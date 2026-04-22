"use client";

function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div>
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-3">
            <Pulse className="h-4 w-32 !bg-white/10" />
            <Pulse className="h-8 w-64 !bg-white/10" />
            <Pulse className="h-6 w-40 !bg-white/10" />
          </div>
          <div className="flex gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="text-center space-y-2">
                <Pulse className="h-8 w-12 mx-auto !bg-white/10" />
                <Pulse className="h-3 w-16 !bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {[
          { bg: "bg-blue-50", border: "border-blue-200", pulse: "!bg-blue-200" },
          { bg: "bg-emerald-50", border: "border-emerald-200", pulse: "!bg-emerald-200" },
          { bg: "bg-violet-50", border: "border-violet-200", pulse: "!bg-violet-200" },
          { bg: "bg-amber-50", border: "border-amber-200", pulse: "!bg-amber-200" },
        ].map((c, i) => (
          <div key={i} className={`${c.bg} rounded-2xl border-2 ${c.border} p-6`}>
            <div className="space-y-3">
              <Pulse className={`h-4 w-28 ${c.pulse}`} />
              <Pulse className={`h-10 w-16 ${c.pulse}`} />
              <Pulse className={`h-3 w-24 ${c.pulse}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Gauge Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {[
          { bg: "bg-blue-50", border: "border-blue-200", pulse: "!bg-blue-200" },
          { bg: "bg-emerald-50", border: "border-emerald-200", pulse: "!bg-emerald-200" },
          { bg: "bg-violet-50", border: "border-violet-200", pulse: "!bg-violet-200" },
        ].map((c, i) => (
          <div key={i} className={`${c.bg} rounded-2xl border-2 ${c.border} p-6`}>
            <Pulse className={`h-4 w-32 mb-4 ${c.pulse}`} />
            <div className="flex items-center gap-5">
              <Pulse className={`w-[90px] h-[90px] !rounded-full ${c.pulse}`} />
              <div className="space-y-2">
                <Pulse className={`h-7 w-24 ${c.pulse}`} />
                <Pulse className={`h-3 w-28 ${c.pulse}`} />
                <Pulse className={`h-3 w-20 ${c.pulse}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { bg: "bg-sky-50", border: "border-sky-200", pulse: "!bg-sky-200" },
          { bg: "bg-teal-50", border: "border-teal-200", pulse: "!bg-teal-200" },
          { bg: "bg-pink-50", border: "border-pink-200", pulse: "!bg-pink-200" },
          { bg: "bg-rose-50", border: "border-rose-200", pulse: "!bg-rose-200" },
        ].map((c, i) => (
          <div key={i} className={`${c.bg} rounded-2xl border-2 ${c.border} p-5`}>
            <Pulse className={`h-4 w-20 mb-3 ${c.pulse}`} />
            <Pulse className={`h-8 w-14 ${c.pulse}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CampaignCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-stretch">
            <div className="w-1.5 bg-gradient-to-b from-gray-200 to-gray-300 flex-shrink-0" />
            <div className="flex items-center gap-5 px-6 py-5 flex-1">
              <Pulse className="w-12 h-12 !rounded-xl" />
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-3">
                  <Pulse className="h-5 w-48" />
                  <Pulse className="h-5 w-16 !rounded-lg" />
                </div>
                <div className="flex items-center gap-5">
                  <Pulse className="h-3.5 w-20" />
                  <Pulse className="h-3.5 w-28" />
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Pulse className="h-9 w-20 !rounded-xl" />
                <Pulse className="h-9 w-9 !rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SourcesTableSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`grid grid-cols-12 gap-4 items-center px-6 py-4 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
          <div className="col-span-4 flex items-center gap-3">
            <Pulse className="w-9 h-9 !rounded-lg flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Pulse className="h-4 w-28" />
              <Pulse className="h-3 w-36" />
            </div>
          </div>
          <div className="col-span-2">
            <Pulse className="h-6 w-16 !rounded-full" />
          </div>
          <div className="col-span-2">
            <Pulse className="h-6 w-20 !rounded-full" />
          </div>
          <div className="col-span-2">
            <Pulse className="h-4 w-14" />
          </div>
          <div className="col-span-2 flex justify-end">
            <Pulse className="h-8 w-16 !rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsAccountSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[1, 2].map(i => (
        <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <Pulse className="w-9 h-9 !rounded-full" />
            <div className="space-y-1.5">
              <Pulse className="h-4 w-40" />
              <Pulse className="h-3 w-24" />
            </div>
          </div>
          <Pulse className="h-8 w-20 !rounded-lg" />
        </div>
      ))}
    </div>
  );
}
