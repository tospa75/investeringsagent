import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createScheduler } from "../lib/scheduler/server";
import type { JobType, RunSummary } from "../lib/scheduler";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase server environment");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), scheduler = createScheduler(db);
  const isin = "NO0011101545", stamp = randomUUID();
  const { data: fund, error: fundError } = await db.from("funds").select("id,isin").eq("isin", isin).single();
  if (fundError) throw fundError;
  const { data: profile, error: profileError } = await db.from("user_profiles").select("id,profile_version").order("created_at").limit(1).single();
  if (profileError) throw profileError;
  const { data: nav, error: navError } = await db.from("fund_nav_history").select("nav,nav_date,currency").eq("fund_id", fund.id).order("nav_date", { ascending: false }).limit(1).single();
  if (navError) throw navError;
  const user = await db.auth.admin.createUser({ email: `task15-${stamp}@invalid.local`, password: `${randomUUID()}Aa1!`, email_confirm: true });
  if (user.error || !user.data.user) throw user.error ?? new Error("Test user creation failed");
  let proposalId: string | null = null, portfolioId: string | null = null;
  const count = async (table: string, fundColumn?: string) => { let query = db.from(table).select("*", { count: "exact", head: true }); if (fundColumn) query = query.eq(fundColumn, fund.id); const { count, error } = await query; if (error) throw error; return count ?? 0; };
  const dataCounts = async () => ({ documents: await count("fund_documents", "fund_id"), exposureDatasets: await count("exposure_datasets", "fund_id"), navPoints: await count("fund_nav_history", "fund_id"), metrics: await count("fund_performance_metrics", "fund_id"), qualityEvents: await count("data_quality_events", "fund_id") });
  try {
    const { data: proposal, error: proposalError } = await db.from("portfolio_proposals").insert({ user_profile_id: profile.id, proposal_type: "SIMPLE", portfolio_score: 80, risk_score: 80, diversification_score: 80, preference_score: 80, cost_score: 80, robustness_score: 80, simplicity_score: 80, portfolio_confidence: "HIGH", metrics: {}, explanations: [], model_version: `task15-${stamp}`, score_model_version: "task15", profile_version: profile.profile_version, preference_version: 1, data_version: { validation: stamp }, data_version_hash: stamp, calculated_at: new Date().toISOString() }).select("id").single();
    if (proposalError) throw proposalError; proposalId = proposal.id;
    const { error: proposalFundError } = await db.from("portfolio_proposal_funds").insert({ proposal_id: proposalId, fund_id: fund.id, target_weight: 1, role: "CORE", fund_score: 80, marginal_contribution: 1, explanation: "Task 15 isolated validation" });
    if (proposalFundError) throw proposalFundError;
    const { data: portfolio, error: portfolioError } = await db.from("portfolios").insert({ user_id: user.data.user.id, name: "Task 15 isolated validation", base_currency: "NOK", portfolio_proposal_id: proposalId, is_active: true }).select("id").single();
    if (portfolioError) throw portfolioError; portfolioId = portfolio.id;
    const { error: transactionError } = await db.from("transactions").insert({ client_transaction_id: `task15-${stamp}`, portfolio_id: portfolioId, fund_id: fund.id, transaction_type: "BUY", trade_date: nav.nav_date, amount: Number(nav.nav) * 10, nav: Number(nav.nav), units: 10, currency: nav.currency, fees: 0, source: "MANUAL", notes: "Task 15 isolated validation" });
    if (transactionError) throw transactionError;
    const run = (jobType: JobType, target: { isin?: string; portfolioId?: string }) => scheduler.run({ jobType, target, triggeredBy: "MANUAL", force: true });
    const executeFlow = async () => {
      const results: RunSummary[] = [];
      for (const jobType of ["NAV_INGESTION", "PERFORMANCE_METRICS"] as JobType[]) results.push(await run(jobType, { isin }));
      for (const jobType of ["PORTFOLIO_SNAPSHOT", "PORTFOLIO_MONITORING", "REBALANCE_EVALUATION"] as JobType[]) results.push(await run(jobType, { portfolioId: portfolioId! }));
      for (const jobType of ["KID_DISCOVERY", "KID_PARSING", "KRON_FUND_DISCOVERY", "EXPOSURE_INGESTION"] as JobType[]) results.push(await run(jobType, { isin }));
      return results;
    };
    const before = await dataCounts(), first = await executeFlow(), afterFirst = await dataCounts(), second = await executeFlow(), afterSecond = await dataCounts();
    const { count: snapshots } = await db.from("portfolio_snapshots").select("*", { count: "exact", head: true }).eq("portfolio_id", portfolioId);
    const { count: monitoringEvents } = await db.from("portfolio_monitoring_events").select("*", { count: "exact", head: true }).eq("portfolio_id", portfolioId);
    const { count: rebalancePlans } = await db.from("rebalance_plans").select("*", { count: "exact", head: true }).eq("portfolio_id", portfolioId);
    console.log(JSON.stringify({ testFund: isin, before, first, afterFirst, second, afterSecond, isolatedPortfolio: { snapshots, monitoringEvents, rebalancePlans }, secondRunDeltas: Object.fromEntries(Object.keys(afterSecond).map(key => [key, afterSecond[key as keyof typeof afterSecond] - afterFirst[key as keyof typeof afterFirst]])) }, null, 2));
  } finally {
    if (portfolioId) await db.from("portfolios").delete().eq("id", portfolioId);
    if (proposalId) await db.from("portfolio_proposals").delete().eq("id", proposalId);
    await db.auth.admin.deleteUser(user.data.user.id);
  }
}

void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
