import supabase from "../services/supabase";
import { sendEmail } from "../services/gmail";
import { isWithinSendWindow } from "../routes/send";
import { getDailyLimit } from "../services/planLimits";

let isProcessing = false;
const MAX_RETRIES = 2;

// Check how many emails a user sent today
async function getUserSentToday(userId: string): Promise<number> {
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

async function processEmailQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, user_id, send_timezone")
      .eq("status", "running");

    if (campaignsError || !campaigns || campaigns.length === 0) return;

    for (const campaign of campaigns) {
      // Check business hours for this campaign's timezone
      const timezone = campaign.send_timezone || "US_EAST";
      const sendWindow = isWithinSendWindow(timezone);
      if (!sendWindow.canSend) {
        continue; // Skip — outside business hours for this campaign's timezone
      }

      const now = new Date().toISOString();

      const { data: emails, error: emailsError } = await supabase
        .from("emails")
        .select("*")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending")
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .order("sequence_step", { ascending: true })
        .limit(1);

      if (emailsError || !emails || emails.length === 0) {
        // Check if campaign is done
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
          console.log(`[Queue] Campaign ${campaign.id} completed`);
        }
        continue;
      }

      const email = emails[0];
      const isFollowUp = (email.sequence_step || 1) > 1;

      // Daily limit only applies to initial emails, not follow-ups
      if (!isFollowUp) {
        const sentToday = await getUserSentToday(campaign.user_id);
        const { limit: dailyLimit } = await getDailyLimit(campaign.user_id);
        if (dailyLimit === 0 || sentToday >= dailyLimit) {
          console.log(`[Queue] User ${campaign.user_id} hit daily limit (${sentToday}/${dailyLimit}), skipping initial emails`);
          continue;
        }
      }

      // Skip follow-ups if the lead already replied
      if (isFollowUp && email.lead_id) {
        const { data: repliedEmails } = await supabase
          .from("emails")
          .select("id")
          .eq("lead_id", email.lead_id)
          .eq("replied", true)
          .limit(1);

        if (repliedEmails && repliedEmails.length > 0) {
          // Cancel this follow-up — lead already replied
          await supabase
            .from("emails")
            .update({ status: "cancelled" })
            .eq("id", email.id);
          console.log(`[Queue] Cancelled follow-up ${email.id} — lead already replied`);
          continue;
        }
      }

      try {
        const result = await sendEmail(
          campaign.user_id,
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

          const sequenceInfo = email.sequence_step === 1 ? "(initial)" : `(follow-up ${email.sequence_step - 1})`;
          console.log(`[Queue] Sent email ${email.id} to ${email.to_email} ${sequenceInfo}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const currentRetry = (email.retry_count || 0) + 1;

        if (currentRetry <= MAX_RETRIES) {
          await supabase
            .from("emails")
            .update({
              retry_count: currentRetry,
              error_log: errorMsg,
            })
            .eq("id", email.id);
          console.log(`[Queue] Retry ${currentRetry}/${MAX_RETRIES} for email ${email.id}: ${errorMsg}`);
        } else {
          await supabase
            .from("emails")
            .update({
              status: "failed",
              retry_count: currentRetry,
              error_log: errorMsg,
            })
            .eq("id", email.id);
          console.log(`[Queue] Failed email ${email.id} after ${MAX_RETRIES} retries: ${errorMsg}`);
        }
      }
    }
  } catch (err) {
    console.error("[Queue] Error processing queue:", err);
  } finally {
    isProcessing = false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startEmailQueue() {
  if (intervalId) {
    console.log("[Queue] Email queue already running");
    return;
  }
  console.log("[Queue] Email queue processor started (interval: 60s)");
  processEmailQueue();
  intervalId = setInterval(processEmailQueue, 60 * 1000);
}

export function stopEmailQueue() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Queue] Email queue processor stopped");
  }
}
