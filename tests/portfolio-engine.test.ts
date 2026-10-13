import { describe, expect, it } from "vitest";
import {
  constructPortfolio,
  holdingsOverlap,
  portfolioMetrics,
  PORTFOLIO_MODEL_VERSION,
} from "../lib/portfolio";
import { STANDARD_PROFILES } from "../lib/filtering";
import type { PortfolioContext, PortfolioFund } from "../lib/portfolio";
const f = (id: string, x: Partial<PortfolioFund> = {}): PortfolioFund => ({
  id,
  isin: `NO00000000${id}`,
  name: `Fund ${id}`,
  category: "Global",
  fundScore: 80 - Number(id),
  fundConfidence: "HIGH",
  riskScore: 80,
  qualityScore: 90,
  activePassive: "passive",
  annualCost: 0.003,
  costConfidence: "HIGH",
  priipRisk: 4,
  volatility: 0.12,
  regions: { EUROPE: 0.4, NORTH_AMERICA: 0.3, DEVELOPED_ASIA: 0.3 },
  countries: { USA: 0.3 },
  sectors: { Technology: 0.25, Financials: 0.2 },
  assets: { Equity: 1 },
  holdings: { [`id:${id}`]: { name: `Holding ${id}`, weight: 0.08 } },
  exposureQuality: "HIGH",
  dataVersion: { x: id },
  ...x,
});
const ctx = (profile = STANDARD_PROFILES.balanced): PortfolioContext => ({
  profile,
  preferences: [],
  preferenceVersion: 1,
  maxSatelliteAllocation: 0.6,
  maxUnderlyingWeight: 0.1,
  portfolioPreference: {
    targetRiskProxy: 4,
    preferredCoreWeight: 0.7,
    preferredSatelliteWeight: 0.2,
    targetRegionWeights: {},
    targetSectorWeights: {},
    preferredEquityWeight: 1,
    preferredFixedIncomeWeight: 0,
    concentrationTolerance: 0.3,
  },
});
describe("portfolio engine", () => {
  it("has explicit version", () =>
    expect(PORTFOLIO_MODEL_VERSION).toBe("PORTFOLIO_CONSTRUCTION_MODEL_V1_3"));
  it("calculates identifier overlap", () => {
    const a = f("1", { holdings: { "id:X": { name: "X", weight: 0.1 } } }),
      b = f("2", { holdings: { "id:X": { name: "X", weight: 0.06 } } });
    expect(holdingsOverlap(a, b).overlap).toBe(0.06);
  });
  it("aggregates cost, geography, sectors and holdings", () => {
    const m = portfolioMetrics([
      {
        fund: f("1"),
        weight: 0.6,
        role: "CORE",
        marginalContribution: 1,
        explanation: "",
      },
      {
        fund: f("2"),
        weight: 0.4,
        role: "CORE",
        marginalContribution: 1,
        explanation: "",
      },
    ]);
    expect(m.weightedCost).toBe(0.003);
    expect(m.regions.EUROPE).toBe(0.4);
    expect(m.sectors.Technology).toBe(0.25);
    expect(m.topHoldings.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(0.08);
  });
  it("returns no SIMPLE proposal when max fund weight makes 1-3 funds infeasible", () =>
    expect(
      constructPortfolio("SIMPLE", [f("1"), f("2"), f("3"), f("4")], ctx()),
    ).toBeNull());
  it("generates deterministic balanced weights summing to one", () => {
    const funds = [f("1"), f("2"), f("3"), f("4"), f("5")],
      a = constructPortfolio("BALANCED", funds, ctx()),
      b = constructPortfolio("BALANCED", funds, ctx());
    expect(a).toEqual(b);
    expect(a!.funds.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1);
    expect(a!.funds.every((x) => x.weight >= 0.05 && x.weight <= 0.3)).toBe(
      true,
    );
  });
  it("blocks excessive underlying concentration", () => {
    const funds = ["1", "2", "3", "4"].map((id) =>
      f(id, { holdings: { "id:X": { name: "X", weight: 0.5 } } }),
    );
    expect(constructPortfolio("BALANCED", funds, ctx())).toBeNull();
  });
  it("keeps low-cost passive candidates passive", () => {
    const p = constructPortfolio(
      "BALANCED",
      [f("1"), f("2"), f("3"), f("4"), f("5")],
      ctx(STANDARD_PROFILES["low-cost-passive"]),
    );
    expect(p!.funds.every((x) => x.fund.activePassive === "passive")).toBe(
      true,
    );
  });
  it("Europe preference changes preference score", () => {
    const c = {
      ...ctx(),
      portfolioPreference: {
        ...ctx().portfolioPreference,
        targetRegionWeights: { EUROPE: 0.5 },
      },
    },
      funds = [f("1"), f("2"), f("3"), f("4"), f("5")],
      p = constructPortfolio("BALANCED", funds, c);
    expect(p!.scores.preference).not.toBe(50);
  });
  it("flags unavailable Asia preference", () => {
    const c = {
        ...ctx(),
        portfolioPreference: {
          ...ctx().portfolioPreference,
          targetRegionWeights: { ASIA: 0.2 },
        },
      },
      funds = ["1", "2", "3", "4", "5"].map((id) =>
        f(id, { regions: { EUROPE: 0.9, NORTH_AMERICA: 0.1 } }),
      ),
      p = constructPortfolio("BALANCED", funds, c);
    expect(p!.unmetPreferences.map((x) => x.code)).toContain(
      "ASIA_EXPOSURE_UNAVAILABLE",
    );
  });
  it("aggressive risk target changes preference score", () => {
    const funds = [f("1"), f("2"), f("3"), f("4"), f("5")],
      low = constructPortfolio("BALANCED", funds, ctx())!,
      aggressive = constructPortfolio("BALANCED", funds, {
        ...ctx(STANDARD_PROFILES.aggressive),
        portfolioPreference: {
          ...ctx().portfolioPreference,
          targetRiskProxy: 6,
        },
      })!;
    expect(aggressive.scores.preference).not.toBe(low.scores.preference);
  });
  it("reports overlap confidence without false precision", () =>
    expect(holdingsOverlap(f("1"), f("2")).confidence).toBe("LOW"));
  it("uses marginal contributions", () => {
    const p = constructPortfolio(
      "BALANCED",
      [f("1"), f("2"), f("3"), f("4"), f("5")],
      ctx(),
    );
    expect(p!.funds.every((x) => Number.isFinite(x.marginalContribution))).toBe(
      true,
    );
  });
});
