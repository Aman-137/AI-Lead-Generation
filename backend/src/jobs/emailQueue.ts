import supabase from "../services/supabase";
import { sendEmailUnified, getInboxSentTodayUnified, getPrimaryEmailAccountId, getAccountInfo, buildAccountAssignment } from "../services/emailRouter";
import { isWithinSendWindow } from "../routes/send";
import { getDailyLimit, GMAIL_INBOX_CAP, getUserPlan, incrementEmailsSentToday } from "../services/planLimits";
import logger from "../utils/logger";
import crypto from "crypto";

// Distributed lock name — must match the pre-inserted row in job_locks table
const LOCK_NAME = "email_queue";
// Unique instance ID — identifies which process holds the lock
const INSTANCE_ID = `eq_${crypto.randomBytes(4).toString("hex")}_${process.pid}`;

const MAX_RETRIES = 2;
const INITIAL_BATCH_SIZE = 10;   // Process up to 10 initial emails per campaign per cycle
const FOLLOW_UP_BATCH_SIZE = 15; // Process up to 15 follow-ups per campaign per cycle

// Exponential backoff: retry 1 = 5 min, retry 2 = 15 min
function getRetryDelay(retryCount: number): Date {
  const delayMinutes = retryCount === 1 ? 5 : 15;
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check how many emails a user sent today (monotonic counter)
async function getUserSentToday(userId: string): Promise<number> {
  const userPlan = await getUserPlan(userId);
  return userPlan.emailsSentToday;
}

// Send a single email with all safety checks, returns true if sent
async function sendSingleEmail(
  email: any,
  campaign: { id: string; user_id: string },
): Promise<boolean> {
  // Resolve which email account to send from
  let accountInfo = getAccountInfo(email);
  if (!accountInfo) {
    const isFollowUp = (email.sequence_step || 1) > 1;
    if (isFollowUp && email.lead_id) {
      const { data: initial } = await supabase
        .from("emails")
        .select("gmail_account_id, smtp_account_id")
        .eq("lead_id", email.lead_id)
        .eq("campaign_id", campaign.id)
        .eq("sequence_step", 1)
        .single();
      if (initial) accountInfo = getAccountInfo(initial);
    }
    if (!accountInfo) {
      const primary = await getPrimaryEmailAccountId(campaign.user_id);
      if (primary) accountInfo = primary;
    }
    if (!accountInfo) {
      logger.warn({ userId: campaign.user_id, emailId: email.id }, "No email account found, skipping");
      return false;
    }
    // Save assignment for future consistency
    await supabase
      .from("emails")
      .update(buildAccountAssignment(accountInfo.id, accountInfo.type))
      .eq("id", email.id);
  }

  // Per-inbox safety cap (450/inbox/day)
  const inboxSent = await getInboxSentTodayUnified(accountInfo.id, accountInfo.type);
  if (inboxSent >= GMAIL_INBOX_CAP) {
    logger.info({ inboxId: accountInfo.id, accountType: accountInfo.type, inboxSent, cap: GMAIL_INBOX_CAP }, "Inbox hit cap, skipping");
    return false;
  }

  const result = await sendEmailUnified(
    accountInfo.id,
    accountInfo.type,
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

    // Increment monotonic daily sent counter (never decrements)
    await incrementEmailsSentToday(campaign.user_id, 1);

    // Mark lead as contacted (only on first email)
    if ((email.sequence_step || 1) === 1 && email.lead_id) {
      await supabase
        .from("leads")
        .update({ contacted: true, contacted_at: new Date().toISOString() })
        .eq("id", email.lead_id);
    }

    const sequenceInfo = email.sequence_step === 1 ? "(initial)" : `(follow-up ${email.sequence_step - 1})`;
    logger.info({ emailId: email.id, to: email.to_email, sequenceInfo, accountType: accountInfo.type }, "Email sent");
    return true;
  }

  return false;
}

// Handle send failure with retry logic
async function handleSendError(email: any, err: unknown): Promise<void> {
  const errorMsg = err instanceof Error ? err.message : String(err);
  const currentRetry = (email.retry_count || 0) + 1;

  if (currentRetry <= MAX_RETRIES) {
    const retryAt = getRetryDelay(currentRetry);
    await supabase
      .from("emails")
      .update({
        retry_count: currentRetry,
        error_log: errorMsg,
        scheduled_at: retryAt.toISOString(),
      })
      .eq("id", email.id);
    logger.warn({ emailId: email.id, retry: currentRetry, retryAt: retryAt.toISOString(), error: errorMsg }, "Retrying email with backoff");
  } else {
    await supabase
      .from("emails")
      .update({
        status: "failed",
        retry_count: currentRetry,
        error_log: errorMsg,
      })
      .eq("id", email.id);
    logger.error({ emailId: email.id, retries: MAX_RETRIES, error: errorMsg }, "Email failed permanently");
  }
}

async function processEmailQueue() {
  // Acquire table-based distributed lock — if another instance holds it, skip this cycle
  // Lock auto-expires after 5 minutes (stale lock protection if process crashes)
  const { data: acquired } = await supabase.rpc("acquire_job_lock", {
    p_lock_name: LOCK_NAME,
    p_locked_by: INSTANCE_ID,
  });
  if (!acquired) {
    logger.debug("Email queue: another instance holds the lock, skipping cycle");
    return;
  }

  try {
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, user_id, send_timezone")
      .eq("status", "running");

    if (campaignsError || !campaigns || campaigns.length === 0) return;

    for (const campaign of campaigns) {
      const timezone = campaign.send_timezone || "US_EAST";
      const followUpWindow = isWithinSendWindow(timezone, true);
      const initialWindow = isWithinSendWindow(timezone, false);

      // If neither can send (outside business hours entirely), skip
      if (!followUpWindow.canSend && !initialWindow.canSend) {
        continue;
      }

      const now = new Date().toISOString();

      // ===== PROCESS INITIAL EMAILS (batch) =====
      if (initialWindow.canSend) {
        const sentToday = await getUserSentToday(campaign.user_id);
        const { limit: dailyLimit } = await getDailyLimit(campaign.user_id);
        const remaining = Math.max(0, dailyLimit - sentToday);
        const batchSize = Math.min(INITIAL_BATCH_SIZE, remaining);

        if (batchSize > 0) {
          const { data: initialEmails } = await supabase
            .from("emails")
            .select("*")
            .eq("campaign_id", campaign.id)
            .eq("status", "pending")
            .eq("sequence_step", 1)
            .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
            .order("created_at", { ascending: true })
            .limit(batchSize);

          if (initialEmails && initialEmails.length > 0) {
            for (let i = 0; i < initialEmails.length; i++) {
              try {
                await sendSingleEmail(initialEmails[i], campaign);
              } catch (err) {
                await handleSendError(initialEmails[i], err);
              }

              // 45-90s delay between cold initial emails (Google safety)
              if (i < initialEmails.length - 1) {
                await delay(45000, 90000);

                // Re-check business hours
                const recheck = isWithinSendWindow(timezone, false);
                if (!recheck.canSend) break;
              }
            }
          }
        }
      }

      // ===== PROCESS FOLLOW-UP EMAILS (batch) =====
      if (followUpWindow.canSend) {
        const { data: followUpEmails } = await supabase
          .from("emails")
          .select("*")
          .eq("campaign_id", campaign.id)
          .eq("status", "pending")
          .gt("sequence_step", 1)
          .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
          .order("sequence_step", { ascending: true })
          .limit(FOLLOW_UP_BATCH_SIZE);

        if (followUpEmails && followUpEmails.length > 0) {
          for (let i = 0; i < followUpEmails.length; i++) {
            const followUp = followUpEmails[i];

            // Skip if lead already replied
            if (followUp.lead_id) {
              const { data: replied } = await supabase
                .from("emails")
                .select("id")
                .eq("lead_id", followUp.lead_id)
                .eq("replied", true)
                .limit(1);

              if (replied && replied.length > 0) {
                await supabase
                  .from("emails")
                  .update({ status: "cancelled" })
                  .eq("id", followUp.id);
                logger.info({ emailId: followUp.id }, "Cancelled follow-up — lead already replied");
                continue;
              }
            }

            try {
              await sendSingleEmail(followUp, campaign);
            } catch (err) {
              await handleSendError(followUp, err);
              break; // Stop follow-up batch on error
            }

            // 20-30s delay between follow-ups (same thread, safer)
            if (i < followUpEmails.length - 1) {
              await delay(20000, 30000);

              // Re-check business hours
              const recheck = isWithinSendWindow(timezone, true);
              if (!recheck.canSend) break;
            }
          }
        }
      }

      // ===== CHECK IF CAMPAIGN IS DONE =====
      const { count: pendingCount } = await supabase
        .from("emails")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "pending");

      if (pendingCount === 0) {
        await supabase
          .from("campaigns")
          .update({ status: "completed" })
          .eq("id", campaign.id);
        logger.info({ campaignId: campaign.id }, "Campaign completed");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error processing email queue");
  } finally {
    // Always release the lock so the next cycle can acquire it
    try {
      await supabase.rpc("release_job_lock", {
        p_lock_name: LOCK_NAME,
        p_locked_by: INSTANCE_ID,
      });
    } catch { /* lock auto-expires after 5 min if release fails */ }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startEmailQueue() {
  if (intervalId) {
    logger.info("Email queue already running");
    return;
  }
  logger.info("Email queue processor started (interval: 60s)");
  processEmailQueue();
  intervalId = setInterval(processEmailQueue, 60 * 1000);
}

export function stopEmailQueue() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("Email queue processor stopped");
  }
}
