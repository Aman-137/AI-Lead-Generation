import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import SidebarNav from "./SidebarNav";
import PageTitle from "./PageTitle";

function AvatarDropdown({ displayName, avatarUrl }: { displayName: string; avatarUrl?: string }) {
  const initial = (displayName?.[0] || "U").toUpperCase();

  return (
    <div className="relative group">
      {/* Avatar */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-10 h-10 rounded-xl object-cover cursor-pointer ring-2 ring-gray-200 group-hover:ring-violet-400 transition-all shadow-sm"
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center text-sm font-bold cursor-pointer ring-2 ring-gray-200 group-hover:ring-violet-400 transition-all shadow-sm">
          {initial}
        </div>
      )}

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl shadow-gray-200/60 border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-violet-50/50 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Manage your account</p>
        </div>
        <div className="py-1.5">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            Settings
          </Link>
          <div className="mx-3 my-1 h-px bg-gray-100" />
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName = user.user_metadata?.full_name || user.email;
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed top header */}
      <header className="fixed top-0 left-64 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/80 flex items-center justify-between px-8 z-40">
        <PageTitle />
        <AvatarDropdown displayName={displayName} avatarUrl={avatarUrl} />
      </header>

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 z-50 overflow-hidden" style={{ background: "linear-gradient(180deg, #0d0a25 0%, #1a1540 40%, #0d0a25 100%)" }}>
        {/* Subtle right edge border */}
        <div className="absolute top-0 right-0 bottom-0 w-px" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(105,98,196,0.3) 30%, rgba(105,98,196,0.15) 70%, transparent 100%)" }} />
        
        {/* Ambient glow blobs */}
        <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(105,98,196,0.15) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] -right-16 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(61,53,128,0.12) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-16 left-[20%] w-52 h-52 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(105,98,196,0.08) 0%, transparent 70%)" }} />

        <div className="relative flex flex-col h-full">
          {/* Brand */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              <img src="/images/logo-3.png" alt="Inertia Leads" className="h-14" />
            </div>
          </div>

          <div className="mx-5 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(105,98,196,0.3), transparent)" }} />

          <SidebarNav />
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 pt-[88px] p-8">{children}</main>
    </div>
  );
}
