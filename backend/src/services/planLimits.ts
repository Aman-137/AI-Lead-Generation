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
// Get or create user plan
// =============================================
export async function getUserPlan(userId: string): Promise<{
  plan: PlanTier;
  gmailConnectedAt: string | null;
  isActive: boolean;
  leadsFoundThisMonth: number;
  leadsFoundResetAt: string;
}> {
  const { data, error } = await supabase
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Auto-create a starter plan for new users (upsert to avoid race condition)
    const { data: newPlan, error: insertError } = await supabase
      .from("user_plans")
      .upsert({
        user_id: userId,
        plan: DEFAULT_PLAN,
        is_active: true,
        leads_found_this_month: 0,
        leads_found_reset_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (insertError || !newPlan) {
      // Fallback to starter defaults if insert fails (e.g. race condition)
      return {
        plan: DEFAULT_PLAN,
        gmailConnectedAt: null,
        isActive: true,
        leadsFoundThisMonth: 0,
        leadsFoundResetAt: new Date().toISOString(),
      };
    }

    return {
      plan: newPlan.plan as PlanTier,
      gmailConnectedAt: newPlan.gmail_connected_at,
      isActive: newPlan.is_active,
      leadsFoundThisMonth: newPlan.leads_found_this_month || 0,
      leadsFoundResetAt: newPlan.leads_found_reset_at,
    };
  }

  return {
    plan: data.plan as PlanTier,
    gmailConnectedAt: data.gmail_connected_at,
    isActive: data.is_active,
    leadsFoundThisMonth: data.leads_found_this_month || 0,
    leadsFoundResetAt: data.leads_found_reset_at,
  };
}

// =============================================
// Calculate warmup day (days since Gmail connected)
// =============================================
function getWarmupDay(gmailConnectedAt: string | null): number {
  if (!gmailConnectedAt) return 0; // Gmail not connected yet
  const connected = new Date(gmailConnectedAt);
  const now = new Date();
  const diffMs = now.getTime() - connected.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // Day 1 = connection day
}

// =============================================
// Get today's daily email limit for a user
// =============================================
export async function getDailyLimit(userId: string): Promise<{
  limit: number;
  plan: PlanTier;
  warmupDay: number;
  warmupComplete: boolean;
  maxCap: number;
}> {
  const userPlan = await getUserPlan(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  const warmupDay = getWarmupDay(userPlan.gmailConnectedAt);

  // Gmail not connected — no sending allowed
  if (warmupDay === 0) {
    return {
      limit: 0,
      plan: userPlan.plan,
      warmupDay: 0,
      warmupComplete: false,
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
// (counts leads with source_type='auto_find' created today)
// =============================================
export async function getLeadsFoundToday(userId: string): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source_type", "auto_find")
    .gte("created_at", today.toISOString());

  return count || 0;
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
  const usedToday = await getLeadsFoundToday(userId);
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
  planLabel: string;
  priceMonthly: number;
  dailyLimit: number;
  maxDailyEmails: number;
  warmupDay: number;
  warmupComplete: boolean;
  warmupWeek: number;
  leadsFoundThisMonth: number;
  monthlyLeadFindLimit: number;
  leadsFoundToday: number;
  dailyLeadFindLimit: number;
}> {
  const userPlan = await getUserPlan(userId);
  const dailyInfo = await getDailyLimit(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  const leadsFoundToday = await getLeadsFoundToday(userId);

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
    planLabel: planLabels[userPlan.plan],
    priceMonthly: config.priceMonthly,
    dailyLimit: dailyInfo.limit,
    maxDailyEmails: config.maxDailyEmails,
    warmupDay: dailyInfo.warmupDay,
    warmupComplete: dailyInfo.warmupComplete,
    warmupWeek,
    leadsFoundThisMonth: userPlan.leadsFoundThisMonth,
    monthlyLeadFindLimit: config.monthlyLeadFindLimit,
    leadsFoundToday,
    dailyLeadFindLimit: config.maxDailyEmails,
  };
}

// =============================================
// Daily AI generation cap (OpenAI cost protection)
// Counts emails generated today for a user
// =============================================
export async function getGenerationsToday(userId: string): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("emails")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", today.toISOString());

  return count || 0;
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
  const usedToday = await getGenerationsToday(userId);
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
