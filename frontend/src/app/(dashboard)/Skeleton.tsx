"use client";

function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: "rgba(47,39,108,0.1)" }} />;
}

export function DashboardSkeleton() {
  return (
    <div>
      {/* Hero */}
      <div className="rounded-2xl p-8 mb-6" style={{ background: "linear-gradient(135deg, #0d0a25 0%, #1a1540 50%, #2a2158 100%)" }}>
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
        {[1, 2, 3, 4].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(47,39,108,0.2)" }}>
            <div className="space-y-3">
              <Pulse className="h-4 w-28" />
              <Pulse className="h-10 w-16" />
              <Pulse className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Gauge Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(47,39,108,0.2)" }}>
            <Pulse className="h-4 w-32 mb-4" />
            <div className="flex items-center gap-5">
              <Pulse className="w-[90px] h-[90px] !rounded-full" />
              <div className="space-y-2">
                <Pulse className="h-7 w-24" />
                <Pulse className="h-3 w-28" />
                <Pulse className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(47,39,108,0.2)" }}>
            <Pulse className="h-4 w-20 mb-3" />
            <Pulse className="h-8 w-14" />
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
        <div key={i} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(47,39,108,0.2)" }}>
          <div className="flex items-stretch">
            <div className="w-1.5 flex-shrink-0" style={{ background: "linear-gradient(180deg, #2f276c, #6962c4)" }} />
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
        <div key={i} className="flex items-center justify-between p-4 rounded-xl" style={{ border: "1px solid rgba(47,39,108,0.1)", background: "rgba(47,39,108,0.03)" }}>
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
