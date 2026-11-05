"use client";

import { createContext, useContext } from "react";

const PlanFeaturesContext = createContext<string[] | null>(null);

/** The features the signed-in workspace's plan includes; `null` (the preview, legacy plans) means everything. */
export function PlanFeaturesProvider({ features, children }: { features: string[] | null; children: React.ReactNode }) {
  return <PlanFeaturesContext.Provider value={features}>{children}</PlanFeaturesContext.Provider>;
}
export const usePlanFeatures = () => useContext(PlanFeaturesContext);
