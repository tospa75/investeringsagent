import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SchedulerRepository } from "../lib/scheduler";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY, publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !publishable) throw new Error("Missing Supabase environment");
  const db = createClient(url, key, { auth: { persistSession: false } }), publicDb = createClient(url, publishable, { auth: { persistSession: false } }), repository = new SchedulerRepository(db);
  const lockKey = `task15-${randomUUID()}`, firstOwner = randomUUID(), secondOwner = randomUUID();
  const first = await db.rpc("acquire_job_lock", { p_lock_key: lockKey, p_job_type: "NAV_INGESTION", p_owner_id: firstOwner, p_lease_seconds: 60 });
  const duplicate = await db.rpc("acquire_job_lock", { p_lock_key: lockKey, p_job_type: "NAV_INGESTION", p_owner_id: secondOwner, p_lease_seconds: 60 });
  await db.from("job_locks").update({ locked_until: new Date(Date.now() - 1_000).toISOString() }).eq("lock_key", lockKey);
  const recovered = await db.rpc("acquire_job_lock", { p_lock_key: lockKey, p_job_type: "NAV_INGESTION", p_owner_id: secondOwner, p_lease_seconds: 60 });
  await db.rpc("release_job_lock", { p_lock_key: lockKey, p_owner_id: secondOwner });
  const provider = `TASK15-${randomUUID()}`, otherProvider = `TASK15-${randomUUID()}`;
  for (let index = 0; index < 5; index++) await repository.providerFailed(provider, "HTTP_5XX");
  const open = !(await repository.providerAvailable(provider)), otherContinues = await repository.providerAvailable(otherProvider);
  await db.from("provider_circuit_breakers").update({ retry_after: new Date(Date.now() - 1_000).toISOString() }).eq("provider", provider);
  const halfOpenAllowed = await repository.providerAvailable(provider);
  await repository.providerSucceeded(provider);
  const reset = await repository.providerAvailable(provider);
  const publicRead = await publicDb.from("scheduled_jobs").select("id").limit(1);
  const publicLock = await publicDb.rpc("acquire_job_lock", { p_lock_key: `${lockKey}-public`, p_job_type: "NAV_INGESTION", p_owner_id: randomUUID(), p_lease_seconds: 60 });
  await db.from("provider_circuit_breakers").delete().in("provider", [provider, otherProvider]);
  console.log(JSON.stringify({ locks: { first: first.data, duplicateBlocked: duplicate.data === false, staleRecovered: recovered.data, errors: [first.error?.message, duplicate.error?.message, recovered.error?.message].filter(Boolean) }, circuitBreaker: { openedAfterFiveFailures: open, otherProviderContinues: otherContinues, cooldownRecovery: halfOpenAllowed, reset }, rls: { publicRows: publicRead.data?.length ?? null, publicReadError: publicRead.error?.message ?? null, publicRpcRejected: Boolean(publicLock.error) } }, null, 2));
}

void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
