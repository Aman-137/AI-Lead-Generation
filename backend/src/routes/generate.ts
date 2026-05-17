import { Router } from "express";
import crypto from "crypto";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";
import openai from "../services/openai";
import { checkDailyGenerationLimit, PLAN_CONFIGS, getUserPlan, incrementEmailsGeneratedToday, ServiceType } from "../services/planLimits";
import { getPageSpeedScores } from "../services/pageSpeed";
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

  // Extract city from address for hyper-local references
  const city = address ? address.split(",")[0].trim() : "";

  let context: string;
  if (hasNoWebsite) {
    context = `Industry: ${industry}${city ? `\nCity: ${city}` : ""}${address ? `\nFull address: ${address}` : ""}
⚠️ THIS BUSINESS HAS NO WEBSITE — only a Google listing with a phone number.
What this means:
- When someone in ${city || "their area"} Googles "${industry.toLowerCase()} near me", this business will never show up in organic results
- Every potential customer goes to a competitor who HAS a website
- They are completely invisible online — no way for anyone to check their services, prices, or reviews before calling`;
  } else if (hasBrokenWebsite) {
    context = `Industry: ${industry}${city ? `\nCity: ${city}` : ""}${address ? `\nFull address: ${address}` : ""}
⚠️ BROKEN WEBSITE — ${lead.website} is down or unreachable.
What this means:
- Anyone searching for them online right now sees an error page
- A broken site is worse than no site — it screams "this business is closed" to customers
- Every day it stays broken, they lose walk-in and phone customers who check online first`;
  } else if (enriched) {
    context = `Industry: ${industry}${city ? `\nCity: ${city}` : ""}${address ? `\nFull address: ${address}` : ""}\nWebsite: ${lead.website}\nWhat their site does: ${enriched.summary}`;
    if (enriched.digitalGaps) {
      context += `\nSpecific problems found on their site:\n${enriched.digitalGaps}`;
    }
    if (enriched.issues) {
      context += `\nTechnical issues: ${enriched.issues}`;
    }
    if ((serviceType === "digital_marketing" || serviceType === "social_media") && lead.enriched_data) {
      const rating = lead.enriched_data.googleRating;
      const reviewCount = lead.enriched_data.googleReviewCount;
      if (rating !== undefined) context += `\nGoogle Rating: ${rating}/5 (${reviewCount || 0} reviews)`;
      if (lead.enriched_data.hasGoogleAds === false) context += `\nNot running Google Ads`;
      if (lead.enriched_data.hasFacebookPixel === false) context += `\nNo Facebook/Meta Pixel (not retargeting visitors)`;
      if (lead.enriched_data.hasAnalytics === false) context += `\nNo Google Analytics (flying blind — no visitor data)`;
    }
  } else {
    context = `Industry: ${industry}${city ? `\nCity: ${city}` : ""}${address ? `\nFull address: ${address}` : ""}\nWebsite: ${lead.website || "N/A"}\nContact: ${lead.name}`;
  }

  const toneInstructions: Record<ToneKey, string> = {
    friendly: `TONE: Write like a genuinely helpful person who noticed something and wants to point it out — zero sales pressure. Think "friendly local expert who saw something and couldn't NOT say something." Use contractions, conversational fragments. Sound human.`,

    direct: `TONE: Write like someone who's busy, confident, and doesn't waste words. No fluff, no pleasantries — get straight to the point. Think "friend who shoots you a quick text about something important." Short sentences, punchy.`,

    curious: `TONE: Write like someone who's genuinely puzzled by what they found. Not pitching — just confused why a clearly good business has this obvious problem. Think "wait, this doesn't make sense for a business like yours." Questions feel authentic, not selling.`,
  };

  // Service-specific writing approach
  const serviceApproach: Record<ServiceType, string> = {
    web_dev: `YOUR ANGLE: You build websites for local ${industry.toLowerCase()} businesses${city ? ` in ${city}` : ""}.

WRITING STRUCTURE:
1. OPEN with ONE hyper-specific thing wrong with their site that the reader can verify in 10 seconds. Not "your site has issues" — describe the EXACT problem: what page, what element, what happens. If their site is not mobile-friendly, tell them to pull it up on their phone and describe what they'll see. If the loading time is bad, tell them to try loading it and count the seconds. The reader should think "wait, let me go check that right now."
2. CONNECT to real-world consequences in ONE sentence — how does this specific thing cost them customers? Be concrete: "That means anyone searching '${industry.toLowerCase()} in ${city || "your area"}' on their phone bounces within 3 seconds."
3. SOCIAL PROOF in ONE casual sentence — reference a real-sounding result with a specific ${industry.toLowerCase()} (not by name): "Fixed this exact thing for a ${industry.toLowerCase()} down the road — their online bookings went from 2/week to 11." Use realistic, SMALL numbers. Never say "doubled" or "tripled."
4. END with a specific question they want to answer — not "want to chat?" but something about their specific situation: "Out of curiosity — do you know what your site looks like on an iPhone right now?"`,

    seo: `YOUR ANGLE: You do SEO for local ${industry.toLowerCase()} businesses${city ? ` in ${city}` : ""}.

WRITING STRUCTURE:
1. OPEN with a specific, verifiable observation about where they rank. Tell them to Google something specific and describe what they'll find (or won't find). Example: "Google '${industry.toLowerCase()} ${city || "near me"}' — scroll through the first 3 pages. You're not there. But [vague competitor description] on [street/area] is #2."
2. CONNECT to consequences in ONE sentence — how many customers per day search for this and click competitors instead.
3. SOCIAL PROOF in ONE casual sentence — "Helped a ${industry.toLowerCase()} a few miles from you go from page 6 to the top 3 map results in about 5 weeks." Use realistic, modest numbers and timeframes.
4. END with a question about their Google presence: "Do you know where you show up when someone searches '${industry.toLowerCase()} in ${city || "your area"}' right now?"`,

    digital_marketing: `YOUR ANGLE: You do digital marketing for local ${industry.toLowerCase()} businesses${city ? ` in ${city}` : ""}.

WRITING STRUCTURE:
1. OPEN with a specific, verifiable observation about their online marketing (or lack of it). Tell them what you found when you searched for their type of business: "Searched '${industry.toLowerCase()} in ${city || "your area"}' — your competitors are running Google Ads at the top of every search. You're not."
2. CONNECT to consequences in ONE sentence — people searching right now are clicking on competitors' ads instead.
3. SOCIAL PROOF in ONE casual sentence — "Set up ads + tracking for a ${industry.toLowerCase()} nearby — they went from zero online leads to about 8-12/week within the first month." Use realistic, modest numbers.
4. END with a question about their customer acquisition: "Quick question — do you track where your new customers actually come from right now?"`,

    social_media: `YOUR ANGLE: You manage social media for local ${industry.toLowerCase()} businesses${city ? ` in ${city}` : ""}.

WRITING STRUCTURE:
1. OPEN with a specific observation about their social media absence or state. What did you find (or not find) when you looked them up? "Looked up ${company} on Instagram — nothing comes up. For a ${industry.toLowerCase()}, that's like having a storefront with no sign."
2. CONNECT to consequences in ONE sentence — customers check social media before choosing a business. No presence = no trust.
3. SOCIAL PROOF in ONE casual sentence — "Helped a ${industry.toLowerCase()} nearby go from zero social presence to 400+ followers and 5-6 DM inquiries a week in about 2 months." Use realistic, modest numbers.
4. END with a question about how customers find/trust them: "When someone Googles your business, what do they see that makes them choose you over the place down the street?"`,
  };

  return `Write a cold email that reads like a personal message, NOT a marketing email.

The reader should feel like a real human noticed something about their business and took 2 minutes to write them about it. The email should feel so personal and specific that they think "this person actually looked at my business" — not "this is a mass email."

${serviceApproach[serviceType]}

LEAD DATA:
Company name: ${company}
Contact name: ${lead.name || ""}
${context}

CRITICAL RULES:
- NEVER use placeholder brackets like [City], [Your Name], [Industry], [X%], [Number] — NEVER. If you don't have a piece of data, either use the actual data provided above or skip that detail entirely. Using brackets = immediate fail.
- ${city ? `Use "${city}" as their city — it's confirmed data.` : "Do NOT guess their city. Skip location references if no city is provided."}
- BANNED words/phrases: "revenue", "optimize", "solution", "leverage", "streamline", "maximize", "boost", "transform", "unlock", "empower", "excited", "thrilled", "growth", "scale", "ROI", "synergy", "game-changer", "I was just browsing", "I came across", "I hope this finds you"
- Do NOT start with a greeting ("Hi", "Hey", "Hello", "I hope this"). Start directly with the observation.
- 75-110 words maximum. Every word must earn its place — if a sentence doesn't add specificity or curiosity, delete it.
- Do NOT use bullet points or numbered lists — this is a personal message, not a report.
- Write in plain English. If your grandmother wouldn't say it in conversation, rewrite it.
- Social proof numbers must be REALISTIC and modest — not "10x", not "doubled revenue", not "hundreds of leads." Think: "went from 2 to 11 bookings/week" or "started getting 5-6 calls a week from Google."
- Every claim must sound like something a small local business would actually experience.
- Leave a blank line (\\n\\n) between paragraphs for readability.
- The closing question must be SO specific to their business that they feel compelled to answer or at least think about it.

SUBJECT LINE RULES:
- Sentence case (capitalize the first letter), 3-6 words
- Must sound like a friend texting about something they noticed — NOT like a marketing email subject
- Include their PROPER company name (exactly as provided, with correct capitalization) when natural
- Create curiosity without being clickbaity
- Examples of GOOD subjects: "Noticed something on ${company}'s site", "${city || industry} question for you", "Quick ${company} question"
- Examples of BAD subjects: "Boost Your Business!", "Your Website Needs Help", "Partnership Opportunity"

${toneInstructions[tone]}
${enriched?.auditUrl ? `
AUDIT LINK: ${enriched.auditUrl}
Include this link naturally in the email after mentioning 1-2 specific issues. Introduce it as "a quick snapshot of what I found" or "put together a quick breakdown" — NOT "audit report." The link MUST be on its own line with \\n before it. Do NOT put any punctuation right after the URL. The link should feel like a helpful extra, not the main pitch. Example:
"Here's a quick breakdown of what I found:
${enriched.auditUrl}"` : ""}

Return ONLY a JSON object with "subject" and "body" fields. The body should NOT include a sign-off name or signature.`;
}

function buildFollowup1Prompt(company: string, issues: string, tone: ToneKey, topGap?: string): string {
  const toneStyle: Record<ToneKey, string> = {
    friendly: `TONE: Warm, zero pressure — like texting a friend you haven't heard back from.`,
    direct: `TONE: Brief and matter-of-fact — one quick bump, no fluff.`,
    curious: `TONE: Still thinking about what you noticed — genuinely curious if they checked.`,
  };

  const gapContext = topGap || issues || "their website";

  return `Write a follow-up email that feels like a real person bumping their own thread. NOT a marketing email — a human checking in.

Context:
- You emailed ${company} a few days ago about: ${gapContext}
- No reply yet
- You want to re-engage them WITHOUT re-pitching

APPROACH: Add NEW value — don't just say "bumping this." Give them one small, useful insight they didn't get in the first email. Something like:
- A quick stat about their industry ("btw — looked into this more, about 60% of ${company.split(" ")[0].toLowerCase()}-type businesses in the area have this same issue")
- A new observation you "just noticed" ("was on your site again and realized the contact form doesn't actually work on mobile — not sure if you knew that")
- A competitor reference ("noticed a ${gapContext.split(" ")[0].toLowerCase()} competitor nearby just redid their site — figured you'd want to know")

Rules:
- 30-50 words — short enough to read in 3 seconds
- MUST add something new — a small nugget of value, not just "did you see my last email?"
- End with a casual, specific question
- No marketing language, no formal greetings
- Do NOT use placeholder brackets like [City], [Name], etc.
- Do NOT include a sign-off name or signature

Subject line: A reply-style subject — "re: [original subject variation]" or something casual like "one more thing" or "forgot to mention"

${toneStyle[tone]}

Return ONLY JSON with "subject" and "body" fields.`;
}

function buildFollowup2Prompt(company: string, tone: ToneKey): string {
  const toneStyle: Record<ToneKey, string> = {
    friendly: `TONE: Genuinely no-pressure — like closing a thread with a friend. Zero guilt.`,
    direct: `TONE: Quick, clean close. One sentence, done.`,
    curious: `TONE: Leave them with one final thought-provoking observation.`,
  };

  return `Write a final follow-up that ends the thread naturally. This is the last email — it should feel like a real person wrapping up, not a marketer doing a "last chance!" push.

Context:
- You emailed ${company} twice, no reply
- This is genuinely the last email — you're moving on

APPROACH: Use the "breakup + door open" technique:
- Acknowledge they're busy (NOT guilt-trip)
- Leave ONE final thought — a tiny value nugget or observation that might stick in their mind
- Make it clear you won't email again — but the door is open if they want to reach out later

Rules:
- 25-40 words maximum
- Sound like a real person, not a drip sequence
- ZERO pressure, zero urgency tactics, zero "last chance" energy
- The reader should feel GOOD after reading this, not guilty
- Do NOT use placeholder brackets like [City], [Name], etc.
- Do NOT include a sign-off name or signature

Subject line: Something casual like "closing the loop" or "last one from me"

${toneStyle[tone]}

Return ONLY JSON with "subject" and "body" fields.`;
}

// ===== AUTO-GENERATE AUDIT TOKEN =====
async function ensureAuditToken(lead: any, serviceType: ServiceType = "web_dev"): Promise<string | undefined> {
  const ed = lead.enriched_data || {};
  // Skip if no enrichment data at all (nothing to show in audit)
  const hasEnrichment = ed.summary || ed.hasOnlineBooking !== undefined || ed.hasContactForm !== undefined || ed.hasSSL !== undefined || ed._siteDown || ed.isParkedDomain;
  if (!hasEnrichment) return undefined;

  // Already has a token — fetch PageSpeed if missing (only for web_dev and seo)
  if (ed.audit_token) {
    const needsPageSpeed = (serviceType === "web_dev" || serviceType === "seo") && !ed.pageSpeed && lead.website && !ed._siteDown && !ed.isParkedDomain;
    if (needsPageSpeed) {
      const pageSpeedData = await getPageSpeedScores(lead.website);
      if (pageSpeedData) {
        await supabase.from("leads")
          .update({ enriched_data: { ...ed, pageSpeed: pageSpeedData, audit_service_type: serviceType } })
          .eq("id", lead.id);
      }
    } else if (!ed.audit_service_type) {
      // Backfill service type for existing tokens
      await supabase.from("leads")
        .update({ enriched_data: { ...ed, audit_service_type: serviceType } })
        .eq("id", lead.id);
    }
    return `${process.env.FRONTEND_URL || "http://localhost:3000"}/audit/${ed.audit_token}`;
  }

  // Generate new token + fetch PageSpeed only for web_dev/seo
  const token = crypto.randomBytes(12).toString("base64url");

  let pageSpeedData = null;
  if ((serviceType === "web_dev" || serviceType === "seo") && lead.website && !ed._siteDown && !ed.isParkedDomain) {
    pageSpeedData = await getPageSpeedScores(lead.website);
  }

  const { error } = await supabase
    .from("leads")
    .update({ enriched_data: { ...ed, audit_token: token, audit_service_type: serviceType, ...(pageSpeedData ? { pageSpeed: pageSpeedData } : {}) } })
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
  const city = address ? address.split(",")[0].trim() : "";

  return `Write a natural phone call script for cold-calling a local ${industry.toLowerCase()} business.

LEAD DATA:
Company: ${lead.company}
Industry: ${industry}${city ? `\nCity: ${city}` : ""}${address ? `\nFull address: ${address}` : ""}
Phone: ${lead.phone || "N/A"}
Contact: ${lead.name || "the owner"}
${enriched ? `Website: ${enriched.summary}\nIssues found: ${enriched.issues}` : "No website or website not analyzed."}

SCRIPT STRUCTURE:
1. OPENING (1 line): "Hi, is this [contact name or company]?" — simple, human, gets them talking.
2. INTRO (1-2 sentences): Who you are (first name only), what you do in plain English, and WHY you're calling them specifically. Reference something specific — their city, their industry, something you noticed about their business. NOT "I help businesses grow online."
3. HOOK (1 sentence): One specific observation about their business that creates curiosity. Example: "I was looking up ${industry.toLowerCase()} in ${city || "your area"} and noticed your business doesn't come up on Google — but your competitor on [nearby street] does." This should be verifiable and specific.
4. ASK (1 sentence): Simple, low-commitment ask. NOT "Can we schedule a call?" — they're already ON a call. Instead: "Would it be cool if I sent you a quick breakdown of what I found? Takes 30 seconds to look at."

RULES:
- Total script under 80 words (people hang up on long pitches)
- Sound like a real person, not reading from a telemarketer script
- Use their company name and city naturally
- NEVER say: "I'm calling from [Agency Name]", "partnership opportunity", "I'd love to help you grow"
- If they have no website, lead with that: "I noticed ${lead.company} doesn't have a website yet — in ${city || "your area"}, about 70% of people search online before picking a ${industry.toLowerCase()}. Just wanted to see if that's something you've been thinking about."
- NEVER use placeholder brackets like [City], [Your Name], etc. Use actual data or skip.
- The "opening" field should ONLY be the first greeting line
- The "script" field should contain the full conversation flow after the opening

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
      const auditUrl = await ensureAuditToken(lead, basicServiceType);
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
      const isMarketingUser = userServiceType === "digital_marketing" || userServiceType === "social_media";
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

      // No lead capture / email signup form
      if (enrichedData.hasLeadCaptureForm === false) {
        allGaps.push({ gap: "No email signup or lead capture — visitors leave and never come back, zero way to nurture them", priority: isMarketingUser ? 88 : 25 });
      }

      // No email marketing platform
      if (enrichedData.hasEmailMarketing === false) {
        allGaps.push({ gap: "No email marketing setup — not collecting or nurturing leads through automated follow-ups", priority: isMarketingUser ? 70 : 15 });
      }

      // No Open Graph tags (social sharing looks broken)
      if (enrichedData.hasOpenGraph === false) {
        allGaps.push({ gap: "No Open Graph tags — when shared on social media, the link shows no image or description (looks broken)", priority: isMarketingUser || isSocialUser ? 65 : 15 });
      }

      // No retargeting pixels (beyond Facebook)
      if (enrichedData.hasRetargeting === false && enrichedData.hasFacebookPixel === false) {
        allGaps.push({ gap: "Zero retargeting setup — 97% of visitors leave without converting and never see another ad from this business", priority: isMarketingUser ? 75 : 20 });
      }

      // No schema markup
      if (enrichedData.hasSchemaMarkup === false) {
        allGaps.push({ gap: "No structured data markup — missing rich snippets in Google (stars, hours, FAQ) that boost click-through rates", priority: isMarketingUser ? 50 : 20 });
      }

      // No clear CTA above the fold
      if (enrichedData.hasCTA === false) {
        allGaps.push({ gap: "No clear call-to-action above the fold — visitors don't know what action to take", priority: isMarketingUser ? 60 : 30 });
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
      const auditUrl = await ensureAuditToken(lead, userServiceType);
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
              scheduled_at: null,
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
