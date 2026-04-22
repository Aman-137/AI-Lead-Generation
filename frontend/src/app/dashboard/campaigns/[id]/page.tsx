"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost, apiPostLong, apiPut } from "@/lib/api";
import SearchBar from "../../SearchBar";
import Loader from "../../Loader";
import Pagination from "../../Pagination";

// ===== Custom Styled Dropdown =====
function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative inline-block ${className || ""}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        <span>{selected?.label || "Select..."}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1.5 bg-white border border-gray-300 rounded-xl shadow-xl py-1.5 overflow-hidden" style={{ minWidth: ref.current?.offsetWidth }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3.5 py-2 text-sm whitespace-nowrap transition-colors ${
                opt.value === value
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-50 font-medium"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
    hasOnlineBooking?: boolean;
    hasContactForm?: boolean;
    technologies?: string[];
    socialLinks?: string[];
    industry?: string;
    title?: string;
    description?: string;
    emails?: string[];
    phones?: string[];
    headings?: string[];
  };
}

interface Email {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  sequence_step?: number;
  sent_at: string | null;
  scheduled_at?: string | null;
  replied?: boolean;
  replied_at?: string | null;
  retry_count?: number;
  error_log?: string | null;
  tone_variant?: string;
  gmail_email?: string | null;
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
  { value: "US_MOUNTAIN", label: "US Mountain (Denver)", hours: "8-11 AM & 1-5 PM MST" },
  { value: "US_WEST", label: "US West (Los Angeles)", hours: "8-11 AM & 1-5 PM PST" },
  { value: "US_ALASKA", label: "US Alaska (Anchorage)", hours: "8-11 AM & 1-5 PM AKST" },
  { value: "US_HAWAII", label: "US Hawaii (Honolulu)", hours: "8-11 AM & 1-5 PM HST" },
  { value: "UK", label: "UK (London)", hours: "8-11 AM & 1-5 PM GMT" },
  { value: "EU_CENTRAL", label: "Europe Central (Berlin/Paris)", hours: "8-11 AM & 1-5 PM CET" },
  { value: "EU_EAST", label: "Europe East (Athens/Helsinki)", hours: "8-11 AM & 1-5 PM EET" },
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

// ===== Lead Detail Modal =====
function LeadDetailModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const ed = lead.enriched_data;
  const scoreColor =
    lead.score && lead.score >= 70
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
      : lead.score && lead.score >= 40
      ? "text-amber-700 bg-amber-50 ring-amber-200"
      : "text-gray-600 bg-gray-50 ring-gray-200";

  const scoreLabel =
    lead.score && lead.score >= 70
      ? "High Opportunity"
      : lead.score && lead.score >= 40
      ? "Medium Opportunity"
      : "Low Opportunity";

  // Build scoring reasons
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];

  if (!lead.website || !lead.website.startsWith("http")) {
    positiveReasons.push("No website — zero digital presence (+30)");
  } else {
    positiveReasons.push("Has a basic website (+15)");
  }

  if (ed) {
    if (ed.technologies?.includes("WordPress")) positiveReasons.push("Uses WordPress (legacy platform) (+20)");
    if (!ed.hasOnlineBooking) positiveReasons.push("No online booking system (+25)");
    if (!ed.hasContactForm) positiveReasons.push("No contact form on website (+15)");
    if (!ed.socialLinks || ed.socialLinks.length <= 1) positiveReasons.push("Weak or no social media presence (+10)");
    if (!ed.technologies || ed.technologies.length === 0) positiveReasons.push("No detectable tech platform (+10)");
    if (ed.hasOnlineBooking && ed.hasContactForm) negativeReasons.push("Has both booking & contact form (-20)");
    if (ed.technologies?.some(t => ["Shopify", "Webflow", "Wix"].includes(t))) negativeReasons.push("Uses modern platform (Shopify/Webflow/Wix) (-15)");
    if (ed.socialLinks && ed.socialLinks.length >= 3) negativeReasons.push("Strong social media (3+ platforms) (-10)");

    // Competitor detection (same logic as backend scoreLead)
    const companyLower = (lead.company || "").toLowerCase();
    const titleLower = (ed.title || "").toLowerCase();
    const descLower = (ed.description || "").toLowerCase();
    const combinedText = `${companyLower} ${titleLower} ${descLower}`;
    const competitorSignals = [
      /\bseo\s+(agency|company|firm|service|expert)/i,
      /\bweb\s+(design|development|developer)\s+(agency|company|firm|studio)/i,
      /\bdigital\s+(marketing|agency)/i,
      /\bmarketing\s+(agency|company|firm)/i,
      /\bbranding\s+agency/i,
      /\bsoftware\s+(development|company)/i,
      /\b(we\s+help|we\s+build|we\s+design|we\s+develop)\b/i,
    ];
    if (competitorSignals.some(regex => regex.test(combinedText))) {
      negativeReasons.push("Detected as a digital/marketing competitor (-30)");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900 capitalize truncate">{lead.company}</h3>
            {lead.name && <p className="text-sm text-gray-500 capitalize">{lead.name}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Score */}
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-lg font-bold ring-1 ${scoreColor}`}>
              {lead.score ?? "—"}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-700">{scoreLabel}</p>
              <p className="text-xs text-gray-400">Lead quality score (0–100)</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Contact Info</p>
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span className="text-gray-700 break-all">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <span className="text-gray-700">{lead.phone}</span>
              </div>
            )}
            {lead.website && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{lead.website}</a>
              </div>
            )}
          </div>

          {/* Enrichment Summary */}
          {ed?.summary && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Summary</p>
              <p className="text-sm text-gray-600 leading-relaxed">{ed.summary}</p>
            </div>
          )}

          {/* Issues Found */}
          {ed?.issues && ed.issues.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Issues Found</p>
              <div className="space-y-1.5">
                {ed.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </span>
                    <span className="text-sm text-gray-700">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunity */}
          {ed?.opportunity && (
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Opportunity</p>
              <p className="text-sm text-emerald-700 font-medium">{ed.opportunity}</p>
            </div>
          )}

          {/* Digital Presence */}
          {ed && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Digital Presence</p>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-3 ${ed.hasOnlineBooking ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-red-50 ring-1 ring-red-200"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 ${ed.hasOnlineBooking ? 'text-emerald-600' : 'text-red-600'}">
                    Online Booking
                  </p>
                  <p className={`text-sm font-bold ${ed.hasOnlineBooking ? "text-emerald-700" : "text-red-700"}`}>
                    {ed.hasOnlineBooking ? "Yes" : "No"}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${ed.hasContactForm ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-red-50 ring-1 ring-red-200"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 ${ed.hasContactForm ? 'text-emerald-600' : 'text-red-600'}">
                    Contact Form
                  </p>
                  <p className={`text-sm font-bold ${ed.hasContactForm ? "text-emerald-700" : "text-red-700"}`}>
                    {ed.hasContactForm ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Technologies */}
          {ed?.technologies && ed.technologies.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Technologies</p>
              <div className="flex flex-wrap gap-1.5">
                {ed.technologies.map((tech, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">{tech}</span>
                ))}
              </div>
            </div>
          )}

          {/* Social Links */}
          {ed?.socialLinks && ed.socialLinks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Social Media</p>
              <div className="space-y-1.5">
                {ed.socialLinks.map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    {link}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Industry */}
          {ed?.industry && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Industry</p>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200 capitalize">{ed.industry}</span>
            </div>
          )}

          {/* Score Breakdown */}
          {(positiveReasons.length > 0 || negativeReasons.length > 0) && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Score Breakdown</p>
              <div className="space-y-1.5">
                {positiveReasons.map((r, i) => (
                  <div key={`p-${i}`} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </span>
                    <span className="text-sm text-gray-700">{r}</span>
                  </div>
                ))}
                {negativeReasons.map((r, i) => (
                  <div key={`n-${i}`} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                    </span>
                    <span className="text-sm text-gray-700">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Enriched */}
          {!ed && (
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-sm text-amber-700 font-medium">This lead has not been enriched yet.</p>
              <p className="text-xs text-amber-500 mt-1">Click &quot;Enrich Leads&quot; to analyze this lead&apos;s digital presence.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [sourceFilter, setSourceFilter] = useState<"all" | "auto_find" | "csv" | "csv_queued">("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [leadSearch, setLeadSearch] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const LEADS_PER_PAGE = 10;

  // Reset lead page when filters change
  useEffect(() => { setLeadPage(1); }, [leadSearch, sourceFilter]);

  // Limit-reached states (disable buttons when daily cap hit)
  const [generateLimitReached, setGenerateLimitReached] = useState(false);
  const [generateLimitMsg, setGenerateLimitMsg] = useState("");
  const [enrichLimitReached, setEnrichLimitReached] = useState(false);
  const [enrichLimitMsg, setEnrichLimitMsg] = useState("");

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
      const data = await apiPostLong<{ count: number }>(endpoint, body);
      generateProgress.finish();
      const selectionNote = leadIdsToUse ? ` (${leadIdsToUse.length} selected)` : "";
      toast.addToast(`Generated ${data.count} personalized emails${selectionNote}!`, "success");
      setSelectedLeadIds(new Set());
      await fetchCampaign();
    } catch (err) {
      generateProgress.cancel();
      const message = err instanceof Error ? err.message : "Failed to generate emails";
      // Detect daily limit reached (403 from backend)
      if (message.includes("Daily AI generation limit reached") || message.includes("daily generation")) {
        setGenerateLimitReached(true);
        setGenerateLimitMsg(message);
      }
      toast.addToast(message, "error");
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
      const data = await apiPostLong<{ count: number }>("/leads/enrich", { leadIds });
      enrichProgress.finish();
      const selectionNote = selectedLeadIds.size > 0 ? ` (${selectedLeadIds.size} selected)` : "";
      toast.addToast(`Enriched ${data.count} leads${selectionNote}!`, "success");
      setSelectedLeadIds(new Set());
      await fetchCampaign();
    } catch (err) {
      enrichProgress.cancel();
      const message = err instanceof Error ? err.message : "Failed to enrich leads";
      // Detect batch size limit
      if (message.includes("batch size exceeds") || message.includes("Enrichment rate limit")) {
        setEnrichLimitReached(true);
        setEnrichLimitMsg(message);
      }
      toast.addToast(message, "error");
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
      const data = await apiPostLong<{ count: number; scripts: { lead_id: string; company: string; phone?: string; opening: string; script: string }[] }>("/generate/call-scripts", { campaignId, leadIds: leadIdsToUse });
      scriptProgress.finish();
      setCallScripts(data.scripts);
      toast.addToast(`Generated ${data.count} call scripts!`, "success");
      setSelectedLeadIds(new Set());
      await fetchCampaign();
    } catch (err) {
      scriptProgress.cancel();
      const message = err instanceof Error ? err.message : "Failed to generate call scripts";
      if (message.includes("Daily AI generation limit reached") || message.includes("daily generation")) {
        setGenerateLimitReached(true);
        setGenerateLimitMsg(message);
      }
      toast.addToast(message, "error");
    } finally {
      setGeneratingScripts(false);
    }
  };

  const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    draft: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400", label: "Draft" },
    running: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Running" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Completed" },
    pending: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Pending" },
    sent: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Sent" },
    failed: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Failed" },
  };

  const statusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg ${cfg.bg} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  if (loading) {
    return <Loader text="Loading campaign..." fullPage />;
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">Campaign not found</p>
          <button onClick={() => router.push("/dashboard/campaigns")} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
            ← Back to campaigns
          </button>
        </div>
      </div>
    );
  }

  const hasEmails = emails.length > 0;
  const hasPendingEmails = emails.some((e) => e.status === "pending");
  const contactedLeadCount = leads.filter(l => l.contacted).length;
  const queuedLeadCount = leads.filter(l => l.source_type === "csv_queued").length;
  const activeLeadCount = leads.length - queuedLeadCount;
  const sentEmailCount = emails.filter(e => e.status === "sent").length;
  const repliedEmailCount = emails.filter(e => e.replied).length;
  const heroStatus = statusConfig[campaign.status] || statusConfig.draft;

  return (
    <div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      {detailLead && <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} />}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8 md:p-10 mb-8">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>
        <div className="relative z-10">
          <button onClick={() => router.push("/dashboard/campaigns")} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to campaigns
          </button>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-white capitalize truncate">{campaign.name}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-white/10 border border-white/10`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${heroStatus.dot}`} />
                  <span className="text-gray-300">{heroStatus.label}</span>
                </span>
              </div>
              <p className="text-sm text-gray-400">
                {campaign.total_leads} leads · Created {new Date(campaign.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {campaign.status === "draft" && !hasEmails && leads.length > 0 && (selectedLeadIds.size > 0 || leads.some(l => !l.enriched_data?.summary)) && (
                <button
                  onClick={handleEnrich}
                  disabled={enriching || enrichLimitReached}
                  className="px-5 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={enrichLimitReached ? enrichLimitMsg : ""}
                >
                  {enriching ? "Enriching..." : enrichLimitReached ? "Limit Reached" : selectedLeadIds.size > 0 ? `Enrich ${selectedLeadIds.size} Selected` : "Enrich Leads"}
                </button>
              )}
              {campaign.status === "draft" && !hasEmails && leads.some(l => l.enriched_data?.summary) && (
                <button
                  onClick={handleGenerate}
                  disabled={generating || generateLimitReached}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={generateLimitReached ? generateLimitMsg : ""}
                >
                  {generating ? "Generating..." : generateLimitReached ? "Daily Limit Reached" : selectedLeadIds.size > 0 ? `Generate for ${selectedLeadIds.size} Selected` : "Generate Emails"}
                </button>
              )}
              {campaign.status === "draft" && leads.some(l => l.contact_method === "call") && leads.some(l => l.enriched_data?.summary) && (
                <button
                  onClick={handleGenerateCallScripts}
                  disabled={generatingScripts || generateLimitReached}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={generateLimitReached ? generateLimitMsg : ""}
                >
                  {generatingScripts ? "Generating..." : generateLimitReached ? "Daily Limit Reached" : "Generate Call Scripts"}
                </button>
              )}
              {campaign.status === "draft" && hasPendingEmails && (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending..." : selectedLeadIds.size > 0 ? `Send to ${selectedLeadIds.size} Selected` : "Start Campaign"}
                </button>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-6 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{activeLeadCount}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Active</p>
              </div>
            </div>
            {queuedLeadCount > 0 && (
              <>
                <div className="w-px h-10 bg-white/10" />
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{queuedLeadCount}</p>
                    <p className="text-[10px] text-amber-400 uppercase tracking-wider">Queued</p>
                  </div>
                </div>
              </>
            )}
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{contactedLeadCount}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Contacted</p>
              </div>
            </div>
            {hasEmails && (
              <>
                <div className="w-px h-10 bg-white/10" />
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{sentEmailCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sent</p>
                  </div>
                </div>
              </>
            )}
            {repliedEmailCount > 0 && (
              <>
                <div className="w-px h-10 bg-white/10" />
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{repliedEmailCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Replies</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-blue-50/50 rounded-2xl border border-blue-200 p-5 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="flex items-center gap-2">
              <CustomSelect
                value={sendTimezone}
                onChange={(val) => setSendTimezone(val)}
                options={TIMEZONE_OPTIONS.map(tz => ({ value: tz.value, label: tz.label }))}
                disabled={savingSettings}
              />
              <span className="text-xs text-gray-400 hidden md:block">{TIMEZONE_OPTIONS.find(t => t.value === sendTimezone)?.hours}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-gray-200" />

          <label htmlFor="followups-toggle" className="flex items-center gap-3 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <input
              type="checkbox"
              id="followups-toggle"
              checked={enableFollowups}
              onChange={(e) => setEnableFollowups(e.target.checked)}
              disabled={savingSettings}
              className="w-4 h-4 rounded cursor-pointer accent-violet-600"
            />
            <span className="text-sm text-gray-700 font-medium">Follow-up sequences</span>
          </label>

          {(enableFollowups !== (campaign?.enable_followups || false) ||
            sendTimezone !== (campaign?.send_timezone || "US_EAST")) && (
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="ml-auto px-5 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 font-semibold transition-all"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          )}
        </div>
        <div className="mt-3 text-xs text-gray-400 pl-11">
          Emails send during peak open times · Morning: 8–11 AM · Afternoon: 1–5 PM ({TIMEZONE_OPTIONS.find(t => t.value === sendTimezone)?.label})
        </div>
      </div>

      {/* Progress Indicators */}
      <ProgressBar tracker={enrichProgress} />
      <ProgressBar tracker={generateProgress} />
      <ProgressBar tracker={sendProgress} />
      <ProgressBar tracker={scriptProgress} />

      {/* Leads Section */}
      <div className="mt-8">
        {(() => {
          const sourceFiltered = sourceFilter === "all"
            ? leads
            : leads.filter(l => l.source_type === sourceFilter);

          const filteredLeads = leadSearch.trim()
            ? sourceFiltered.filter(l => {
                const q = leadSearch.toLowerCase();
                return (
                  (l.name?.toLowerCase().includes(q)) ||
                  (l.email?.toLowerCase().includes(q)) ||
                  (l.company?.toLowerCase().includes(q)) ||
                  (l.phone?.toLowerCase().includes(q))
                );
              })
            : sourceFiltered;

          const contactedCount = filteredLeads.filter(l => l.contacted).length;
          const uncontactedCount = filteredLeads.filter(l => !l.contacted && l.source_type !== "csv_queued").length;
          const queuedCount = filteredLeads.filter(l => l.source_type === "csv_queued").length;

          const leadStart = (leadPage - 1) * LEADS_PER_PAGE;
          const paginatedLeads = filteredLeads.slice(leadStart, leadStart + LEADS_PER_PAGE);

          return filteredLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-100">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Leads <span className="text-gray-400 font-medium">({leads.length})</span></h2>
                </div>
                <CustomSelect
                  value={sourceFilter}
                  onChange={(val) => {
                    setSourceFilter(val as "all" | "auto_find" | "csv" | "csv_queued");
                    setSelectedLeadIds(new Set());
                  }}
                  options={[
                    { value: "all" as const, label: "All Sources" },
                    { value: "auto_find" as const, label: "Auto-Find" },
                    { value: "csv" as const, label: "CSV Upload" },
                    { value: "csv_queued" as const, label: "Queued" },
                  ]}
                />
              </div>
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">No leads found for this filter.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-100">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Leads <span className="text-gray-400 font-medium">({leads.length})</span></h2>
                  </div>
                  <div className="h-6 w-px bg-blue-200" />
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-gray-500">{filteredLeads.length} showing</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <SearchBar
                    placeholder="Search leads..."
                    value={leadSearch}
                    onChange={setLeadSearch}
                    className="w-64"
                  />
                  <CustomSelect
                    value={sourceFilter}
                    onChange={(val) => {
                      setSourceFilter(val as "all" | "auto_find" | "csv" | "csv_queued");
                      setSelectedLeadIds(new Set());
                    }}
                    options={[
                      { value: "all" as const, label: "All Sources" },
                      { value: "auto_find" as const, label: "Auto-Find" },
                      { value: "csv" as const, label: "CSV Upload" },
                      { value: "csv_queued" as const, label: "Queued" },
                    ]}
                  />
                  {selectedLeadIds.size > 0 && (
                    <span className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg ring-1 ring-blue-200">
                      {selectedLeadIds.size} selected
                    </span>
                  )}
                </div>
              </div>

              {/* Table */}
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="px-4 py-3.5 text-left">
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
                          className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                        />
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedLeads.map((lead) => {
                      const scoreColor =
                        lead.score && lead.score >= 70
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : lead.score && lead.score >= 40
                          ? "bg-amber-50 text-amber-700 ring-amber-200"
                          : "bg-gray-50 text-gray-600 ring-gray-200";
                      const isCallLead = lead.contact_method === "call";
                      const isSelected = selectedLeadIds.has(lead.id);
                      return (
                        <tr key={lead.id} className={`transition-colors ${isSelected ? "bg-blue-50/70" : "hover:bg-gray-50/70"}`}>
                          <td className="px-4 py-3.5">
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
                              className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-gray-900 capitalize">{lead.name}</td>
                          <td className="px-4 py-3.5 text-sm">
                            {isCallLead ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                {lead.phone && lead.phone.trim() ? lead.phone : "No number"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                {lead.email}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600">{lead.company}</td>
                          <td className="px-4 py-3.5 text-xs">
                            <span className={`px-2.5 py-1 rounded-lg font-semibold ring-1 ${
                              lead.source_type === "csv"
                                ? "bg-purple-50 text-purple-700 ring-purple-200"
                                : lead.source_type === "csv_queued"
                                ? "bg-amber-50 text-amber-700 ring-amber-200"
                                : "bg-cyan-50 text-cyan-700 ring-cyan-200"
                            }`}>
                              {lead.source_type === "csv" ? "CSV" : lead.source_type === "csv_queued" ? "Queued" : lead.source_type === "auto_find" ? "Auto" : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm">
                            {lead.score !== undefined && lead.score !== null ? (
                              <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ring-1 ${scoreColor}`}>
                                {lead.score}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm">
                            {lead.contacted ? (
                              <div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Contacted
                                </span>
                                {lead.contacted_at && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {new Date(lead.contacted_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                Uncontacted
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => setDetailLead(lead)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg ring-1 ring-blue-200 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4">
                  <Pagination
                    currentPage={leadPage}
                    totalItems={filteredLeads.length}
                    perPage={LEADS_PER_PAGE}
                    onPageChange={setLeadPage}
                  />
                </div>
              </div>
            );
          })()}
        </div>

      {/* Emails Section */}
      {hasEmails && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-100">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Generated Emails <span className="text-gray-400 font-medium">({emails.length})</span></h2>
          </div>
          <div className="space-y-4">
            {emails.map((email) => {
              const stepColors = [
                "from-blue-500 to-indigo-500",
                "from-violet-500 to-purple-500",
                "from-orange-500 to-amber-500",
              ];
              const stepIdx = Math.min((email.sequence_step || 1) - 1, 2);
              return (
                <div key={email.id} className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all overflow-hidden">
                  <div className={`h-1 bg-gradient-to-r ${stepColors[stepIdx]}`} />
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r ${stepColors[stepIdx]}`}>
                          {(email.sequence_step || 1) === 1 ? "Initial" : `Follow-up ${(email.sequence_step || 1) - 1}`}
                        </span>
                        <span className="text-sm text-gray-500">To: <span className="font-medium text-gray-700">{email.to_email}</span></span>
                        {email.tone_variant && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium uppercase tracking-wider">{email.tone_variant}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {email.replied ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Replied
                          </span>
                        ) : email.status === "sent" ? (
                          <button
                            onClick={() => handleMarkReply(email.id)}
                            className="px-3 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Mark as Replied
                          </button>
                        ) : null}
                        {statusBadge(email.status)}
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{email.subject}</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{email.body}</p>
                    <div className="mt-3 flex items-center gap-4 flex-wrap">
                      {email.gmail_email && (
                        <p className="text-xs text-gray-400">From: {email.gmail_email}</p>
                      )}
                      {email.sent_at && (
                        <p className="text-xs text-gray-400">Sent {new Date(email.sent_at).toLocaleString()}</p>
                      )}
                      {!email.sent_at && email.scheduled_at && (
                        <p className="text-xs text-amber-600 font-medium">Scheduled: {new Date(email.scheduled_at).toLocaleString()}</p>
                      )}
                      {email.replied_at && (
                        <p className="text-xs text-emerald-600 font-medium">Replied {new Date(email.replied_at).toLocaleString()}</p>
                      )}
                      {email.error_log && email.status === "failed" && (
                        <p className="text-xs text-red-500">Error: {email.error_log}</p>
                      )}
                      {email.retry_count && email.retry_count > 0 && email.status !== "sent" && (
                        <p className="text-xs text-orange-500">Retries: {email.retry_count}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Call Scripts */}
      {callScripts.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-100">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Call Scripts <span className="text-gray-400 font-medium">({callScripts.length})</span></h2>
          </div>
          <div className="space-y-4">
            {callScripts.map((script) => (
              <div key={script.lead_id} className="bg-white rounded-2xl border border-gray-200 hover:border-orange-200 hover:shadow-md transition-all overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-gray-900 capitalize">{script.company}</span>
                    {script.phone && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-orange-700 bg-orange-50 rounded-lg ring-1 ring-orange-200">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {script.phone}
                      </span>
                    )}
                  </div>
                  {script.opening && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Opening</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{script.opening}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Full Script</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{script.script}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
