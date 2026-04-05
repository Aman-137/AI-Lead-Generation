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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-2xl font-bold text-gray-900">Verify your email</h2>
        <p className="mt-3 text-gray-600 text-sm">
          You need to verify your email address before you can access the dashboard.
          Check your inbox for a verification link.
        </p>

        {resent && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Verification email resent! Check your inbox.
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleResend}
            disabled={resending || resent}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {resending ? "Sending..." : resent ? "Email sent!" : "Resend verification email"}
          </button>

          <Link
            href="/login"
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 inline-block"
          >
            Back to Sign In
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Already verified? <Link href="/dashboard" className="text-blue-600 hover:underline">Try accessing the dashboard</Link>
        </p>
      </div>
    </div>
  );
}
