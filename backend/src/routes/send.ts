import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";
import { sendEmail, isGmailConnected } from "../services/gmail";
import { getDailyLimit } from "../services/planLimits";

const router = Router();

const MAX_RETRIES = 2;

// ===== Business Hours Sending =====
// Optimal cold email send times (research-backed):
// Morning peak: 8:00-11:00 AM | Afternoon peak: 1:00-5:00 PM
// All 7 days, timezone-aware with DST handling
const TIMEZONE_OFFSETS: Record<string, number[]> = {
  US_EAST:    [-5, -4],   // EST/EDT (Nov-Mar: -5, Mar-Nov: -4)
  US_CENTRAL: [-6, -5],   // CST/CDT
  US_WEST:    [-8, -7],   // PST/PDT
  UK:         [0, 1],     // GMT/BST
  EU_CENTRAL: [1, 2],     // CET/CEST
};

// Determine if DST is active — different rules for US vs UK/EU
function isDSTForRegion(date: Date, region: "US" | "EU"): boolean {
  const year = date.getUTCFullYear();

  if (region === "US") {
    // US: Second Sunday of March (2am EST = 7 UTC) → First Sunday of November (2am EDT = 6 UTC)
    const mar1 = new Date(Date.UTC(year, 2, 1));
    const daysToFirstMarSun = (7 - mar1.getUTCDay()) % 7;
    const secondMarSun = 1 + daysToFirstMarSun + 7; // first Sunday + 7 = second Sunday
    const dstStart = new Date(Date.UTC(year, 2, secondMarSun, 7));
    const nov1 = new Date(Date.UTC(year, 10, 1));
    const daysToFirstNovSun = (7 - nov1.getUTCDay()) % 7;
    const firstNovSun = 1 + daysToFirstNovSun;
    const dstEnd = new Date(Date.UTC(year, 10, firstNovSun, 6));
    return date >= dstStart && date < dstEnd;
  } else {
    // UK/EU: Last Sunday of March (1am UTC) → Last Sunday of October (1am UTC)
    const mar = new Date(Date.UTC(year, 2, 31));
    const marSun = 31 - mar.getUTCDay(); // last Sunday of March
    const dstStart = new Date(Date.UTC(year, 2, marSun, 1)); // 1am UTC
    const oct = new Date(Date.UTC(year, 9, 31));
    const octSun = 31 - oct.getUTCDay(); // last Sunday of October
    const dstEnd = new Date(Date.UTC(year, 9, octSun, 1)); // 1am UTC
    return date >= dstStart && date < dstEnd;
  }
}

const TIMEZONE_REGIONS: Record<string, "US" | "EU"> = {
  US_EAST: "US",
  US_CENTRAL: "US",
  US_WEST: "US",
  UK: "EU",
  EU_CENTRAL: "EU",
};

function getLocalHour(date: Date, timezone: string): { hour: number; dayOfWeek: number } {
  const offsets = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS.US_EAST;
  const region = TIMEZONE_REGIONS[timezone] || "US";
  const offset = isDSTForRegion(date, region) ? offsets[1] : offsets[0];
  const localMs = date.getTime() + offset * 3600000;
  const local = new Date(localMs);
  return { hour: local.getUTCHours(), dayOfWeek: local.getUTCDay() };
}

// Check if current time is within sending hours (all 7 days)
export function isWithinSendWindow(timezone: string): { canSend: boolean; nextWindowMs: number } {
  const now = new Date();
  const { hour } = getLocalHour(now, timezone);

  // Morning window: 8:00-11:00 AM | Afternoon window: 1:00-5:00 PM
  const inMorning = hour >= 8 && hour < 11;
  const inAfternoon = hour >= 13 && hour < 17;

  if (inMorning || inAfternoon) {
    return { canSend: true, nextWindowMs: 0 };
  }

  // Calculate next send window
  const offsets = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS.US_EAST;
  const region = TIMEZONE_REGIONS[timezone] || "US";
  const offset = isDSTForRegion(now, region) ? offsets[1] : offsets[0];
  const next = new Date(now);

  if (hour < 8) {
    // Before morning window → wait until 8am today
    next.setUTCHours(8 - offset, 0, 0, 0);
  } else if (hour >= 11 && hour < 13) {
    // Between windows → wait until 1pm today
    next.setUTCHours(13 - offset, 0, 0, 0);
  } else {
    // After 5pm → next day 8am
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(8 - offset, 0, 0, 0);
  }

  return { canSend: false, nextWindowMs: Math.max(0, next.getTime() - now.getTime()) };
}

// Helper: random delay between min and max ms
function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: count emails sent today by this user
async function getEmailsSentToday(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("emails")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("sent_at", today.toISOString());

  return count || 0;
}

// POST /api/send — Send generated emails for a campaign one-by-one with delay
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { campaignId, leadIds } = req.body;

    if (!campaignId) {
      res.status(400).json({ error: "Campaign ID is required" });
      return;
    }

    // Check if Gmail is connected
    const gmailStatus = await isGmailConnected(req.userId!);
    if (!gmailStatus.connected) {
      res.status(400).json({
        error: "Gmail not connected. Please connect your Gmail account first.",
      });
      return;
    }

    // Fetch campaign to get timezone setting
    const { data: campaignData, error: campaignError } = await supabase
      .from("campaigns")
      .select("send_timezone")
      .eq("id", campaignId)
      .eq("user_id", req.userId)
      .single();

    if (campaignError || !campaignData) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const timezone = campaignData.send_timezone || "US_EAST";

    // Check if campaign is already running (prevent duplicate queuing)
    const { data: statusCheck } = await supabase
      .from("campaigns")
      .select("status")
      .eq("id", campaignId)
      .eq("user_id", req.userId)
      .single();

    if (statusCheck?.status === "running") {
      res.json({
        message: "Campaign is already running. Emails will be sent during the next business hour window.",
        sent: 0, failed: 0, total: 0, queued: true,
      });
      return;
    }

    // Check business hours — if outside window, queue the campaign for auto-sending
    const sendWindow = isWithinSendWindow(timezone);
    if (!sendWindow.canSend) {
      // Set campaign to "running" so the background queue picks it up during business hours
      await supabase
        .from("campaigns")
        .update({ status: "running" })
        .eq("id", campaignId)
        .eq("user_id", req.userId);

      const waitMins = Math.ceil(sendWindow.nextWindowMs / 60000);
      const waitHrs = Math.floor(waitMins / 60);
      const remainMins = waitMins % 60;
      const waitStr = waitHrs > 0 ? `${waitHrs}h ${remainMins}m` : `${waitMins}m`;
      const tzLabel = timezone.replace("_", " ");

      res.json({
        message: `Campaign queued! Outside ${tzLabel} sending hours right now. Emails will auto-send during the next window (8-11 AM & 1-5 PM ${tzLabel}) in ~${waitStr}.`,
        sent: 0,
        failed: 0,
        total: 0,
        queued: true,
        nextWindowMs: sendWindow.nextWindowMs,
      });
      return;
    }

    // Check daily limit (plan-based with warmup)
    const sentToday = await getEmailsSentToday(req.userId!);
    const { limit: DAILY_SEND_LIMIT, warmupDay, warmupComplete, plan } = await getDailyLimit(req.userId!);

    // Gmail not connected or plan inactive — no sending
    if (DAILY_SEND_LIMIT === 0) {
      res.status(400).json({
        error: "Gmail not connected or plan inactive. Please connect Gmail in Settings first.",
      });
      return;
    }

    // Fetch pending emails for this campaign (only those ready to send now)
    const now = new Date().toISOString();
    let emailQuery = supabase
      .from("emails")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", req.userId)
      .eq("status", "pending")
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order("sequence_step", { ascending: true });

    // If specific lead IDs provided, only send emails for those leads
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      emailQuery = emailQuery.in("lead_id", leadIds);
    }

    const { data: emails, error: emailsError } = await emailQuery;

    if (emailsError || !emails || emails.length === 0) {
      if (sentToday >= DAILY_SEND_LIMIT) {
        res.status(429).json({
          error: `Daily send limit reached (${DAILY_SEND_LIMIT}/day). Try again tomorrow to protect your Gmail account.`,
        });
        return;
      }
      res.status(404).json({ error: "No pending emails found for this campaign" });
      return;
    }

    // Split into initial emails (capped) and follow-ups (uncapped)
    const initialEmails = emails.filter(e => (e.sequence_step || 1) === 1);
    const followUpEmails = emails.filter(e => (e.sequence_step || 1) > 1);

    // Cap only initial emails to daily limit
    const remaining = Math.max(0, DAILY_SEND_LIMIT - sentToday);
    const cappedInitials = initialEmails.slice(0, remaining);

    // Skip follow-ups for leads that already replied
    const repliedLeadIds = new Set<string>();
    if (followUpEmails.length > 0) {
      const leadIds = [...new Set(followUpEmails.map(e => e.lead_id).filter(Boolean))];
      if (leadIds.length > 0) {
        const { data: repliedEmails } = await supabase
          .from("emails")
          .select("lead_id")
          .in("lead_id", leadIds)
          .eq("replied", true);
        if (repliedEmails) {
          repliedEmails.forEach(e => repliedLeadIds.add(e.lead_id));
        }
      }
    }
    const activeFollowUps = followUpEmails.filter(e => !repliedLeadIds.has(e.lead_id));

    // Cancel follow-ups for replied leads
    const cancelledFollowUps = followUpEmails.filter(e => repliedLeadIds.has(e.lead_id));
    if (cancelledFollowUps.length > 0) {
      await supabase
        .from("emails")
        .update({ status: "cancelled" })
        .in("id", cancelledFollowUps.map(e => e.id));
    }

    // Combine: capped initials + all active follow-ups
    const emailsToSend = [...cappedInitials, ...activeFollowUps];

    // Update campaign status to "running"
    await supabase
      .from("campaigns")
      .update({ status: "running" })
      .eq("id", campaignId)
      .eq("user_id", req.userId);

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < emailsToSend.length; i++) {
      const email = emailsToSend[i];

      try {
        const result = await sendEmail(
          req.userId!,
          email.to_email,
          email.subject,
          email.body
        );

        if (result.success) {
          await supabase
            .from("emails")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              error_log: null,
            })
            .eq("id", email.id);

          // Mark lead as contacted (only on first email)
          if ((email.sequence_step || 1) === 1 && email.lead_id) {
            await supabase
              .from("leads")
              .update({ contacted: true, contacted_at: new Date().toISOString() })
              .eq("id", email.lead_id);
          }

          sentCount++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const currentRetry = (email.retry_count || 0) + 1;

        if (currentRetry <= MAX_RETRIES) {
          // Keep as pending for retry, increment counter
          await supabase
            .from("emails")
            .update({
              retry_count: currentRetry,
              error_log: errorMsg,
            })
            .eq("id", email.id);
        } else {
          // Max retries reached — mark as failed
          await supabase
            .from("emails")
            .update({
              status: "failed",
              retry_count: currentRetry,
              error_log: errorMsg,
            })
            .eq("id", email.id);
        }

        failedCount++;
      }

      // Delay between emails (45-90 seconds) — more natural spacing
      if (i < emailsToSend.length - 1) {
        await delay(45000, 90000);
      }
    }

    // Update campaign status based on results
    // Check ALL pending emails (including future-scheduled follow-ups)
    const { count: pendingCount } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["pending"]);

    const finalStatus = (pendingCount || 0) === 0
      ? "completed"
      : "running";  // Stay "running" so the background queue picks up follow-ups

    await supabase
      .from("campaigns")
      .update({ status: finalStatus })
      .eq("id", campaignId)
      .eq("user_id", req.userId);

    res.json({
      message: "Email sending completed",
      sent: sentCount,
      failed: failedCount,
      total: emailsToSend.length,
      dailyLimitRemaining: remaining - sentCount,
      plan,
      warmupDay,
      warmupComplete,
      dailyLimit: DAILY_SEND_LIMIT,
    });
  } catch {
    res.status(500).json({ error: "Failed to send emails" });
  }
});

// POST /api/send/mark-reply — Manually mark an email as replied
router.post("/mark-reply", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { emailId } = req.body;

    if (!emailId) {
      res.status(400).json({ error: "Email ID is required" });
      return;
    }

    const { error } = await supabase
      .from("emails")
      .update({
        replied: true,
        replied_at: new Date().toISOString(),
      })
      .eq("id", emailId)
      .eq("user_id", req.userId);

    if (error) {
      res.status(500).json({ error: "Failed to mark reply" });
      return;
    }

    res.json({ message: "Email marked as replied" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
