import { Router } from "express";
import crypto from "crypto";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";
import openai from "../services/openai";
import { checkDailyGenerationLimit, PLAN_CONFIGS, getUserPlan, incrementEmailsGeneratedToday, ServiceType } from "../services/planLimits";
import logger from "../utils/logger";

const router = Router();

// Helper: process items in parallel batches
async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    for (const r of batchResults) {
      if (r !== null) results.push(r);
    }
  }
  return results;
}

const PARALLEL_BATCH_SIZE = 5;

// Helper: random integer between min and max (inclusive)
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: calculate follow-up date with random delay range
function calculateFollowUpDate(minDays: number, maxDays: number): string {
  const days = randInt(minDays, maxDays);
  const hours = randInt(0, 12); // Add random hours for natural timing
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

// ===== PROMPT VARIATIONS =====
// 3 distinct tones randomly assigned per lead to avoid pattern detection

type ToneKey = "friendly" | "direct" | "curious";
const TONES: ToneKey[] = ["friendly", "direct", "curious"];

function pickTone(): ToneKey {
  return TONES[Math.floor(Math.random() * TONES.length)];
}

// Append opt-out line to email body (CAN-SPAM / GDPR compliance)
function appendOptOut(body: string): string {
  return body.trimEnd() + "\n\nP.S. If this isn't relevant, just reply \"unsubscribe\" and I won't reach out again.";
}

function buildInitialPrompt(lead: any, tone: ToneKey, enriched?: { summary?: string; issues?: string; digitalGaps?: string; noWebsite?: boolean; brokenWebsite?: boolean; auditUrl?: string }, serviceType: ServiceType = "web_dev"): string {
  const company = lead.company;
  const industry = lead.industry || "Local business";
  const address = lead.enriched_data?.address || "";
  const hasNoWebsite = enriched?.noWebsite || (!lead.website || !lead.website.startsWith("http"));
  const hasBrokenWebsite = enriched?.brokenWebsite || false;

  // Service-specific role descriptions
  const serviceRoles: Record<ServiceType, string> = {
    web_dev: "a web designer/developer who builds, redesigns, and develops websites for local businesses",
    seo: "an SEO specialist who helps local businesses rank higher on Google and get more organic traffic",
    digital_marketing: "a digital marketing expert who helps local businesses get more customers through Google Ads, Facebook Ads, analytics, and online strategy",
    social_media: "a social media manager who helps local businesses grow their presence on Instagram, Facebook, TikTok, and other platforms",
  };

  let context: string;
  if (hasNoWebsite) {
    const noWebsiteContexts: Record<ServiceType, string> = {
      web_dev: `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}
⚠️ THIS BUSINESS HAS NO WEBSITE AT ALL — only a Google listing with a phone number.
Digital gaps found:
- No website — customers searching online for ${industry.toLowerCase()} in their area will never find them
- No online presence means zero bookings, zero inquiries, zero reviews happening online
- Competitors in the area ARE showing up online and capturing all the search traffic`,
      seo: `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}
⚠️ THIS BUSINESS HAS NO WEBSITE AT ALL — only a Google listing.
Digital gaps found:
- No website means they CANNOT rank on Google — zero organic search visibility
- When someone Googles "${industry.toLowerCase()} near me" they will never appear in results
- Competitors with even basic websites are capturing ALL the search traffic in their area`,
      digital_marketing: `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}
⚠️ THIS BUSINESS HAS NO WEBSITE AT ALL — only a Google listing with a phone number.
Digital gaps found:
- No website means they can't run Google Ads (no landing page to send traffic to)
- No way to track customer behaviour or measure marketing ROI
- Competitors are running ads and getting ALL the online customers in the area`,
      social_media: `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}
⚠️ THIS BUSINESS HAS NO WEBSITE AT ALL — only a Google listing with a phone number.
Digital gaps found:
- No website AND likely no social media presence — completely invisible online
- Customers who find them on Google Maps have nowhere to learn more or see their work
- Competitors with active social profiles are building trust and getting all the engagement`,
    };
    context = noWebsiteContexts[serviceType];
  } else if (hasBrokenWebsite) {
    context = `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}
⚠️ THIS BUSINESS HAS A BROKEN/UNREACHABLE WEBSITE — their site is down or so broken it won't load.
Website URL: ${lead.website}
Digital gaps found:
- Website is currently down or broken — anyone who searches for them online sees an error page
- A broken website is worse than no website — it signals the business is closed or doesn't care
- Every day the site is down, potential customers bounce to competitors who show up properly`;
  } else if (enriched) {
    context = `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}\nWebsite summary: ${enriched.summary}`;
    if (enriched.digitalGaps) {
      context += `\nDigital gaps found:\n${enriched.digitalGaps}`;
    }
    if (enriched.issues) {
      context += `\nKey issues: ${enriched.issues}`;
    }
    // Add Google review data for marketing/social media pitches
    if ((serviceType === "digital_marketing" || serviceType === "social_media") && lead.enriched_data) {
      const rating = lead.enriched_data.googleRating;
      const reviewCount = lead.enriched_data.googleReviewCount;
      if (rating !== undefined) context += `\nGoogle Rating: ${rating}/5 (${reviewCount || 0} reviews)`;
      if (lead.enriched_data.hasGoogleAds === false) context += `\nNot running Google Ads`;
      if (lead.enriched_data.hasFacebookPixel === false) context += `\nNo Facebook/Meta Pixel detected (not running social ads)`;
      if (lead.enriched_data.hasAnalytics === false) context += `\nNo Google Analytics — not tracking website visitors`;
    }
  } else {
    context = `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}\nWebsite: ${lead.website || "N/A"}\nContact Name: ${lead.name}`;
  }

  const toneInstructions: Record<ToneKey, string> = {
    friendly: `Tone: Warm, genuine, zero pressure. Like a helpful neighbor who happens to know about ${serviceType === "web_dev" ? "websites" : serviceType === "seo" ? "SEO" : serviceType === "digital_marketing" ? "marketing" : "social media"}.`,

    direct: `Tone: Short, blunt, confident. Like a busy CEO who types fast and doesn't waste words.`,

    curious: `Tone: Genuinely curious and observational. Like someone who spotted something interesting and can't help but mention it.`,
  };

  // Service-specific frameworks
  const serviceFrameworks: Record<ServiceType, string> = {
    web_dev: `FRAMEWORK — use this structure:
1. OPEN with a specific, verifiable observation the reader can CHECK THEMSELVES in 10 seconds (e.g. "Pull up your site on your phone right now — the menu overlaps the header and half the page is cut off"). This creates an immediate "oh shit" moment.
2. AMPLIFY by connecting 2-3 digital gaps to MONEY they're losing RIGHT NOW — frame it as customers they're sending straight to competitors. Be specific to their industry.
3. PLANT THE SEED — mention that you fixed this exact thing for a similar business recently (don't name them, just reference the type and results: "fixed this for a ${industry} in the area last month — they went from 2 online bookings/week to 15").
4. CLOSE WITH IRRESISTIBLE CURIOSITY — ask a question so specific they can't help but reply.`,

    seo: `FRAMEWORK — use this structure:
1. OPEN with a specific, verifiable observation about their Google presence (e.g. "Google '${industry.toLowerCase()} near me' in ${address ? address.split(",")[0] : "your city"} right now — you won't find your business in the first 3 pages"). The reader must be able to verify this in 10 seconds.
2. AMPLIFY by connecting their SEO gaps to CUSTOMERS they're losing — people search for their service daily but find competitors instead. Reference their specific PageSpeed score, missing meta descriptions, or mobile issues.
3. PLANT THE SEED — mention that you helped a similar ${industry.toLowerCase()} business appear on page 1 within X weeks (don't name them, keep it vague: "helped a ${industry.toLowerCase()} nearby go from invisible to top 3 in Google Maps last month").
4. CLOSE WITH CURIOSITY — ask something like "curious — do you know where you show up when someone searches '${industry.toLowerCase()} in [their city]' right now?"`,

    digital_marketing: `FRAMEWORK — use this structure:
1. OPEN with a specific, verifiable observation about their marketing (e.g. "I searched for '${industry.toLowerCase()} in ${address ? address.split(",")[0] : "your area"}' — your competitors are running ads at the top but you're nowhere to be found" or "checked your site — no tracking, no pixel, no analytics — you're spending money but have no idea what's working").
2. AMPLIFY by showing how competitors are actively spending money to steal their customers. Reference specifics: no Google Ads, no Facebook pixel, no analytics, low review count vs competitors.
3. PLANT THE SEED — mention you helped a similar business go from 0 online leads to X per month with a simple ads + tracking setup (keep it vague, don't name them).
4. CLOSE WITH CURIOSITY — ask something like "quick question — do you know how many people Google '${industry.toLowerCase()} near me' in your area each month? It's probably higher than you'd expect."`,

    social_media: `FRAMEWORK — use this structure:
1. OPEN with a verifiable observation about their social media absence (e.g. "I looked up ${company} on Instagram — nothing. For a ${industry.toLowerCase()}, that's like having a shop with blacked-out windows" or "Your Google listing has X reviews — most ${industry.toLowerCase()} businesses in the area have 50+").
2. AMPLIFY by showing what competitors are doing on social — posting before/afters, getting reviews, building a following. Their absence means customers can't see their work or verify they're trustworthy.
3. PLANT THE SEED — mention you helped a similar ${industry.toLowerCase()} grow from 0 to X followers and Y inquiries per month through consistent social content.
4. CLOSE WITH CURIOSITY — ask something like "curious — when customers Google you, what do they see to help them decide? Social proof is the #1 thing people look for now."`,
  };

  return `You are a world-class cold email copywriter specializing in outreach for ${serviceRoles[serviceType]}. Your emails consistently get 40%+ reply rates because they follow a proven psychological framework that triggers the reader to WANT a conversation.

${serviceFrameworks[serviceType]}

Lead context:
Company: ${company}
${context}

STRICT RULES:
- BANNED words: "revenue", "optimize", "solution", "leverage", "streamline", "maximize", "boost", "transform", "unlock", "empower", "excited", "thrilled", "growth", "scale", "ROI", "synergy", "game-changer"
- Do NOT open with "I was checking/looking at your site" — that's generic. Instead open DIRECTLY with the verifiable observation
- ALWAYS include at least one "go check it yourself" moment — something the reader can verify in seconds
- Mention their city/location if available — hyper-local = hyper-relevant
- Reference their industry competitors WITHOUT naming them
- Weave up to 3 digital gaps naturally as observations with real-world consequences — NEVER bullet-point them
- Every gap mentioned must tie to MONEY or CUSTOMERS lost
- 80-100 words (long enough to be specific, short enough to read on mobile)
- Write like a real person, not a marketer. Contractions, fragments, casual language all fine
- End with a CURIOSITY question they MUST answer — make it so specific to their situation that ignoring it feels wrong
- Do NOT use placeholder brackets like [Your Name] or [Agency Name]
- Do NOT start with greetings like "I hope this finds you well", "Hi there", etc.
- Subject line: lowercase, 3-6 words, sounds like a friend texting — include their company name or city when possible. Should create enough curiosity to open.

${toneInstructions[tone]}
${enriched?.auditUrl ? `
AUDIT REPORT LINK: ${enriched.auditUrl}
You MUST include this link in the email body. Introduce it naturally — e.g. "I put together a quick breakdown of what I found: ${enriched.auditUrl}" or "Here's a 30-second snapshot of where things stand: ${enriched.auditUrl}". Do NOT say "audit report" — call it a "quick breakdown", "snapshot", or "overview". Place the link after you mention 1-2 specific issues, NOT at the very beginning or very end of the email. The link should feel like a helpful bonus, not the main pitch.` : ""}

Return ONLY a JSON object with "subject" and "body" fields.`;
}

function buildFollowup1Prompt(company: string, issues: string, tone: ToneKey, topGap?: string): string {
  const toneStyle: Record<ToneKey, string> = {
    friendly: `Style: "Hey — just circling back on this. No rush at all, just curious if you had a sec to think about it?"`,
    direct: `Style: "Bumping this — did you get a chance to look?"`,
    curious: `Style: "Hey — still thinking about that thing I noticed on your site. Worth chatting about?"`,
  };

  const gapContext = topGap || issues || "their website";

  return `Write a quick follow-up email — feels like a real person bumping their own thread.

Context:
- You emailed ${company} a few days ago, no reply
- Thing you mentioned: ${gapContext}

Rules:
- Under 40 words
- Super casual
- No marketing language at all
- Don't re-pitch, just nudge — vaguely reference what you mentioned before
- End with a simple question
- Do NOT use placeholder brackets

${toneStyle[tone]}

Return ONLY JSON with "subject" and "body" fields.`;
}

function buildFollowup2Prompt(company: string, tone: ToneKey): string {
  const toneStyle: Record<ToneKey, string> = {
    friendly: `Style: "Hey — totally fine if the timing's off. Just wanted to close the loop. Hope things are going well!"`,
    direct: `Style: "Last ping on this. No worries either way."`,
    curious: `Style: "Figured I'd check one last time — if not, no sweat at all."`,
  };

  return `Write a final follow-up email — sounds like a real person closing the loop.

Context:
- You emailed ${company} twice, no reply
- This is your last email

Rules:
- Under 30 words
- Very casual and low-pressure
- No guilt-tripping or marketing speak
- Just a simple "no worries if not" vibe
- Do NOT use placeholder brackets

${toneStyle[tone]}

Return ONLY JSON with "subject" and "body" fields.`;
}

// ===== AUTO-GENERATE AUDIT TOKEN =====
async function ensureAuditToken(lead: any): Promise<string | undefined> {
  const ed = lead.enriched_data || {};
  // Skip if no enrichment data at all (nothing to show in audit)
  const hasEnrichment = ed.hasOnlineBooking !== undefined || ed.hasContactForm !== undefined || ed.hasSSL !== undefined;
  if (!hasEnrichment) return undefined;

  // Already has a token
  if (ed.audit_token) {
    return `${process.env.FRONTEND_URL || "http://localhost:3000"}/audit/${ed.audit_token}`;
  }

  // Generate new token and store it
  const token = crypto.randomBytes(12).toString("base64url");
  const { error } = await supabase
    .from("leads")
    .update({ enriched_data: { ...ed, audit_token: token } })
    .eq("id", lead.id);

  if (error) {
    logger.error({ leadId: lead.id, error }, "Failed to auto-generate audit token");
    return undefined;
  }

  return `${process.env.FRONTEND_URL || "http://localhost:3000"}/audit/${token}`;
}

// ===== LEAD QUALITY FILTER =====
function isValidLead(lead: any): { valid: boolean; reason?: string } {
  if (!lead.company || lead.company.trim().length < 2) {
    return { valid: false, reason: "no_company" };
  }
  if (!lead.email || !lead.email.includes("@")) {
    return { valid: false, reason: "no_email" };
  }

  const email = lead.email.toLowerCase();
  const [localPart, domain] = email.split("@");

  // Check for obvious junk emails
  const junkPatterns = ["noreply", "no-reply", "donotreply", "test@", "example.com"];
  if (junkPatterns.some(p => email.includes(p))) {
    return { valid: false, reason: "junk_email" };
  }

  // Reject file-like emails (e.g. flags@2x.webp, icon@3x.png)
  const junkExtensions = [".webp", ".png", ".jpg", ".gif", ".svg", ".ico", ".js", ".css", ".json", ".woff", ".woff2", ".ttf"];
  if (junkExtensions.some(ext => email.endsWith(ext))) {
    return { valid: false, reason: "file_extension_email" };
  }

  // Local part too short or only digits
  if (!localPart || localPart.length < 2 || /^\d+$/.test(localPart)) {
    return { valid: false, reason: "invalid_local_part" };
  }

  // Domain too short (e.g. @2x)
  if (!domain || domain.split(".").length < 2 || domain.length < 4) {
    return { valid: false, reason: "invalid_domain" };
  }

  return { valid: true };
}

// ===== CALL SCRIPT GENERATION =====
function buildCallScriptPrompt(lead: any, enriched?: { summary?: string; issues?: string }): string {
  const industry = lead.industry || "Local business";
  const address = lead.enriched_data?.address || "";
  return `Write a very short phone call script for cold-calling a local business.

Lead context:
Company: ${lead.company}
Industry: ${industry}${address ? `\nLocation: ${address}` : ""}
Phone: ${lead.phone || "N/A"}
${enriched ? `Website summary: ${enriched.summary}\nIssues: ${enriched.issues}` : ""}

Rules:
- Opening line + 1 question + 1 value statement
- Under 50 words total
- Sound natural, not scripted
- Casual and friendly
- End with asking for a quick meeting or call back

Return ONLY JSON with "opening" and "script" fields.`;
}

// POST /api/generate — Generate AI cold emails for a campaign
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { campaignId, leadIds } = req.body;

    if (!campaignId) {
      res.status(400).json({ error: "Campaign ID is required" });
      return;
    }

    // Check daily generation limit (OpenAI cost protection)
    const genCheck = await checkDailyGenerationLimit(req.userId!);
    if (!genCheck.allowed) {
      res.status(403).json({
        error: `Daily AI generation limit reached (${genCheck.usedToday}/${genCheck.dailyLimit} on ${genCheck.plan} plan). Try again tomorrow.`,
        usedToday: genCheck.usedToday,
        dailyLimit: genCheck.dailyLimit,
        plan: genCheck.plan,
      });
      return;
    }

    // Get user's service type for email personalization
    const basicUserPlan = await getUserPlan(req.userId!);
    const basicServiceType: ServiceType = basicUserPlan.serviceType;

    // Fetch leads for the campaign (only email-contactable leads)
    let query = supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", req.userId)
      .neq("contact_method", "call");

    // If specific lead IDs provided, filter to only those
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      query = query.in("id", leadIds);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError || !leads || leads.length === 0) {
      res.status(404).json({ error: "No leads found for this campaign" });
      return;
    }

    // Skip leads that already have emails (prevents duplicate generation via Postman)
    const { data: existingEmails } = await supabase
      .from("emails")
      .select("lead_id")
      .eq("campaign_id", campaignId)
      .eq("user_id", req.userId);

    const existingLeadIds = new Set((existingEmails || []).map((e: any) => e.lead_id));
    const newLeads = leads.filter(lead => !existingLeadIds.has(lead.id));

    if (newLeads.length === 0) {
      res.json({ message: "Emails already generated for all leads in this campaign", count: 0, skipped: leads.length });
      return;
    }

    // Cap leads to remaining daily generation slots
    const maxLeads = genCheck.remaining;
    const cappedLeads = newLeads.slice(0, maxLeads);

    const generatedEmails: any[] = [];
    let skippedCount = 0;

    // Filter valid leads first
    const validLeads = cappedLeads.filter(lead => {
      const check = isValidLead(lead);
      if (!check.valid) { skippedCount++; return false; }
      return true;
    });

    // Generate emails in parallel batches of 5
    const results = await processBatch(validLeads, PARALLEL_BATCH_SIZE, async (lead) => {
      const tone = pickTone();
      const hasNoWebsite = !lead.website || !lead.website.startsWith("http");
      const enrichedData = lead.enriched_data || {};
      const hasBrokenWebsite = !hasNoWebsite && (enrichedData._siteDown === true || (!enrichedData.title && !enrichedData.description && (!enrichedData.technologies || enrichedData.technologies.length === 0)));
      const auditUrl = await ensureAuditToken(lead);
      const summary = enrichedData.summary || lead.company;
      const prompt = buildInitialPrompt(lead, tone, hasNoWebsite ? { noWebsite: true, auditUrl } : hasBrokenWebsite ? { brokenWebsite: true, auditUrl } : { summary, auditUrl }, basicServiceType);

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.85,
          response_format: { type: "json_object" },
        });

        const content = completion.choices[0].message.content;
        if (content) {
          const emailData = JSON.parse(content);
          if (emailData.subject && emailData.body) {
            return {
              lead_id: lead.id,
              campaign_id: campaignId,
              user_id: req.userId,
              to_email: lead.email,
              subject: emailData.subject,
              body: appendOptOut(emailData.body),
              status: "pending",
              sequence_step: 1,
              tone_variant: tone,
            };
          }
        }
      } catch (err) {
        logger.error({ leadId: lead.id, error: err instanceof Error ? err.message : err }, "Generate error for lead");
      }
      return null;
    });

    generatedEmails.push(...results);

    if (generatedEmails.length === 0) {
      res.status(500).json({ error: "Failed to generate any emails" });
      return;
    }

    // Store generated emails in DB
    const { error: insertError } = await supabase
      .from("emails")
      .insert(generatedEmails);

    if (insertError) {
      res.status(500).json({ error: "Failed to save generated emails" });
      return;
    }

    // Increment monotonic daily generation counter (never decrements)
    await incrementEmailsGeneratedToday(req.userId!, generatedEmails.length);

    await supabase
      .from("campaigns")
      .update({ status: "draft" })
      .eq("id", campaignId)
      .eq("user_id", req.userId);

    res.json({
      message: "Emails generated successfully",
      count: generatedEmails.length,
      skipped: skippedCount,
      capped: leads.length > maxLeads ? leads.length - maxLeads : 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to generate emails" });
  }
});

// POST /api/generate/advanced — Generate highly personalized emails using enriched lead data
router.post("/advanced", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { campaignId, enableFollowups = false, leadIds } = req.body;

    if (!campaignId) {
      res.status(400).json({ error: "Campaign ID is required" });
      return;
    }

    // Check daily generation limit (OpenAI cost protection)
    const genCheck = await checkDailyGenerationLimit(req.userId!);
    if (!genCheck.allowed) {
      res.status(403).json({
        error: `Daily AI generation limit reached (${genCheck.usedToday}/${genCheck.dailyLimit} on ${genCheck.plan} plan). Try again tomorrow.`,
        usedToday: genCheck.usedToday,
        dailyLimit: genCheck.dailyLimit,
        plan: genCheck.plan,
      });
      return;
    }

    // Calculate how many leads we can process (each lead = 1 or 3 generations)
    const generationsPerLead = enableFollowups ? 3 : 1;
    const maxLeads = Math.floor(genCheck.remaining / generationsPerLead);

    if (maxLeads === 0) {
      res.status(403).json({
        error: `Not enough daily generation quota remaining. Need ${generationsPerLead} per lead, only ${genCheck.remaining} left.`,
      });
      return;
    }

    // Get user's service type to tailor email generation
    const userPlan = await getUserPlan(req.userId!);
    const userServiceType: ServiceType = userPlan.serviceType;

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("user_id", req.userId)
      .single();

    if (campaignError || !campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Fetch leads with enriched data (high-quality leads with score >= 40, email only)
    let query = supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", req.userId)
      .neq("contact_method", "call")
      .order("score", { ascending: false });

    // If specific lead IDs provided, filter to only those
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      query = query.in("id", leadIds);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError || !leads || leads.length === 0) {
      res.status(404).json({
        error: "No high-quality (scored) leads found. Please enrich leads first.",
      });
      return;
    }

    // Skip leads that already have emails (prevents duplicate generation via Postman)
    const { data: existingEmails } = await supabase
      .from("emails")
      .select("lead_id")
      .eq("campaign_id", campaignId)
      .eq("user_id", req.userId);

    const existingLeadIds = new Set((existingEmails || []).map((e: any) => e.lead_id));
    const newLeads = leads.filter(lead => !existingLeadIds.has(lead.id));

    if (newLeads.length === 0) {
      res.json({ message: "Emails already generated for all leads in this campaign", count: 0, skipped: leads.length });
      return;
    }

    // Cap leads to remaining daily generation slots
    const cappedLeads = newLeads.slice(0, maxLeads);

    const generatedEmails: any[] = [];
    let skippedCount = 0;

    // Filter valid leads first
    const validLeads = cappedLeads.filter(lead => {
      const check = isValidLead(lead);
      if (!check.valid) { skippedCount++; return false; }
      return true;
    });

    // Generate emails in parallel batches of 5
    const results = await processBatch(validLeads, PARALLEL_BATCH_SIZE, async (lead) => {
      const enrichedData = lead.enriched_data || {};
      const summary = enrichedData.summary || lead.company;
      const issues = (enrichedData.issues || []).slice(0, 2).join(", ");
      const tone = pickTone();
      const emails: any[] = [];

      // Build specific digital gaps list from enrichment data, prioritized by industry relevance
      const industry = (enrichedData.industry || lead.industry || "").toLowerCase();
      const isSPA = enrichedData.isSPA || false;
      const allGaps: { gap: string; priority: number }[] = [];

      // --- CRITICAL "go check it yourself" gaps (highest conversion) ---

      // No SSL — browser literally warns visitors
      if (enrichedData.hasSSL === false) {
        allGaps.push({ gap: "No SSL certificate — Chrome shows 'Not Secure' warning to every visitor (open the site in Chrome and see for yourself)", priority: 110 });
      }

      // Not mobile-friendly — broken on phones
      if (!isSPA && enrichedData.isMobileFriendly === false) {
        allGaps.push({ gap: "Website is not mobile-friendly — try opening it on your phone, the layout breaks and text is unreadable", priority: 105 });
      }

      // Slow page load (>3s)
      if (enrichedData.pageLoadTimeMs && enrichedData.pageLoadTimeMs > 3000) {
        const secs = (enrichedData.pageLoadTimeMs / 1000).toFixed(1);
        allGaps.push({ gap: `Website takes ${secs} seconds to load — over half of visitors leave a site that takes more than 3 seconds`, priority: 95 });
      }

      // Parked domain
      if (enrichedData.isParkedDomain) {
        allGaps.push({ gap: "Domain is parked or 'under construction' — effectively no website exists for customers", priority: 115 });
      }

      // --- FUNCTIONAL gaps ---

      // Booking — highest for service businesses
      if (!isSPA && enrichedData.hasOnlineBooking === false) {
        const bookingIndustries = ["dental", "medical", "salon", "fitness", "restaurant", "plumbing", "hvac", "automotive", "spa", "clinic", "vet", "chiropract"];
        const isBookingCritical = bookingIndustries.some(i => industry.includes(i));
        allGaps.push({ gap: "No online booking system — customers can't schedule appointments from the website, they have to call", priority: isBookingCritical ? 100 : 70 });
      }

      // Contact form
      if (!isSPA && enrichedData.hasContactForm === false) {
        const contactIndustries = ["legal", "real estate", "medical", "dental", "consulting", "accounting"];
        const isContactCritical = contactIndustries.some(i => industry.includes(i));
        allGaps.push({ gap: "No contact form — potential customers have no easy way to reach out except calling", priority: isContactCritical ? 95 : 65 });
      }

      // No social media
      if (!enrichedData.socialLinks || enrichedData.socialLinks.length === 0) {
        allGaps.push({ gap: "Zero social media presence — invisible to customers who search on Instagram, Facebook, or Google Maps", priority: 60 });
      } else if (enrichedData.socialLinks.length <= 1) {
        allGaps.push({ gap: "Weak social media (only on 1 platform) — missing customers on the platforms they actually use", priority: 40 });
      }

      // --- SEO / credibility gaps ---

      // No meta description
      if (enrichedData.hasMetaDescription === false) {
        allGaps.push({ gap: "Missing meta description — when someone Googles the business, the search result shows a blank or auto-generated snippet", priority: 55 });
      }

      // Outdated copyright
      const currentYear = new Date().getFullYear();
      if (enrichedData.copyrightYear && enrichedData.copyrightYear < currentYear - 1) {
        allGaps.push({ gap: `Copyright in the footer says © ${enrichedData.copyrightYear} — makes the business look inactive or closed`, priority: 50 });
      }

      // Outdated tech
      if (enrichedData.technologies?.includes("WordPress")) {
        allGaps.push({ gap: "Running on WordPress — can be slow, vulnerable to hacks, and expensive to maintain", priority: 50 });
      }
      if (enrichedData.technologies?.some((t: string) => ["Joomla", "Drupal"].includes(t))) {
        allGaps.push({ gap: `Built on ${enrichedData.technologies.find((t: string) => ["Joomla", "Drupal"].includes(t))} — severely outdated platform that's hard and costly to update`, priority: 55 });
      }

      // No platform detected
      if (!enrichedData.technologies || enrichedData.technologies.length === 0) {
        allGaps.push({ gap: "Basic/outdated website with no modern platform — likely looks unprofessional on mobile", priority: 45 });
      }

      // --- MARKETING / ADS gaps (higher priority for digital_marketing service type) ---
      const isMarketingUser = userServiceType === "digital_marketing";
      const isSocialUser = userServiceType === "social_media";

      // No Google Ads
      if (enrichedData.hasGoogleAds === false) {
        allGaps.push({ gap: "Not running Google Ads — competitors are paying to appear at the top while they're invisible in search", priority: isMarketingUser ? 100 : 35 });
      }

      // No Facebook Pixel
      if (enrichedData.hasFacebookPixel === false) {
        allGaps.push({ gap: "No Facebook/Meta Pixel — can't retarget website visitors or run effective social ads", priority: isMarketingUser || isSocialUser ? 90 : 30 });
      }

      // No analytics
      if (enrichedData.hasAnalytics === false) {
        allGaps.push({ gap: "No Google Analytics — completely blind to how many people visit the site and what they do", priority: isMarketingUser ? 85 : 30 });
      }

      // Low Google rating / few reviews
      if (enrichedData.googleRating !== undefined && enrichedData.googleRating < 4.0) {
        allGaps.push({ gap: `Google rating is ${enrichedData.googleRating}/5 — below the trust threshold where customers start looking at competitors instead`, priority: isMarketingUser || isSocialUser ? 80 : 35 });
      }
      if (enrichedData.googleReviewCount !== undefined && enrichedData.googleReviewCount < 10) {
        allGaps.push({ gap: `Only ${enrichedData.googleReviewCount} Google reviews — competitors with 50+ reviews look far more trustworthy to new customers`, priority: isSocialUser ? 85 : isMarketingUser ? 75 : 30 });
      }

      // Detect no-website and broken-website leads
      const hasNoWebsite = !lead.website || !lead.website.startsWith("http");
      const hasBrokenWebsite = !hasNoWebsite && !enrichedData.title && !enrichedData.description && (!enrichedData.technologies || enrichedData.technologies.length === 0) && !enrichedData.hasOnlineBooking && !enrichedData.hasContactForm && (!enrichedData.socialLinks || enrichedData.socialLinks.length === 0);

      // Sort by priority (highest first) and take top 3
      allGaps.sort((a, b) => b.priority - a.priority);
      const topGaps = allGaps.slice(0, 3);
      const gaps = topGaps.map(g => `- ${g.gap}`);
      const digitalGaps = gaps.length > 0 ? gaps.join("\n") : "";

      // Initial email — auto-generate audit token if enrichment exists
      const auditUrl = await ensureAuditToken(lead);
      const initialPrompt = buildInitialPrompt(lead, tone, { summary, issues, digitalGaps, noWebsite: hasNoWebsite, brokenWebsite: hasBrokenWebsite, auditUrl }, userServiceType);
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: initialPrompt }],
          temperature: 0.85,
          response_format: { type: "json_object" },
        });

        const content = completion.choices[0].message.content;
        if (content) {
          const emailData = JSON.parse(content);
          if (emailData.subject && emailData.body) {
            emails.push({
              lead_id: lead.id,
              campaign_id: campaignId,
              user_id: req.userId,
              to_email: lead.email,
              subject: emailData.subject,
              body: appendOptOut(emailData.body),
              status: "pending",
              sequence_step: 1,
              scheduled_at: new Date().toISOString(),
              tone_variant: tone,
            });

            // Generate follow-ups in parallel if enabled
            if (enableFollowups) {
              const [f1Result, f2Result] = await Promise.all([
                // Follow-up 1
                (async () => {
                  try {
                    const topGap = gaps.length > 0 ? gaps[0].replace("- ", "") : undefined;
                    const f1Prompt = buildFollowup1Prompt(lead.company, issues, tone, topGap);
                    const f1 = await openai.chat.completions.create({
                      model: "gpt-4o",
                      messages: [{ role: "user", content: f1Prompt }],
                      temperature: 0.8,
                      response_format: { type: "json_object" },
                    });
                    const f1Content = f1.choices[0].message.content;
                    if (f1Content) {
                      const f1Data = JSON.parse(f1Content);
                      if (f1Data.subject && f1Data.body) {
                        return {
                          lead_id: lead.id,
                          campaign_id: campaignId,
                          user_id: req.userId,
                          to_email: lead.email,
                          subject: f1Data.subject,
                          body: appendOptOut(f1Data.body),
                          status: "pending",
                          sequence_step: 2,
                          scheduled_at: calculateFollowUpDate(2, 4),
                          tone_variant: tone,
                        };
                      }
                    }
                  } catch { logger.error({ leadId: lead.id }, "Failed follow-up 1"); }
                  return null;
                })(),
                // Follow-up 2
                (async () => {
                  try {
                    const f2Prompt = buildFollowup2Prompt(lead.company, tone);
                    const f2 = await openai.chat.completions.create({
                      model: "gpt-4o",
                      messages: [{ role: "user", content: f2Prompt }],
                      temperature: 0.7,
                      response_format: { type: "json_object" },
                    });
                    const f2Content = f2.choices[0].message.content;
                    if (f2Content) {
                      const f2Data = JSON.parse(f2Content);
                      if (f2Data.subject && f2Data.body) {
                        return {
                          lead_id: lead.id,
                          campaign_id: campaignId,
                          user_id: req.userId,
                          to_email: lead.email,
                          subject: f2Data.subject,
                          body: appendOptOut(f2Data.body),
                          status: "pending",
                          sequence_step: 3,
                          scheduled_at: calculateFollowUpDate(5, 7),
                          tone_variant: tone,
                        };
                      }
                    }
                  } catch { logger.error({ leadId: lead.id }, "Failed follow-up 2"); }
                  return null;
                })(),
              ]);

              if (f1Result) emails.push(f1Result);
              if (f2Result) emails.push(f2Result);
            }
          }
        }
      } catch (err) {
        logger.error({ leadId: lead.id, error: err instanceof Error ? err.message : err }, "Generate error for lead");
      }
      return emails.length > 0 ? emails : null;
    });

    // Flatten results (each result is an array of emails for one lead)
    for (const leadEmails of results) {
      generatedEmails.push(...leadEmails);
    }

    if (generatedEmails.length === 0) {
      res.status(500).json({ error: "Failed to generate emails" });
      return;
    }

    const { error: insertError } = await supabase
      .from("emails")
      .insert(generatedEmails);

    if (insertError) {
      res.status(500).json({ error: "Failed to save generated emails" });
      return;
    }

    // Increment monotonic daily generation counter (never decrements)
    await incrementEmailsGeneratedToday(req.userId!, generatedEmails.length);

    if (enableFollowups) {
      await supabase
        .from("campaigns")
        .update({ enable_followups: true })
        .eq("id", campaignId)
        .eq("user_id", req.userId);
    }

    res.json({
      message: "Advanced emails generated successfully",
      count: generatedEmails.length,
      initialEmails: cappedLeads.length,
      skipped: skippedCount,
      followUpsIncluded: enableFollowups,
      capped: leads.length > maxLeads ? leads.length - maxLeads : 0,
    });
  } catch (error) {
    logger.error({ error }, "Advanced generate error");
    res.status(500).json({ error: "Failed to generate emails" });
  }
});

// POST /api/generate/call-scripts — Generate call scripts for call-only leads
router.post("/call-scripts", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { campaignId, leadIds } = req.body;

    if (!campaignId) {
      res.status(400).json({ error: "Campaign ID is required" });
      return;
    }

    // Check daily generation limit (OpenAI cost protection)
    const genCheck = await checkDailyGenerationLimit(req.userId!);
    if (!genCheck.allowed) {
      res.status(403).json({
        error: `Daily AI generation limit reached (${genCheck.usedToday}/${genCheck.dailyLimit} on ${genCheck.plan} plan). Try again tomorrow.`,
        usedToday: genCheck.usedToday,
        dailyLimit: genCheck.dailyLimit,
        plan: genCheck.plan,
      });
      return;
    }

    // Fetch call-only leads
    let callQuery = supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", req.userId)
      .eq("contact_method", "call");

    // If specific lead IDs provided, filter to only those
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      callQuery = callQuery.in("id", leadIds);
    }

    const { data: leads, error: leadsError } = await callQuery;

    if (leadsError || !leads || leads.length === 0) {
      res.status(404).json({ error: "No call leads found for this campaign" });
      return;
    }

    const validLeads = leads.filter(l => l.company && l.company.trim().length >= 2);

    // Cap to remaining daily generation slots
    const cappedLeads = validLeads.slice(0, genCheck.remaining);

    // Generate call scripts in parallel batches of 5
    const scripts = await processBatch(cappedLeads, PARALLEL_BATCH_SIZE, async (lead) => {
      const enrichedData = lead.enriched_data || {};
      const prompt = buildCallScriptPrompt(lead, {
        summary: enrichedData.summary,
        issues: (enrichedData.issues || []).join(", "),
      });

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          response_format: { type: "json_object" },
        });

        const content = completion.choices[0].message.content;
        if (content) {
          const scriptData = JSON.parse(content);

          // Save call script to lead's enriched_data
          await supabase
            .from("leads")
            .update({
              enriched_data: {
                ...enrichedData,
                call_script: scriptData,
              },
            })
            .eq("id", lead.id)
            .eq("user_id", req.userId);

          return {
            lead_id: lead.id,
            company: lead.company,
            phone: lead.phone,
            opening: scriptData.opening || "",
            script: scriptData.script || "",
          };
        }
      } catch (err) {
        logger.error({ leadId: lead.id, error: err instanceof Error ? err.message : err }, "CallScript error for lead");
      }
      return null;
    });

    res.json({
      message: "Call scripts generated",
      count: scripts.length,
      scripts,
    });
  } catch {
    res.status(500).json({ error: "Failed to generate call scripts" });
  }
});

export default router;
