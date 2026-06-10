"use client";

import { useRouter } from "next/navigation";

interface FeatureGateProps {
  featureName: string;
  description: string;
  requiredPlan: string;
}

export default function FeatureGate({ featureName, description, requiredPlan }: FeatureGateProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
      <div className="text-center max-w-md mx-auto px-10 py-12 rounded-3xl" style={{ background: "linear-gradient(145deg, #1a1540 0%, #2d2660 50%, #3d3580 100%)", border: "1px solid rgba(105,98,196,0.35)", boxShadow: "0 20px 50px rgba(13,10,37,0.4)", minHeight: "360px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(105,98,196,0.2)", border: "1px solid rgba(105,98,196,0.3)" }}>
          <svg className="w-7 h-7" style={{ color: "#a78bfa" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{featureName}</h2>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">{description}</p>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: "rgba(105,98,196,0.15)", color: "#c4b5fd", border: "1px solid rgba(105,98,196,0.35)" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Available on {requiredPlan} &amp; Agency plans
        </div>
        <div>
          <button
            onClick={() => router.push("/settings")}
            className="px-7 py-3 text-sm font-bold rounded-xl text-white transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #6962c4 0%, #8b5cf6 100%)", boxShadow: "0 4px 20px rgba(139,92,246,0.4)" }}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}
