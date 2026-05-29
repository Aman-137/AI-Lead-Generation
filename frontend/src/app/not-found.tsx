import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0d0a25 0%, #1a1540 50%, #0d0a25 100%)" }}>
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="dots-nf" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#dots-nf)" /></svg>
      </div>
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(105, 98, 196, 0.12)" }} />
      <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full blur-3xl" style={{ background: "rgba(61, 53, 128, 0.10)" }} />
      <div className="relative z-10 text-center max-w-md px-8 py-10 rounded-2xl border" style={{ background: "rgba(26, 21, 64, 0.6)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.08)" }}>
        <p className="text-6xl font-bold mb-4" style={{ color: "#a78bfa" }}>404</p>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-white/50 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 text-white/70 text-sm font-medium rounded-lg border hover:text-white hover:border-white/30 transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
