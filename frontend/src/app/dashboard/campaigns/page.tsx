"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { apiGet, apiDelete } from "@/lib/api";
import SearchBar from "../SearchBar";
import { CampaignCardsSkeleton } from "../Skeleton";
import Pagination from "../Pagination";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_leads: number;
  queued_leads: number;
  source: string;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "auto_find" | "csv">("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await apiGet<{ campaigns: Campaign[] }>("/campaigns");
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = async (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    setDeleting(id);
    try {
      await apiDelete(`/campaigns/${id}`);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Failed to delete campaign:", err);
      alert("Failed to delete campaign");
    } finally {
      setDeleting(null);
    }
  };

  const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    draft: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400", label: "Draft" },
    running: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Running" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Completed" },
    failed: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Failed" },
  };

  const totalLeads = campaigns.reduce((sum, c) => sum + c.total_leads, 0);
  const draftCount = campaigns.filter(c => c.status === "draft").length;
  const activeCount = campaigns.filter(c => c.status === "running").length;
  const failedCount = campaigns.filter(c => c.status === "failed").length;

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;
    if (sourceFilter !== "all") {
      filtered = filtered.filter(c => {
        if (sourceFilter === "csv") return c.source === "csv" || c.source === "mixed";
        return c.source === sourceFilter || c.source === "mixed";
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [campaigns, search, sourceFilter]);

  const paginatedCampaigns = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredCampaigns.slice(start, start + PER_PAGE);
  }, [filteredCampaigns, page]);

  // Reset to page 1 when search or filter changes
  useEffect(() => { setPage(1); }, [search, sourceFilter]);

  return (
    <div>
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Delete Campaign</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Are you sure you want to delete <span className="font-semibold text-gray-700">&quot;{deleteConfirm.name}&quot;</span>? This will permanently remove all leads and emails in this campaign.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8 md:p-10 mb-8">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-4">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium text-gray-300">Campaigns</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Your Campaigns</h1>
            <p className="mt-2 text-gray-400 text-sm">Manage your outreach campaigns, track leads, and send emails.</p>
          </div>
          <Link
            href="/dashboard/upload"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Campaign
          </Link>
        </div>

        {/* Stats row */}
        {!loading && campaigns.length > 0 && (
          <div className="relative z-10 mt-6 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{campaigns.length}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Campaigns</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{totalLeads}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Leads</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-400">{draftCount}</span>
              </div>
              <p className="text-xs text-gray-400">Drafts</p>
            </div>
            {activeCount > 0 && (
              <>
                <div className="w-px h-10 bg-white/10" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-400">{activeCount}</span>
                  </div>
                  <p className="text-xs text-gray-400">Active</p>
                </div>
              </>
            )}
            {failedCount > 0 && (
              <>
                <div className="w-px h-10 bg-white/10" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-red-400">{failedCount}</span>
                  </div>
                  <p className="text-xs text-gray-400">Failed</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile new campaign button */}
      <Link
        href="/dashboard/upload"
        className="sm:hidden flex items-center justify-center gap-2 w-full mb-6 px-5 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Campaign
      </Link>

      {/* Search + Source Filter */}
      {!loading && campaigns.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <SearchBar
            placeholder="Search campaigns by name or status..."
            value={search}
            onChange={setSearch}
            className="flex-1"
          />
          <div className="relative">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as "all" | "auto_find" | "csv")}
              className="appearance-none text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 pr-9 hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="all">All Sources</option>
              <option value="auto_find">Auto-Find</option>
              <option value="csv">CSV Upload</option>
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <CampaignCardsSkeleton />
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">No campaigns yet</p>
          <p className="text-xs text-gray-400 mt-1.5">Upload leads or use Auto Lead Finder to create your first campaign</p>
          <div className="flex items-center justify-center gap-3 mt-5">
            <Link
              href="/dashboard/upload"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-200 transition-all hover:from-blue-700 hover:to-indigo-700"
            >
              Upload Leads
            </Link>
            <Link
              href="/dashboard/auto-leads"
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
            >
              Auto Find Leads
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.length === 0 && (search || sourceFilter !== "all") ? (
            <div className="bg-white rounded-2xl border border-gray-200 py-12 text-center">
              <p className="text-sm text-gray-500">No campaigns matching your filters</p>
            </div>
          ) : null}
          {paginatedCampaigns.map((campaign, index) => {
            const status = statusConfig[campaign.status] || statusConfig.draft;
            const globalIndex = (page - 1) * PER_PAGE + index;
            const colorIdx = globalIndex % 5;
            const colors = {
              gradient: ["from-blue-500 to-indigo-600", "from-violet-500 to-purple-600", "from-emerald-500 to-teal-600", "from-orange-500 to-amber-500", "from-pink-500 to-rose-600"][colorIdx],
              bgTint: ["hover:bg-blue-50/30", "hover:bg-violet-50/30", "hover:bg-emerald-50/30", "hover:bg-orange-50/30", "hover:bg-pink-50/30"][colorIdx],
              hoverText: ["group-hover:text-blue-600", "group-hover:text-violet-600", "group-hover:text-emerald-600", "group-hover:text-orange-600", "group-hover:text-pink-600"][colorIdx],
              viewBg: ["bg-blue-50 hover:bg-blue-100 text-blue-700 ring-blue-200 hover:ring-blue-300", "bg-violet-50 hover:bg-violet-100 text-violet-700 ring-violet-200 hover:ring-violet-300", "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 ring-emerald-200 hover:ring-emerald-300", "bg-orange-50 hover:bg-orange-100 text-orange-700 ring-orange-200 hover:ring-orange-300", "bg-pink-50 hover:bg-pink-100 text-pink-700 ring-pink-200 hover:ring-pink-300"][colorIdx],
            };
            return (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className={`group block bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all overflow-hidden ${colors.bgTint}`}
              >
                <div className="flex items-stretch">
                  <div className={`w-1.5 bg-gradient-to-b ${colors.gradient} flex-shrink-0`} />

                  <div className="flex items-center gap-5 px-6 py-5 flex-1 min-w-0">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg`}>
                      <span className="text-base font-bold text-white">{globalIndex + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-base font-bold text-gray-900 capitalize ${colors.hoverText} transition-colors truncate`}>
                          {campaign.name}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg ${status.bg} ${status.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        {campaign.queued_leads > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {campaign.queued_leads} Queued
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg ${
                          campaign.source === "auto_find"
                            ? "bg-blue-50 text-blue-700"
                            : campaign.source === "mixed"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-teal-50 text-teal-700"
                        }`}>
                          {campaign.source === "auto_find" ? "Auto" : campaign.source === "mixed" ? "Mixed" : "CSV"}
                        </span>
                      </div>
                      <div className="flex items-center gap-5 mt-2">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-semibold text-gray-700">{campaign.total_leads}</span> leads
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(campaign.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <span
                        className={`px-5 py-2 text-xs font-semibold rounded-xl ring-1 transition-all ${colors.viewBg}`}
                      >
                        View →
                      </span>
                      <button
                        onClick={(e) => { e.preventDefault(); handleDelete(campaign.id, campaign.name); }}
                        disabled={deleting === campaign.id}
                        className="p-2.5 text-xs font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 ring-1 ring-red-200 hover:ring-red-300 transition-all disabled:opacity-50"
                      >
                        {deleting === campaign.id ? (
                          <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
          <Pagination
            currentPage={page}
            totalItems={filteredCampaigns.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
