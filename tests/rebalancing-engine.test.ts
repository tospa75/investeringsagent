import { describe, expect, it } from "vitest";
import { buildRebalancePlan } from "../lib/rebalancing";
import type { PortfolioMonitoringInput, RebalancePosition } from "../lib/rebalancing";

const position = (fundId: string, value: number | null, weight: number | null, overrides: Partial<RebalancePosition> = {}): RebalancePosition => ({ fundId, name: fundId, marketValue: value, actualWeight: weight, nav: 100, navFreshness: "FRESH", dataQuality: "HIGH", available: true, documentValid: true, annualCost: 0.002, volatility: 0.12, ...overrides });
const base = (overrides: Partial<PortfolioMonitoringInput> = {}): PortfolioMonitoringInput => ({
  positions: [position("A", 5000, 0.5), position("B", 5000, 0.5)],
  targets: [{ fundId: "A", weight: 0.5 }, { fundId: "B", weight: 0.5 }],
  newCashAmount: 0,
  settings: { absoluteThreshold: 0.05, relativeThreshold: 0.2, minimumTradeAmount: 100, minimumWeightImpact: 0.005, avoidRealization: false, transactionCostRate: 0.001 },
  exposures: { regions: { EUROPE: 0.4 }, sectors: { Technology: 0.2 }, holdings: [{ key: "x", name: "X", weight: 0.08 }] },
  targetModelVersion: "v1",
  currentDataVersion: { nav: "1" },
  ...overrides,
});

describe("rebalancing and monitoring engine", () => {
  it("reports target versus actual for a balanced portfolio", () => { const plan = buildRebalancePlan(base()); expect(plan.status).toBe("IN_BALANCE"); expect(plan.driftScore).toBe(0); expect(plan.actions).toHaveLength(0); });
  it("honors the no-trade band", () => { const plan = buildRebalancePlan(base({ positions: [position("A", 5300, .53), position("B", 4700, .47)] })); expect(plan.funds.every((x) => x.status === "WITHIN_RANGE")).toBe(true); expect(plan.actions).toHaveLength(0); });
  it("detects overweight and underweight funds", () => { const plan = buildRebalancePlan(base({ positions: [position("A", 7000, .7), position("B", 3000, .3)] })); expect(plan.funds.find((x) => x.fundId === "A")?.status).toBe("OVERWEIGHT"); expect(plan.funds.find((x) => x.fundId === "B")?.status).toBe("UNDERWEIGHT"); });
  it("allocates new cash to the largest underweight first", () => { const plan = buildRebalancePlan(base({ positions: [position("A", 7000, .7), position("B", 3000, .3)], newCashAmount: 4000 })); expect(plan.actions[0]).toMatchObject({ fundId: "B", actionType: "BUY", amount: 4000 }); expect(plan.actions.some((x) => x.actionType === "SELL")).toBe(false); });
  it("suggests a sale when no cash is available", () => { const plan = buildRebalancePlan(base({ positions: [position("A", 7000, .7), position("B", 3000, .3)] })); expect(plan.actions.some((x) => x.fundId === "A" && x.actionType === "SELL")).toBe(true); expect(plan.actions.some((x) => x.fundId === "B" && x.actionType === "BUY")).toBe(true); });
  it("suppresses sales when avoid realization is true", () => { const input = base({ positions: [position("A", 7000, .7), position("B", 3000, .3)] }); input.settings.avoidRealization = true; const plan = buildRebalancePlan(input); expect(plan.actions.some((x) => x.actionType === "SELL")).toBe(false); expect(plan.warnings.join(" ")).toMatch(/cannot be reached/i); });
  it("suppresses tiny trades", () => { const input = base({ positions: [position("A", 5600, .56), position("B", 4400, .44)] }); input.settings.minimumTradeAmount = 1000; expect(buildRebalancePlan(input).actions).toHaveLength(0); });
  it("raises a critical hard geography constraint and withholds trades", () => { const input = base({ exposures: { regions: { EUROPE: .7 } } }); input.settings.maxRegionWeights = { EUROPE: .5 }; const plan = buildRebalancePlan(input); expect(plan.monitoringEvents[0]).toMatchObject({ eventType: "REGION_MAX_BREACH", severity: "CRITICAL" }); expect(plan.actions).toHaveLength(0); });
  it("lowers confidence for stale NAV", () => { const plan = buildRebalancePlan(base({ positions: [position("A", 7000, .7, { navFreshness: "STALE" }), position("B", 3000, .3)] })); expect(plan.confidence).toBe("MEDIUM"); expect(plan.actions.every((x) => x.confidence === "MEDIUM")).toBe(true); });
  it("does not calculate exact trades with missing NAV value", () => { const plan = buildRebalancePlan(base({ positions: [position("A", null, null, { nav: null, navFreshness: "MISSING" }), position("B", 5000, .5)] })); expect(plan.status).toBe("UNKNOWN"); expect(plan.actions).toHaveLength(0); expect(plan.confidence).toBe("LOW"); });
  it("creates a concentration alert", () => { const input = base({ positions: [position("A", 7000, .7), position("B", 3000, .3)] }); input.settings.maxFundWeight = .6; expect(buildRebalancePlan(input).monitoringEvents.some((x) => x.eventType === "FUND_CONCENTRATION")).toBe(true); });
  it("creates a critical review event for an invalid fund", () => { const input = base({ positions: [position("A", 5000, .5, { documentValid: false }), position("B", 5000, .5)] }); const plan = buildRebalancePlan(input); expect(plan.monitoringEvents.some((x) => x.eventType === "FUND_REVIEW_REQUIRED" && x.severity === "CRITICAL")).toBe(true); expect(plan.actions).toHaveLength(0); });
  it("produces one stable event per condition", () => { const input = base(); input.settings.maxUnderlyingHoldingWeight = .05; const plan = buildRebalancePlan(input); expect(plan.monitoringEvents.filter((x) => x.eventType === "UNDERLYING_CONCENTRATION")).toHaveLength(1); });
  it("is deterministic", () => { const input = base({ positions: [position("A", 7000, .7), position("B", 3000, .3)] }); expect(buildRebalancePlan(input)).toEqual(buildRebalancePlan(input)); });
  it("rejects targets that do not sum to 100 percent", () => expect(() => buildRebalancePlan(base({ targets: [{ fundId: "A", weight: .4 }, { fundId: "B", weight: .5 }] }))).toThrow(/sum to 1/));
  it("monitors weighted cost and risk drift", () => { const input = base({ positions: [position("A", 5000, .5, { annualCost: .02 }), position("B", 5000, .5, { annualCost: .02 })], targetRisk: 3, portfolioRisk: 5 }); input.settings.maxAnnualCost = .01; const events = buildRebalancePlan(input).monitoringEvents.map((x) => x.eventType); expect(events).toContain("COST_MAX_BREACH"); expect(events).toContain("RISK_DRIFT"); });
});
