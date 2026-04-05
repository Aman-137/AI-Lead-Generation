"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiGet } from "@/lib/api";

interface LeadSource {
  id: string;
  niche: string;
  location: string;
  status: string;
  created_at: string;
  leadsCount?: number;
  campaignId?: string;
  campaignName?: string;
}

// ===== Progress Tracker =====
interface ProgressStep {
  label: string;
  delayMs: number;
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
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

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
      <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-blue-500 to-purple-500"
          style={{ width: `${tracker.progress}%` }}
        />
      </div>
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

const findLeadsSteps: ProgressStep[] = [
  { label: "Searching Google for businesses...", delayMs: 0 },
  { label: "Extracting business details...", delayMs: 3000 },
  { label: "Creating campaign and saving leads...", delayMs: 7000 },
  { label: "Almost done...", delayMs: 12000 },
];

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

export default function AutoLeadsPage() {
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [activeTab, setActiveTab] = useState("find");
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [findingLeads, setFindingLeads] = useState(false);
  const [loadingSources, setLoadingSources] = useState(true);
  const router = useRouter();
  const findProgress = useProgressTracker(findLeadsSteps);
  const toast = useToast();

  // Fetch existing lead sources on page load
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const data = await apiGet<{ sources: LeadSource[] }>("/leads/sources");
        setSources(data.sources || []);
      } catch {
        // silently fail — sources will just be empty
      } finally {
        setLoadingSources(false);
      }
    };
    fetchSources();
  }, []);

  const handleFindLeads = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!niche.trim() || !location.trim()) {
      toast.addToast("Please enter both niche and location", "error");
      return;
    }

    setFindingLeads(true);
    findProgress.start();
    try {
      const response = await apiPost<{
        message: string;
        source_id: string;
        campaign_id?: string;
        campaign_name?: string;
        count: number;
        duplicatesSkipped?: number;
      }>("/leads/auto-find", {
        niche,
        location,
      });

      // Clear form
      setNiche("");
      setLocation("");

      // Show success message
      const newSource: LeadSource = {
        id: response.source_id,
        niche,
        location,
        status: "completed",
        created_at: new Date().toISOString(),
        leadsCount: response.count,
        campaignId: response.campaign_id,
        campaignName: response.campaign_name,
      };

      setSources((prev) => [newSource, ...prev]);

      findProgress.finish();
      const dupMsg = response.duplicatesSkipped ? ` (${response.duplicatesSkipped} duplicates skipped)` : "";
      toast.addToast(`Found ${response.count} new leads!${dupMsg}`, response.count > 0 ? "success" : "info");

      // If leads found and campaign created, navigate to campaign
      if (response.campaign_id && response.count > 0) {
        router.push(`/dashboard/campaigns/${response.campaign_id}`);
        return;
      }

      // Otherwise switch to manage tab
      setTimeout(() => setActiveTab("manage"), 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to find leads";
      toast.addToast(message, "error");
      findProgress.cancel();
      console.error("Find leads error:", err);
    } finally {
      setFindingLeads(false);
    }
  };

  const handleEnrichLeads = (source: LeadSource) => {
    if (source.campaignId) {
      router.push(`/dashboard/campaigns/${source.campaignId}`);
    } else {
      toast.addToast("No campaign found for this source. Try finding leads again.", "error");
    }
  };

  const exampleNiches = [
    "dentists",
    "chiropractors",
    "lawyers",
    "plumbers",
    "electricians",
  ];

  const exampleLocations = ["California", "Texas", "New York", "Florida"];

  const quickSetup = async (selectedNiche: string, selectedLocation: string) => {
    setNiche(selectedNiche);
    setLocation(selectedLocation);
  };

  return (
    <div>
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Auto Lead Finder</h1>
        <p className="text-gray-600 text-sm mt-1">
          Find, enrich, and score leads automatically by niche and location
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("find")}
          className={`px-4 py-3 font-medium text-sm ${
            activeTab === "find"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          🔍 Find Leads
        </button>
        <button
          onClick={() => setActiveTab("manage")}
          className={`px-4 py-3 font-medium text-sm ${
            activeTab === "manage"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          📊 Manage Sources
        </button>
      </div>

      {/* Find Leads Tab */}
      {activeTab === "find" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Find Leads by Niche & Location
              </h2>

              <form onSubmit={handleFindLeads} className="space-y-4">
                <div>
                  <label
                    htmlFor="niche"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Niche / Industry
                  </label>
                  <input
                    type="text"
                    id="niche"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g., dentists, plumbers, lawyers"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={findingLeads}
                  />
                </div>

                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., San Francisco, California, USA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={findingLeads}
                  />
                </div>

                <button
                  type="submit"
                  disabled={findingLeads}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                >
                  {findingLeads ? "🔄 Finding Leads..." : "🚀 Find Leads"}
                </button>
              </form>

              <ProgressBar tracker={findProgress} />

              {/* Quick Setup */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-3">
                  Quick Setup Examples
                </p>
                <div className="space-y-2">
                  {exampleNiches.slice(0, 2).map((example) => (
                    <button
                      key={example}
                      onClick={() => quickSetup(example, "California")}
                      className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                    >
                      {example} in California →
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-900 mb-4">How It Works</h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div>
                <p className="font-medium">1️⃣ Search</p>
                <p className="text-xs">Find businesses in your niche/location</p>
              </div>
              <div>
                <p className="font-medium">2️⃣ Enrich</p>
                <p className="text-xs">
                  Extract website data and business context
                </p>
              </div>
              <div>
                <p className="font-medium">3️⃣ Score</p>
                <p className="text-xs">
                  AI scores leads based on fit and opportunity
                </p>
              </div>
              <div>
                <p className="font-medium">4️⃣ Generate Emails</p>
                <p className="text-xs">
                  Create personalized emails with follow-ups
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Sources Tab */}
      {activeTab === "manage" && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Lead Sources
            </h2>

            {loadingSources ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">Loading your lead sources...</p>
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm">
                  No lead sources yet. Find some leads first! 👆
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Niche
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Location
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Leads Found
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr key={source.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {source.niche}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {source.location}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            {source.leadsCount || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              source.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {source.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleEnrichLeads(source)}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                          >
                            {source.campaignId ? "View Campaign →" : "Enrich & Score →"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
