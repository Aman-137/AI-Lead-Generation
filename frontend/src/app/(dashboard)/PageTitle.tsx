"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/auto-leads": "Auto Lead Finder",
  "/campaigns": "Campaigns",
  "/upload": "Upload Leads",
  "/settings": "Settings",
  "/help": "Help & Support",
};

export default function PageTitle() {
  const pathname = usePathname();

  // Exact match first, then check for dynamic routes like /campaigns/[id]
  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/campaigns/") ? "Campaign Details" : "Dashboard");

  return (
    <h2 className="text-base font-semibold" style={{ color: "#1a1540" }}>{title}</h2>
  );
}
