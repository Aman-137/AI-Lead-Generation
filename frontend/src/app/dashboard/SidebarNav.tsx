"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    exact: true,
    activeBg: "bg-amber-500/15",
    hoverBg: "group-hover:bg-amber-500/15",
    activeIcon: "text-amber-400",
    hoverIcon: "group-hover:text-amber-400",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    ),
  },
  {
    href: "/dashboard/auto-leads",
    label: "Auto Lead Finder",
    activeBg: "bg-emerald-500/15",
    hoverBg: "group-hover:bg-emerald-500/15",
    activeIcon: "text-emerald-400",
    hoverIcon: "group-hover:text-emerald-400",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    ),
  },
  {
    href: "/dashboard/campaigns",
    label: "Campaigns",
    activeBg: "bg-fuchsia-500/15",
    hoverBg: "group-hover:bg-fuchsia-500/15",
    activeIcon: "text-fuchsia-400",
    hoverIcon: "group-hover:text-fuchsia-400",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
  },
  {
    href: "/dashboard/upload",
    label: "Upload Leads",
    activeBg: "bg-cyan-500/15",
    hoverBg: "group-hover:bg-cyan-500/15",
    activeIcon: "text-cyan-400",
    hoverIcon: "group-hover:text-cyan-400",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    ),
  },
  {
    href: "/dashboard/hot-leads",
    label: "Hot Leads",
    activeBg: "bg-orange-500/15",
    hoverBg: "group-hover:bg-orange-500/15",
    activeIcon: "text-orange-400",
    hoverIcon: "group-hover:text-orange-400",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    ),
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                active
                  ? item.activeBg
                  : `bg-white/[0.06] ${item.hoverBg}`
              }`}>
                <svg className={`w-4 h-4 transition-colors ${
                  active
                    ? item.activeIcon
                    : `text-white/30 ${item.hoverIcon}`
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5">
        <div className="mx-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
        <Link
          href="/dashboard/help"
          className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            pathname.startsWith("/dashboard/help")
              ? "bg-white/[0.08] text-white"
              : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            pathname.startsWith("/dashboard/help")
              ? "bg-amber-500/15"
              : "bg-white/[0.06] group-hover:bg-amber-500/15"
          }`}>
            <svg className={`w-4 h-4 transition-colors ${
              pathname.startsWith("/dashboard/help")
                ? "text-amber-400"
                : "text-white/30 group-hover:text-amber-400"
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium">Help & Support</span>
          {pathname.startsWith("/dashboard/help") && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </Link>
      </div>
    </>
  );
}
