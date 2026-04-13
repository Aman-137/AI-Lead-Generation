"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

interface GmailAccount {
  id: string;
  email: string;
  is_primary: boolean;
  warmup_started_at: string;
  created_at: string;
}

interface SmtpAccount {
  id: string;
  email: string;
  display_name: string;
  host: string;
  port: number;
  is_primary: boolean;
  warmup_started_at: string;
  created_at: string;
}

interface AccountsResponse {
  accounts: GmailAccount[];
  maxInboxes: number;
  plan: string;
}

interface SmtpAccountsResponse {
  accounts: SmtpAccount[];
}

type SmtpProvider = "outlook" | "office365" | "yahoo" | "zoho" | "custom";

const SMTP_PRESETS: Record<SmtpProvider, { label: string; host: string; port: string; useTls: boolean; helpText: string }> = {
  outlook: {
    label: "Outlook / Hotmail",
    host: "smtp-mail.outlook.com",
    port: "587",
    useTls: true,
    helpText: "If you have 2FA enabled, use an App Password from account.microsoft.com/security",
  },
  office365: {
    label: "Microsoft 365 (Work/School)",
    host: "smtp.office365.com",
    port: "587",
    useTls: true,
    helpText: "Your admin may need to enable \"Authenticated SMTP\" for your account",
  },
  yahoo: {
    label: "Yahoo Mail",
    host: "smtp.mail.yahoo.com",
    port: "587",
    useTls: true,
    helpText: "Generate an App Password at login.yahoo.com → Account Security → App Passwords",
  },
  zoho: {
    label: "Zoho Mail",
    host: "smtp.zoho.com",
    port: "587",
    useTls: true,
    helpText: "Use an App Password if 2FA is enabled. Find it in Zoho Accounts → Security",
  },
  custom: {
    label: "Custom SMTP",
    host: "",
    port: "587",
    useTls: true,
    helpText: "Enter your SMTP server details manually",
  },
};

export default function SettingsPage() {
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [maxInboxes, setMaxInboxes] = useState(1);
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  // SMTP form state
  const [showSmtpForm, setShowSmtpForm] = useState(false);
  const [smtpProvider, setSmtpProvider] = useState<SmtpProvider | "">("");
  const [smtpForm, setSmtpForm] = useState({
    email: "",
    displayName: "",
    host: "",
    port: "587",
    username: "",
    password: "",
    useTls: true,
  });
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpError, setSmtpError] = useState("");
  const [smtpSuccess, setSmtpSuccess] = useState("");

  const totalInboxes = gmailAccounts.length + smtpAccounts.length;

  const fetchAccounts = useCallback(async () => {
    try {
      const [gmailData, smtpData] = await Promise.all([
        apiGet<AccountsResponse>("/gmail/accounts"),
        apiGet<SmtpAccountsResponse>("/smtp/accounts"),
      ]);
      setGmailAccounts(gmailData.accounts);
      setSmtpAccounts(smtpData.accounts);
      setMaxInboxes(gmailData.maxInboxes);
      setPlan(gmailData.plan);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle OAuth callback code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      (async () => {
        try {
          setLoading(true);
          await apiPost("/gmail/callback", { code });
          await fetchAccounts();
        } catch (err) {
          console.error("Failed to connect Gmail:", err);
          alert("Failed to connect Gmail. Please try again.");
        } finally {
          setLoading(false);
        }
      })();
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [fetchAccounts]);

  const addGmailInbox = async () => {
    try {
      const { url } = await apiGet<{ url: string }>("/gmail/auth-url");
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start Gmail connection.";
      alert(msg);
    }
  };

  const removeGmailInbox = async (accountId: string) => {
    if (!confirm("Remove this Gmail account? Pending emails assigned to it will be reassigned to your primary inbox.")) return;
    try {
      setRemoving(accountId);
      await apiDelete(`/gmail/accounts/${accountId}`);
      await fetchAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove account.";
      alert(msg);
    } finally {
      setRemoving(null);
    }
  };

  const removeSmtpInbox = async (accountId: string) => {
    if (!confirm("Remove this SMTP account? Pending emails assigned to it will be reassigned.")) return;
    try {
      setRemoving(accountId);
      await apiDelete(`/smtp/accounts/${accountId}`);
      await fetchAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove SMTP account.";
      alert(msg);
    } finally {
      setRemoving(null);
    }
  };

  const selectProvider = (provider: SmtpProvider) => {
    const preset = SMTP_PRESETS[provider];
    setSmtpProvider(provider);
    setSmtpForm((prev) => ({
      ...prev,
      host: preset.host,
      port: preset.port,
      useTls: preset.useTls,
    }));
    setSmtpError("");
    setSmtpSuccess("");
  };

  const testSmtpConnection = async () => {
    setSmtpError("");
    setSmtpSuccess("");
    setSmtpTesting(true);
    try {
      const username = smtpForm.username || smtpForm.email;
      await apiPost("/smtp/test", {
        email: smtpForm.email,
        host: smtpForm.host,
        port: parseInt(smtpForm.port),
        username,
        password: smtpForm.password,
        useTls: smtpForm.useTls,
      });
      setSmtpSuccess("Connection successful! You can now save this account.");
    } catch (err) {
      setSmtpError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setSmtpTesting(false);
    }
  };

  const saveSmtpAccount = async () => {
    setSmtpError("");
    setSmtpSuccess("");
    setSmtpSaving(true);
    try {
      const username = smtpForm.username || smtpForm.email;
      await apiPost("/smtp/accounts", {
        email: smtpForm.email,
        displayName: smtpForm.displayName,
        host: smtpForm.host,
        port: parseInt(smtpForm.port),
        username,
        password: smtpForm.password,
        useTls: smtpForm.useTls,
      });
      setShowSmtpForm(false);
      setSmtpProvider("");
      setSmtpForm({ email: "", displayName: "", host: "", port: "587", username: "", password: "", useTls: true });
      await fetchAccounts();
    } catch (err) {
      setSmtpError(err instanceof Error ? err.message : "Failed to add SMTP account.");
    } finally {
      setSmtpSaving(false);
    }
  };

  function getWarmupStatus(warmupStartedAt: string): { label: string; color: string } {
    const days = Math.floor((Date.now() - new Date(warmupStartedAt).getTime()) / 86400000) + 1;
    if (days > 21) return { label: "Warmed up", color: "green" };
    const week = Math.ceil(days / 7);
    return { label: `Warmup Week ${week} (Day ${days}/21)`, color: "yellow" };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-2 text-gray-600">
        Manage your email accounts and integrations.
        <span className="ml-2 text-sm text-gray-400">
          {totalInboxes}/{maxInboxes} inboxes used ({plan} plan)
        </span>
      </p>

      <div className="mt-8 max-w-xl space-y-6">
        {/* Gmail Accounts Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Gmail Accounts</h2>
              <p className="mt-1 text-sm text-gray-500">
                {gmailAccounts.length} Gmail {gmailAccounts.length === 1 ? "account" : "accounts"} connected
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="text-sm text-gray-400">Loading accounts...</p>
            ) : gmailAccounts.length === 0 ? (
              <p className="text-sm text-gray-500">No Gmail accounts connected.</p>
            ) : (
              gmailAccounts.map((account) => {
                const warmup = getWarmupStatus(account.warmup_started_at);
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-sm">✉</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {account.email}
                          </span>
                          {account.is_primary && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              Primary
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-xs ${
                            warmup.color === "green"
                              ? "text-green-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {warmup.color === "green" ? "✓ " : "⏳ "}
                          {warmup.label}
                        </span>
                      </div>
                    </div>
                    {!account.is_primary && (
                      <button
                        onClick={() => removeGmailInbox(account.id)}
                        disabled={removing === account.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        {removing === account.id ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {totalInboxes < maxInboxes && (
              <button
                onClick={addGmailInbox}
                className="w-full mt-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                + Connect Gmail Account
              </button>
            )}
          </div>
        </div>

        {/* SMTP Accounts Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">SMTP Accounts</h2>
              <p className="mt-1 text-sm text-gray-500">
                {smtpAccounts.length} SMTP {smtpAccounts.length === 1 ? "account" : "accounts"} connected
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="text-sm text-gray-400">Loading accounts...</p>
            ) : (
              smtpAccounts.map((account) => {
                const warmup = getWarmupStatus(account.warmup_started_at);
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 text-sm">⚡</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {account.email}
                          </span>
                          {account.is_primary && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {account.host}:{account.port}
                          </span>
                          <span
                            className={`text-xs ${
                              warmup.color === "green"
                                ? "text-green-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {warmup.color === "green" ? "✓ " : "⏳ "}
                            {warmup.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSmtpInbox(account.id)}
                      disabled={removing === account.id}
                      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {removing === account.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                );
              })
            )}

            {/* Add SMTP Button / Form */}
            {!showSmtpForm ? (
              totalInboxes < maxInboxes && (
                <button
                  onClick={() => { setShowSmtpForm(true); setSmtpProvider(""); setSmtpError(""); setSmtpSuccess(""); }}
                  className="w-full mt-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  + Connect Email Account
                </button>
              )
            ) : (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Connect Email Account</h3>

                {/* Provider Selection */}
                {!smtpProvider ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Select your email provider:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(SMTP_PRESETS) as [SmtpProvider, typeof SMTP_PRESETS[SmtpProvider]][]).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => selectProvider(key)}
                          className={`p-3 text-left text-sm font-medium rounded-lg border transition-colors hover:border-indigo-300 hover:bg-indigo-50 ${
                            key === "custom"
                              ? "col-span-2 border-gray-200 bg-white text-gray-600"
                              : "border-gray-200 bg-white text-gray-800"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setShowSmtpForm(false); setSmtpError(""); setSmtpSuccess(""); }}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Provider badge + change link */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        {SMTP_PRESETS[smtpProvider].label}
                      </span>
                      <button
                        onClick={() => { setSmtpProvider(""); setSmtpForm({ ...smtpForm, host: "", port: "587", useTls: true }); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Change provider
                      </button>
                    </div>

                    {/* Help text */}
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      💡 {SMTP_PRESETS[smtpProvider].helpText}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={smtpForm.email}
                          onChange={(e) => setSmtpForm({ ...smtpForm, email: e.target.value, username: e.target.value })}
                          placeholder="you@example.com"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {smtpProvider === "custom" ? "Password" : "Password or App Password"}
                        </label>
                        <input
                          type="password"
                          value={smtpForm.password}
                          onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Display Name (optional)</label>
                        <input
                          type="text"
                          value={smtpForm.displayName}
                          onChange={(e) => setSmtpForm({ ...smtpForm, displayName: e.target.value })}
                          placeholder="John Smith"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>

                      {/* Advanced fields — always visible for custom, collapsible for presets */}
                      {smtpProvider === "custom" && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Host</label>
                            <input
                              type="text"
                              value={smtpForm.host}
                              onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                              placeholder="smtp.yourdomain.com"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                            <input
                              type="number"
                              value={smtpForm.port}
                              onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                              placeholder="587"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                            <input
                              type="text"
                              value={smtpForm.username}
                              onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                              placeholder="you@yourdomain.com"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 pb-2">
                              <input
                                type="checkbox"
                                checked={smtpForm.useTls}
                                onChange={(e) => setSmtpForm({ ...smtpForm, useTls: e.target.checked })}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-xs text-gray-600">Use TLS/SSL</span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>

                    {smtpError && (
                      <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{smtpError}</p>
                    )}
                    {smtpSuccess && (
                      <p className="text-xs text-green-600 bg-green-50 p-2 rounded">{smtpSuccess}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={testSmtpConnection}
                        disabled={smtpTesting || !smtpForm.email || !smtpForm.host || !smtpForm.password}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        {smtpTesting ? "Testing..." : "Test Connection"}
                      </button>
                      <button
                        onClick={saveSmtpAccount}
                        disabled={smtpSaving || !smtpForm.email || !smtpForm.host || !smtpForm.password}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {smtpSaving ? "Saving..." : "Save Account"}
                      </button>
                      <button
                        onClick={() => { setShowSmtpForm(false); setSmtpProvider(""); setSmtpError(""); setSmtpSuccess(""); }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {totalInboxes >= maxInboxes && maxInboxes < 4 && (
            <p className="mt-3 text-xs text-gray-400">
              Upgrade your plan to connect more email accounts for better deliverability.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
