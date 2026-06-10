"use client";

import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[70vh] px-4">
      <div className="relative text-center max-w-lg w-full">
        {/* Large faded 404 background text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
          <span className="text-[220px] font-black tracking-tighter opacity-[0.04]" style={{ color: "#3d3580" }}>404</span>
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Animated floating icon */}
          <div className="mx-auto w-24 h-24 rounded-3xl flex items-center justify-center mb-8 animate-bounce" style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 60%, #a78bfa 100%)", boxShadow: "0 12px 40px rgba(105,98,196,0.35), 0 0 0 8px rgba(105,98,196,0.06)", animationDuration: "3s" }}>
            <svg className="w-11 h-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </div>

          {/* Error code */}
          <h1 className="text-5xl font-black mb-3 tracking-tight" style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 50%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Oops! Lost in space
          </h1>

          <p className="text-gray-400 text-base mb-2">Error 404</p>
          <p className="text-gray-500 text-sm max-w-xs mx-auto mb-10">
            The page you&apos;re looking for has drifted into the void. It might have been moved or no longer exists.
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2.5 w-48 py-3.5 text-white text-sm font-semibold rounded-xl hover:scale-[1.03] hover:shadow-xl active:scale-[0.97] transition-all"
              style={{ background: "linear-gradient(135deg, #3d3580 0%, #6962c4 100%)", boxShadow: "0 6px 20px rgba(105,98,196,0.35)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Go to Dashboard
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 w-48 py-3.5 text-gray-700 text-sm font-semibold rounded-xl border-2 border-gray-300 hover:border-[#6962c4] hover:text-[#3d3580] hover:bg-violet-50 hover:scale-[1.03] active:scale-[0.97] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
