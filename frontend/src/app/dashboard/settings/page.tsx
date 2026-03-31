"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface GmailStatus {
  connected: boolean;
  email?: string;
}

export default function SettingsPage() {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkGmailStatus = useCallback(async () => {
    try {
      const status = await apiGet<GmailStatus>("/gmail/status");
      setGmailStatus(status);
    } catch (err) {
      console.error("Failed to check Gmail status:", err);
      setGmailStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkGmailStatus();
  }, [checkGmailStatus]);

  const connectGmail = async () => {
    try {
      const { url } = await apiGet<{ url: string }>("/gmail/auth-url");
      window.location.href = url;
    } catch {
      alert("Failed to start Gmail connection. Please try again.");
    }
  };

  const handleCallback = useCallback(async (code: string) => {
    try {
      setLoading(true);
      await apiPost("/gmail/callback", { code });
      await checkGmailStatus();
    } catch (err) {
      console.error("Failed to connect Gmail:", err);
      alert("Failed to connect Gmail. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [checkGmailStatus]);

  // Handle OAuth callback code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      handleCallback(code);
      // Clean URL
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [handleCallback]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-2 text-gray-600">Manage your integrations.</p>

      <div className="mt-8 max-w-xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Gmail Integration</h2>
          <p className="mt-1 text-sm text-gray-500">
            Connect your Gmail account to send cold emails directly.
          </p>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-gray-400">Checking connection...</p>
            ) : gmailStatus?.connected ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Connected
                </span>
                <span className="text-sm text-gray-600">{gmailStatus.email}</span>
              </div>
            ) : (
              <button
                onClick={connectGmail}
                className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Connect Gmail
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
