import { mkdir, writeFile } from "node:fs/promises";
import { buildRebalancePlan } from "../lib/rebalancing";
import type { PortfolioMonitoringInput, RebalancePosition } from "../lib/rebalancing";

async function main() {

const position = (fundId: string, value: number | null, weight: number | null, overrides: Partial<RebalancePosition> = {}): RebalancePosition => ({ fundId, name: `Fund ${fundId}`, marketValue: value, actualWeight: weight, nav: 100, navFreshness: "FRESH", dataQuality: "HIGH", available: true, documentValid: true, annualCost: .002, volatility: .12, ...overrides });
const input = (overrides: Partial<PortfolioMonitoringInput> = {}): PortfolioMonitoringInput => ({ positions: [position("A", 70000, .7), position("B", 30000, .3)], targets: [{ fundId: "A", weight: .5, role: "CORE" }, { fundId: "B", weight: .5, role: "SATELLITE" }], newCashAmount: 0, settings: { absoluteThreshold: .05, relativeThreshold: .2, minimumTradeAmount: 500, minimumWeightImpact: .005, avoidRealization: false, maxFundWeight: .75, maxRegionWeights: { NORTH_AMERICA: .8 }, maxUnderlyingHoldingWeight: .1, maxSatelliteWeight: .6, maxAnnualCost: .01, transactionCostRate: .001 }, exposures: { regions: { NORTH_AMERICA: .7 }, sectors: { Technology: .25 }, holdings: [{ key: "x", name: "Holding X", weight: .08 }] }, targetRisk: 4, portfolioRisk: 4, targetModelVersion: "PORTFOLIO_CONSTRUCTION_MODEL_V1_3", currentDataVersion: { validation: "task-13-v1" }, ...overrides });
const scenarios = {
  balanced: buildRebalancePlan(input({ positions: [position("A", 50000, .5), position("B", 50000, .5)] })),
  overweightSaleRequired: buildRebalancePlan(input()),
  newCashFirst: buildRebalancePlan(input({ newCashAmount: 40000 })),
  avoidRealization: (() => { const x = input(); x.settings.avoidRealization = true; return buildRebalancePlan(x); })(),
  staleNav: buildRebalancePlan(input({ positions: [position("A", 70000, .7, { navFreshness: "STALE" }), position("B", 30000, .3)] })),
  hardConstraint: (() => { const x = input(); x.settings.maxRegionWeights = { NORTH_AMERICA: .5 }; return buildRebalancePlan(x); })(),
  invalidFund: buildRebalancePlan(input({ positions: [position("A", 70000, .7, { available: false }), position("B", 30000, .3)] })),
};
const report = { generatedAt: new Date().toISOString(), databaseValidation: "PENDING_MIGRATION", scenarios };
await mkdir("reports", { recursive: true });
await writeFile("reports/rebalancing-validation.json", `${JSON.stringify(report, null, 2)}\n`);
const lines = ["# Rebalancing validation", "", `Generated: ${report.generatedAt}`, "", "Database validation: pending migration", "", "| Scenario | Status | Drift | Confidence | Actions | Turnover | Events |", "|---|---|---:|---|---:|---:|---:|", ...Object.entries(scenarios).map(([name, plan]) => `| ${name} | ${plan.status} | ${plan.driftScore === null ? "–" : (plan.driftScore * 100).toFixed(2) + " %"} | ${plan.confidence} | ${plan.actions.length} | ${plan.totalTurnover.toFixed(2)} NOK | ${plan.monitoringEvents.length} |`), "", "## Example actions", "", ...scenarios.overweightSaleRequired.actions.map((action) => `- ${action.actionType} ${action.fundId}: ${action.amount?.toFixed(2) ?? "unknown"} NOK — ${action.reason}`), "", "## New cash first", "", ...scenarios.newCashFirst.actions.map((action) => `- ${action.actionType} ${action.fundId}: ${action.amount?.toFixed(2) ?? "unknown"} NOK — ${action.reason}`), "", "## Monitoring examples", "", ...[...scenarios.hardConstraint.monitoringEvents, ...scenarios.invalidFund.monitoringEvents].map((event) => `- ${event.severity} ${event.eventType}: ${event.message}`)];
await writeFile("reports/rebalancing-validation.md", `${lines.join("\n")}\n`);
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
