import { createClient } from "@supabase/supabase-js";
import { buildRebalancePlan, RebalancingRepository } from "../lib/rebalancing";

async function main() {

const valueAfter = (flag: string) => { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] : undefined; };
const portfolioId = valueAfter("--portfolio-id"), cash = Number(valueAfter("--new-cash") ?? 0);
if (!portfolioId) throw new Error("Usage: --portfolio-id <id> [--new-cash <NOK>]");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing Supabase environment");
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: portfolio, error: portfolioError } = await db.from("portfolios").select("id,portfolio_proposal_id,base_currency").eq("id", portfolioId).single();
if (portfolioError || !portfolio) throw new Error(portfolioError?.message ?? "Portfolio not found");
if (!portfolio.portfolio_proposal_id) throw new Error("Portfolio has no linked target proposal");
const { data: snapshot, error: snapshotError } = await db.from("portfolio_snapshots").select("id,data_version").eq("portfolio_id", portfolioId).order("snapshot_date", { ascending: false }).limit(1).single();
if (snapshotError || !snapshot) throw new Error(snapshotError?.message ?? "Portfolio has no snapshot");
const [{ data: rows, error: rowError }, { data: proposal, error: proposalError }, { data: targetRows, error: targetError }] = await Promise.all([
  db.from("portfolio_position_snapshots").select("fund_id,market_value,actual_weight,nav,nav_freshness").eq("portfolio_snapshot_id", snapshot.id),
  db.from("portfolio_proposals").select("model_version,data_version").eq("id", portfolio.portfolio_proposal_id).single(),
  db.from("portfolio_proposal_funds").select("fund_id,target_weight,role").eq("proposal_id", portfolio.portfolio_proposal_id),
]);
if (rowError || proposalError || targetError || !proposal) throw new Error(rowError?.message ?? proposalError?.message ?? targetError?.message ?? "Missing proposal data");
const fundIds = [...new Set([...(rows ?? []).map((x) => x.fund_id), ...(targetRows ?? []).map((x) => x.fund_id)])];
const { data: funds, error: fundError } = await db.from("funds").select("id,name,available_on_kron").in("id", fundIds);
if (fundError) throw new Error(fundError.message);
const fundMap = new Map((funds ?? []).map((fund) => [fund.id, fund]));
const [{ data: costRows, error: costError }, { data: riskRows, error: riskError }] = await Promise.all([
  db.from("fund_costs").select("fund_id,total_annual_cost,retrieved_at").in("fund_id", fundIds).eq("is_current", true).order("retrieved_at", { ascending: false }),
  db.from("fund_risk").select("fund_id,volatility,retrieved_at").in("fund_id", fundIds).eq("is_current", true).order("retrieved_at", { ascending: false }),
]);
if (costError || riskError) throw new Error(costError?.message ?? riskError?.message);
const costMap = new Map<string, number | null>(), riskMap = new Map<string, number | null>();
for (const row of costRows ?? []) if (!costMap.has(row.fund_id)) costMap.set(row.fund_id, row.total_annual_cost === null ? null : Number(row.total_annual_cost));
for (const row of riskRows ?? []) if (!riskMap.has(row.fund_id)) riskMap.set(row.fund_id, row.volatility === null ? null : Number(row.volatility));
const input = {
  positions: (rows ?? []).map((row) => ({ fundId: row.fund_id, name: fundMap.get(row.fund_id)?.name ?? row.fund_id, marketValue: row.market_value === null ? null : Number(row.market_value), actualWeight: row.actual_weight === null ? null : Number(row.actual_weight), nav: row.nav === null ? null : Number(row.nav), navFreshness: row.nav_freshness, annualCost: costMap.get(row.fund_id) ?? null, volatility: riskMap.get(row.fund_id) ?? null, available: fundMap.get(row.fund_id)?.available_on_kron ?? false, documentValid: true, dataQuality: "HIGH" as const })),
  targets: (targetRows ?? []).map((row) => ({ fundId: row.fund_id, weight: Number(row.target_weight), role: row.role === "CORE" ? "CORE" as const : "SATELLITE" as const })),
  newCashAmount: cash,
  settings: { absoluteThreshold: .05, relativeThreshold: .2, minimumTradeAmount: 500, minimumWeightImpact: .005, avoidRealization: process.argv.includes("--avoid-realization"), maxFundWeight: .4, transactionCostRate: 0 },
  targetModelVersion: proposal.model_version,
  currentDataVersion: { snapshot: snapshot.data_version, proposal: proposal.data_version },
};
const plan = buildRebalancePlan(input), repo = new RebalancingRepository(db);
const saved = await repo.savePlan(portfolioId, input, plan);
const eventsInserted = await repo.saveMonitoringEvents(portfolioId, plan);
console.log(JSON.stringify({ saved, eventsInserted, plan }, null, 2));
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
