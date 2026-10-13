export const JOB_TYPES = [
  "KRON_FUND_DISCOVERY", "KID_DISCOVERY", "KID_PARSING", "EXPOSURE_INGESTION",
  "NAV_INGESTION", "PERFORMANCE_METRICS", "PORTFOLIO_SNAPSHOT",
  "PORTFOLIO_MONITORING", "REBALANCE_EVALUATION", "MAINTENANCE_CLEANUP",
] as const;
export type JobType = typeof JOB_TYPES[number];
export type JobStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED" | "RUNNING";
export type TriggeredBy = "SCHEDULE" | "MANUAL" | "RETRY" | "DEPENDENCY";
export type ItemStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
export type JobHealth = "HEALTHY" | "DEGRADED" | "FAILING" | "NEVER_RUN";
export type Freshness = "FRESH" | "STALE" | "VERY_STALE" | "MISSING";
export interface RetryPolicy { maxAttempts: number; baseDelayMs: number; maxDelayMs: number; retryableCodes: string[] }
export interface JobDefinition {
  type: JobType; name: string; enabled: boolean; scheduleExpression: string;
  cadenceMs: number; timeoutMs: number; retry: RetryPolicy;
  concurrency: "SINGLETON" | "PER_TARGET"; dependencies: JobType[]; criticalDependencies: JobType[];
}
export interface JobTarget { fundId?: string; isin?: string; portfolioId?: string }
export interface JobItemResult extends JobTarget { status: ItemStatus; message: string; warningCode?: string; errorCode?: string; externalRequests?: number; dbQueries?: number }
export interface JobExecutionResult { items: JobItemResult[]; dataVersion?: Record<string, unknown>; warnings?: string[] }
export interface RunRequest { jobType: JobType; triggeredBy: TriggeredBy; target?: JobTarget; dataVersion?: string; dryRun?: boolean; force?: boolean; attempt?: number }
export interface RunSummary { runId: string | null; jobType: JobType; status: JobStatus; deterministicKey: string; itemsProcessed: number; itemsSucceeded: number; itemsPartial: number; itemsFailed: number; warnings: string[]; errors: string[]; durationMs: number; dryRun: boolean }
