import type { SupabaseClient } from "@supabase/supabase-js";
import { createDefaultHandlers } from "./default-handlers";
import { JobOrchestrator } from "./orchestrator";
import { SchedulerRepository } from "./scheduler-repository";

export function createScheduler(db: SupabaseClient) {
  const riskFreeRate = Number(process.env.RISK_FREE_RATE_ANNUAL ?? 0.04);
  const minimumAcceptableReturn = Number(process.env.MINIMUM_ACCEPTABLE_RETURN_ANNUAL ?? 0);
  if (!Number.isFinite(riskFreeRate) || !Number.isFinite(minimumAcceptableReturn)) throw new Error("Invalid performance-rate environment configuration");
  return new JobOrchestrator(new SchedulerRepository(db), createDefaultHandlers(db, riskFreeRate, minimumAcceptableReturn));
}
