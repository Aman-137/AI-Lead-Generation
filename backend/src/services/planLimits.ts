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
  // Price (for display only — billing handled separately)
  priceMonthly: number;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  starter: {
    warmup: [10, 20, 35],
    maxDailyEmails: 50,
    monthlyLeadFindLimit: 1100,
    priceMonthly: 29,
  },
  growth: {
    warmup: [20, 45, 90],
    maxDailyEmails: 100,
    monthlyLeadFindLimit: 2200,
    priceMonthly: 59,
  },
  agency: {
    warmup: [40, 100, 200],
    maxDailyEmails: 200,
    monthlyLeadFindLimit: 4400,
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
    // Auto-create a starter plan for new users
    const { data: newPlan, error: insertError } = await supabase
      .from("user_plans")
      .insert({
        user_id: userId,
        plan: DEFAULT_PLAN,
        is_active: true,
        leads_found_this_month: 0,
        leads_found_reset_at: new Date().toISOString(),
      })
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
// Get daily lead search limit (how many leads per search)
// Matches the plan's max daily email cap so user always
// has exactly enough leads to fill one day of sending.
// =============================================
export async function getDailySearchLimit(userId: string): Promise<number> {
  const userPlan = await getUserPlan(userId);
  const config = PLAN_CONFIGS[userPlan.plan];
  return config.maxDailyEmails; // 50 / 100 / 200
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

  // Check if we need to reset the monthly counter
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
  const userPlan = await getUserPlan(userId);
  await supabase
    .from("user_plans")
    .update({
      leads_found_this_month: (userPlan.leadsFoundThisMonth || 0) + count,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

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
}> {
  const userPlan = await getUserPlan(userId);
  const dailyInfo = await getDailyLimit(userId);
  const config = PLAN_CONFIGS[userPlan.plan];

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
  };
}
