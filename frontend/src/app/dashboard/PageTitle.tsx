"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/auto-leads": "Auto Lead Finder",
  "/dashboard/campaigns": "Campaigns",
  "/dashboard/upload": "Upload Leads",
  "/dashboard/settings": "Settings",
  "/dashboard/help": "Help & Support",
};

export default function PageTitle() {
  const pathname = usePathname();

  // Exact match first, then check for dynamic routes like /dashboard/campaigns/[id]
  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/dashboard/campaigns/") ? "Campaign Details" : "Dashboard");

  return (
    <h2 className="text-base font-semibold text-gray-800">{title}</h2>
  );
}
