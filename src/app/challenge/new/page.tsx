import { Suspense } from "react";
import { PlanBuilder } from "@/components/challenge/PlanBuilder";

export default function NewChallengePage() {
  return (
    <Suspense fallback={<div className="card mt-8 h-64 animate-pulse" />}>
      <PlanBuilder />
    </Suspense>
  );
}
