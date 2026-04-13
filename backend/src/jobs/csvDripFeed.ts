import supabase from "../services/supabase";
import { getUserPlan, PLAN_CONFIGS } from "../services/planLimits";
import logger from "../utils/logger";

/**
 * CSV Drip-Feed Processor
 * 
 * Promotes "csv_queued" leads to "csv" daily, up to each user's plan limit.
 * Runs once every 60 minutes. Only promotes leads if the user hasn't already
 * had their daily batch promoted today.
 * 
 * Flow:
 * 1. Find all users who have csv_queued leads
 * 2. For each user, check their plan daily limit (50/100/200)
 * 3. Count how many csv leads were already promoted today
 * 4. Promote up to (dailyLimit - alreadyPromotedToday) queued leads
 */

async function processCsvDripFeed() {
  try {
    // Find distinct users who have queued CSV leads
    const { data: queuedLeads, error } = await supabase
      .from("leads")
      .select("user_id, campaign_id")
      .eq("source_type", "csv_queued")
      .limit(1000);

    if (error || !queuedLeads || queuedLeads.length === 0) return;

    // Get unique user+campaign pairs
    const userCampaigns = new Map<string, Set<string>>();
    for (const lead of queuedLeads) {
      if (!userCampaigns.has(lead.user_id)) {
        userCampaigns.set(lead.user_id, new Set());
      }
      if (lead.campaign_id) {
        userCampaigns.get(lead.user_id)!.add(lead.campaign_id);
      }
    }

    for (const [userId, campaignIds] of userCampaigns) {
      try {
        // Get user's daily limit from their plan
        const userPlan = await getUserPlan(userId);
        const config = PLAN_CONFIGS[userPlan.plan];
        const dailyLimit = config.maxDailyEmails; // 50 / 100 / 200

        // Count how many csv leads were already promoted today for this user
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const { count: promotedToday } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("source_type", "csv")
          .gte("created_at", today.toISOString());

        const alreadyPromoted = promotedToday || 0;
        const canPromote = Math.max(0, dailyLimit - alreadyPromoted);

        if (canPromote === 0) continue;

        // Promote queued leads across all campaigns for this user
        for (const campaignId of campaignIds) {
          if (canPromote <= 0) break;

          // Fetch queued leads for this campaign
          const { data: toPromote } = await supabase
            .from("leads")
            .select("id")
            .eq("user_id", userId)
            .eq("campaign_id", campaignId)
            .eq("source_type", "csv_queued")
            .order("created_at", { ascending: true })
            .limit(canPromote);

          if (!toPromote || toPromote.length === 0) continue;

          const ids = toPromote.map(l => l.id);

          // Promote: change source_type from csv_queued to csv
          const { error: updateError } = await supabase
            .from("leads")
            .update({ source_type: "csv" })
            .in("id", ids);

          if (!updateError) {
            logger.info({
              userId,
              campaignId,
              promoted: ids.length,
              dailyLimit,
            }, "CSV drip-feed: promoted queued leads");
          }
        }
      } catch (err) {
        logger.error({ userId, error: err instanceof Error ? err.message : err }, "CSV drip-feed error for user");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in CSV drip-feed processor");
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startCsvDripFeed() {
  if (intervalId) {
    logger.info("CSV drip-feed already running");
    return;
  }
  logger.info("CSV drip-feed processor started (interval: 60min)");
  // Run once on startup, then every 60 minutes
  processCsvDripFeed();
  intervalId = setInterval(processCsvDripFeed, 60 * 60 * 1000);
}

export function stopCsvDripFeed() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("CSV drip-feed processor stopped");
  }
}
