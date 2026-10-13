import { createClient } from "@supabase/supabase-js";
import { JOB_TYPES, type JobTarget, type JobType } from "../lib/scheduler";
import { createScheduler } from "../lib/scheduler/server";

const valueAfter = (args: string[], flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };

async function main() {
  const args = process.argv.slice(2), jobType = args[0] as JobType;
  if (!JOB_TYPES.includes(jobType)) throw new Error(`Job must be one of: ${JOB_TYPES.join(", ")}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase server environment");
  const target: JobTarget = { isin: valueAfter(args, "--fund"), portfolioId: valueAfter(args, "--portfolio") };
  const scheduler = createScheduler(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  const result = await scheduler.run({ jobType, triggeredBy: "MANUAL", target: Object.values(target).some(Boolean) ? target : undefined, dryRun: args.includes("--dry-run"), force: args.includes("--force") });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "FAILED") process.exitCode = 1;
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
