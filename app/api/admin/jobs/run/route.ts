import { NextResponse } from "next/server";
import { z } from "zod";
import { JOB_TYPES } from "@/lib/scheduler";
import { createScheduler } from "@/lib/scheduler/server";
import { isAuthorizedJobRequest } from "@/lib/scheduler/security";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  jobType: z.enum(JOB_TYPES),
  target: z.object({ fundId: z.string().uuid().optional(), isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/).optional(), portfolioId: z.string().uuid().optional() }).optional(),
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  dataVersion: z.string().min(1).max(200).optional(),
});

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  const result = await createScheduler(createAdminClient()).run({ ...parsed.data, triggeredBy: "MANUAL" });
  return NextResponse.json(result, { status: result.status === "FAILED" ? 500 : 200 });
}
