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
  currentPeriodEnd: string | null;
  pastDueSince: string | null;
  trialDaysLeft: number | null;
  features: Features;
  leadsFoundToday: number;
  dailyLeadFindLimit: number;
  canAccessFeatures: boolean;
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
  currentPeriodEnd: null,
  pastDueSince: null,
  trialDaysLeft: null,
  features: defaultFeatures,
  leadsFoundToday: 0,
  dailyLeadFindLimit: 50,
  canAccessFeatures: false,
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
      currentPeriodEnd?: string | null;
      pastDueSince?: string | null;
      trialDaysLeft?: number | null;
      features?: Partial<Features>;
      leadsFoundToday: number;
      dailyLeadFindLimit: number;
    }>("/stats")
      .then((data) => {
        const status = data.subscriptionStatus || "none";
        // Check if trial has expired
        const trialExpired = status === "trialing" && data.trialEndsAt && new Date(data.trialEndsAt) < new Date();
        // Cancelled users keep access until current_period_end
        const cancelledWithAccess = status === "cancelled" && data.currentPeriodEnd && new Date(data.currentPeriodEnd) > new Date();
        // Past due: 3-day grace period from when payment first failed
        const pastDueWithAccess = status === "past_due" && (
          !data.pastDueSince || (Date.now() - new Date(data.pastDueSince).getTime()) < 3 * 24 * 60 * 60 * 1000
        );
        // User can access features if: trialing (not expired), active, past_due (within grace), or cancelled with remaining period
        const canAccess = (["trialing", "active"].includes(status) && !trialExpired) || !!cancelledWithAccess || !!pastDueWithAccess;
        
        setPlanData({
          planLabel: data.planLabel,
          subscriptionStatus: status,
          isOnTrial: data.isOnTrial || false,
          trialEndsAt: data.trialEndsAt || null,
          currentPeriodEnd: data.currentPeriodEnd || null,
          pastDueSince: data.pastDueSince || null,
          trialDaysLeft: data.trialDaysLeft ?? null,
          features: {
            hotLeadTracking: data.features?.hotLeadTracking !== false,
            csvUpload: data.isOnTrial || data.features?.csvUpload !== false,
            auditReports: data.features?.auditReports !== false,
            prioritySupport: data.features?.prioritySupport || false,
          },
          leadsFoundToday: data.leadsFoundToday,
          dailyLeadFindLimit: data.dailyLeadFindLimit,
          canAccessFeatures: canAccess,
          loaded: true,
        });
      })
      .catch(() => {
        // On error, fail-closed (lock features) — backend still validates on each API call
        setPlanData({ ...defaultPlanData, loaded: true });
      });
  }, []);

  return <PlanContext.Provider value={planData}>{children}</PlanContext.Provider>;
}
