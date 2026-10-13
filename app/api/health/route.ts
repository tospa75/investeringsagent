import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const requestId = randomUUID();
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-local";
  try {
    const { error } = await createAdminClient().from("scheduled_jobs").select("id", { head: true }).limit(1);
    const ready = !error;
    return NextResponse.json({ status: ready ? "ok" : "degraded", database: ready ? "reachable" : "unavailable", version, requestId }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unavailable", version, requestId }, { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  }
}
