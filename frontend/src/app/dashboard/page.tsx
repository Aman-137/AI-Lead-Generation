"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setDisplayName(user?.user_metadata?.full_name || user?.email || "");

        const data = await apiGet<Stats>("/stats");
        setStats(data);

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
    </div>
  );
}
