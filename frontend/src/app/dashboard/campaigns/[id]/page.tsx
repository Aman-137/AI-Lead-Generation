"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost, apiPut } from "@/lib/api";

// ===== Toast Notification System =====
type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastIdCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) {
  if (toasts.length === 0) return null;

  const styles: Record<ToastType, string> = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-gray-800 text-white",
  };

  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles[toast.type]} px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 animate-slide-in text-sm`}
          role="alert"
        >
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {icons[toast.type]}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-white/70 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  website: string;
  phone?: string;
  contact_method?: string;
  source_type?: string;
  score?: number;
  contacted?: boolean;
  contacted_at?: string;
  enriched_data?: {
    summary?: string;
    issues?: string[];
    opportunity?: string;
  };
}

interface Email {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  replied?: boolean;
  replied_at?: string | null;
  retry_count?: number;
  error_log?: string | null;
  tone_variant?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_leads: number;
  enable_followups?: boolean;
  send_timezone?: string;
  created_at: string;
}

// Timezone options for email sending
const TIMEZONE_OPTIONS = [
  { value: "US_EAST", label: "US East (New York)", hours: "8-11 AM & 1-5 PM EST" },
  { value: "US_CENTRAL", label: "US Central (Chicago)", hours: "8-11 AM & 1-5 PM CST" },
  { value: "US_WEST", label: "US West (Los Angeles)", hours: "8-11 AM & 1-5 PM PST" },
  { value: "UK", label: "UK (London)", hours: "8-11 AM & 1-5 PM GMT" },
  { value: "EU_CENTRAL", label: "Europe (Berlin/Paris)", hours: "8-11 AM & 1-5 PM CET" },
];

// ===== Progress Tracker =====
interface ProgressStep {
  label: string;
  delayMs: number; // time before showing this step
}

function useProgressTracker(steps: ProgressStep[]) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const start = useCallback(() => {
    setActive(true);
    setCurrentStep(0);
    setProgress(0);
    // Clear any existing timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Schedule each step
    let elapsed = 0;
    steps.forEach((step, i) => {
      elapsed += step.delayMs;
      const t = setTimeout(() => {
        setCurrentStep(i);
        setProgress(Math.min(90, ((i + 1) / steps.length) * 90));
      }, elapsed);
      timersRef.current.push(t);
    });
  }, [steps]);

  const finish = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setProgress(100);
    setTimeout(() => {
      setActive(false);
      setCurrentStep(-1);
      setProgress(0);
    }, 600);
  }, []);

  const cancel = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setActive(false);
    setCurrentStep(-1);
    setProgress(0);
  }, []);

  return { currentStep, progress, active, start, finish, cancel, steps };
}

function ProgressBar({ tracker }: { tracker: ReturnType<typeof useProgressTracker> }) {
  if (!tracker.active) return null;
  const step = tracker.currentStep >= 0 ? tracker.steps[tracker.currentStep] : null;

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-blue-500 to-purple-500"
          style={{ width: `${tracker.progress}%` }}
        />
      </div>
      {/* Step label */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
        <span className="text-sm text-gray-700 font-medium">
          {step?.label || "Starting..."}
        </span>
        <span className="text-xs text-gray-400 ml-auto">
          {Math.round(tracker.progress)}%
        </span>
      </div>
    </div>
  );
}

// Step configs for each operation
const enrichSteps: ProgressStep[] = [
  { label: "Preparing leads for enrichment...", delayMs: 0 },
  { label: "Scraping websites in parallel...", delayMs: 2000 },
  { label: "Extracting emails and contact info...", delayMs: 6000 },
  { label: "Scoring leads based on enriched data...", delayMs: 12000 },
  { label: "Saving enrichment results...", delayMs: 20000 },
  { label: "Almost done — finalizing scores...", delayMs: 30000 },
];

const generateSteps: ProgressStep[] = [
  { label: "Analyzing lead data...", delayMs: 0 },
  { label: "Crafting personalized emails (batch 1)...", delayMs: 3000 },
  { label: "Generating more emails in parallel...", delayMs: 8000 },
  { label: "Fine-tuning subject lines...", delayMs: 15000 },
  { label: "Wrapping up — saving emails...", delayMs: 25000 },
  { label: "Almost there...", delayMs: 40000 },
];

const generateAdvancedSteps: ProgressStep[] = [
  { label: "Analyzing enriched lead profiles...", delayMs: 0 },
  { label: "Generating personalized initial emails...", delayMs: 3000 },
  { label: "Crafting follow-up sequences...", delayMs: 10000 },
  { label: "Writing follow-up nudges in parallel...", delayMs: 18000 },
  { label: "Scheduling follow-up delivery times...", delayMs: 30000 },
  { label: "Saving email sequences...", delayMs: 45000 },
  { label: "Almost done — finalizing...", delayMs: 60000 },
];

const sendSteps: ProgressStep[] = [
  { label: "Connecting to Gmail...", delayMs: 0 },
  { label: "Sending emails with natural spacing...", delayMs: 3000 },
  { label: "Emails going out (45-90s between each)...", delayMs: 15000 },
  { label: "Still sending — keeping delivery natural...", delayMs: 45000 },
  { label: "Sending more emails...", delayMs: 90000 },
  { label: "Wrapping up remaining emails...", delayMs: 150000 },
];

const callScriptSteps: ProgressStep[] = [
  { label: "Finding call-only leads...", delayMs: 0 },
  { label: "Generating call scripts in parallel...", delayMs: 2000 },
  { label: "Tailoring scripts to each business...", delayMs: 8000 },
  { label: "Finishing up...", delayMs: 15000 },
];

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [enableFollowups, setEnableFollowups] = useState(false);
  const [sendTimezone, setSendTimezone] = useState("US_EAST");
  const [savingSettings, setSavingSettings] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [callScripts, setCallScripts] = useState<{ lead_id: string; company: string; phone?: string; opening: string; script: string }[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "auto_find" | "csv">("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const toast = useToast();

  // Progress trackers for each long operation
  const enrichProgress = useProgressTracker(enrichSteps);
  const generateProgress = useProgressTracker(
    enableFollowups ? generateAdvancedSteps : generateSteps
  );
  const sendProgress = useProgressTracker(sendSteps);
  const scriptProgress = useProgressTracker(callScriptSteps);

  const fetchCampaign = useCallback(async () => {
    try {
      const data = await apiGet<{ campaign: Campaign; leads: Lead[]; emails: Email[] }>(
        `/campaigns/${campaignId}`
      );
      setCampaign(data.campaign);
      setLeads(data.leads);
      setEmails(data.emails);
      setEnableFollowups(data.campaign.enable_followups || false);
      setSendTimezone(data.campaign.send_timezone || "US_EAST");

      // Load call scripts from enriched_data
      const existingScripts = data.leads
        .filter((l: Lead) => l.contact_method === "call" && l.enriched_data && (l.enriched_data as any).call_script)
        .map((l: Lead) => {
          const cs = (l.enriched_data as any).call_script;
          return { lead_id: l.id, company: l.company, phone: l.phone, opening: cs.opening || "", script: cs.script || "" };
        });
      if (existingScripts.length > 0) setCallScripts(existingScripts);
    } catch {
      toast.addToast("Failed to load campaign", "error");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Step 3: Generate Emails
  const handleGenerate = async () => {
    setGenerating(true);
    generateProgress.start();
    try {
      const endpoint = enableFollowups ? "/generate/advanced" : "/generate";
      const leadIdsToUse = selectedLeadIds.size > 0 ? Array.from(selectedLeadIds) : undefined;
      const body = enableFollowups
        ? { campaignId, enableFollowups: true, leadIds: leadIdsToUse }
        : { campaignId, leadIds: leadIdsToUse };
      const data = await apiPost<{ count: number }>(endpoint, body);
      generateProgress.finish();
      const selectionNote = leadIdsToUse ? ` (${leadIdsToUse.length} selected)` : "";
      toast.addToast(`Generated ${data.count} personalized emails${selectionNote}!`, "success");
      setSelectedLeadIds(new Set());
      await fetchCampaign();
    } catch (err) {
      generateProgress.cancel();
      toast.addToast(err instanceof Error ? err.message : "Failed to generate emails", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Step 5: Start Campaign (send emails)
  const handleSend = async () => {
    setSending(true);
    sendProgress.start();
    try {
      const leadIdsToUse = selectedLeadIds.size > 0 ? Array.from(selectedLeadIds) : undefined;
      const data = await apiPost<{ sent: number; failed: number; total: number; queued?: boolean; message?: string }>("/send", { campaignId, leadIds: leadIdsToUse });
      sendProgress.finish();
      if (data.queued) {
        toast.addToast(data.message || "Campaign queued — will send during business hours!", "info");
      } else {
        toast.addToast(`Sent ${data.sent}/${data.total} emails.${data.failed > 0 ? ` ${data.failed} failed.` : ""}`, data.failed > 0 ? "info" : "success");
      }
      setSelectedLeadIds(new Set());
      await fetchCampaign();
    } catch (err) {
      sendProgress.cancel();
      toast.addToast(err instanceof Error ? err.message : "Failed to send emails", "error");
    } finally {
      setSending(false);
    }
  };

  // Save campaign settings (follow-ups + timezone)
  const handleSaveSettings = async () => {
    if (!campaign) return;
    setSavingSettings(true);
    try {
      const data = await apiPut<{ campaign: Campaign }>(`/campaigns/${campaign.id}`, {
        enable_followups: enableFollowups,
        send_timezone: sendTimezone,
      });
      setCampaign(data.campaign);
      const tzLabel = TIMEZONE_OPTIONS.find(t => t.value === sendTimezone)?.label || sendTimezone;
      toast.addToast(`Settings saved! Timezone: ${tzLabel}`, "success");
    } catch (err) {
      toast.addToast(err instanceof Error ? err.message : "Failed to update settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Enrich leads
  const handleEnrich = async () => {
    if (leads.length === 0) return;
    setEnriching(true);
    enrichProgress.start();
    try {
      const leadIds = selectedLeadIds.size > 0 ? Array.from(selectedLeadIds) : leads.map(l => l.id);
      const data = await apiPost<{ count: number }>("/leads/enrich", { leadIds });
      enrichProgress.finish();
      const selectionNote = selectedLeadIds.size > 0 ? ` (${selectedLeadIds.size} selected)` : "";
      toast.addToast(`Enriched ${data.count} leads${selectionNote}!`, "success");
      setSelectedLeadIds(new Set());
      await fetchCampaign();
    } catch (err) {
      enrichProgress.cancel();
      toast.addToast(err instanceof Error ? err.message : "Failed to enrich leads", "error");
    } finally {
      setEnriching(false);
    }
  };

  // Mark email as replied
  const handleMarkReply = async (emailId: string) => {
    try {
      await apiPost("/send/mark-reply", { emailId });
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, replied: true, replied_at: new Date().toISOString() } : e));
      toast.addToast("Email marked as replied", "success");
    } catch {
      toast.addToast("Failed to mark reply", "error");
    }
  };

  // Generate call scripts for call-only leads
  const handleGenerateCallScripts = async () => {
    setGeneratingScripts(true);
    scriptProgress.start();
    try {
      const leadIdsToUse = selectedLeadIds.size > 0 ? Array.from(selectedLeadIds) : undefined;
      const data = await apiPost<{ count: number; scripts: { lead_id: string; company: string; phone?: string; opening: string; script: string }[] }>("/generate/call-scripts", { campaignId, leadIds: leadIdsToUse });
      scriptProgress.finish();
      setCallScripts(data.scripts);
      toast.addToast(`Generated ${data.count} call scripts!`, "success");
      setSelectedLeadIds(new Set());
      await fetchCampaign();
    } catch (err) {
      scriptProgress.cancel();
      toast.addToast(err instanceof Error ? err.message : "Failed to generate call scripts", "error");
    } finally {
      setGeneratingScripts(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      running: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      pending: "bg-yellow-100 text-yellow-700",
      sent: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <p className="text-gray-500">Loading campaign...</p>;
  }

  if (!campaign) {
    return (
      <div>
        <p className="text-red-600">Campaign not found.</p>
        <button onClick={() => router.push("/dashboard/campaigns")} className="mt-4 text-blue-600 hover:underline text-sm">
          ← Back to campaigns
        </button>
      </div>
    );
  }

  const hasEmails = emails.length > 0;
  const hasPendingEmails = emails.some((e) => e.status === "pending");

  return (
    <div>
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push("/dashboard/campaigns")} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
            ← Back to campaigns
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            {statusBadge(campaign.status)}
            <span className="text-sm text-gray-500">{campaign.total_leads} leads</span>
            <span className="text-sm text-gray-500">
              Created {new Date(campaign.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Action buttons based on campaign flow */}
        <div className="flex gap-3">
          {/* Step 3: Generate Emails (only if draft and no emails yet) */}
          {campaign.status === "draft" && !hasEmails && leads.some(l => l.enriched_data?.summary) && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : selectedLeadIds.size > 0 ? `🤖 Generate for ${selectedLeadIds.size} Selected` : "🤖 Generate Emails"}
            </button>
          )}

          {/* Generate Call Scripts (if campaign has call leads and still in draft) */}
          {campaign.status === "draft" && leads.some(l => l.contact_method === "call") && leads.some(l => l.enriched_data?.summary) && (
            <button
              onClick={handleGenerateCallScripts}
              disabled={generatingScripts}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {generatingScripts ? "Generating..." : "📞 Generate Call Scripts"}
            </button>
          )}

          {/* Step 2: Enrich (only if draft, has leads, no enrichment yet) */}
          {campaign.status === "draft" && !hasEmails && leads.length > 0 && !leads.some(l => l.enriched_data?.summary) && (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {enriching ? "Enriching..." : selectedLeadIds.size > 0 ? `🔍 Enrich ${selectedLeadIds.size} Selected` : "🔍 Enrich Leads"}
            </button>
          )}

          {/* Step 4 & 5: Start Campaign (only if emails are pending) */}
          {campaign.status === "draft" && hasPendingEmails && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? "Sending..." : selectedLeadIds.size > 0 ? `🚀 Send to ${selectedLeadIds.size} Selected` : "🚀 Start Campaign"}
            </button>
          )}
        </div>
      </div>

      {/* Progress Indicators */}
      {/* Campaign Settings Bar */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Timezone Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">🕐 Send Timezone:</label>
            <select
              value={sendTimezone}
              onChange={(e) => setSendTimezone(e.target.value)}
              disabled={savingSettings}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-400">
              {TIMEZONE_OPTIONS.find(t => t.value === sendTimezone)?.hours}
            </span>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200" />

          {/* Follow-ups Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="followups-toggle"
              checked={enableFollowups}
              onChange={(e) => setEnableFollowups(e.target.checked)}
              disabled={savingSettings}
              className="w-4 h-4 rounded cursor-pointer"
            />
            <label htmlFor="followups-toggle" className="text-sm text-gray-700 cursor-pointer">
              Enable follow-up sequences
            </label>
          </div>

          {/* Save Button (shown when settings differ) */}
          {(enableFollowups !== (campaign?.enable_followups || false) ||
            sendTimezone !== (campaign?.send_timezone || "US_EAST")) && (
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="ml-auto px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          )}

          {/* Sending schedule info */}
          <div className="w-full mt-1 text-xs text-gray-400">
            📧 Emails send daily during peak open times • Morning: 8–11 AM • Afternoon: 1–5 PM ({TIMEZONE_OPTIONS.find(t => t.value === sendTimezone)?.label})
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      <ProgressBar tracker={enrichProgress} />
      <ProgressBar tracker={generateProgress} />
      <ProgressBar tracker={sendProgress} />
      <ProgressBar tracker={scriptProgress} />

      {/* Leads Table */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Leads ({leads.length})</h2>
          <div className="flex items-center gap-3">
            {/* Source Type Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as "all" | "auto_find" | "csv");
                setSelectedLeadIds(new Set());
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="auto_find">🔍 Auto-Find</option>
              <option value="csv">📁 CSV Upload</option>
            </select>
            {/* Selected count */}
            {selectedLeadIds.size > 0 && (
              <span className="text-sm text-blue-600 font-medium">
                {selectedLeadIds.size} selected
              </span>
            )}
          </div>
        </div>

        {(() => {
          const filteredLeads = sourceFilter === "all"
            ? leads
            : leads.filter(l => l.source_type === sourceFilter);

          const contactedCount = filteredLeads.filter(l => l.contacted).length;
          const uncontactedCount = filteredLeads.filter(l => !l.contacted).length;

          return filteredLeads.length === 0 ? (
            <p className="text-gray-500 text-sm">No leads found for this filter.</p>
          ) : (
            <>
              {/* Contact Summary Bar */}
              <div className="mb-3 flex items-center gap-4 text-sm">
                <span className="text-gray-500">
                  Showing {filteredLeads.length} leads
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  ✉ {contactedCount} contacted
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {uncontactedCount} uncontacted
                </span>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
                            } else {
                              setSelectedLeadIds(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLeads.map((lead) => {
                      const scoreColor =
                        lead.score && lead.score >= 70
                          ? "bg-green-100 text-green-700"
                          : lead.score && lead.score >= 40
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700";
                      const isCallLead = lead.contact_method === "call";
                      const isSelected = selectedLeadIds.has(lead.id);
                      return (
                        <tr key={lead.id} className={`hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedLeadIds);
                                if (e.target.checked) {
                                  next.add(lead.id);
                                } else {
                                  next.delete(lead.id);
                                }
                                setSelectedLeadIds(next);
                              }}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{lead.name}</td>
                          <td className="px-4 py-3 text-sm">
                            {isCallLead ? (
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 mb-1">
                                  📞 Call
                                </span>
                                {lead.phone && (
                                  <p className="text-gray-600 text-xs">{lead.phone}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-600">{lead.email}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{lead.company}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              lead.source_type === "csv"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-cyan-100 text-cyan-700"
                            }`}>
                              {lead.source_type === "csv" ? "📁 CSV" : lead.source_type === "auto_find" ? "🔍 Auto" : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {lead.score !== undefined && lead.score !== null ? (
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${scoreColor}`}>
                                {lead.score}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {lead.contacted ? (
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  ✉ Contacted
                                </span>
                                {lead.contacted_at && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {new Date(lead.contacted_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                Uncontacted
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {lead.enriched_data?.summary ? (
                              <div className="max-w-xs">
                                <p className="truncate" title={lead.enriched_data.summary}>
                                  {lead.enriched_data.summary}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Not enriched</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>

      {/* Emails Table */}
      {hasEmails && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generated Emails ({emails.length})</h2>
          <div className="space-y-4">
            {emails.map((email) => (
              <div key={email.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">To: {email.to_email}</span>
                    {email.tone_variant && (
                      <span className="text-xs text-gray-400">({email.tone_variant})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {email.replied ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✅ Replied</span>
                    ) : email.status === "sent" ? (
                      <button
                        onClick={() => handleMarkReply(email.id)}
                        className="px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      >
                        Mark as Replied
                      </button>
                    ) : null}
                    {statusBadge(email.status)}
                  </div>
                </div>
                <h3 className="font-medium text-gray-900">{email.subject}</h3>
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{email.body}</p>
                <div className="mt-2 flex items-center gap-3">
                  {email.sent_at && (
                    <p className="text-xs text-gray-400">
                      Sent {new Date(email.sent_at).toLocaleString()}
                    </p>
                  )}
                  {email.replied_at && (
                    <p className="text-xs text-green-600">
                      Replied {new Date(email.replied_at).toLocaleString()}
                    </p>
                  )}
                  {email.error_log && email.status === "failed" && (
                    <p className="text-xs text-red-500">Error: {email.error_log}</p>
                  )}
                  {email.retry_count && email.retry_count > 0 && email.status !== "sent" && (
                    <p className="text-xs text-orange-500">Retries: {email.retry_count}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call Scripts Section */}
      {callScripts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Call Scripts ({callScripts.length})</h2>
          <div className="space-y-4">
            {callScripts.map((script) => (
              <div key={script.lead_id} className="bg-white rounded-xl shadow-sm border border-orange-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{script.company}</span>
                  {script.phone && (
                    <span className="text-sm text-orange-600 font-medium">📞 {script.phone}</span>
                  )}
                </div>
                {script.opening && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Opening</p>
                    <p className="text-sm text-gray-700">{script.opening}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Script</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{script.script}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
