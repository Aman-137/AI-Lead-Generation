import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";
import openai from "../services/openai";

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

function buildInitialPrompt(lead: any, tone: ToneKey, enriched?: { summary?: string; issues?: string }): string {
  const company = lead.company;
  const context = enriched
    ? `Website summary: ${enriched.summary}\nIssues: ${enriched.issues || "General digital presence concerns"}`
    : `Website: ${lead.website || "N/A"}\nContact Name: ${lead.name}`;

  const toneInstructions: Record<ToneKey, string> = {
    friendly: `Tone: Warm and friendly, like messaging someone you met at a networking event.
Example style: "Hey — saw your site and thought of something. Mind if I ask a quick question?"`,

    direct: `Tone: Short, blunt, no fluff. Like a busy founder who types fast.
Example style: "Checked out your site. Noticed something — worth a quick chat?"`,

    curious: `Tone: Genuinely curious, like you stumbled on something interesting.
Example style: "Hey — was looking at your site and got curious about something..."`,
  };

  return `Write a cold email that feels like it was written manually in under 2 minutes.

Lead context:
Company: ${company}
${context}

Rules:
- Do NOT sound like marketing or sales copy
- Avoid these words entirely: "revenue", "optimize", "solution", "leverage", "streamline", "maximize", "boost", "transform", "unlock", "empower"
- Write like a real person who quickly checked their site
- Mention ONE specific observation
- Keep it under 80 words
- Use simple, casual language
- Slightly imperfect grammar is OK (contractions, fragments fine)
- End with a simple question, not a formal CTA
- Do NOT use placeholder brackets like [Your Name] or [Agency Name]
- Do NOT start with "I hope this email finds you well" or similar clichés
- Subject line should be lowercase, short, no emojis

${toneInstructions[tone]}

Return ONLY a JSON object with "subject" and "body" fields.`;
}

function buildFollowup1Prompt(company: string, issues: string, tone: ToneKey): string {
  const toneStyle: Record<ToneKey, string> = {
    friendly: `Style: "Hey — just circling back on this. No rush at all, just curious if you had a sec to think about it?"`,
    direct: `Style: "Bumping this — did you get a chance to look?"`,
    curious: `Style: "Hey — still thinking about that thing I noticed on your site. Worth chatting about?"`,
  };

  return `Write a quick follow-up email — feels like a real person bumping their own thread.

Context:
- You emailed ${company} a few days ago, no reply
- Issue you mentioned: ${issues || "their website"}

Rules:
- Under 40 words
- Super casual
- No marketing language at all
- Don't re-pitch, just nudge
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
  // Check for obvious junk emails
  const junkPatterns = ["noreply", "no-reply", "donotreply", "test@", "example.com"];
  if (junkPatterns.some(p => lead.email.toLowerCase().includes(p))) {
    return { valid: false, reason: "junk_email" };
  }
  return { valid: true };
}

// ===== CALL SCRIPT GENERATION =====
function buildCallScriptPrompt(lead: any, enriched?: { summary?: string; issues?: string }): string {
  return `Write a very short phone call script for cold-calling a local business.

Lead context:
Company: ${lead.company}
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

    const generatedEmails: any[] = [];
    let skippedCount = 0;

    // Filter valid leads first
    const validLeads = leads.filter(lead => {
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
        console.error(`[Generate] Error for lead ${lead.id}:`, err instanceof Error ? err.message : err);
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

    await supabase
      .from("campaigns")
      .update({ status: "draft" })
      .eq("id", campaignId);

    res.json({
      message: "Emails generated successfully",
      count: generatedEmails.length,
      skipped: skippedCount,
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
      .gte("score", 40)
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

    const generatedEmails: any[] = [];
    let skippedCount = 0;

    // Filter valid leads first
    const validLeads = leads.filter(lead => {
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

      // Initial email
      const initialPrompt = buildInitialPrompt(lead, tone, { summary, issues });
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
                    const f1Prompt = buildFollowup1Prompt(lead.company, issues, tone);
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
                  } catch { console.error(`[Generate] Failed follow-up 1 for lead ${lead.id}`); }
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
                  } catch { console.error(`[Generate] Failed follow-up 2 for lead ${lead.id}`); }
                  return null;
                })(),
              ]);

              if (f1Result) emails.push(f1Result);
              if (f2Result) emails.push(f2Result);
            }
          }
        }
      } catch (err) {
        console.error(`[Generate] Error for lead ${lead.id}:`, err instanceof Error ? err.message : err);
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

    if (enableFollowups) {
      await supabase
        .from("campaigns")
        .update({ enable_followups: true })
        .eq("id", campaignId);
    }

    res.json({
      message: "Advanced emails generated successfully",
      count: generatedEmails.length,
      initialEmails: leads.length,
      skipped: skippedCount,
      followUpsIncluded: enableFollowups,
    });
  } catch (error) {
    console.error("[Advanced Generate] Error:", error);
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

    // Generate call scripts in parallel batches of 5
    const scripts = await processBatch(validLeads, PARALLEL_BATCH_SIZE, async (lead) => {
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
            .eq("id", lead.id);

          return {
            lead_id: lead.id,
            company: lead.company,
            phone: lead.phone,
            opening: scriptData.opening || "",
            script: scriptData.script || "",
          };
        }
      } catch (err) {
        console.error(`[CallScript] Error for lead ${lead.id}:`, err instanceof Error ? err.message : err);
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
