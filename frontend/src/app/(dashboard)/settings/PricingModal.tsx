"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";

interface PricingModalProps {
  plan: string;
  hasPlan: boolean;
  isExpired: boolean;
  onClose: () => void;
  onToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function PricingModal({ plan, hasPlan, isExpired, onClose, onToast }: PricingModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(selectedPlan: string) {
    setLoading(selectedPlan);
    try {
      const res = await apiPost<{ checkoutUrl?: string }>("/billing/checkout", { plan: selectedPlan });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        onToast("Failed to create checkout session", "error");
      }
    } catch (err: any) {
      onToast(err?.message || "Failed to start checkout", "error");
    } finally {
      setLoading(null);
    }
  }

  async function handleManageSubscription() {
    setLoading("manage");
    try {
      const res = await apiPost<{ portalUrl?: string }>("/billing/manage", {});
      if (res.portalUrl) {
        window.open(res.portalUrl, "_blank");
      } else {
        onToast("Could not open subscription portal", "error");
      }
    } catch (err: any) {
      onToast(err?.message || "Failed to open portal", "error");
    } finally {
      setLoading(null);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-2xl max-w-[1100px] w-full py-8 px-10" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="text-center mb-7">
          <h2 className="text-2xl font-extrabold text-gray-900">Choose Your Plan</h2>
          <p className="text-sm text-gray-500 mt-1.5">Scale your outreach with the right plan</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Starter */}
          <div className={`relative rounded-2xl p-5 pt-6 transition-all flex flex-col ${plan === "starter" ? "bg-white shadow-lg ring-2 ring-violet-400" : "bg-white shadow-sm hover:shadow-xl border border-gray-200 hover:border-gray-300"}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(105,98,196,0.1)" }}>
                <svg className="w-4 h-4" style={{ color: "#6962c4" }} fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/></svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">Starter</h3>
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-extrabold text-gray-900">$39</span>
              <span className="text-sm text-gray-400 font-medium">/month</span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />
            <ul className="space-y-2 mb-5 flex-grow">
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>50 cold emails/day (after warmup)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>1,100 leads per month</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>50 leads per enrichment batch</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>1 connected Gmail inbox</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>AI email personalization</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Automated Gmail warmup (3-week)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Lead scoring & data enrichment</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Auto find leads</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Daily limits reset at midnight</span></li>
            </ul>
            {isExpired || !hasPlan ? (
              <button
                onClick={() => handleSubscribe("starter")}
                disabled={loading === "starter"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] mt-auto disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 100%)" }}
              >
                {loading === "starter" ? "Redirecting..." : "Get Started"}
              </button>
            ) : plan === "starter" ? (
              <button
                onClick={handleManageSubscription}
                disabled={loading === "manage"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-gray-500 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-all mt-auto flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe("starter")}
                disabled={loading === "starter"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 transition-all hover:scale-[1.02] active:scale-[0.98] mt-auto disabled:opacity-60"
              >
                {loading === "starter" ? "Redirecting..." : "Downgrade"}
              </button>
            )}
          </div>

          {/* Growth - Featured */}
          <div className={`relative rounded-2xl p-5 pt-6 transition-all flex flex-col ${plan === "growth" ? "shadow-lg ring-2 ring-violet-400" : "shadow-xl shadow-amber-100/50 hover:shadow-2xl"}`} style={{ background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 30%)", border: plan === "growth" ? undefined : "1px solid #fbbf24" }}>
            {plan !== "growth" && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full text-white shadow-md bg-gradient-to-r from-amber-500 to-orange-500">🔥 Most Popular</div>
            )}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100">
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/></svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">Growth</h3>
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-extrabold text-gray-900">$79</span>
              <span className="text-sm text-gray-400 font-medium">/month</span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent mb-4" />
            <ul className="space-y-2 mb-5 flex-grow">
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>100 cold emails/day (after warmup)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>2,200 leads per month</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>100 leads per enrichment batch</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>2 connected Gmail inboxes</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>AI email personalization</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Automated Gmail warmup (3-week)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Lead scoring & data enrichment</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Auto find leads</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Hot lead tracking</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>CSV lead upload</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Daily limits reset at midnight</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>AI audit reports (SEO, marketing & web)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-400"><div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg></div><span>CRM integration <em>(coming soon)</em></span></li>
            </ul>
            {isExpired || !hasPlan ? (
              <button
                onClick={() => handleSubscribe("growth")}
                disabled={loading === "growth"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] mt-auto disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 100%)" }}
              >
                {loading === "growth" ? "Redirecting..." : "Get Started"}
              </button>
            ) : plan === "growth" ? (
              <button
                onClick={handleManageSubscription}
                disabled={loading === "manage"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-gray-500 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-all mt-auto flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                Current Plan
              </button>
            ) : plan === "agency" ? (
              <button
                onClick={() => handleSubscribe("growth")}
                disabled={loading === "growth"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 transition-all hover:scale-[1.02] active:scale-[0.98] mt-auto disabled:opacity-60"
              >
                {loading === "growth" ? "Redirecting..." : "Downgrade"}
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe("growth")}
                disabled={loading === "growth"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] mt-auto disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 100%)" }}
              >
                {loading === "growth" ? "Redirecting..." : "Upgrade"}
              </button>
            )}
          </div>

          {/* Agency */}
          <div className={`relative rounded-2xl p-5 pt-6 transition-all flex flex-col ${plan === "agency" ? "bg-white shadow-lg ring-2 ring-violet-400" : "bg-white shadow-sm hover:shadow-xl border border-gray-200 hover:border-gray-300"}`}>
            {plan !== "agency" && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full text-white shadow-md bg-gradient-to-r from-purple-600 to-indigo-600">⚡ Priority Support</div>
            )}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(61,53,128,0.1)" }}>
                <svg className="w-4 h-4" style={{ color: "#3d3580" }} fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">Agency</h3>
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-extrabold text-gray-900">$129</span>
              <span className="text-sm text-gray-400 font-medium">/month</span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />
            <ul className="space-y-2 mb-5 flex-grow">
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>200 cold emails/day (after warmup)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>4,400 leads per month</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>200 leads per enrichment batch</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>4 connected Gmail inboxes</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>AI email personalization</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Automated Gmail warmup (3-week)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Lead scoring & data enrichment</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Auto find leads</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Hot lead tracking</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>CSV lead upload</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>Daily limits reset at midnight</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div><span>AI audit reports (SEO, marketing & web)</span></li>
              <li className="flex items-start gap-2 text-xs text-gray-400"><div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5"><svg className="w-2.5 h-2.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg></div><span>CRM integration <em>(coming soon)</em></span></li>
            </ul>
            {isExpired || !hasPlan ? (
              <button
                onClick={() => handleSubscribe("agency")}
                disabled={loading === "agency"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] mt-auto disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 100%)" }}
              >
                {loading === "agency" ? "Redirecting..." : "Get Started"}
              </button>
            ) : plan === "agency" ? (
              <button
                onClick={handleManageSubscription}
                disabled={loading === "manage"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-gray-500 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-all mt-auto flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe("agency")}
                disabled={loading === "agency"}
                className="w-full py-2.5 text-xs font-bold rounded-xl text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] mt-auto disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 100%)" }}
              >
                {loading === "agency" ? "Redirecting..." : "Upgrade"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
