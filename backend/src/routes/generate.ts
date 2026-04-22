import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";
import openai from "../services/openai";
import { checkDailyGenerationLimit, PLAN_CONFIGS, getUserPlan, incrementEmailsGeneratedToday } from "../services/planLimits";
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

function buildInitialPrompt(lead: any, tone: ToneKey, enriched?: { summary?: string; issues?: string; digitalGaps?: string }): string {
  const company = lead.company;
  const industry = lead.industry || "Local business";
  const address = lead.enriched_data?.address || "";

  let context: string;
  if (enriched) {
    context = `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}\nWebsite summary: ${enriched.summary}`;
    if (enriched.digitalGaps) {
      context += `\nDigital gaps found:\n${enriched.digitalGaps}`;
    }
    if (enriched.issues) {
      context += `\nKey issues: ${enriched.issues}`;
    }
  } else {
    context = `Industry: ${industry}${address ? `\nLocation: ${address}` : ""}\nWebsite: ${lead.website || "N/A"}\nContact Name: ${lead.name}`;
  }

  const toneInstructions: Record<ToneKey, string> = {
    friendly: `Tone: Warm, genuine, zero pressure. Like a helpful neighbor who happens to know about websites.`,

    direct: `Tone: Short, blunt, confident. Like a busy CEO who types fast and doesn't waste words.`,

    curious: `Tone: Genuinely curious and observational. Like someone who spotted something interesting and can't help but mention it.`,
  };

  return `You are a world-class cold email copywriter. Your emails consistently get 40%+ reply rates because they follow a proven psychological framework.

FRAMEWORK — use this structure:
1. OPEN with their #1 pain point as a specific observation (NOT "I was checking out your site"). Lead with what you found, not what you did.
2. AMPLIFY by connecting 2-3 digital gaps to real business consequences specific to their industry — frame it as customers/money they're losing RIGHT NOW, not abstract problems.
3. CREATE CURIOSITY with a soft, low-commitment question that makes them want to reply. Never ask for a "call" or "chat" in the first email — ask a question they can answer in one sentence.

Lead context:
Company: ${company}
${context}

STRICT RULES:
- BANNED words: "revenue", "optimize", "solution", "leverage", "streamline", "maximize", "boost", "transform", "unlock", "empower", "excited", "thrilled", "growth", "scale", "ROI"
- Do NOT open with "I was checking/looking at your site" — that's generic. Instead open directly with the observation (e.g. "Patients searching for a dentist in Austin can't book online from your site right now")
- Mention their city/location if available — hyper-local = hyper-relevant
- Reference their industry competitors WITHOUT naming them (e.g. "most ${industry} businesses in the area already have...")
- Weave up to 3 digital gaps naturally as observations with real-world consequences — NEVER bullet-point them
- Every gap mentioned must tie to a specific customer behavior (e.g. "customers Google you, can't find you on social, and move on to the next option")
- 80-90 words (sweet spot — long enough to be specific, short enough to read on mobile)
- Write like a real person, not a marketer. Contractions, fragments, casual language all fine
- End with a CURIOSITY question they can answer in one line — NOT "want to hop on a call?" but more like "is that something you've been thinking about?" or "curious — is that intentional or just hasn't been a priority yet?"
- Do NOT use placeholder brackets like [Your Name] or [Agency Name]
- Do NOT start with greetings like "I hope this finds you well", "Hi there", etc.
- Subject line: lowercase, 3-6 words, sounds like a friend texting — include their company name or city when possible

${toneInstructions[tone]}

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
      const prompt = buildInitialPrompt(lead, tone);

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
      const allGaps: { gap: string; priority: number }[] = [];

      // Booking — highest priority for service businesses
      if (enrichedData.hasOnlineBooking === false) {
        const bookingIndustries = ["dental", "medical", "salon", "fitness", "restaurant", "plumbing", "hvac", "automotive"];
        const isBookingCritical = bookingIndustries.some(i => industry.includes(i));
        allGaps.push({ gap: "No online booking system — customers can't schedule appointments from the website", priority: isBookingCritical ? 100 : 70 });
      }

      // Contact form — highest for legal, real estate, professional services
      if (enrichedData.hasContactForm === false) {
        const contactIndustries = ["legal", "real estate", "medical", "dental"];
        const isContactCritical = contactIndustries.some(i => industry.includes(i));
        allGaps.push({ gap: "No contact form — makes it hard for potential customers to reach out", priority: isContactCritical ? 95 : 65 });
      }

      // No social media
      if (!enrichedData.socialLinks || enrichedData.socialLinks.length === 0) {
        allGaps.push({ gap: "Zero social media presence — invisible to customers searching on social platforms", priority: 60 });
      } else if (enrichedData.socialLinks.length <= 1) {
        allGaps.push({ gap: "Weak social media (only on 1 platform) — missing customers on other channels", priority: 40 });
      }

      // Outdated tech
      if (enrichedData.technologies?.includes("WordPress")) {
        allGaps.push({ gap: "Running on WordPress — can be slow, vulnerable, and expensive to maintain", priority: 50 });
      }

      // No platform detected
      if (!enrichedData.technologies || enrichedData.technologies.length === 0) {
        allGaps.push({ gap: "Basic/outdated website with no modern platform — looks unprofessional on mobile", priority: 55 });
      }

      // Sort by priority (highest first) and take top 3
      allGaps.sort((a, b) => b.priority - a.priority);
      const topGaps = allGaps.slice(0, 3);
      const gaps = topGaps.map(g => `- ${g.gap}`);
      const digitalGaps = gaps.length > 0 ? gaps.join("\n") : "";

      // Initial email
      const initialPrompt = buildInitialPrompt(lead, tone, { summary, issues, digitalGaps });
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
