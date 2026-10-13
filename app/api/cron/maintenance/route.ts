import { NextResponse } from "next/server";
import { createScheduler } from "@/lib/scheduler/server";
import { isAuthorizedJobRequest } from "@/lib/scheduler/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Scheduler is not configured" }, { status: 503 });
  if (!isAuthorizedJobRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";
  const results = await createScheduler(createAdminClient()).runDue(dryRun);
  const failed = results.some((result) => result.status === "FAILED");
  return NextResponse.json({ ok: !failed, dryRun, results }, { status: failed ? 207 : 200 });
}
