import supabase from "./supabase";

// =============================================
// Plan Definitions — Option C (single inbox)
// =============================================
// Warmup ramps up over 3 weeks, then stays at steady-state cap.
// Warmup tracks per Gmail inbox (gmail_connected_at), NOT per billing cycle.

export type PlanTier = "starter" | "growth" | "agency";

interface PlanConfig {
  // Warmup schedule: daily send limits per week
  warmup: [number, number, number]; // [week1, week2, week3]
  // Steady-state max emails/day after warmup completes (week 4+)
  maxDailyEmails: number;
  // Monthly auto-find lead limit
  monthlyLeadFindLimit: number;
  // Max AI generations per day (initial + follow-ups = 3x daily emails)
  maxDailyGenerations: number;
  // Max leads per single enrich request
  maxEnrichBatchSize: number;
  // Price (for display only — billing handled separately)
  priceMonthly: number;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  starter: {
    warmup: [10, 20, 35],
    maxDailyEmails: 50,
    monthlyLeadFindLimit: 1100,
    maxDailyGenerations: 150,   // 50 leads × 3 emails each
    maxEnrichBatchSize: 50,
    priceMonthly: 39,
  },
  growth: {
    warmup: [20, 45, 90],
    maxDailyEmails: 100,
    monthlyLeadFindLimit: 2200,
    maxDailyGenerations: 300,   // 100 leads × 3 emails each
    maxEnrichBatchSize: 100,
    priceMonthly: 79,
  },
  agency: {
    warmup: [40, 100, 200],
    maxDailyEmails: 200,
    monthlyLeadFindLimit: 4400,
    maxDailyGenerations: 600,   // 200 leads × 3 emails each
    maxEnrichBatchSize: 200,
    priceMonthly: 129,
  },
};

// Default plan for new users
const DEFAULT_PLAN: PlanTier = "starter";

// =============================================
// Timezone helpers
// =============================================
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Get the start of today (midnight) in the user's timezone, returned as a UTC Date.
// E.g. for Asia/Kolkata: if it's 9:30 AM IST Apr 17, returns Apr 16 6:30 PM UTC (= midnight IST Apr 17).
function getStartOfTodayInTz(tz: string): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;

  // Compute the timezone offset: localAsUtc - realUtc = offset
  // Round to nearest MINUTE — all real-world timezone offsets are whole minutes
  // (e.g. IST +5:30, Nepal +5:45). This eliminates ms/second drift from now.getTime().
  const localAsUtcMs = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  const offsetMinutes = Math.round((localAsUtcMs - now.getTime()) / 60000);
  const cleanOffsetMs = offsetMinutes * 60000;
  const localMidnightMs = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0);
  return new Date(localMidnightMs - cleanOffsetMs);
}

// Check if a daily counter has expired — true if reset_at is before today's midnight
// in the user's timezone. Timezone change is locked to once per 24h to prevent exploits.
function isDailyCounterExpired(resetAt: string | null, tz: string): boolean {
  if (!resetAt) return true;
  const todayMidnight = getStartOfTodayInTz(tz);
  return new Date(resetAt) < todayMidnight;
}

// =============================================
// Get or create user plan
// =============================================
export type ServiceType = "web_dev" | "seo" | "digital_marketing" | "social_media";
// NOTE: social_media is deprecated — treated as digital_marketing. Kept for backward compat.

export async function getUserPlan(userId: string): Promise<{
  plan: PlanTier;
  serviceType: ServiceType;
  gmailConnectedAt: string | null;
  isActive: boolean;
  leadsFoundThisMonth: number;
  leadsFoundResetAt: string;
  leadsFoundToday: number;
  leadsFoundTodayResetAt: string;
  emailsGeneratedToday: number;
  emailsGeneratedTodayResetAt: string;
  emailsSentToday: number;
  emailsSentTodayResetAt: string;
  timezone: string;
}> {
  const { data, error } = await supabase
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Try INSERT-only (ignoreDuplicates: true = ON CONFLICT DO NOTHING).
    // This creates a row for genuinely new users but NEVER overwrites existing data.
    await supabase
      .from("user_plans")
      .upsert({
        user_id: userId,
        plan: DEFAULT_PLAN,
        is_active: true,
        leads_found_this_month: 0,
        leads_found_reset_at: new Date().toISOString(),
        leads_found_today: 0,
        leads_found_today_reset_at: new Date().toISOString(),
        emails_generated_today: 0,
        emails_generated_today_reset_at: new Date().toISOString(),
        emails_sent_today: 0,
        emails_sent_today_reset_at: new Date().toISOString(),
        timezone: "UTC",
      }, { onConflict: "user_id", ignoreDuplicates: true });

    // Now re-SELECT — whether we just inserted or the row already existed
    const { data: plan2, error: err2 } = await supabase
      .from("user_plans")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (err2 || !plan2) {
      // Genuinely unreachable unless DB is down — return safe read-only defaults
      // (these are NOT written to the DB, so no counter reset)
      return {
        plan: DEFAULT_PLAN,
        serviceType: "web_dev" as ServiceType,
        gmailConnectedAt: null,
        isActive: true,
        leadsFoundThisMonth: 0,
        leadsFoundResetAt: new Date().toISOString(),
        leadsFoundToday: 0,
        leadsFoundTodayResetAt: new Date().toISOString(),
        emailsGeneratedToday: 0,
        emailsGeneratedTodayResetAt: new Date().toISOString(),
        emailsSentToday: 0,
        emailsSentTodayResetAt: new Date().toISOString(),
        timezone: "UTC",
      };
    }

    // Use the REAL data from the DB (preserves existing counters)
    const tz = plan2.timezone || "UTC";
    return {
      plan: plan2.plan as PlanTier,
      serviceType: (plan2.service_type || "web_dev") as ServiceType,
      gmailConnectedAt: plan2.gmail_connected_at,
      isActive: plan2.is_active,
      leadsFoundThisMonth: plan2.leads_found_this_month || 0,
      leadsFoundResetAt: plan2.leads_found_reset_at,
      leadsFoundToday: isDailyCounterExpired(plan2.leads_found_today_reset_at, tz)
        ? 0 : (plan2.leads_found_today || 0),
      leadsFoundTodayResetAt: plan2.leads_found_today_reset_at || new Date().toISOString(),
      emailsGeneratedToday: isDailyCounterExpired(plan2.emails_generated_today_reset_at, tz)
        ? 0 : (plan2.emails_generated_today || 0),
      emailsGeneratedTodayResetAt: plan2.emails_generated_today_reset_at || new Date().toISOString(),
      emailsSentToday: isDailyCounterExpired(plan2.emails_sent_today_reset_at, tz)
        ? 0 : (plan2.emails_sent_today || 0),
      emailsSentTodayResetAt: plan2.emails_sent_today_reset_at || new Date().toISOString(),
      timezone: tz,
    };
  }

  // Daily counter expiry — resets at midnight in the user's timezone.
  // Timezone change is locked to once per 24h to prevent exploit.
  const userTz = data.timezone || "UTC";

  const effectiveLeadsFoundToday = isDailyCounterExpired(data.leads_found_today_reset_at, userTz)
    ? 0 : (data.leads_found_today || 0);

  const effectiveEmailsGeneratedToday = isDailyCounterExpired(data.emails_generated_today_reset_at, userTz)
    ? 0 : (data.emails_generated_today || 0);

  const effectiveEmailsSentToday = isDailyCounterExpired(data.emails_sent_today_reset_at, userTz)
    ? 0 : (data.emails_sent_today || 0);

  return {
    plan: data.plan as PlanTier,
    serviceType: (data.service_type || "web_dev") as ServiceType,
    gmailConnectedAt: data.gmail_connected_at,
    isActive: data.is_active,
    leadsFoundThisMonth: data.leads_found_this_month || 0,
    leadsFoundResetAt: data.leads_found_reset_at,
    leadsFoundToday: effectiveLeadsFoundToday,
    leadsFoundTodayResetAt: data.leads_found_today_reset_at || new Date().toISOString(),
    emailsGeneratedToday: effectiveEmailsGeneratedToday,
    emailsGeneratedTodayResetAt: data.emails_generated_today_reset_at || new Date().toISOString(),
    emailsSentToday: effectiveEmailsSentToday,
    emailsSentTodayResetAt: data.emails_sent_today_reset_at || new Date().toISOString(),
    timezone: data.timezone || "UTC",
  };
}

// =============================================
// Calculate warmup day (based on actual sending activity)
// Counts distinct days the user has sent at least 1 email.
// Also detects if warmup is "paused" (no sends in last 48h).
// =============================================
async function getWarmupInfo(userId: string, gmailConnectedAt: string | null): Promise<{
  warmupDay: number;
  warmupPaused: boolean;
  lastSentAt: string | null;
}> {
  if (!gmailConnectedAt) return { warmupDay: 0, warmupPaused: false, lastSentAt: null };

  // Count distinct days user has sent at least 1 email
  const { data: sentDays, error } = await supabase
    .from("emails")
    .select("sent_at")
    .eq("user_id", userId)
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: true });

  if (error || !sentDays || sentDays.length === 0) {
    // Gmail connected but never sent — day 0, paused
    return { warmupDay: 0, warmupPaused: true, lastSentAt: null };
  }

  // Count unique calendar days (UTC)
  const uniqueDays = new Set<string>();
  let lastSentAt: string | null = null;
  for (const row of sentDays) {
    if (row.sent_at) {
      const day = row.sent_at.substring(0, 10); // "YYYY-MM-DD"
      uniqueDays.add(day);
      lastSentAt = row.sent_at;
    }
  }

  const warmupDay = uniqueDays.size;

  // Paused = no email sent in the last 48 hours
  let warmupPaused = true;
  if (lastSentAt) {
    const lastSent = new Date(lastSentAt);
    const hoursSinceLastSend = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
    warmupPaused = hoursSinceLastSend > 48;
  }

  return { warmupDay, warmupPaused, lastSentAt };
}

// =============================================
// Get today's daily email limit for a user
// =============================================
export async function getDailyLimit(userId: string): Promise<{
  limit: number;
  plan: PlanTier;
  warmupDay: number;
  warmupComplete: boolean;
  warmupPaused: boolean;
  maxCap: number;
}> {
  const userPlan = await getUserPlan(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  const { warmupDay, warmupPaused } = await getWarmupInfo(userId, userPlan.gmailConnectedAt);

  // Gmail not connected — no sending allowed
  if (!userPlan.gmailConnectedAt) {
    return {
      limit: 0,
      plan: userPlan.plan,
      warmupDay: 0,
      warmupComplete: false,
      warmupPaused: false,
      maxCap: config.maxDailyEmails,
    };
  }

  // Never sent any email — allow week 1 limit so they can start
  if (warmupDay === 0) {
    return {
      limit: config.warmup[0],
      plan: userPlan.plan,
      warmupDay: 0,
      warmupComplete: false,
      warmupPaused: true,
      maxCap: config.maxDailyEmails,
    };
  }

  let limit: number;
  let warmupComplete = false;

  if (warmupDay <= 7) {
    // Week 1
    limit = config.warmup[0];
  } else if (warmupDay <= 14) {
    // Week 2
    limit = config.warmup[1];
  } else if (warmupDay <= 21) {
    // Week 3
    limit = config.warmup[2];
  } else {
    // Week 4+ — steady state
    limit = config.maxDailyEmails;
    warmupComplete = true;
  }

  return {
    limit,
    plan: userPlan.plan,
    warmupDay,
    warmupComplete,
    warmupPaused,
    maxCap: config.maxDailyEmails,
  };
}

// =============================================
// Get daily lead find limit
// Matches the plan's max daily email cap so user always
// has exactly enough leads to fill one day of sending.
// Starter: 50/day, Growth: 100/day, Agency: 200/day
// =============================================
export async function getDailyLeadFindLimit(userId: string): Promise<number> {
  const userPlan = await getUserPlan(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  return config.maxDailyEmails; // 50 / 100 / 200
}

// =============================================
// Count how many leads the user has found TODAY
// Delegates to getUserPlan which handles timezone-aware daily reset.
// =============================================
export async function getLeadsFoundToday(userId: string): Promise<number> {
  const userPlan = await getUserPlan(userId);
  return userPlan.leadsFoundToday;
}

// =============================================
// Atomically increment daily lead find counter
// The RPC handles auto-reset on new day + increment
// in a single atomic UPDATE (no race conditions).
// This counter NEVER decrements — deleted leads
// still count against the daily limit.
// =============================================
export async function incrementLeadsFoundToday(userId: string, count: number): Promise<void> {
  await supabase.rpc("increment_leads_found_today", {
    p_user_id: userId,
    p_count: count,
  });
}

// =============================================
// Decrement daily lead counter when background scraper
// deletes useless leads (no email + no phone).
// This gives the user back those slots so CSV/auto-find
// remaining count stays accurate.
// =============================================
export async function decrementLeadsFoundToday(userId: string, count: number): Promise<void> {
  if (count <= 0) return;
  const { data } = await supabase
    .from("user_plans")
    .select("leads_found_today, leads_found_this_month")
    .eq("user_id", userId)
    .single();
  if (!data) return;
  await supabase
    .from("user_plans")
    .update({
      leads_found_today: Math.max(0, (data.leads_found_today || 0) - count),
      leads_found_this_month: Math.max(0, (data.leads_found_this_month || 0) - count),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

// =============================================
// Check if user can find more leads today (daily cap)
// Returns: allowed, remaining slots, used today, daily limit
// =============================================
export async function checkDailyLeadFindLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  usedToday: number;
  dailyLimit: number;
  plan: PlanTier;
}> {
  const userPlan = await getUserPlan(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  const dailyLimit = config.maxDailyEmails; // 50 / 100 / 200
  const usedToday = userPlan.leadsFoundToday;
  const remaining = Math.max(0, dailyLimit - usedToday);

  return {
    allowed: remaining > 0,
    remaining,
    usedToday,
    dailyLimit,
    plan: userPlan.plan,
  };
}

// =============================================
// Check if user can find more leads this month
// =============================================
export async function checkLeadFindLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  plan: PlanTier;
}> {
  const userPlan = await getUserPlan(userId);
  const config = PLAN_CONFIGS[userPlan.plan];

  // Check if we need to reset the monthly counter (30 days from last reset)
  const resetAt = new Date(userPlan.leadsFoundResetAt);
  const now = new Date();
  const daysSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceReset >= 30) {
    // Reset monthly counter
    await supabase
      .from("user_plans")
      .update({
        leads_found_this_month: 0,
        leads_found_reset_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);

    return {
      allowed: true,
      used: 0,
      limit: config.monthlyLeadFindLimit,
      plan: userPlan.plan,
    };
  }

  return {
    allowed: userPlan.leadsFoundThisMonth < config.monthlyLeadFindLimit,
    used: userPlan.leadsFoundThisMonth,
    limit: config.monthlyLeadFindLimit,
    plan: userPlan.plan,
  };
}

// =============================================
// Increment leads found counter
// =============================================
export async function incrementLeadsFound(userId: string, count: number): Promise<void> {
  await supabase.rpc("increment_leads_found", {
    p_user_id: userId,
    p_count: count,
  });
}

// =============================================
// Max Gmail inboxes per plan (inbox rotation)
// =============================================
export function getMaxInboxes(plan: PlanTier): number {
  switch (plan) {
    case "starter": return 1;
    case "growth": return 2;
    case "agency": return 4;
    default: return 1;
  }
}

// Gmail safety cap per inbox/day (buffer below Google's 500 hard limit)
export const GMAIL_INBOX_CAP = 450;

// =============================================
// Set Gmail connected timestamp (starts warmup)
// =============================================
export async function setGmailConnectedAt(userId: string): Promise<void> {
  const userPlan = await getUserPlan(userId);

  // Only set if not already set (don't reset warmup on re-auth)
  if (!userPlan.gmailConnectedAt) {
    await supabase
      .from("user_plans")
      .update({
        gmail_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
}

// =============================================
// Get full plan info for dashboard display
// =============================================
export async function getPlanInfo(userId: string): Promise<{
  plan: PlanTier;
  serviceType: ServiceType;
  planLabel: string;
  priceMonthly: number;
  dailyLimit: number;
  maxDailyEmails: number;
  warmupDay: number;
  warmupComplete: boolean;
  warmupPaused: boolean;
  warmupWeek: number;
  leadsFoundThisMonth: number;
  monthlyLeadFindLimit: number;
  leadsFoundToday: number;
  dailyLeadFindLimit: number;
}> {
  const userPlan = await getUserPlan(userId);
  const dailyInfo = await getDailyLimit(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  const leadsFoundToday = userPlan.leadsFoundToday;

  const warmupWeek = dailyInfo.warmupDay === 0
    ? 0
    : Math.min(4, Math.ceil(dailyInfo.warmupDay / 7));

  const planLabels: Record<PlanTier, string> = {
    starter: "Starter",
    growth: "Growth",
    agency: "Agency",
  };

  return {
    plan: userPlan.plan,
    serviceType: userPlan.serviceType,
    planLabel: planLabels[userPlan.plan],
    priceMonthly: config.priceMonthly,
    dailyLimit: dailyInfo.limit,
    maxDailyEmails: config.maxDailyEmails,
    warmupDay: dailyInfo.warmupDay,
    warmupComplete: dailyInfo.warmupComplete,
    warmupPaused: dailyInfo.warmupPaused,
    warmupWeek,
    leadsFoundThisMonth: userPlan.leadsFoundThisMonth,
    monthlyLeadFindLimit: config.monthlyLeadFindLimit,
    leadsFoundToday,
    dailyLeadFindLimit: config.maxDailyEmails,
  };
}

// =============================================
// Daily AI generation cap (OpenAI cost protection)
// Uses a dedicated counter in user_plans (not DB row count)
// to prevent limit bypass when campaigns/emails are deleted.
// =============================================
export async function getGenerationsToday(userId: string): Promise<number> {
  const userPlan = await getUserPlan(userId);
  return userPlan.emailsGeneratedToday;
}

// =============================================
// Atomically increment daily email generation counter
// The RPC handles auto-reset on new day + increment
// in a single atomic UPDATE (no race conditions).
// This counter NEVER decrements — deleted emails
// still count against the daily generation limit.
// =============================================
export async function incrementEmailsGeneratedToday(userId: string, count: number): Promise<void> {
  await supabase.rpc("increment_emails_generated_today", {
    p_user_id: userId,
    p_count: count,
  });
}

// =============================================
// Atomically increment daily email sent counter
// Same pattern — monotonic, never decrements.
// Deleted campaigns still count against the daily send limit.
// =============================================
export async function incrementEmailsSentToday(userId: string, count: number): Promise<void> {
  await supabase.rpc("increment_emails_sent_today", {
    p_user_id: userId,
    p_count: count,
  });
}

export async function checkDailyGenerationLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  usedToday: number;
  dailyLimit: number;
  plan: PlanTier;
}> {
  const userPlan = await getUserPlan(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  const usedToday = userPlan.emailsGeneratedToday;
  const remaining = Math.max(0, config.maxDailyGenerations - usedToday);

  return {
    allowed: remaining > 0,
    remaining,
    usedToday,
    dailyLimit: config.maxDailyGenerations,
    plan: userPlan.plan,
  };
}

// =============================================
// Get max enrich batch size for user's plan
// =============================================
export async function getMaxEnrichBatchSize(userId: string): Promise<number> {
  const userPlan = await getUserPlan(userId);
  return PLAN_CONFIGS[userPlan.plan].maxEnrichBatchSize;
}

// =============================================
// Set user timezone (auto-detected from browser)
// Validates IANA timezone string before storing.
// Locked to once per 24h to prevent timezone-switching exploits.
// =============================================
export async function setUserTimezone(userId: string, timezone: string): Promise<boolean> {
  if (!timezone || !isValidTimezone(timezone)) return false;

  // Check if timezone was changed in the last 24 hours
  const { data } = await supabase
    .from("user_plans")
    .select("timezone, timezone_updated_at")
    .eq("user_id", userId)
    .single();

  if (data) {
    // If same timezone, no-op (always allow — this is the auto-detect re-sync)
    if (data.timezone === timezone) return true;

    // If timezone was changed within last 24h, block the change
    if (data.timezone_updated_at) {
      const lastChange = new Date(data.timezone_updated_at);
      const hoursSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60);
      if (hoursSinceChange < 24) return false;
    }
  }

  await supabase
    .from("user_plans")
    .update({
      timezone,
      timezone_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return true;
}
