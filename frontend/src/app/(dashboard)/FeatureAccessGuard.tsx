"use client";

import { usePlan } from "./PlanContext";
import LockedFeatureModal from "./LockedFeatureModal";

export default function FeatureAccessGuard({ children }: { children: React.ReactNode }) {
  const { canAccessFeatures, loaded } = usePlan();

  if (!loaded) return null;

  if (!canAccessFeatures) {
    return <LockedFeatureModal />;
  }

  return <>{children}</>;
}
