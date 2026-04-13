import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          <div className="px-6 py-5 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Inertia Leads</h1>
            <p className="text-xs text-gray-500 mt-1">AI-Powered Outreach</p>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              📊 Dashboard
            </Link>
            <Link
              href="/dashboard/auto-leads"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              🔍 Auto Lead Finder
            </Link>
            <Link
              href="/dashboard/campaigns"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              📧 Campaigns
            </Link>
            <Link
              href="/dashboard/upload"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              📁 Upload Leads
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              ⚙️ Settings
            </Link>
          </nav>

          <div className="px-4 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 truncate mb-2">{user.email}</p>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
