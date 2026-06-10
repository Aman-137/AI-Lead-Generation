"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiGet } from "@/lib/api";

interface Features {
  hotLeadTracking: boolean;
  csvUpload: boolean;
  auditReports: boolean;
  prioritySupport: boolean;
}

interface PlanData {
  planLabel: string;
  subscriptionStatus: string;
  isOnTrial: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  features: Features;
  leadsFoundToday: number;
  dailyLeadFindLimit: number;
  loaded: boolean;
}

const defaultFeatures: Features = {
  hotLeadTracking: true,
  csvUpload: true,
  auditReports: true,
  prioritySupport: false,
};

const defaultPlanData: PlanData = {
  planLabel: "",
  subscriptionStatus: "",
  isOnTrial: false,
  trialEndsAt: null,
  trialDaysLeft: null,
  features: defaultFeatures,
  leadsFoundToday: 0,
  dailyLeadFindLimit: 50,
  loaded: false,
};

const PlanContext = createContext<PlanData>(defaultPlanData);

export function usePlan() {
  return useContext(PlanContext);
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [planData, setPlanData] = useState<PlanData>(defaultPlanData);

  useEffect(() => {
    apiGet<{
      planLabel: string;
      subscriptionStatus?: string;
      isOnTrial?: boolean;
      trialEndsAt?: string | null;
      trialDaysLeft?: number | null;
      features?: Partial<Features>;
      leadsFoundToday: number;
      dailyLeadFindLimit: number;
    }>("/stats")
      .then((data) => {
        setPlanData({
          planLabel: data.planLabel,
          subscriptionStatus: data.subscriptionStatus || "active",
          isOnTrial: data.isOnTrial || false,
          trialEndsAt: data.trialEndsAt || null,
          trialDaysLeft: data.trialDaysLeft ?? null,
          features: {
            hotLeadTracking: data.features?.hotLeadTracking !== false,
            csvUpload: data.isOnTrial || data.features?.csvUpload !== false,
            auditReports: data.features?.auditReports !== false,
            prioritySupport: data.features?.prioritySupport || false,
          },
          leadsFoundToday: data.leadsFoundToday,
          dailyLeadFindLimit: data.dailyLeadFindLimit,
          loaded: true,
        });
      })
      .catch(() => {
        // On error, grant access (fail-open) so users aren't locked out
        setPlanData({ ...defaultPlanData, loaded: true });
      });
  }, []);

  return <PlanContext.Provider value={planData}>{children}</PlanContext.Provider>;
}
