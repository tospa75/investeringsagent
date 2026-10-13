import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { freshness } from "./policies";

const DAY = 86_400_000;
const SOURCES = [
  { name: "FUND_UNIVERSE", table: "funds", field: "updated_at", freshMs: 7 * DAY },
  { name: "KID", table: "fund_documents", field: "retrieved_at", freshMs: 30 * DAY },
  { name: "EXPOSURE", table: "exposure_datasets", field: "retrieved_at", freshMs: 30 * DAY },
  { name: "NAV", table: "fund_nav_history", field: "nav_date", freshMs: 5 * DAY },
  { name: "METRICS", table: "fund_performance_metrics", field: "as_of_date", freshMs: 5 * DAY },
  { name: "PORTFOLIO_SNAPSHOT", table: "portfolio_snapshots", field: "snapshot_date", freshMs: 5 * DAY },
] as const;

export async function evaluateDataFreshness(db: SupabaseClient, writeEvents = false, now = new Date()) {
  const results = [];
  for (const source of SOURCES) {
    const { data, error } = await db.from(source.table).select(source.field).order(source.field, { ascending: false }).limit(1).maybeSingle();
    const observedAt = error ? null : ((data as Record<string, string> | null)?.[source.field] ?? null);
    const status = freshness(observedAt, source.freshMs, now);
    results.push({ source: source.name, status, observedAt, expectedFreshWithinDays: source.freshMs / DAY, error: error?.message ?? null });
    if (writeEvents && (status === "STALE" || status === "VERY_STALE" || status === "MISSING")) {
      const eventKey = createHash("sha256").update(`${source.name}|${status}|${observedAt ?? "missing"}`).digest("hex");
      await db.from("data_quality_events").upsert({ event_key: eventKey, event_type: "DATA_SOURCE_STALE", severity: status === "STALE" ? "WARNING" : "CRITICAL", message: `${source.name} is ${status}`, data_version: { observedAt, expectedFreshWithinDays: source.freshMs / DAY } }, { onConflict: "event_key", ignoreDuplicates: true });
    }
  }
  return results;
}
