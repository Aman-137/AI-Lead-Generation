"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface PageSpeedMetrics {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  speedIndex: number;
}

interface AuditData {
  company: string;
  website: string;
  industry: string;
  score: number;
  summary: string | null;
  issues: string[];
  opportunity: string | null;
  signals: {
    hasOnlineBooking: boolean | null;
    hasContactForm: boolean | null;
    hasSSL: boolean | null;
    isMobileFriendly: boolean | null;
    hasMetaDescription: boolean | null;
    pageLoadTimeMs: number | null;
    pageSizeKB: number | null;
    copyrightYear: number | null;
    socialLinks: number;
    technologies: string[];
    isParkedDomain: boolean;
    _siteDown: boolean;
    pageSpeed: {
      mobile: PageSpeedMetrics | null;
      desktop: PageSpeedMetrics | null;
    } | null;
    hasGoogleAds: boolean | null;
    hasFacebookPixel: boolean | null;
    hasAnalytics: boolean | null;
    googleRating: number | null;
    googleReviewCount: number | null;
  };
}

function ScoreRing({ score }: { score: number }) {
  const healthScore = Math.max(0, Math.min(100, 100 - score));
  const grade =
    healthScore >= 80 ? "A" : healthScore >= 60 ? "B" : healthScore >= 40 ? "C" : healthScore >= 20 ? "D" : "F";
  const color =
    healthScore <= 30 ? "#ef4444" : healthScore <= 60 ? "#f59e0b" : "#10b981";
  const label =
    healthScore <= 30
      ? "Needs Immediate Attention"
      : healthScore <= 60
      ? "Room for Improvement"
      : "Looking Good";

  const r = 58;
  const circ = 2 * Math.PI * r;
  const offset = circ - (healthScore / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[148px] h-[148px]">
        <svg className="w-[148px] h-[148px] -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="64" cy="64" r={r} fill="none"
            stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold tracking-tight" style={{ color }}>{healthScore}</span>
          <span className="text-[11px] text-gray-400 font-semibold">/100</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-sm" style={{ backgroundColor: color }}>
          {grade}
        </span>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
    </div>
  );
}

// ===== Lighthouse-style Performance Gauge (like Chrome DevTools) =====
function LighthouseGauge({ score, size = 96 }: { score: number; size?: number }) {
  const color = score >= 90 ? "#0cce6b" : score >= 50 ? "#ffa400" : "#ff4e42";
  const bgColor = score >= 90 ? "#0cce6b22" : score >= 50 ? "#ffa40022" : "#ff4e4222";
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill={bgColor} stroke="#e2e8f0" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function LighthouseMetricRow({ label, value, unit, threshold }: { label: string; value: number; unit: string; threshold: { good: number; poor: number } }) {
  const displayValue = unit === "s" ? (value / 1000).toFixed(1) : value.toFixed(3);
  const color = value <= threshold.good ? "#0cce6b" : value <= threshold.poor ? "#ffa400" : "#ff4e42";
  const status = value <= threshold.good ? "Good" : value <= threshold.poor ? "Needs Work" : "Poor";

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-700 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold" style={{ color }}>{displayValue}{unit}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: `${color}15`, color }}>{status}</span>
      </div>
    </div>
  );
}

function truncateUrl(url: string, maxLen = 40): string {
  const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen) + "\u2026";
}

export default function AuditReportPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    fetch(`${apiUrl}/audit/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Report not found");
        return res.json();
      })
      .then((d) => {
        setData(d);
        // Track view (fire-and-forget — don't block page render)
        fetch(`${apiUrl}/audit/${token}/view`, { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => {});
      })
      .catch(() => setError("This audit report was not found or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Generating your report&hellip;</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-10 max-w-sm text-center border border-gray-100">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Report Not Found</h1>
          <p className="text-sm text-gray-500 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  const s = data.signals;
  const currentYear = new Date().getFullYear();

  // Build checklist — each issue has impact statement + recommendation
  type Check = { label: string; pass: boolean; detail: string; impact: string; fix: string; icon: string };
  const checks: Check[] = [];
  const industry = data.industry || "Local Business";

  if (s.hasSSL !== null) {
    checks.push({
      label: s.hasSSL ? "SSL Certificate Active" : "No SSL \u2014 Browser Shows \"Not Secure\"",
      pass: s.hasSSL,
      icon: "\uD83D\uDD12",
      detail: s.hasSSL
        ? "Your site shows the lock icon \u2014 visitors see it as trustworthy and safe to use."
        : "Every person who visits your site sees a \"Not Secure\" warning in Chrome. Open your site right now and look at the address bar \u2014 you\u2019ll see it.",
      impact: s.hasSSL ? "" : "85% of consumers say they won\u2019t continue browsing an unsecure website. That\u2019s 8 out of 10 potential customers gone before they even read anything.",
      fix: s.hasSSL ? "" : "Requires proper certificate installation, server configuration, and redirect setup to avoid mixed-content errors.",
    });
  }
  if (s.isMobileFriendly !== null) {
    checks.push({
      label: s.isMobileFriendly ? "Mobile-Friendly Design" : "Not Optimized for Mobile",
      pass: s.isMobileFriendly,
      icon: "\uD83D\uDCF1",
      detail: s.isMobileFriendly
        ? "Your site adapts to phone screens \u2014 text is readable, buttons are tappable, navigation works."
        : `Pull up your site on your phone right now. If text is tiny, buttons overlap, or you have to pinch-to-zoom \u2014 that\u2019s what every mobile customer sees.`,
      impact: s.isMobileFriendly ? "" : `63% of all Google searches come from mobile devices. For ${industry.toLowerCase()} businesses, most people searching \u201C${industry.toLowerCase()} near me\u201D are on their phone. If they can\u2019t navigate your site, they hit back and call your competitor.`,
      fix: s.isMobileFriendly ? "" : "Requires a full responsive redesign across all page templates, navigation, and forms to work on every device.",
    });
  }
  // Performance check — prefer Google PageSpeed score over raw load time
  const mobilePerf = s.pageSpeed?.mobile?.performanceScore;
  if (mobilePerf !== undefined && mobilePerf !== null) {
    const fast = mobilePerf >= 50;
    checks.push({
      label: fast ? `Performance Score \u2014 ${mobilePerf}/100` : `Poor Performance \u2014 ${mobilePerf}/100`,
      pass: fast,
      icon: "\u26A1",
      detail: fast
        ? `Google rates your mobile site performance at ${mobilePerf}/100. This is within acceptable range for user experience.`
        : `Google rates your mobile site performance at ${mobilePerf} out of 100. You can verify this yourself \u2014 go to pagespeed.web.dev and enter your website URL.`,
      impact: fast ? "" : `Google uses page speed as a ranking factor. Sites scoring below 50 load so slowly that over half of mobile visitors leave before seeing your content \u2014 choosing a competitor instead.`,
      fix: fast ? "" : "Requires image optimization, code minification, server improvements, and render-blocking resource elimination.",
    });
  } else if (s.pageLoadTimeMs !== null) {
    const secs = (s.pageLoadTimeMs / 1000).toFixed(1);
    const fast = s.pageLoadTimeMs <= 3000;
    checks.push({
      label: fast ? `Fast Load Speed \u2014 ${secs}s` : `Slow Load Speed \u2014 ${secs} seconds`,
      pass: fast,
      icon: "\u26A1",
      detail: fast
        ? "Your site loads within Google\u2019s recommended 3-second window. Visitors get instant access."
        : `Your website takes ${secs} seconds to load. That\u2019s ${(parseFloat(secs) - 3).toFixed(1)} seconds over Google\u2019s recommendation. You can test this yourself \u2014 open your site and count.`,
      impact: fast ? "" : "Google research shows 53% of mobile visitors leave if a page takes longer than 3 seconds. For every 100 people who click your site, roughly half are leaving before seeing anything.",
      fix: fast ? "" : "Image compression, caching, and platform optimization can cut load time by 50\u201370%.",
    });
  }
  if (s.hasOnlineBooking !== null) {
    checks.push({
      label: s.hasOnlineBooking ? "Online Booking Available" : "No Online Booking System",
      pass: s.hasOnlineBooking,
      icon: "\uD83D\uDCC5",
      detail: s.hasOnlineBooking
        ? "Customers can schedule appointments directly from your website, 24/7, without calling."
        : `There\u2019s no way for someone to book an appointment on your website. When a potential customer visits at 10pm and wants to schedule with a ${industry.toLowerCase()}, they can\u2019t \u2014 they\u2019ll Google the next option and book there instead.`,
      impact: s.hasOnlineBooking ? "" : "Businesses with online booking report 2\u20133x more appointments than call-only businesses. 67% of customers prefer booking online over calling.",
      fix: s.hasOnlineBooking ? "" : "Needs integration with your calendar, automated confirmations, and proper placement to maximize conversions.",
    });
  }
  if (s.hasContactForm !== null) {
    checks.push({
      label: s.hasContactForm ? "Contact Form Found" : "No Contact Form",
      pass: s.hasContactForm,
      icon: "\u2709\uFE0F",
      detail: s.hasContactForm
        ? "Visitors can send you a message directly from the website without leaving."
        : "There\u2019s no contact form on your site. The only option for a visitor is to pick up the phone and call \u2014 and most people won\u2019t. They\u2019ll find a competitor with a simple \u201CGet a Quote\u201D form instead.",
      impact: s.hasContactForm ? "" : "Contact forms capture leads 24/7, even when you\u2019re closed. Businesses without one miss every inquiry that happens outside of calling hours.",
      fix: s.hasContactForm ? "" : "Requires strategic placement, spam protection, and integration with your workflow to capture leads effectively.",
    });
  }
  if (s.hasMetaDescription !== null) {
    checks.push({
      label: s.hasMetaDescription ? "SEO Description Present" : "Missing SEO Description",
      pass: s.hasMetaDescription,
      icon: "\uD83D\uDD0D",
      detail: s.hasMetaDescription
        ? "When someone Googles your business, the search result shows a clear, compelling description of what you do."
        : `Google your business name right now. Instead of a professional description, you\u2019ll see a blank or auto-generated snippet that looks unprofessional compared to competitors who have proper descriptions.`,
      impact: s.hasMetaDescription ? "" : "Search results with optimized descriptions get 5.8% higher click-through rates. That\u2019s more people choosing your listing over competitors.",
      fix: s.hasMetaDescription ? "" : "Each page needs a unique, keyword-optimized description that matches search intent for your services.",
    });
  }
  checks.push({
    label: s.socialLinks >= 2 ? `Active on ${s.socialLinks} Social Platforms` : s.socialLinks === 1 ? "Only 1 Social Profile" : "No Social Media Presence",
    pass: s.socialLinks >= 2,
    icon: "\uD83D\uDC65",
    detail: s.socialLinks >= 2
      ? "Your business shows up across multiple social platforms \u2014 customers can find and verify you on the channels they use."
      : `When someone hears about your business and checks Instagram or Facebook to see your work, they find nothing. For a ${industry.toLowerCase()}, this is especially costly \u2014 people want to see your portfolio and social proof before reaching out.`,
    impact: s.socialLinks >= 2 ? "" : "71% of consumers who have a positive social media experience with a brand are likely to recommend it. No presence means no word-of-mouth amplification.",
    fix: s.socialLinks >= 2 ? "" : "Even one active profile with consistent posting builds trust and shows potential customers you\u2019re active and engaged.",
  });
  if (s.hasGoogleAds !== null) {
    checks.push({
      label: s.hasGoogleAds ? "Running Google Ads" : "Not Running Google Ads",
      pass: s.hasGoogleAds,
      icon: "\uD83D\uDCB0",
      detail: s.hasGoogleAds
        ? "Your business is actively running Google Ads \u2014 you\u2019re showing up when potential customers search for your services."
        : `Search for \u201C${industry.toLowerCase()} near me\u201D \u2014 your competitors are paying to appear at the very top of results. You\u2019re not. Every day without ads, those customers go to whoever shows up first.`,
      impact: s.hasGoogleAds ? "" : "Businesses running Google Ads typically see 2-5x more inquiries than those relying solely on organic search.",
      fix: s.hasGoogleAds ? "" : "Requires proper campaign setup, keyword research, and landing page optimization to get a positive return on ad spend.",
    });
  }
  if (s.hasAnalytics !== null) {
    checks.push({
      label: s.hasAnalytics ? "Website Analytics Active" : "No Website Analytics",
      pass: s.hasAnalytics,
      icon: "\uD83D\uDCCA",
      detail: s.hasAnalytics
        ? "You\u2019re tracking visitor behaviour \u2014 you can see what\u2019s working and what\u2019s not on your site."
        : "Your website has no analytics tracking. You have zero visibility into how many people visit, where they come from, or why they leave without contacting you.",
      impact: s.hasAnalytics ? "" : "Without analytics, you\u2019re making business decisions blind. You can\u2019t improve what you can\u2019t measure.",
      fix: s.hasAnalytics ? "" : "Requires Google Analytics setup, conversion tracking, and proper configuration to generate useful insights.",
    });
  }
  if (s.googleRating !== null) {
    const goodRating = s.googleRating >= 4.0;
    checks.push({
      label: goodRating ? `Google Rating: ${s.googleRating}\u2605 (${s.googleReviewCount || 0} reviews)` : `Low Google Rating: ${s.googleRating}\u2605`,
      pass: goodRating && (s.googleReviewCount || 0) >= 10,
      icon: "\u2B50",
      detail: goodRating
        ? `Your business has a solid ${s.googleRating}-star rating on Google with ${s.googleReviewCount || 0} reviews \u2014 this builds trust with new customers.`
        : `Your Google rating is ${s.googleRating} stars${s.googleReviewCount ? ` with only ${s.googleReviewCount} reviews` : ""}. When someone searches for a ${industry.toLowerCase()} and compares options, a sub-4-star rating makes them scroll past you.`,
      impact: goodRating ? "" : "88% of consumers trust online reviews as much as personal recommendations. A rating below 4.0 is a red flag to potential customers.",
      fix: goodRating ? "" : "A consistent review generation strategy can improve your rating and review count within 2-3 months.",
    });
  }
  if (s.copyrightYear !== null) {
    const fresh = s.copyrightYear >= currentYear - 1;
    checks.push({
      label: fresh ? `Copyright Up to Date (${s.copyrightYear})` : `Outdated Copyright \u2014 \u00A9 ${s.copyrightYear}`,
      pass: fresh,
      icon: "\uD83D\uDCC6",
      detail: fresh
        ? "Your website footer shows the current year \u2014 signals an active, maintained business."
        : `Your website footer says \u00A9 ${s.copyrightYear}. Scroll to the bottom of your site and check. To a visitor, this signals the business may be closed or that nobody is maintaining the website.`,
      impact: fresh ? "" : `That\u2019s ${currentYear - s.copyrightYear} years out of date. Visitors subconsciously notice \u2014 it\u2019s a small detail that erodes trust, especially when competitors\u2019 sites look fresh.`,
      fix: fresh ? "" : "A 10-second fix that instantly makes your site look current and maintained.",
    });
  }

  const failChecks = checks.filter(c => !c.pass);
  const passChecks = checks.filter(c => c.pass);
  const healthScore = Math.max(0, Math.min(100, 100 - data.score));
  const industryAvg = 52 + (industry.length % 11);
  const estimatedLossMin = failChecks.length * 8;
  const estimatedLossMax = failChecks.length * 15;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero — matches app dashboard dark gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="absolute top-1/2 right-1/3 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-xl mx-auto px-5 pt-10 pb-8">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Website Audit Report</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white capitalize tracking-tight leading-tight">
            {data.company}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
            {data.website && (
              <a href={data.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-blue-300 hover:bg-white/15 transition-colors" title={data.website}>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                {truncateUrl(data.website)}
              </a>
            )}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30 capitalize">
              {data.industry}
            </span>
          </div>

          <p className="text-[11px] text-white/30 mt-4">Report generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 -mt-1">
        {/* Executive Summary */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <p className="text-sm font-bold text-gray-900">Executive Summary</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            We analyzed <span className="font-semibold text-gray-900">{data.company}</span>&apos;s online presence across {checks.length} key areas that directly impact whether potential customers choose you or a competitor.
          </p>
          {failChecks.length > 0 && (
            <p className="text-sm text-gray-600 leading-relaxed mt-3">
              <span className="font-semibold text-red-700">{failChecks.length} critical {failChecks.length === 1 ? "issue was" : "issues were"} found</span> that {failChecks.length === 1 ? "is" : "are"} actively driving customers to competitors. {failChecks.length >= 2 ? "The combination of these issues compounds the problem \u2014 each one makes the others worse." : ""}
            </p>
          )}
          {data.opportunity && (
            <div className="mt-4 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Opportunity</p>
              <p className="text-sm text-amber-700 leading-relaxed">{data.opportunity}</p>
            </div>
          )}
        </div>

        {/* Critical alert */}
        {(s._siteDown || s.isParkedDomain) && (
          <div className="mt-6 rounded-2xl p-5 bg-rose-50 border-2 border-rose-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-rose-800">
                  {s._siteDown ? "Website is Down or Unreachable" : "Domain is Parked / Under Construction"}
                </p>
                <p className="text-xs text-rose-600 mt-1 leading-relaxed">
                  Customers searching for your business cannot find a working website. Every potential customer goes to a competitor.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Score card */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-8 pb-6 flex flex-col items-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-5">Digital Health Score</p>
            <ScoreRing score={data.score} />
          </div>
          <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">
            <div className="grid grid-cols-3 divide-x divide-gray-200 text-center">
              <div className="px-2">
                <p className="text-xl font-extrabold text-red-600">{failChecks.length}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Issues</p>
              </div>
              <div className="px-2">
                <p className="text-xl font-extrabold text-emerald-600">{passChecks.length}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Passed</p>
              </div>
              <div className="px-2">
                <p className="text-xl font-extrabold text-gray-800">{checks.length}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Checked</p>
              </div>
            </div>
          </div>
        </div>

        {/* Google Lighthouse Score */}
        {s.pageSpeed && (s.pageSpeed.mobile || s.pageSpeed.desktop) && (
          <div className="mt-6">
            {/* Section Header */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-indigo-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">Google Lighthouse Score</p>
                <p className="text-xs text-gray-400">Powered by PageSpeed Insights — same as Chrome DevTools</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0cce6b]" />
                <span className="text-[11px] text-gray-500 font-medium">90–100 Good</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffa400]" />
                <span className="text-[11px] text-gray-500 font-medium">50–89 Needs Work</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff4e42]" />
                <span className="text-[11px] text-gray-500 font-medium">0–49 Poor</span>
              </div>
            </div>

            {/* Mobile Card */}
            {s.pageSpeed.mobile && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                <div className="px-6 pt-5 pb-1">
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-base">📱</span> Mobile
                  </p>
                </div>

                {/* 4 Category Gauges */}
                <div className="px-6 py-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.mobile.performanceScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">Performance</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.mobile.accessibilityScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">Accessibility</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.mobile.bestPracticesScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">Best Practices</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.mobile.seoScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">SEO</p>
                    </div>
                  </div>
                </div>

                {/* Performance Diagnostics */}
                <div className="border-t border-gray-100 px-6 py-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Core Web Vitals</p>
                  <div>
                    <LighthouseMetricRow
                      label="First Contentful Paint"
                      value={s.pageSpeed.mobile.firstContentfulPaint}
                      unit="s"
                      threshold={{ good: 1800, poor: 3000 }}
                    />
                    <LighthouseMetricRow
                      label="Largest Contentful Paint"
                      value={s.pageSpeed.mobile.largestContentfulPaint}
                      unit="s"
                      threshold={{ good: 2500, poor: 4000 }}
                    />
                    <LighthouseMetricRow
                      label="Total Blocking Time"
                      value={s.pageSpeed.mobile.totalBlockingTime}
                      unit="s"
                      threshold={{ good: 200, poor: 600 }}
                    />
                    <LighthouseMetricRow
                      label="Cumulative Layout Shift"
                      value={s.pageSpeed.mobile.cumulativeLayoutShift}
                      unit=""
                      threshold={{ good: 0.1, poor: 0.25 }}
                    />
                    <LighthouseMetricRow
                      label="Speed Index"
                      value={s.pageSpeed.mobile.speedIndex}
                      unit="s"
                      threshold={{ good: 3400, poor: 5800 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Card */}
            {s.pageSpeed.desktop && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 pt-5 pb-1">
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-base">💻</span> Desktop
                  </p>
                </div>

                {/* 4 Category Gauges */}
                <div className="px-6 py-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.desktop.performanceScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">Performance</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.desktop.accessibilityScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">Accessibility</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.desktop.bestPracticesScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">Best Practices</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <LighthouseGauge score={s.pageSpeed.desktop.seoScore} size={72} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-700 text-center">SEO</p>
                    </div>
                  </div>
                </div>

                {/* Performance Diagnostics */}
                <div className="border-t border-gray-100 px-6 py-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Core Web Vitals</p>
                  <div>
                    <LighthouseMetricRow
                      label="First Contentful Paint"
                      value={s.pageSpeed.desktop.firstContentfulPaint}
                      unit="s"
                      threshold={{ good: 1800, poor: 3000 }}
                    />
                    <LighthouseMetricRow
                      label="Largest Contentful Paint"
                      value={s.pageSpeed.desktop.largestContentfulPaint}
                      unit="s"
                      threshold={{ good: 2500, poor: 4000 }}
                    />
                    <LighthouseMetricRow
                      label="Total Blocking Time"
                      value={s.pageSpeed.desktop.totalBlockingTime}
                      unit="s"
                      threshold={{ good: 200, poor: 600 }}
                    />
                    <LighthouseMetricRow
                      label="Cumulative Layout Shift"
                      value={s.pageSpeed.desktop.cumulativeLayoutShift}
                      unit=""
                      threshold={{ good: 0.1, poor: 0.25 }}
                    />
                    <LighthouseMetricRow
                      label="Speed Index"
                      value={s.pageSpeed.desktop.speedIndex}
                      unit="s"
                      threshold={{ good: 3400, poor: 5800 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Context note */}
            <p className="mt-3 text-[11px] text-gray-400 text-center">
              Scores from Google Lighthouse — the same tool used in Chrome DevTools and by Google to evaluate page quality for search rankings
            </p>
          </div>
        )}

        {/* How You Compare */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-bold text-gray-900 mb-4">How You Compare</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-gray-700">Your Score</span>
                <span className="text-xs font-bold" style={{ color: healthScore <= 30 ? '#ef4444' : healthScore <= 60 ? '#f59e0b' : '#10b981' }}>{healthScore}/100</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${healthScore}%`, backgroundColor: healthScore <= 30 ? '#ef4444' : healthScore <= 60 ? '#f59e0b' : '#10b981' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-gray-500">Average {industry}</span>
                <span className="text-xs font-bold text-gray-400">{industryAvg}/100</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gray-300 transition-all duration-1000" style={{ width: `${industryAvg}%` }} />
              </div>
            </div>
          </div>
          {healthScore < industryAvg && (
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Your digital presence scores <span className="font-bold text-red-600">{industryAvg - healthScore} points below</span> the average {industry.toLowerCase()} business in your area.
            </p>
          )}
        </div>

        {/* Estimated customer loss */}
        {failChecks.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-200 p-6 text-center">
            <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-2">Estimated Monthly Impact</p>
            <p className="text-3xl font-extrabold text-red-700">{estimatedLossMin}&ndash;{estimatedLossMax}</p>
            <p className="text-sm font-semibold text-red-600 mt-1">potential customers lost per month</p>
            <p className="text-xs text-red-500/70 mt-2 leading-relaxed">
              Based on {failChecks.length} active {failChecks.length === 1 ? "issue" : "issues"} affecting your online visibility and conversion rate
            </p>
          </div>
        )}

        {/* Issues */}
        {failChecks.length > 0 && (
          <div className="mt-6 bg-red-50 rounded-2xl border-2 border-red-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="text-sm font-bold text-red-900">What Needs Fixing</p>
            </div>
            <p className="text-xs text-red-600/70 mb-4 ml-9">Each issue below is actively sending customers to your competitors</p>
            <div className="space-y-0">
              {failChecks.map((check, i) => (
                <div key={i} className={`py-4 ${i > 0 ? "border-t border-red-200/50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5 flex-shrink-0">{check.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-red-800">{check.label}</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase tracking-wider">
                          #{i + 1}{i === 0 ? " — Fix This First" : " Priority"}
                        </span>
                      </div>
                      <p className="text-[13px] text-red-900/70 mt-1.5 leading-relaxed">{check.detail}</p>
                      {check.impact && (
                        <p className="text-xs text-red-700/60 mt-2 leading-relaxed italic">{check.impact}</p>
                      )}
                      {check.fix && (
                        <div className="mt-2.5 flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          <p className="text-xs font-medium text-red-700/80">{check.fix}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passed */}
        {passChecks.length > 0 && (
          <div className="mt-6 bg-emerald-50 rounded-2xl border-2 border-emerald-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-sm font-bold text-emerald-900">What&apos;s Working Well</p>
            </div>
            <p className="text-xs text-emerald-600/70 mb-4 ml-9">Keep these up &mdash; they&apos;re giving you an edge</p>
            <div className="space-y-0">
              {passChecks.map((check, i) => (
                <div key={i} className={`flex items-start gap-3 py-3 ${i > 0 ? "border-t border-emerald-200/50" : ""}`}>
                  <span className="text-base mt-0.5 flex-shrink-0">{check.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">{check.label}</p>
                    <p className="text-[13px] text-emerald-700/60 mt-1 leading-relaxed">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technologies */}
        {s.technologies.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-bold text-gray-900 mb-3">Technologies Detected</p>
            <div className="flex flex-wrap gap-2">
              {s.technologies.map((tech, i) => (
                <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottom line */}
        {failChecks.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-bold text-gray-900 mb-2">The Bottom Line</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Every day these {failChecks.length} {failChecks.length === 1 ? "issue goes" : "issues go"} unfixed, potential customers are finding your business online and choosing a competitor instead. The good news: {failChecks.length === 1 ? "this is" : "these are all"} fixable with the right expertise and a clear plan.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-gray-800">{failChecks.length}</p>
                <p className="text-[10px] text-gray-400 font-semibold uppercase">Fixable {failChecks.length === 1 ? "Issue" : "Issues"}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-blue-600">Expert</p>
                <p className="text-[10px] text-gray-400 font-semibold uppercase">Help Needed</p>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        {failChecks.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-bold text-gray-900 mb-4">Your Next Steps</p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-blue-700">1</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Reply to the email</p>
                  <p className="text-xs text-gray-500">We&apos;ll create a priority fix plan specific to your business &mdash; no cost</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-violet-700">2</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Get your fix roadmap</p>
                  <p className="text-xs text-gray-500">We&apos;ll show you exactly what to fix, in what order, and how long each takes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-emerald-700">3</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Start seeing results</p>
                  <p className="text-xs text-gray-500">We handle everything &mdash; you focus on running your business</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 text-center">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />
          </div>
          <div className="relative z-10">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {failChecks.length > 0 ? "These issues are all fixable." : "Your site is in good shape."}
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
              {failChecks.length > 0
                ? `Reply to the email that brought you here. We\u2019ll show you exactly what to fix first and how long each one takes \u2014 no cost for the roadmap.`
                : "If you want to go from good to great, reply to the email that brought you here and we\u2019ll show you how."}
            </p>
          </div>
        </div>

        {/* Footer with brand */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-400">Inertia Leads</span>
          </div>
          <p className="text-[10px] text-gray-300">
            Automated website audit &bull; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
