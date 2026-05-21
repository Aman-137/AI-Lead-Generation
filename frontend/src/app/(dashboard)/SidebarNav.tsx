"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    exact: true,
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    ),
  },
  {
    href: "/auto-leads",
    label: "Auto Lead Finder",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    ),
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
  },
  {
    href: "/upload",
    label: "Upload Leads",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    ),
  },
  {
    href: "/hot-leads",
    label: "Hot Leads",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sidebarGlow {
          0%, 100% { opacity: 0.7; box-shadow: 0 0 6px rgba(167,139,250,0.4); }
          50% { opacity: 1; box-shadow: 0 0 12px rgba(167,139,250,0.8); }
        }
        @keyframes sidebarIndicatorPulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.1); }
        }
        @keyframes activeGlowBg {
          0%, 100% { box-shadow: 0 2px 12px rgba(105,98,196,0.15), inset 0 0 20px rgba(105,98,196,0.05); }
          50% { box-shadow: 0 4px 20px rgba(105,98,196,0.25), inset 0 0 30px rgba(105,98,196,0.08); }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 6px rgba(167,139,250,0.6); }
          50% { transform: scale(1.3); box-shadow: 0 0 12px rgba(167,139,250,1); }
        }
        .sidebar-active-item {
          animation: activeGlowBg 3s ease-in-out infinite;
        }
        .sidebar-active-item::before {
          content: '';
          position: absolute;
          left: -1px;
          top: 15%;
          bottom: 15%;
          width: 3px;
          border-radius: 0 6px 6px 0;
          background: linear-gradient(180deg, #c4b5fd, #a78bfa, #6962c4);
          animation: sidebarGlow 2.5s ease-in-out infinite, sidebarIndicatorPulse 2.5s ease-in-out infinite;
        }
        .sidebar-active-dot {
          animation: dotPulse 2s ease-in-out infinite;
        }
        .sidebar-nav-item {
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-nav-item:hover:not(.sidebar-active-item) {
          background: linear-gradient(135deg, rgba(105,98,196,0.1) 0%, rgba(61,53,128,0.08) 100%);
          transform: translateX(4px);
          box-shadow: 0 2px 12px rgba(105,98,196,0.1);
        }
        .sidebar-nav-item:hover .sidebar-icon-box {
          background: linear-gradient(135deg, rgba(105,98,196,0.25), rgba(167,139,250,0.15)) !important;
          box-shadow: 0 0 16px rgba(105,98,196,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
          border-color: rgba(105,98,196,0.3) !important;
        }
        .sidebar-nav-item:hover .sidebar-icon-svg {
          color: #ffffff !important;
          filter: drop-shadow(0 0 4px rgba(167,139,250,0.5));
          stroke-width: 2.5;
        }
        .sidebar-nav-item:hover .sidebar-label {
          color: rgba(255,255,255,0.9) !important;
        }
      ` }} />

      <nav className="flex-1 px-3 py-5 space-y-1.5">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                active
                  ? "sidebar-active-item text-white"
                  : ""
              }`}
              style={active ? { background: "linear-gradient(135deg, rgba(105,98,196,0.18) 0%, rgba(61,53,128,0.12) 100%)", border: "1px solid rgba(105,98,196,0.2)" } : undefined}
            >
              <div
                className="sidebar-icon-box w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300"
                style={active
                  ? { background: "linear-gradient(135deg, rgba(105,98,196,0.35), rgba(167,139,250,0.2))", boxShadow: "0 0 20px rgba(105,98,196,0.5), inset 0 1px 0 rgba(255,255,255,0.12)", border: "1px solid rgba(167,139,250,0.25)" }
                  : { background: "rgba(105,98,196,0.06)", border: "1px solid rgba(105,98,196,0.1)" }
                }
              >
                <svg className="sidebar-icon-svg w-[18px] h-[18px] transition-all duration-300" style={active ? { color: "#ffffff", filter: "drop-shadow(0 0 6px rgba(167,139,250,0.7))", strokeWidth: 2.5 } : { color: "rgba(255,255,255,0.4)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
              </div>
              <span className={`sidebar-label text-sm font-medium transition-all duration-300 ${active ? "text-white" : "text-white/60"}`}>{item.label}</span>
              {active && (
                <div className="sidebar-active-dot ml-auto w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #c4b5fd, #a78bfa)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5">
        <div className="mx-2 h-px mb-3" style={{ background: "linear-gradient(90deg, transparent, rgba(105,98,196,0.35), transparent)" }} />
        <Link
          href="/help"
          className={`sidebar-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl ${
            pathname.startsWith("/help")
              ? "sidebar-active-item text-white"
              : ""
          }`}
          style={pathname.startsWith("/help") ? { background: "linear-gradient(135deg, rgba(105,98,196,0.18) 0%, rgba(61,53,128,0.12) 100%)", border: "1px solid rgba(105,98,196,0.2)" } : undefined}
        >
          <div
            className="sidebar-icon-box w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300"
            style={pathname.startsWith("/help")
              ? { background: "linear-gradient(135deg, rgba(105,98,196,0.35), rgba(167,139,250,0.2))", boxShadow: "0 0 20px rgba(105,98,196,0.5), inset 0 1px 0 rgba(255,255,255,0.12)", border: "1px solid rgba(167,139,250,0.25)" }
              : { background: "rgba(105,98,196,0.06)", border: "1px solid rgba(105,98,196,0.1)" }
            }
          >
            <svg className="sidebar-icon-svg w-[18px] h-[18px] transition-all duration-300" style={pathname.startsWith("/help") ? { color: "#ffffff", filter: "drop-shadow(0 0 6px rgba(167,139,250,0.7))", strokeWidth: 2.5 } : { color: "rgba(255,255,255,0.4)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className={`sidebar-label text-sm font-medium transition-all duration-300 ${pathname.startsWith("/help") ? "text-white" : "text-white/60"}`}>Help & Support</span>
          {pathname.startsWith("/help") && (
            <div className="sidebar-active-dot ml-auto w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #c4b5fd, #a78bfa)" }} />
          )}
        </Link>
      </div>
    </>
  );
}
