"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

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
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0, totalCampaigns: 0, emailsSent: 0, totalEmails: 0,
    emailsFailed: 0, repliesReceived: 0, replyRate: "0.0%", avgLeadScore: 0,
    callLeads: 0, sentToday: 0, dailySendLimit: 0,
    plan: "starter", planLabel: "Starter", priceMonthly: 29,
    maxDailyEmails: 50, warmupDay: 0, warmupComplete: false, warmupWeek: 0,
    leadsFoundThisMonth: 0, monthlyLeadFindLimit: 100,
  });
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setEmail(user?.email || "");

        const data = await apiGet<Stats>("/stats");
        setStats(data);
      } catch {
        // stats will remain 0
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const v = (val: number | string) => loading ? "—" : val;

  const isNewUser = !loading && stats.totalLeads === 0 && stats.totalCampaigns === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome back, {email}</p>

      {/* Onboarding Guide — shows for new users */}
      {isNewUser && (
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Get started in 4 steps</h2>
          <p className="text-sm text-gray-600 mt-1">Launch your first campaign in minutes.</p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/dashboard/auto-leads" className="block bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all">
              <div className="text-2xl mb-2">1️⃣</div>
              <h3 className="font-medium text-sm text-gray-900">Find Leads</h3>
              <p className="text-xs text-gray-500 mt-1">Enter a niche & location, or upload a CSV file</p>
            </Link>

            <div className="bg-white rounded-lg p-4 border border-gray-200 opacity-70">
              <div className="text-2xl mb-2">2️⃣</div>
              <h3 className="font-medium text-sm text-gray-900">Enrich & Score</h3>
              <p className="text-xs text-gray-500 mt-1">We scrape websites and score each lead 0–100</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 opacity-70">
              <div className="text-2xl mb-2">3️⃣</div>
              <h3 className="font-medium text-sm text-gray-900">Generate Emails</h3>
              <p className="text-xs text-gray-500 mt-1">AI writes personalized cold emails per lead</p>
            </div>

            <Link href="/dashboard/settings" className="block bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all">
              <div className="text-2xl mb-2">4️⃣</div>
              <h3 className="font-medium text-sm text-gray-900">Connect Gmail & Send</h3>
              <p className="text-xs text-gray-500 mt-1">Link your Gmail and start your campaign</p>
            </Link>
          </div>
        </div>
      )}

      {/* Plan & Warmup Status */}
      {!loading && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{stats.planLabel} Plan</span>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  ${stats.priceMonthly}/mo
                </span>
              </div>
              {stats.warmupDay === 0 ? (
                <p className="text-xs text-amber-600 mt-1">
                  Connect Gmail in Settings to start warmup
                </p>
              ) : stats.warmupComplete ? (
                <p className="text-xs text-green-600 mt-1">
                  Warmup complete — sending up to {stats.maxDailyEmails}/day
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Warmup Day {stats.warmupDay}/21 (Week {stats.warmupWeek}) — sending up to {stats.dailySendLimit}/day → max {stats.maxDailyEmails}/day
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Leads found this month</p>
              <p className="text-sm font-semibold text-gray-900">
                {stats.leadsFoundThisMonth}/{stats.monthlyLeadFindLimit}
              </p>
            </div>
          </div>
          {stats.warmupDay > 0 && !stats.warmupComplete && (
            <div className="mt-3">
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats.warmupDay / 21) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{Math.min(21, stats.warmupDay)} of 21 warmup days completed</p>
            </div>
          )}
        </div>
      )}

      {/* Key Metrics — the 3 that sell your SaaS */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Emails Sent</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{v(stats.emailsSent)}</p>
          <p className="mt-1 text-xs text-gray-400">Today: {v(stats.sentToday)}/{v(stats.dailySendLimit)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6 border-l-4 border-l-green-500">
          <h3 className="text-sm font-medium text-gray-500">Replies Received</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">{v(stats.repliesReceived)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 border-l-4 border-l-blue-500">
          <h3 className="text-sm font-medium text-gray-500">Reply Rate</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">{v(stats.replyRate)}</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-medium text-gray-500">Total Leads</h3>
          <p className="mt-1 text-xl font-bold text-gray-900">{v(stats.totalLeads)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-medium text-gray-500">Campaigns</h3>
          <p className="mt-1 text-xl font-bold text-gray-900">{v(stats.totalCampaigns)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-medium text-gray-500">Avg Lead Score</h3>
          <p className="mt-1 text-xl font-bold text-gray-900">{v(stats.avgLeadScore)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-medium text-gray-500">Call Leads</h3>
          <p className="mt-1 text-xl font-bold text-orange-600">{v(stats.callLeads)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-medium text-gray-500">Failed Emails</h3>
          <p className="mt-1 text-xl font-bold text-red-600">{v(stats.emailsFailed)}</p>
        </div>
      </div>
    </div>
  );
}
