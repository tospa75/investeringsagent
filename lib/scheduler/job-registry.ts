import type { JobDefinition, JobType } from "./scheduler-types";
const HOUR = 3_600_000, DAY = 24 * HOUR;
const retry = { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 30_000, retryableCodes: ["NETWORK", "HTTP_429", "HTTP_5XX", "TIMEOUT"] };
export const JOB_REGISTRY: Record<JobType, JobDefinition> = {
  KRON_FUND_DISCOVERY: { type:"KRON_FUND_DISCOVERY", name:"Kron fund discovery", enabled:true, scheduleExpression:"0 4 * * 1,4", cadenceMs:3*DAY, timeoutMs:10*60_000, retry, concurrency:"SINGLETON", dependencies:[], criticalDependencies:[] },
  KID_DISCOVERY: { type:"KID_DISCOVERY", name:"KID discovery", enabled:true, scheduleExpression:"20 4 * * *", cadenceMs:DAY, timeoutMs:15*60_000, retry, concurrency:"PER_TARGET", dependencies:["KRON_FUND_DISCOVERY"], criticalDependencies:[] },
  KID_PARSING: { type:"KID_PARSING", name:"KID parsing", enabled:true, scheduleExpression:"40 4 * * *", cadenceMs:DAY, timeoutMs:10*60_000, retry:{...retry,maxAttempts:1,retryableCodes:[]}, concurrency:"PER_TARGET", dependencies:["KID_DISCOVERY"], criticalDependencies:["KID_DISCOVERY"] },
  EXPOSURE_INGESTION: { type:"EXPOSURE_INGESTION", name:"Exposure ingestion", enabled:true, scheduleExpression:"0 5 * * 0", cadenceMs:7*DAY, timeoutMs:20*60_000, retry, concurrency:"PER_TARGET", dependencies:[], criticalDependencies:[] },
  NAV_INGESTION: { type:"NAV_INGESTION", name:"NAV ingestion", enabled:true, scheduleExpression:"0 5 * * 1-5", cadenceMs:DAY, timeoutMs:15*60_000, retry, concurrency:"PER_TARGET", dependencies:[], criticalDependencies:[] },
  PERFORMANCE_METRICS: { type:"PERFORMANCE_METRICS", name:"Performance metrics", enabled:true, scheduleExpression:"20 5 * * 1-5", cadenceMs:DAY, timeoutMs:10*60_000, retry:{...retry,maxAttempts:2}, concurrency:"PER_TARGET", dependencies:["NAV_INGESTION"], criticalDependencies:["NAV_INGESTION"] },
  PORTFOLIO_SNAPSHOT: { type:"PORTFOLIO_SNAPSHOT", name:"Portfolio snapshots", enabled:true, scheduleExpression:"40 5 * * 1-5", cadenceMs:DAY, timeoutMs:10*60_000, retry:{...retry,maxAttempts:2}, concurrency:"PER_TARGET", dependencies:["PERFORMANCE_METRICS"], criticalDependencies:["PERFORMANCE_METRICS"] },
  PORTFOLIO_MONITORING: { type:"PORTFOLIO_MONITORING", name:"Portfolio monitoring", enabled:true, scheduleExpression:"0 6 * * 1-5", cadenceMs:DAY, timeoutMs:10*60_000, retry:{...retry,maxAttempts:2}, concurrency:"PER_TARGET", dependencies:["PORTFOLIO_SNAPSHOT"], criticalDependencies:["PORTFOLIO_SNAPSHOT"] },
  REBALANCE_EVALUATION: { type:"REBALANCE_EVALUATION", name:"Rebalance evaluation", enabled:true, scheduleExpression:"20 6 * * 1-5", cadenceMs:DAY, timeoutMs:10*60_000, retry:{...retry,maxAttempts:2}, concurrency:"PER_TARGET", dependencies:["PORTFOLIO_MONITORING"], criticalDependencies:["PORTFOLIO_MONITORING"] },
  MAINTENANCE_CLEANUP: { type:"MAINTENANCE_CLEANUP", name:"Safe retention cleanup", enabled:true, scheduleExpression:"0 3 * * 0", cadenceMs:7*DAY, timeoutMs:5*60_000, retry:{...retry,maxAttempts:2}, concurrency:"SINGLETON", dependencies:[], criticalDependencies:[] },
};
export const dependencyOrder = (requested: JobType[]) => {
  const output: JobType[] = [], visiting = new Set<JobType>(), visited = new Set<JobType>();
  const visit = (type: JobType) => { if(visited.has(type))return;if(visiting.has(type))throw new Error(`Dependency cycle at ${type}`);visiting.add(type);for(const dependency of JOB_REGISTRY[type].dependencies)if(requested.includes(dependency))visit(dependency);visiting.delete(type);visited.add(type);output.push(type); };
  requested.forEach(visit); return output;
};
