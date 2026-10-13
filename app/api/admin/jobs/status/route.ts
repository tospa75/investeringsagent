import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateDataFreshness, health, JOB_REGISTRY, JOB_TYPES, SchedulerRepository } from "@/lib/scheduler";
import { isAuthorizedJobRequest } from "@/lib/scheduler/security";

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient(), repository = new SchedulerRepository(db), jobs = [];
  for (const jobType of JOB_TYPES) {
    const [scheduled, latest] = await Promise.all([repository.scheduled(jobType), repository.latest(jobType)]);
    jobs.push({ jobType, health: health(latest?.status ?? null, scheduled?.failure_streak ?? 0, scheduled?.last_success_at ?? null, JOB_REGISTRY[jobType].cadenceMs), enabled: scheduled?.enabled ?? false, nextRunAt: scheduled?.next_run_at ?? null, lastRunAt: scheduled?.last_run_at ?? null, lastSuccessAt: scheduled?.last_success_at ?? null, failureStreak: scheduled?.failure_streak ?? 0, latest: latest ? { status: latest.status, itemsProcessed: latest.items_processed, durationMs: latest.duration_ms } : null });
  }
  return NextResponse.json({ jobs, freshness: await evaluateDataFreshness(db) });
}
