import { createHash } from "node:crypto";
import type { Freshness, JobDefinition, JobHealth, JobStatus, JobTarget } from "./scheduler-types";
export const deterministicRunKey = (jobType:string,dataVersion:string,target:JobTarget={},bucket="") => createHash("sha256").update(JSON.stringify([jobType,dataVersion,target.fundId??target.isin??target.portfolioId??"batch",bucket])).digest("hex");
export const retryDelayMs = (attempt:number,base:number,max:number) => Math.min(max,base * 2 ** Math.max(0,attempt-1));
export const shouldRetry = (code:string,attempt:number,definition:JobDefinition) => attempt < definition.retry.maxAttempts && definition.retry.retryableCodes.includes(code);
export function classifyRetryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b429\b/.test(message)) return "HTTP_429";
  if (/\b5\d\d\b/.test(message)) return "HTTP_5XX";
  if (/timeout|timed out|abort/i.test(message)) return "TIMEOUT";
  if (/network|fetch failed|econn|socket|dns/i.test(message)) return "NETWORK";
  return "NON_RETRYABLE";
}
export const isDue = (nextRunAt:string|null,enabled:boolean,now=new Date()) => enabled && (!nextRunAt || Date.parse(nextRunAt)<=now.getTime());
export const leaseAvailable = (lockedUntil:string|null,now=new Date()) => !lockedUntil||Date.parse(lockedUntil)<now.getTime();
export const shouldCreatePortfolioSnapshot = (openPositionCount:number) => openPositionCount>0;
export function health(lastStatus:JobStatus|null,failureStreak:number,lastSuccessAt:string|null,cadenceMs:number,now=new Date()):JobHealth { if(!lastStatus)return"NEVER_RUN";if(failureStreak>=3||lastStatus==="FAILED")return"FAILING";if(lastStatus==="PARTIAL"||!lastSuccessAt||now.getTime()-Date.parse(lastSuccessAt)>cadenceMs*2)return"DEGRADED";return"HEALTHY"; }
export function freshness(observedAt:string|null,freshMs:number,now=new Date()):Freshness { if(!observedAt)return"MISSING";const age=now.getTime()-Date.parse(observedAt);return age<=freshMs?"FRESH":age<=freshMs*2?"STALE":"VERY_STALE"; }
export const significantChange = (before:{risk?:number|null;holdingPeriod?:number|null;fee?:number|null;available?:boolean|null;managementStyle?:string|null;benchmark?:string|null},after:typeof before) => [
  ...(before.risk!=null&&after.risk!=null&&before.risk!==after.risk?["PRIIP_RISK_CHANGED"]:[]),
  ...(before.holdingPeriod!=null&&after.holdingPeriod!=null&&before.holdingPeriod!==after.holdingPeriod?["HOLDING_PERIOD_CHANGED"]:[]),
  ...(before.fee!=null&&after.fee!=null&&Math.abs(before.fee-after.fee)>.001?["FEE_CHANGED_MATERIALLY"]:[]),
  ...(before.available===true&&after.available===false?["FUND_BECAME_UNAVAILABLE"]:[]),
  ...(before.managementStyle&&after.managementStyle&&before.managementStyle!==after.managementStyle?["MANAGEMENT_STYLE_CHANGED"]:[]),
  ...(before.benchmark&&after.benchmark&&before.benchmark!==after.benchmark?["BENCHMARK_CHANGED"]:[]),
];
export const retentionCutoff = (days:number,now=new Date()) => new Date(now.getTime()-days*86_400_000).toISOString();
