"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPut } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { DashboardSkeleton } from "./Skeleton";

interface Stats {
  totalLeads: number;
  totalCampaigns: number;
  emailsSent: number;
  totalEmails: number;
  emailsFailed: number;
  repliesReceived: number;
  replyRate: string;
  avgLeadScore: number;
  callLeads: number;
  sentToday: number;
  dailySendLimit: number;
  plan: string;
  planLabel: string;
  priceMonthly: number;
  maxDailyEmails: number;
  warmupDay: number;
  warmupComplete: boolean;
  warmupWeek: number;
  leadsFoundThisMonth: number;
  monthlyLeadFindLimit: number;
  leadsFoundToday: number;
  dailyLeadFindLimit: number;
}

interface AuditView {
  id: string;
  lead_id: string;
  device: string;
  viewed_at: string;
}

interface AuditViewsResponse {
  views: AuditView[];
  leads: Record<string, { company: string; campaign_id: string }>;
}

function CircularProgress({ value, max, color, size = 80 }: { value: number; max: number; color: string; size?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const colors: Record<string, { stroke: string; track: string }> = {
    blue: { stroke: "#3b82f6", track: "#dbeafe" },
    emerald: { stroke: "#10b981", track: "#d1fae5" },
    amber: { stroke: "#f59e0b", track: "#fef3c7" },
    violet: { stroke: "#8b5cf6", track: "#ede9fe" },
    rose: { stroke: "#f43f5e", track: "#ffe4e6" },
  };
  const c = colors[color] || colors.blue;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.track} strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.stroke} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-1000 ease-out" />
    </svg>
  );
}

function MiniBar({ values, maxVal, color }: { values: number[]; maxVal: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-400", emerald: "bg-emerald-400", amber: "bg-amber-400", violet: "bg-violet-400", rose: "bg-rose-400",
  };
  const bg = colors[color] || "bg-blue-400";
  return (
    <div className="flex items-end gap-[3px] h-10">
      {values.map((v, i) => (
        <div key={i} className={`w-[6px] rounded-full ${bg} transition-all duration-500`}
          style={{ height: `${Math.max(8, maxVal > 0 ? (v / maxVal) * 100 : 15)}%`, opacity: 0.4 + (i / values.length) * 0.6 }} />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0, totalCampaigns: 0, emailsSent: 0, totalEmails: 0,
    emailsFailed: 0, repliesReceived: 0, replyRate: "0.0%", avgLeadScore: 0,
    callLeads: 0, sentToday: 0, dailySendLimit: 0,
    plan: "starter", planLabel: "Starter", priceMonthly: 39,
    maxDailyEmails: 50, warmupDay: 0, warmupComplete: false, warmupWeek: 0,
    leadsFoundThisMonth: 0, monthlyLeadFindLimit: 100,
    leadsFoundToday: 0, dailyLeadFindLimit: 50,
  });
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [auditViews, setAuditViews] = useState<AuditViewsResponse>({ views: [], leads: {} });
  const [onboarding, setOnboarding] = useState<{ hasProfile: boolean; hasEmail: boolean; hasServiceType: boolean; hasLeads: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setDisplayName(user?.user_metadata?.full_name || user?.email || "");

        // Check if onboarding already dismissed
        const onboardingDone = user?.user_metadata?.onboarding_completed === true;

        const data = await apiGet<Stats & { serviceType?: string }>("/stats");
        setStats(data);

        // Determine onboarding state (only if not dismissed)
        if (!onboardingDone) {
          const hasProfile = !!(user?.user_metadata?.full_name);
          const hasEmail = (data.warmupDay || 0) > 0 || (data.dailySendLimit || 0) > 0;
          const hasServiceType = !!(data.serviceType && data.serviceType !== "web_dev") || !!(user?.user_metadata?.service_type_set);
          const hasLeads = (data.totalLeads || 0) > 0;

          const allDone = hasProfile && hasEmail && hasServiceType && hasLeads;
          if (allDone) {
            // Mark onboarding as complete permanently
            await supabase.auth.updateUser({ data: { onboarding_completed: true } });
            setOnboarding(null);
          } else {
            setOnboarding({ hasProfile, hasEmail, hasServiceType, hasLeads });
          }
        }

        // Fetch recent audit views (fire-and-forget, non-blocking)
        apiGet<AuditViewsResponse>("/audit/views/recent")
          .then(vd => setAuditViews(vd))
          .catch(() => {});

        // Sync browser timezone to backend (fire-and-forget)
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) apiPut("/stats/timezone", { timezone: tz }).catch(() => {});
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const v = (val: number | string) => loading ? "—" : val;

  // Fake sparkline data for visual appeal (in production, use real historical data)
  const leadSpark = [12, 18, 25, 20, 35, 42, stats.leadsFoundToday || 50];
  const emailSpark = [5, 8, 3, 12, 15, 10, stats.sentToday || 0];
  const replySpark = [0, 1, 0, 2, 1, 3, stats.repliesReceived || 0];

  const leadPct = stats.dailyLeadFindLimit > 0 ? Math.round((stats.leadsFoundToday / stats.dailyLeadFindLimit) * 100) : 0;
  const monthPct = stats.monthlyLeadFindLimit > 0 ? Math.round((stats.leadsFoundThisMonth / stats.monthlyLeadFindLimit) * 100) : 0;
  const scorePct = stats.avgLeadScore;

  if (loading) return <DashboardSkeleton />;

  return (
    <div>
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 mb-6">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-blue-300 text-sm font-medium">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-3xl font-bold text-white mt-1">
              Welcome back, {displayName.split(" ")[0]} 👋
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                {stats.planLabel} Plan
              </span>
              {stats.warmupDay > 0 && !stats.warmupComplete && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">
                  ⏳ Warmup Day {stats.warmupDay}/21
                </span>
              )}
              {stats.warmupComplete && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                  ✓ Warmup Complete
                </span>
              )}
            </div>
          </div>
          {/* Mini summary */}
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{v(stats.totalLeads)}</p>
              <p className="text-xs text-slate-400">Total Leads</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{v(stats.totalCampaigns)}</p>
              <p className="text-xs text-slate-400">Campaigns</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{v(stats.replyRate)}</p>
              <p className="text-xs text-slate-400">Reply Rate</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-sm text-rose-600">Failed to load dashboard stats. Please refresh.</p>
        </div>
      )}

      {/* Onboarding Checklist */}
      {onboarding && (
        <div className="mb-6 bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-2xl border-2 border-indigo-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Get Started</h2>
              <p className="text-sm text-gray-500 mt-0.5">Complete these steps to start generating leads and sending emails</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-indigo-600">
                {[onboarding.hasProfile, onboarding.hasEmail, onboarding.hasServiceType, onboarding.hasLeads].filter(Boolean).length}/4
              </span>
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                  style={{ width: `${([onboarding.hasProfile, onboarding.hasEmail, onboarding.hasServiceType, onboarding.hasLeads].filter(Boolean).length / 4) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Step 1: Profile */}
            <button
              onClick={() => router.push("/dashboard/settings")}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                onboarding.hasProfile
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {onboarding.hasProfile && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${onboarding.hasProfile ? "bg-emerald-100" : "bg-indigo-100"}`}>
                <svg className={`w-4 h-4 ${onboarding.hasProfile ? "text-emerald-600" : "text-indigo-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Complete Profile</p>
              <p className="text-xs text-gray-500 mt-0.5">Add your name</p>
            </button>

            {/* Step 2: Email Account */}
            <button
              onClick={() => router.push("/dashboard/settings")}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                onboarding.hasEmail
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {onboarding.hasEmail && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${onboarding.hasEmail ? "bg-emerald-100" : "bg-indigo-100"}`}>
                <svg className={`w-4 h-4 ${onboarding.hasEmail ? "text-emerald-600" : "text-indigo-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Connect Email</p>
              <p className="text-xs text-gray-500 mt-0.5">Gmail or SMTP</p>
            </button>

            {/* Step 3: Service Type */}
            <button
              onClick={() => router.push("/dashboard/settings")}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                onboarding.hasServiceType
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {onboarding.hasServiceType && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${onboarding.hasServiceType ? "bg-emerald-100" : "bg-indigo-100"}`}>
                <svg className={`w-4 h-4 ${onboarding.hasServiceType ? "text-emerald-600" : "text-indigo-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Select Service</p>
              <p className="text-xs text-gray-500 mt-0.5">SEO, Web Dev, etc.</p>
            </button>

            {/* Step 4: Find Leads */}
            <button
              onClick={() => router.push("/dashboard/auto-leads")}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                onboarding.hasLeads
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {onboarding.hasLeads && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${onboarding.hasLeads ? "bg-emerald-100" : "bg-indigo-100"}`}>
                <svg className={`w-4 h-4 ${onboarding.hasLeads ? "text-emerald-600" : "text-indigo-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Find Leads</p>
              <p className="text-xs text-gray-500 mt-0.5">Auto-find businesses</p>
            </button>
          </div>
        </div>
      )}

      {/* Dashboard content — hidden until onboarding is complete */}
      {onboarding ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-amber-900">Complete the setup to unlock your dashboard</h3>
          <p className="text-sm text-amber-700 mt-1">Finish the steps above to start finding leads, generating emails, and tracking your outreach.</p>
        </div>
      ) : (
      <>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {/* Leads Found Today */}
        <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">Leads Found Today</p>
              <p className="text-4xl font-extrabold text-blue-900 mt-2">{v(stats.leadsFoundToday)}</p>
              <p className="text-sm text-blue-600 mt-1 font-medium">
                of {v(stats.dailyLeadFindLimit)} daily limit
              </p>
            </div>
            <MiniBar values={leadSpark} maxVal={Math.max(...leadSpark)} color="blue" />
          </div>
          <div className="mt-4 w-full bg-blue-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${leadPct}%` }} />
          </div>
        </div>

        {/* Emails Sent */}
        <div className="bg-emerald-50 rounded-2xl border-2 border-emerald-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Emails Sent</p>
              <p className="text-4xl font-extrabold text-emerald-900 mt-2">{v(stats.emailsSent)}</p>
              <p className="text-sm text-emerald-600 mt-1 font-medium">
                {v(stats.sentToday)}/{v(stats.dailySendLimit)} sent today
              </p>
            </div>
            <MiniBar values={emailSpark} maxVal={Math.max(...emailSpark, 1)} color="emerald" />
          </div>
          {!loading && stats.dailySendLimit > 0 && (
            <div className="mt-4 w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
              <div className="h-2 rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (stats.sentToday / stats.dailySendLimit) * 100)}%` }} />
            </div>
          )}
        </div>

        {/* Replies */}
        <div className="bg-violet-50 rounded-2xl border-2 border-violet-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-violet-700">Replies Received</p>
              <p className="text-4xl font-extrabold text-violet-900 mt-2">{v(stats.repliesReceived)}</p>
              <p className="text-sm text-violet-600 mt-1 font-medium">
                {v(stats.replyRate)} reply rate
              </p>
            </div>
            <MiniBar values={replySpark} maxVal={Math.max(...replySpark, 1)} color="violet" />
          </div>
        </div>

        {/* Call Leads */}
        <div className="bg-amber-50 rounded-2xl border-2 border-amber-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-700">Call-Ready Leads</p>
              <p className="text-4xl font-extrabold text-amber-900 mt-2">{v(stats.callLeads)}</p>
              <p className="text-sm text-amber-600 mt-1 font-medium">
                with phone numbers
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Hot Activity — Audit Views */}
      {auditViews.views.length > 0 && (
        <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-orange-900">Hot Leads — Audit Viewed</p>
              <p className="text-xs text-orange-600">These leads opened their website audit report</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {auditViews.views.slice(0, 5).map((view) => {
              const lead = auditViews.leads[view.lead_id];
              const diff = Date.now() - new Date(view.viewed_at).getTime();
              const mins = Math.floor(diff / 60000);
              const timeAgo = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;
              return (
                <div key={view.id} className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-3 border border-orange-100">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 capitalize truncate">
                      {lead?.company || "Unknown Lead"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Viewed audit report · {view.device === "mobile" ? "📱 Mobile" : "💻 Desktop"}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-orange-700 flex-shrink-0">{timeAgo}</span>
                </div>
              );
            })}
          </div>
          {auditViews.views.length > 5 && (
            <p className="text-xs text-orange-500 mt-3 text-center font-medium">
              +{auditViews.views.length - 5} more views
            </p>
          )}
        </div>
      )}

      {/* Analytics Row — Circular Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Daily Usage */}
        <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
          <p className="text-sm font-semibold text-blue-800 mb-4">Daily Lead Usage</p>
          <div className="flex items-center gap-5">
            <div className="relative">
              <CircularProgress value={stats.leadsFoundToday} max={stats.dailyLeadFindLimit} color="blue" size={90} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-700">{loading ? "—" : `${leadPct}%`}</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{v(stats.leadsFoundToday)} <span className="text-base font-normal text-gray-400">/ {v(stats.dailyLeadFindLimit)}</span></p>
              <p className="text-sm text-gray-500 mt-1">leads found today</p>
              <p className="text-xs text-blue-600 mt-2 font-medium">
                {v(stats.dailyLeadFindLimit - stats.leadsFoundToday)} remaining
              </p>
            </div>
          </div>
        </div>

        {/* Monthly Usage */}
        <div className="bg-emerald-50 rounded-2xl border-2 border-emerald-200 p-6">
          <p className="text-sm font-semibold text-emerald-800 mb-4">Monthly Lead Usage</p>
          <div className="flex items-center gap-5">
            <div className="relative">
              <CircularProgress value={stats.leadsFoundThisMonth} max={stats.monthlyLeadFindLimit} color="emerald" size={90} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-emerald-700">{loading ? "—" : `${monthPct}%`}</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{v(stats.leadsFoundThisMonth)} <span className="text-base font-normal text-gray-400">/ {v(stats.monthlyLeadFindLimit)}</span></p>
              <p className="text-sm text-gray-500 mt-1">leads this month</p>
              <p className="text-xs text-emerald-600 mt-2 font-medium">
                {v(stats.monthlyLeadFindLimit - stats.leadsFoundThisMonth)} remaining
              </p>
            </div>
          </div>
        </div>

        {/* Lead Score */}
        <div className="bg-violet-50 rounded-2xl border-2 border-violet-200 p-6">
          <p className="text-sm font-semibold text-violet-800 mb-4">Average Lead Score</p>
          <div className="flex items-center gap-5">
            <div className="relative">
              <CircularProgress value={stats.avgLeadScore} max={100} color="violet" size={90} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-violet-700">{v(stats.avgLeadScore)}</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{v(stats.avgLeadScore)} <span className="text-base font-normal text-gray-400">/ 100</span></p>
              <p className="text-sm text-gray-500 mt-1">quality score</p>
              <p className={`text-xs mt-2 font-medium ${
                !loading && stats.avgLeadScore >= 70 ? "text-emerald-600" :
                !loading && stats.avgLeadScore >= 40 ? "text-amber-600" : "text-rose-600"
              }`}>
                {!loading && (stats.avgLeadScore >= 70 ? "Excellent quality" : stats.avgLeadScore >= 40 ? "Good quality" : "Needs improvement")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warmup Progress */}
      {!loading && stats.warmupDay > 0 && !stats.warmupComplete && (
        <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-orange-900">Email Warmup in Progress</p>
                <p className="text-sm text-orange-700">
                  Week {stats.warmupWeek} · Day {stats.warmupDay}/21 · Sending up to {stats.dailySendLimit}/day
                </p>
              </div>
            </div>
            <span className="text-lg font-bold text-orange-700">{Math.round((stats.warmupDay / 21) * 100)}%</span>
          </div>
          <div className="w-full bg-orange-100 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-700"
              style={{ width: `${Math.min(100, (stats.warmupDay / 21) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-sky-50 rounded-2xl border-2 border-sky-200 p-5">
          <p className="text-sm font-semibold text-sky-700">Total Leads</p>
          <p className="text-3xl font-extrabold text-sky-900 mt-2">{v(stats.totalLeads)}</p>
        </div>
        <div className="bg-teal-50 rounded-2xl border-2 border-teal-200 p-5">
          <p className="text-sm font-semibold text-teal-700">Campaigns</p>
          <p className="text-3xl font-extrabold text-teal-900 mt-2">{v(stats.totalCampaigns)}</p>
        </div>
        <div className="bg-pink-50 rounded-2xl border-2 border-pink-200 p-5">
          <p className="text-sm font-semibold text-pink-700">Max Daily Emails</p>
          <p className="text-3xl font-extrabold text-pink-900 mt-2">{v(stats.maxDailyEmails)}</p>
        </div>
        <div className="bg-rose-50 rounded-2xl border-2 border-rose-200 p-5">
          <p className="text-sm font-semibold text-rose-700">Failed Emails</p>
          <p className="text-3xl font-extrabold text-rose-900 mt-2">{v(stats.emailsFailed)}</p>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
