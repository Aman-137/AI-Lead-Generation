"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function VerifyEmailPage() {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const supabase = createClient();

  const handleResend = async () => {
    setResending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await supabase.auth.resend({
          type: "signup",
          email: user.email,
        });
        setResent(true);
      }
    } catch {
      // silently fail
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0d0a25 0%, #1a1540 50%, #0d0a25 100%)" }}>
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="dots-v" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#dots-v)" /></svg>
      </div>
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(105, 98, 196, 0.12)" }} />
      <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full blur-3xl" style={{ background: "rgba(61, 53, 128, 0.10)" }} />
      <div className="relative z-10 max-w-md w-full p-8 rounded-2xl border text-center" style={{ background: "rgba(26, 21, 64, 0.6)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-2xl font-bold text-white">Verify your email</h2>
        <p className="mt-3 text-white/60 text-sm">
          You need to verify your email address before you can access the dashboard.
          Check your inbox for a verification link.
        </p>

        {resent && (
          <div className="mt-4 border text-sm px-4 py-3 rounded-lg" style={{ background: "rgba(52,211,153,0.1)", borderColor: "rgba(52,211,153,0.3)", color: "#6ee7b7" }}>
            Verification email resent! Check your inbox.
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleResend}
            disabled={resending || resent}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            {resending ? "Sending..." : resent ? "Email sent!" : "Resend verification email"}
          </button>

          <Link
            href="/login"
            className="w-full px-4 py-2.5 text-sm font-medium text-white/70 border rounded-lg hover:text-white hover:border-white/30 transition-colors inline-block"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
          >
            Back to Sign In
          </Link>
        </div>

        <p className="mt-6 text-xs text-white/40">
          Already verified? <Link href="/" className="text-violet-400 hover:text-violet-300 transition-colors">Try accessing the dashboard</Link>
        </p>
      </div>
    </div>
  );
}
