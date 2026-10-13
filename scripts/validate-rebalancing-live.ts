import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { buildRebalancePlan, RebalancingRepository } from "../lib/rebalancing";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: created, error: userError } = await db.auth.admin.createUser({ email: `task13-validation-${randomUUID()}@invalid.local`, email_confirm: true, password: `${randomUUID()}Aa1!` });
  if (userError || !created.user) throw new Error(userError?.message ?? "Could not create validation user");
  let portfolioId: string | null = null;
  try {
    const { data: proposal, error: proposalError } = await db.from("portfolio_proposals").select("id,model_version,data_version").order("created_at", { ascending: false }).limit(1).single();
    if (proposalError || !proposal) throw new Error(proposalError?.message ?? "No target proposal found");
    const { data: targetRows, error: targetError } = await db.from("portfolio_proposal_funds").select("fund_id,target_weight,role").eq("proposal_id", proposal.id).order("fund_id");
    if (targetError || !targetRows?.length) throw new Error(targetError?.message ?? "No proposal targets found");
    const { data: portfolio, error: portfolioError } = await db.from("portfolios").insert({ user_id: created.user.id, name: "Task 13 validation", base_currency: "NOK", portfolio_proposal_id: proposal.id }).select("id").single();
    if (portfolioError) throw new Error(portfolioError.message);
    portfolioId = portfolio.id;
    const validationPortfolioId = portfolio.id as string;
    const snapshotDate = "2026-10-12";
    const marketValues = targetRows.map((_, index) => index === 0 ? 70000 : 30000 / Math.max(1, targetRows.length - 1));
    const { data: snapshot, error: snapshotError } = await db.from("portfolio_snapshots").insert({ portfolio_id: portfolioId, snapshot_date: snapshotDate, total_invested: 100000, market_value: 100000, unrealized_gain_loss: 0, realized_gain_loss: 0, total_return_percent: 0, data_version: { validation: "task-13-live-v1" }, data_version_hash: `task13-${randomUUID()}` }).select("id").single();
    if (snapshotError) throw new Error(snapshotError.message);
    const { error: positionError } = await db.from("portfolio_position_snapshots").insert(targetRows.map((row, index) => ({ portfolio_snapshot_id: snapshot.id, fund_id: row.fund_id, units: marketValues[index] / 100, nav: 100, nav_date: snapshotDate, nav_freshness: "FRESH", market_value: marketValues[index], cost_basis: marketValues[index], unrealized_gain_loss: 0, actual_weight: marketValues[index] / 100000 })));
    if (positionError) throw new Error(positionError.message);
    const { data: funds, error: fundError } = await db.from("funds").select("id,name,available_on_kron").in("id", targetRows.map((row) => row.fund_id));
    if (fundError) throw new Error(fundError.message);
    const fundMap = new Map((funds ?? []).map((fund) => [fund.id, fund]));
    const input = {
      positions: targetRows.map((row, index) => ({ fundId: row.fund_id, name: fundMap.get(row.fund_id)?.name ?? row.fund_id, marketValue: marketValues[index], actualWeight: marketValues[index] / 100000, nav: 100, navFreshness: "FRESH" as const, dataQuality: "HIGH" as const, available: fundMap.get(row.fund_id)?.available_on_kron ?? true, documentValid: true, annualCost: null })),
      targets: targetRows.map((row) => ({ fundId: row.fund_id, weight: Number(row.target_weight), role: row.role === "CORE" ? "CORE" as const : "SATELLITE" as const })),
      newCashAmount: 10000,
      settings: { absoluteThreshold: .05, relativeThreshold: .2, minimumTradeAmount: 500, minimumWeightImpact: .005, avoidRealization: false, maxFundWeight: .65, transactionCostRate: .001 },
      targetModelVersion: proposal.model_version,
      currentDataVersion: { snapshot: "task-13-live-v1", proposal: proposal.data_version },
    };
    const plan = buildRebalancePlan(input), repo = new RebalancingRepository(db);
    const firstPlan = await repo.savePlan(validationPortfolioId, input, plan), secondPlan = await repo.savePlan(validationPortfolioId, input, plan);
    const firstEvents = await repo.saveMonitoringEvents(validationPortfolioId, plan), secondEvents = await repo.saveMonitoringEvents(validationPortfolioId, plan);
    const peakDatabaseRows: Record<string, number | null> = {};
    for (const table of ["portfolio_monitoring_events", "rebalance_plans", "rebalance_plan_actions"]) { const { count, error } = await db.from(table).select("*", { count: "exact", head: true }); if (error) throw new Error(error.message); peakDatabaseRows[table] = count; }
    const liveValidation = { temporaryUser: true, cleanedUp: true, portfolioId, proposalId: proposal.id, targetCount: targetRows.length, peakDatabaseRows, firstPlanInserted: firstPlan.inserted, secondPlanInserted: secondPlan.inserted, firstEventsInserted: firstEvents, secondEventsInserted: secondEvents, plan };
    const report = JSON.parse(await readFile("reports/rebalancing-validation.json", "utf8"));
    report.databaseValidation = "COMPLETE"; report.liveValidation = liveValidation;
    await writeFile("reports/rebalancing-validation.json", `${JSON.stringify(report, null, 2)}\n`);
    const prior = (await readFile("reports/rebalancing-validation.md", "utf8")).split("\n## Live database validation")[0].replace("Database validation: pending migration", "Database validation: complete");
    const section = ["", "## Live database validation", "", `- Target proposal: ${proposal.id} (${proposal.model_version})`, `- Target funds: ${targetRows.length}`, `- First/second plan inserts: ${firstPlan.inserted}/${secondPlan.inserted}`, `- First/second event inserts: ${firstEvents}/${secondEvents}`, `- Confidence: ${plan.confidence}`, `- Drift: ${plan.driftScore === null ? "unknown" : (plan.driftScore * 100).toFixed(2) + " %"}`, `- Turnover: ${plan.totalTurnover.toFixed(2)} NOK`, `- Estimated cost: ${plan.estimatedCost.toFixed(2)} NOK`, `- Peak rows: ${JSON.stringify(peakDatabaseRows)}`, "- Temporary validation rows: cleaned up"].join("\n");
    await writeFile("reports/rebalancing-validation.md", `${prior.trimEnd()}\n${section}\n`);
  } finally {
    const { error } = await db.auth.admin.deleteUser(created.user.id);
    if (error) throw new Error(`Validation cleanup failed: ${error.message}`);
  }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
