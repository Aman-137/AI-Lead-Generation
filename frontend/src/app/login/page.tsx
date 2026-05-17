"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const resetForm = () => {
    setError("");
    setFullName("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const switchMode = (newMode: "login" | "signup") => {
    resetForm();
    setMode(newMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setEmailSent(true);
  };

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) setError(error.message);
  };

  // Verification email sent screen
  if (emailSent) {
    return (
      <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #15103a 30%, #0f1f3d 60%, #0a1a35 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="loginDots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#loginDots)" /></svg>
        </div>
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-fuchsia-500/[0.12] blur-3xl" />
        <div className="absolute top-1/3 right-[10%] w-72 h-72 rounded-full bg-violet-500/[0.10] blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full bg-cyan-500/[0.08] blur-3xl" />
        <div className="absolute bottom-1/3 right-[30%] w-64 h-64 rounded-full bg-amber-500/[0.05] blur-3xl" />

        <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <div className="flex flex-col lg:flex-row items-center gap-24 max-w-5xl w-full">
            <div className="hidden lg:block flex-1 text-white">
              <BrandingSide />
            </div>
            <div className="w-full max-w-sm bg-white/[0.07] backdrop-blur-md rounded-2xl border border-white/[0.12] shadow-2xl shadow-black/30 p-8 text-center">
              <div className="text-5xl mb-4">📧</div>
              <h2 className="text-2xl font-bold text-white">Check your email</h2>
              <p className="mt-3 text-white/60 text-sm">
                We sent a verification link to <span className="font-medium text-white">{email}</span>.
                Click the link in your email to verify your account.
              </p>
              <p className="mt-4 text-xs text-white/30">
                Didn&apos;t receive the email? Check your spam folder.
              </p>
              <div className="mt-6 flex gap-3 justify-center">
                <button
                  onClick={() => { setEmailSent(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-white/70 bg-white/[0.06] border border-white/[0.12] rounded-lg hover:bg-white/[0.10]"
                >
                  Try again
                </button>
                <button
                  onClick={() => { setEmailSent(false); resetForm(); setMode("login"); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg hover:from-violet-700 hover:to-fuchsia-700"
                >
                  Go to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #15103a 30%, #0f1f3d 60%, #0a1a35 100%)" }}>
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="loginDots2" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#loginDots2)" /></svg>
      </div>
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-fuchsia-500/[0.12] blur-3xl" />
      <div className="absolute top-1/3 right-[10%] w-72 h-72 rounded-full bg-violet-500/[0.10] blur-3xl" />
      <div className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full bg-cyan-500/[0.08] blur-3xl" />
      <div className="absolute bottom-1/3 right-[30%] w-64 h-64 rounded-full bg-amber-500/[0.05] blur-3xl" />

      <div className="relative z-10 h-full flex items-center justify-center px-6">
        {/* Glass container wrapping both sides — fixed height */}
        <div
          className="relative w-full max-w-5xl h-[680px] rounded-3xl border border-white/[0.10] overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.05) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Top edge highlight for 3D effect */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          {/* Bottom subtle shadow line */}
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent" />

          <div className="flex flex-col lg:flex-row items-stretch h-full">
            {/* Left - Branding */}
            <div className="hidden lg:flex flex-1 flex-col justify-center px-12 py-10 border-r border-white/[0.06]">
              <div className="text-white">
                <BrandingSide />
              </div>
            </div>

            {/* Right - Auth Card */}
            <div className="w-full lg:w-[400px] flex-shrink-0 relative h-full overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {/* Inner glow on right panel */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none rounded-r-3xl" />
              <div className="relative z-10 px-8 py-8 min-h-full flex flex-col justify-center">
                {/* Inner glass card for auth form */}
                <div className="rounded-2xl border border-white/[0.08] p-6" style={{ background: "rgba(255,255,255,0.04)" }}>
          {/* Mobile logo - only shows on small screens */}
          <div className="lg:hidden text-center mb-6">
            <img src="/images/logo.png" alt="Inertia Leads" className="h-14 mx-auto" />
          </div>

          {/* Tab switcher */}
          <div className="flex mb-6 bg-white/[0.06] rounded-xl p-1 border border-white/[0.08]">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleAuth}
            type="button"
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-white/[0.12] rounded-xl text-sm font-medium text-white bg-white/[0.06] hover:bg-white/[0.10] transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.10]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 text-white/30 bg-transparent">or</span>
            </div>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={mode === "login" ? handleLogin : handleSignup}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-white/70">
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2.5 border border-white/[0.12] rounded-xl bg-white/[0.06] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/50 text-sm transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/70">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 border border-white/[0.12] rounded-xl bg-white/[0.06] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/50 text-sm transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2.5 pr-10 border border-white/[0.12] rounded-xl bg-white/[0.06] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/50 text-sm transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {mode === "login" && (
                <div className="mt-1 text-right">
                  <Link href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300">
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            {mode === "signup" && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/70">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2.5 pr-10 border border-white/[0.12] rounded-xl bg-white/[0.06] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/50 text-sm transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg shadow-violet-500/30 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign in"
                : "Sign up"}
            </button>
          </form>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}

function BrandingSide() {
  return (
    <>
      <div className="flex justify-center mb-8">
        <img src="/images/logo.png" alt="Inertia Leads" className="h-16" />
      </div>
      <p className="text-lg text-white/60 mb-12 max-w-md text-center mx-auto">
        AI-Powered Lead Generation & Cold Email Outreach
      </p>

      <div className="space-y-5">
        <div className="flex items-start gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base text-white">Find Leads Automatically</h3>
            <p className="text-white/40 text-sm mt-1">
              Search by niche & location — we find businesses with emails, phones, and websites instantly.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base text-white">AI-Generated Emails</h3>
            <p className="text-white/40 text-sm mt-1">
              Personalized cold emails written by AI — with automated follow-ups that land in inboxes.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base text-white">Send on Autopilot</h3>
            <p className="text-white/40 text-sm mt-1">
              Smart inbox rotation, warmup protection, and business-hours scheduling — all handled for you.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base text-white">Track Everything</h3>
            <p className="text-white/40 text-sm mt-1">
              Real-time dashboard with sent, replied, and campaign performance stats at a glance.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-3 text-xs">
        <Link href="/privacy" className="text-white/25 hover:text-white/50 transition-colors">
          Privacy Policy
        </Link>
        <span className="text-white/15">·</span>
        <Link href="/terms" className="text-white/25 hover:text-white/50 transition-colors">
          Terms of Service
        </Link>
      </div>
    </>
  );
}
