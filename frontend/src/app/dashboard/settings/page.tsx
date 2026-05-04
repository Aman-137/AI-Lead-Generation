"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { SettingsAccountSkeleton } from "../Skeleton";

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
          className={`${styles[toast.type]} px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 text-sm`}
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
    </div>
  );
}

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

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Service type state
  const [serviceType, setServiceType] = useState("web_dev");
  const [savedServiceType, setSavedServiceType] = useState("web_dev");
  const [serviceTypeSaving, setServiceTypeSaving] = useState(false);
  const toast = useToast();

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
    // Load current name from Supabase user metadata
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setProfileName(user?.user_metadata?.full_name || "");
      setProfileBio(user?.user_metadata?.bio || "");
      setProfileAvatarUrl(user?.user_metadata?.avatar_url || "");
      setProfileEmail(user?.email || "");
      if (user?.created_at) {
        setMemberSince(new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
      }
      if (!user?.user_metadata?.full_name) setProfileEditing(true);
    };
    loadProfile();
    // Load service type from stats
    apiGet<{ serviceType?: string }>("/stats").then((data) => {
      if (data.serviceType) {
        setServiceType(data.serviceType);
        setSavedServiceType(data.serviceType);
      }
    }).catch(() => {});
  }, [fetchAccounts]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileName.trim(), bio: profileBio.trim(), avatar_url: profileAvatarUrl },
      });
      if (error) throw error;
      setProfileMsg({ type: "success", text: "Profile updated!" });
      setProfileEditing(false);
      setTimeout(() => setProfileMsg(null), 3000);
    } catch {
      setProfileMsg({ type: "error", text: "Failed to update profile." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileMsg({ type: "error", text: "Please select an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMsg({ type: "error", text: "Image must be under 2MB." });
      return;
    }

    setAvatarUploading(true);
    setProfileMsg(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const url = `${publicUrl}?t=${Date.now()}`;
      setProfileAvatarUrl(url);

      await supabase.auth.updateUser({ data: { avatar_url: url } });
      setProfileMsg({ type: "success", text: "Avatar uploaded!" });
    } catch {
      setProfileMsg({ type: "error", text: "Failed to upload avatar." });
    } finally {
      setAvatarUploading(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ type: "success", text: "Password changed!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMsg({ type: "error", text: "Failed to change password." });
    } finally {
      setPasswordSaving(false);
    }
  };

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
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8 md:p-10 mb-8">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-6">
          {/* Avatar */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl cursor-pointer group flex-shrink-0"
          >
            <div className="w-20 h-20 rounded-2xl ring-2 ring-white/20 ring-offset-2 ring-offset-gray-900 overflow-hidden">
              {profileAvatarUrl ? (
                <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold">
                  {(profileName?.[0] || "U").toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            {avatarUploading && (
              <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-3">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-medium text-gray-300">Account Settings</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{profileName || "Your Profile"}</h1>
            <p className="text-gray-400 text-sm mt-1">Manage your profile, security, and email integrations</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 ring-1 ring-blue-500/30">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400 ring-1 ring-white/10">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {totalInboxes}/{maxInboxes} inboxes
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-blue-50 rounded-2xl shadow-sm border-2 border-blue-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-100 to-indigo-100 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-300">
                  <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Personal Information</h2>
                  <p className="text-xs text-gray-500">Update your name and bio</p>
                </div>
              </div>
              {!profileEditing && profileName && (
                <button
                  onClick={() => { setProfileEditing(true); setProfileMsg(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white/80 rounded-lg hover:bg-white ring-1 ring-blue-200 hover:ring-blue-300 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {profileEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => { setProfileName(e.target.value); setProfileMsg(null); }}
                    placeholder="Enter your full name"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">About</label>
                  <textarea
                    value={profileBio}
                    onChange={(e) => { setProfileBio(e.target.value); setProfileMsg(null); }}
                    placeholder="Tell us a little about yourself..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 focus:bg-white transition-all resize-none"
                  />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving || !profileName.trim()}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200 transition-all"
                  >
                    {profileSaving ? "Saving..." : "Save Profile"}
                  </button>
                  {profileName.trim() && (
                    <button
                      onClick={() => { setProfileEditing(false); setProfileMsg(null); }}
                      className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {profileMsg && (
                    <span className={`text-sm font-medium ${profileMsg.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
                      {profileMsg.type === "success" ? "✓ " : ""}{profileMsg.text}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              (() => {
                const checks = [
                  { label: "Name", done: !!profileName.trim() },
                  { label: "Bio", done: !!profileBio.trim() },
                  { label: "Avatar", done: !!profileAvatarUrl },
                  { label: "Inbox", done: totalInboxes > 0 },
                ];
                const completed = checks.filter(c => c.done).length;
                const pct = Math.round((completed / checks.length) * 100);
                return (
                  <div className="flex gap-5">
                    {/* Left: profile info */}
                    <div className="flex-1 space-y-4 min-w-0">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{profileName}</p>
                        {profileBio && (
                          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{profileBio}</p>
                        )}
                      </div>
                      <div className="border-t border-blue-100 pt-3 grid grid-cols-1 gap-2.5">
                        {profileEmail && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <span className="text-gray-600 truncate">{profileEmail}</span>
                          </div>
                        )}
                        {memberSince && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <span className="text-gray-600">Member since {memberSince}</span>
                          </div>
                        )}
                      </div>
                      {profileMsg && (
                        <span className={`text-sm font-medium ${profileMsg.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
                          {profileMsg.type === "success" ? "✓ " : ""}{profileMsg.text}
                        </span>
                      )}
                    </div>

                    {/* Right: vertical progress bar with checklist on left */}
                    <div className="flex items-stretch gap-3 pl-4 border-l border-blue-100">
                      <div className="flex flex-col justify-center gap-3">
                        {checks.map(c => (
                          <div key={c.label} className="flex items-center gap-1.5" title={c.label}>
                            {c.done ? (
                              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                            )}
                            <span className={`text-[11px] ${c.done ? "text-gray-600" : "text-gray-400"}`}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-sm font-bold ${pct === 100 ? "text-emerald-600" : "text-blue-600"}`}>{pct}%</span>
                        <div className="relative w-3 flex-1 min-h-[100px] rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`absolute bottom-0 w-full rounded-full transition-all duration-700 ${pct === 100 ? "bg-gradient-to-t from-emerald-500 via-teal-400 to-green-300" : "bg-gradient-to-t from-blue-600 via-violet-500 to-amber-400"}`}
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-amber-50 rounded-2xl shadow-sm border-2 border-amber-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-100 to-orange-100 border-b border-amber-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-300">
                <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Security</h2>
                <p className="text-xs text-gray-500">Update your password</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordMsg(null); }}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMsg(null); }}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={changePassword}
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-amber-200 transition-all"
              >
                {passwordSaving ? "Changing..." : "Change Password"}
              </button>
              {passwordMsg && (
                <span className={`text-sm font-medium ${passwordMsg.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
                  {passwordMsg.type === "success" ? "✓ " : ""}{passwordMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Gmail Card */}
        <div className="bg-red-50 rounded-2xl shadow-sm border-2 border-red-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-red-100 to-pink-100 border-b border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-sm shadow-red-300">
                  <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Gmail</h2>
                  <p className="text-xs text-gray-500">{gmailAccounts.length} connected</p>
                </div>
              </div>
              {totalInboxes < maxInboxes && (
                <button
                  onClick={addGmailInbox}
                  className="px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
                >
                  + Connect
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <SettingsAccountSkeleton />
            ) : gmailAccounts.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No Gmail accounts connected</p>
                <p className="text-xs text-gray-400 mt-1">Connect one to start sending emails</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {gmailAccounts.map((account) => {
                  const warmup = getWarmupStatus(account.warmup_started_at);
                  return (
                    <div key={account.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-red-400 to-red-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{account.email[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{account.email}</span>
                            {account.is_primary && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">PRIMARY</span>
                            )}
                          </div>
                          <span className={`text-xs ${warmup.color === "green" ? "text-emerald-600" : "text-amber-600"}`}>
                            {warmup.color === "green" ? "✓ " : "⏳ "}{warmup.label}
                          </span>
                        </div>
                      </div>
                      {!account.is_primary && (
                        <button
                          onClick={() => removeGmailInbox(account.id)}
                          disabled={removing === account.id}
                          className="text-xs text-gray-400 hover:text-red-500 font-medium disabled:opacity-50 transition-colors"
                        >
                          {removing === account.id ? "..." : "Remove"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* SMTP Card */}
        <div className="bg-violet-50 rounded-2xl shadow-sm border-2 border-violet-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-100 to-violet-100 border-b border-violet-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-violet-300">
                  <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">SMTP / Other</h2>
                  <p className="text-xs text-gray-500">{smtpAccounts.length} connected</p>
                </div>
              </div>
              {!showSmtpForm && totalInboxes < maxInboxes && (
                <button
                  onClick={() => { setShowSmtpForm(true); setSmtpProvider(""); setSmtpError(""); setSmtpSuccess(""); }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                >
                  + Connect
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <SettingsAccountSkeleton />
            ) : showSmtpForm ? (
              <div className="space-y-3">
                {!smtpProvider ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select provider</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(SMTP_PRESETS) as [SmtpProvider, typeof SMTP_PRESETS[SmtpProvider]][]).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => selectProvider(key)}
                          className={`p-3 text-left text-sm font-medium rounded-xl border-2 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm ${
                            key === "custom"
                              ? "col-span-2 border-dashed border-gray-200 bg-gray-50 text-gray-600"
                              : "border-gray-100 bg-white text-gray-800"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setShowSmtpForm(false); setSmtpError(""); setSmtpSuccess(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {SMTP_PRESETS[smtpProvider].label}
                      </span>
                      <button
                        onClick={() => { setSmtpProvider(""); setSmtpForm({ ...smtpForm, host: "", port: "587", useTls: true }); }}
                        className="text-xs text-indigo-500 hover:text-indigo-700"
                      >
                        Change
                      </button>
                    </div>
                    <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      💡 {SMTP_PRESETS[smtpProvider].helpText}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                        <input
                          type="email"
                          value={smtpForm.email}
                          onChange={(e) => setSmtpForm({ ...smtpForm, email: e.target.value, username: e.target.value })}
                          placeholder="you@example.com"
                          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white transition-all"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          {smtpProvider === "custom" ? "Password" : "App Password"}
                        </label>
                        <input
                          type="password"
                          value={smtpForm.password}
                          onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white transition-all"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Display Name</label>
                        <input
                          type="text"
                          value={smtpForm.displayName}
                          onChange={(e) => setSmtpForm({ ...smtpForm, displayName: e.target.value })}
                          placeholder="John Smith (optional)"
                          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white transition-all"
                        />
                      </div>
                      {smtpProvider === "custom" && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">SMTP Host</label>
                            <input
                              type="text"
                              value={smtpForm.host}
                              onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                              placeholder="smtp.yourdomain.com"
                              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Port</label>
                            <input
                              type="number"
                              value={smtpForm.port}
                              onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                              placeholder="587"
                              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Username</label>
                            <input
                              type="text"
                              value={smtpForm.username}
                              onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                              placeholder="you@yourdomain.com"
                              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white transition-all"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 pb-2.5">
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
                      <div className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{smtpError}</div>
                    )}
                    {smtpSuccess && (
                      <div className="text-xs text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">✓ {smtpSuccess}</div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={testSmtpConnection}
                        disabled={smtpTesting || !smtpForm.email || !smtpForm.host || !smtpForm.password}
                        className="px-4 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        {smtpTesting ? "Testing..." : "Test Connection"}
                      </button>
                      <button
                        onClick={saveSmtpAccount}
                        disabled={smtpSaving || !smtpForm.email || !smtpForm.host || !smtpForm.password}
                        className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-50 shadow-sm shadow-indigo-200"
                      >
                        {smtpSaving ? "Saving..." : "Save Account"}
                      </button>
                      <button
                        onClick={() => { setShowSmtpForm(false); setSmtpProvider(""); setSmtpError(""); setSmtpSuccess(""); }}
                        className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : smtpAccounts.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No SMTP accounts connected</p>
                <p className="text-xs text-gray-400 mt-1">Outlook, Yahoo, Zoho, or custom SMTP</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {smtpAccounts.map((account) => {
                  const warmup = getWarmupStatus(account.warmup_started_at);
                  return (
                    <div key={account.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{account.email[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{account.email}</span>
                            {account.is_primary && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">PRIMARY</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">{account.host}:{account.port}</span>
                            <span className="text-gray-300">·</span>
                            <span className={`text-xs ${warmup.color === "green" ? "text-emerald-600" : "text-amber-600"}`}>
                              {warmup.color === "green" ? "✓ " : "⏳ "}{warmup.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeSmtpInbox(account.id)}
                        disabled={removing === account.id}
                        className="text-xs text-gray-400 hover:text-red-500 font-medium disabled:opacity-50 transition-colors"
                      >
                        {removing === account.id ? "..." : "Remove"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {totalInboxes >= maxInboxes && maxInboxes < 4 && (
              <p className="mt-4 text-xs text-gray-400 text-center">
                Upgrade your plan to connect more inboxes
              </p>
            )}
          </div>
        </div>

        {/* Service Type Card */}
        <div className="bg-violet-50 rounded-2xl shadow-sm border-2 border-violet-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-violet-100 to-purple-100 border-b border-violet-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shadow-violet-300">
                  <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Your Service</h2>
                  <p className="text-xs text-gray-500">Controls AI email pitch style</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (serviceType === savedServiceType) return;
                  setServiceTypeSaving(true);
                  try {
                    await apiPut("/stats/service-type", { serviceType });
                    setSavedServiceType(serviceType);
                    // Mark service type as explicitly set (for onboarding detection)
                    const supabase = createClient();
                    await supabase.auth.updateUser({ data: { service_type_set: true } });
                    toast.addToast("Service type updated", "success");
                  } catch {
                    setServiceType(savedServiceType);
                    toast.addToast("Failed to update service type", "error");
                  } finally {
                    setServiceTypeSaving(false);
                  }
                }}
                disabled={serviceTypeSaving || serviceType === savedServiceType}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg hover:from-violet-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                {serviceTypeSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "web_dev", label: "Web Design & Dev", icon: "🌐" },
                { value: "seo", label: "SEO", icon: "🔍" },
                { value: "digital_marketing", label: "Digital Marketing", icon: "📈" },
                { value: "social_media", label: "Social Media", icon: "📱" },
              ] as const).map((opt) => {
                const isSelected = serviceType === opt.value;
                const isSaved = savedServiceType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setServiceType(opt.value)}
                    disabled={serviceTypeSaving}
                    className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-center transition-all ${
                      isSelected
                        ? "bg-violet-100 border-2 border-violet-500 shadow-sm shadow-violet-200"
                        : "bg-white border-2 border-gray-200 hover:border-violet-300 hover:bg-violet-50"
                    }`}
                  >
                    {isSelected && isSaved && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                    <span className="text-2xl">{opt.icon}</span>
                    <span className={`text-xs font-semibold ${isSelected ? "text-violet-900" : "text-gray-700"}`}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
