import { describe, expect, it, vi } from "vitest";
import { dependencyOrder, JOB_REGISTRY } from "../lib/scheduler/job-registry";
import { classifyRetryError, deterministicRunKey, freshness, health, isDue, leaseAvailable, retentionCutoff, retryDelayMs, shouldCreatePortfolioSnapshot, shouldRetry, significantChange } from "../lib/scheduler/policies";
import { JobOrchestrator } from "../lib/scheduler/orchestrator";
import type { JobType, RunSummary } from "../lib/scheduler/scheduler-types";
import type { SchedulerRepository } from "../lib/scheduler/scheduler-repository";
import { isAuthorizedJobRequest } from "../lib/scheduler/security";

function repository(overrides: Record<string, unknown> = {}) {
  return {
    due: vi.fn().mockResolvedValue([]),
    latest: vi.fn().mockResolvedValue({ status: "SUCCESS" }),
    acquire: vi.fn().mockResolvedValue("owner"),
    release: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue({ runId: "run-1", duplicate: false }),
    finish: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SchedulerRepository;
}

describe("scheduler policies", () => {
  it("rejects missing or incorrect scheduler secrets", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "task15-secret";
    expect(isAuthorizedJobRequest(new Request("http://localhost"))).toBe(false);
    expect(isAuthorizedJobRequest(new Request("http://localhost", { headers: { authorization: "Bearer wrong" } }))).toBe(false);
    expect(isAuthorizedJobRequest(new Request("http://localhost", { headers: { authorization: "Bearer task15-secret" } }))).toBe(true);
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  });
  it("orders the NAV chain before dependent portfolio work", () => {
    expect(dependencyOrder(["REBALANCE_EVALUATION", "PORTFOLIO_MONITORING", "PORTFOLIO_SNAPSHOT", "PERFORMANCE_METRICS", "NAV_INGESTION"]))
      .toEqual(["NAV_INGESTION", "PERFORMANCE_METRICS", "PORTFOLIO_SNAPSHOT", "PORTFOLIO_MONITORING", "REBALANCE_EVALUATION"]);
  });
  it("detects due jobs, health and freshness deterministically", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(isDue("2026-10-13T11:59:00Z", true, now)).toBe(true);
    expect(isDue(null, false, now)).toBe(false);
    expect(health("PARTIAL", 0, now.toISOString(), 86_400_000, now)).toBe("DEGRADED");
    expect(freshness("2026-10-10T12:00:00Z", 86_400_000, now)).toBe("VERY_STALE");
  });
  it("uses bounded exponential retries only for transient errors", () => {
    expect(retryDelayMs(1, 1_000, 30_000)).toBe(1_000);
    expect(retryDelayMs(8, 1_000, 30_000)).toBe(30_000);
    expect(classifyRetryError(new Error("HTTP 429"))).toBe("HTTP_429");
    expect(classifyRetryError(new Error("HTTP 503"))).toBe("HTTP_5XX");
    expect(classifyRetryError(new Error("network socket failure"))).toBe("NETWORK");
    expect(classifyRetryError(new Error("parser invariant"))).toBe("NON_RETRYABLE");
    expect(shouldRetry("HTTP_429", 1, JOB_REGISTRY.NAV_INGESTION)).toBe(true);
    expect(shouldRetry("NON_RETRYABLE", 1, JOB_REGISTRY.NAV_INGESTION)).toBe(false);
  });
  it("identifies only material source changes", () => {
    expect(significantChange({ risk: 3, holdingPeriod: 5, fee: .005, available: true, managementStyle: "ACTIVE", benchmark: "A" }, { risk: 4, holdingPeriod: 7, fee: .0062, available: false, managementStyle: "PASSIVE", benchmark: "B" })).toEqual([
      "PRIIP_RISK_CHANGED", "HOLDING_PERIOD_CHANGED", "FEE_CHANGED_MATERIALLY", "FUND_BECAME_UNAVAILABLE", "MANAGEMENT_STYLE_CHANGED", "BENCHMARK_CHANGED",
    ]);
    expect(significantChange({ fee: .005 }, { fee: .0055 })).toEqual([]);
  });
  it("creates stable keys and safe retention cutoffs", () => {
    expect(deterministicRunKey("NAV_INGESTION", "v1", { isin: "NO0010000000" }, "2026-10-13")).toBe(deterministicRunKey("NAV_INGESTION", "v1", { isin: "NO0010000000" }, "2026-10-13"));
    expect(retentionCutoff(90, new Date("2026-10-13T00:00:00Z"))).toBe("2026-07-15T00:00:00.000Z");
  });
  it("recovers stale leases and skips empty portfolios", () => {
    expect(leaseAvailable("2026-10-13T11:00:00Z", new Date("2026-10-13T12:00:00Z"))).toBe(true);
    expect(leaseAvailable("2026-10-13T13:00:00Z", new Date("2026-10-13T12:00:00Z"))).toBe(false);
    expect(shouldCreatePortfolioSnapshot(0)).toBe(false);
    expect(shouldCreatePortfolioSnapshot(2)).toBe(true);
  });
});

describe("job orchestrator", () => {
  it("prevents a duplicate active execution", async () => {
    const repo = repository({ acquire: vi.fn().mockResolvedValue(null) });
    const result = await new JobOrchestrator(repo, {}).run({ jobType: "NAV_INGESTION", triggeredBy: "MANUAL" });
    expect(result.status).toBe("SKIPPED");
    expect(result.warnings).toContain("DUPLICATE_OR_ACTIVE_LEASE");
  });
  it("blocks a critical dependent job after upstream failure", async () => {
    const repo = repository({ latest: vi.fn().mockResolvedValue({ status: "FAILED" }) });
    const result = await new JobOrchestrator(repo, {}).run({ jobType: "PERFORMANCE_METRICS", triggeredBy: "DEPENDENCY" });
    expect(result.status).toBe("SKIPPED");
    expect(result.errors).toContain("CRITICAL_DEPENDENCY_FAILED:NAV_INGESTION");
  });
  it("allows partial upstream data and isolates item failures", async () => {
    const repo = repository({ latest: vi.fn().mockResolvedValue({ status: "PARTIAL" }) });
    const handler = vi.fn().mockResolvedValue({ items: [
      { isin: "NO001", status: "SUCCESS", message: "ok" },
      { isin: "NO002", status: "FAILED", message: "bad", errorCode: "SOURCE_FAILED" },
    ] });
    const result = await new JobOrchestrator(repo, { PERFORMANCE_METRICS: handler }).run({ jobType: "PERFORMANCE_METRICS", triggeredBy: "DEPENDENCY" });
    expect(result.status).toBe("PARTIAL");
    expect(result.itemsSucceeded).toBe(1);
    expect(result.itemsFailed).toBe(1);
  });
  it("retries transient handler failures with bounded attempts", async () => {
    const repo = repository(), sleep = vi.fn().mockResolvedValue(undefined);
    const handler = vi.fn().mockRejectedValueOnce(new Error("HTTP 429")).mockResolvedValue({ items: [{ status: "SUCCESS", message: "ok" }] });
    const result = await new JobOrchestrator(repo, { NAV_INGESTION: handler }, () => new Date("2026-10-13T00:00:00Z"), sleep).run({ jobType: "NAV_INGESTION", triggeredBy: "SCHEDULE" });
    expect(result.status).toBe("SUCCESS");
    expect(handler).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });
  it("stops at max attempts and never retries validation errors", async () => {
    const repo = repository(), sleep = vi.fn().mockResolvedValue(undefined);
    const transient = vi.fn().mockRejectedValue(new Error("HTTP 503"));
    const transientResult = await new JobOrchestrator(repo, { NAV_INGESTION: transient }, () => new Date("2026-10-13T00:00:00Z"), sleep).run({ jobType: "NAV_INGESTION", triggeredBy: "SCHEDULE" });
    expect(transientResult.status).toBe("FAILED");
    expect(transient).toHaveBeenCalledTimes(3);
    const validation = vi.fn().mockRejectedValue(new Error("invalid ISIN"));
    const validationResult = await new JobOrchestrator(repository(), { NAV_INGESTION: validation }, () => new Date("2026-10-14T00:00:00Z"), sleep).run({ jobType: "NAV_INGESTION", triggeredBy: "SCHEDULE" });
    expect(validationResult.status).toBe("FAILED");
    expect(validation).toHaveBeenCalledTimes(1);
  });
  it("returns a no-write dry run summary", async () => {
    const repo = repository(), handler = vi.fn();
    const result = await new JobOrchestrator(repo, { EXPOSURE_INGESTION: handler }).run({ jobType: "EXPOSURE_INGESTION", triggeredBy: "MANUAL", dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
  it("simulates the complete maintenance chain in dependency order", async () => {
    const types: JobType[] = ["REBALANCE_EVALUATION", "KID_PARSING", "EXPOSURE_INGESTION", "PORTFOLIO_MONITORING", "KRON_FUND_DISCOVERY", "KID_DISCOVERY", "PORTFOLIO_SNAPSHOT", "PERFORMANCE_METRICS", "NAV_INGESTION"];
    const repo = repository({ due: vi.fn().mockResolvedValue(types.map((job_type) => ({ job_type }))) });
    const calls: JobType[] = [];
    const handlers = Object.fromEntries(types.map((type) => [type, async () => { calls.push(type); return { items: [{ status: "SUCCESS", message: "simulated" }] }; }])) as never;
    const results = await new JobOrchestrator(repo, handlers, () => new Date("2026-10-13T00:00:00Z"), async () => {}).runDue();
    expect(calls).toEqual(["NAV_INGESTION", "PERFORMANCE_METRICS", "PORTFOLIO_SNAPSHOT", "PORTFOLIO_MONITORING", "REBALANCE_EVALUATION", "KRON_FUND_DISCOVERY", "KID_DISCOVERY", "KID_PARSING", "EXPOSURE_INGESTION"]);
    expect(results.every((result: RunSummary) => result.status === "SUCCESS")).toBe(true);
  });
});
