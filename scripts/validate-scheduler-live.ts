import { createClient } from "@supabase/supabase-js";
import { createScheduler } from "../lib/scheduler/server";
import { evaluateDataFreshness, health, JOB_REGISTRY, JOB_TYPES, SchedulerRepository } from "../lib/scheduler";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase server environment");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const repository = new SchedulerRepository(db), scheduler = createScheduler(db);
  const tables = ["scheduled_jobs", "job_runs", "job_run_items", "job_locks", "provider_circuit_breakers", "data_quality_events", "portfolio_monitoring_events"];
  const counts = async () => Object.fromEntries(await Promise.all(tables.map(async table => { const { count, error } = await db.from(table).select("*", { count: "exact", head: true }); if (error) throw error; return [table, count ?? 0]; })));
  const before = await counts(), dryRun = await scheduler.runDue(true), afterDryRun = await counts();
  const jobs = [];
  for (const jobType of JOB_TYPES) {
    const [scheduled, latest] = await Promise.all([repository.scheduled(jobType), repository.latest(jobType)]);
    jobs.push({ jobType, health: health(latest?.status ?? null, scheduled?.failure_streak ?? 0, scheduled?.last_success_at ?? null, JOB_REGISTRY[jobType].cadenceMs), lastRunAt: scheduled?.last_run_at ?? null, lastSuccessAt: scheduled?.last_success_at ?? null, nextRunAt: scheduled?.next_run_at ?? null, failureStreak: scheduled?.failure_streak ?? 0 });
  }
  console.log(JSON.stringify({ before, dryRun, afterDryRun, dryRunNoWrites: JSON.stringify(before) === JSON.stringify(afterDryRun), jobs, freshness: await evaluateDataFreshness(db) }, null, 2));
}

void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
