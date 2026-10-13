import { describe, expect, it } from "vitest";
import {
  calculatePortfolio,
  navFreshness,
  normalizeTransaction,
} from "../lib/tracking";
import type { NormalizedTransaction } from "../lib/tracking";
const tx = (
  id: string,
  fundId: string,
  type: "BUY" | "SELL" | "ADJUSTMENT",
  amount: number | null,
  nav: number | null,
  units: number | null,
  tradeDate = "2026-10-01",
): NormalizedTransaction =>
  normalizeTransaction({
    id,
    fundId,
    type,
    amount,
    nav,
    units,
    tradeDate,
    currency: "NOK",
    fees: 0,
    source: "MANUAL",
  });
describe("transaction and actual portfolio engine", () => {
  it("calculates BUY units", () =>
    expect(tx("1", "A", "BUY", 1000, 100, null).units).toBe(10));
  it("calculates SELL proceeds", () =>
    expect(tx("1", "A", "SELL", null, 120, 2).amount).toBe(240));
  it("uses weighted average cost", () => {
    const s = calculatePortfolio(
      [tx("1", "A", "BUY", 1000, 100, 10), tx("2", "A", "BUY", 600, 120, 5)],
      {
        A: { nav: 130, date: "2026-10-10", currency: "NOK", contentHash: "x" },
      },
      "2026-10-11",
      "NOK",
    );
    expect(s.positions[0].averageCost).toBeCloseTo(1600 / 15);
  });
  it("handles partial sell and realized P/L", () => {
    const s = calculatePortfolio(
      [tx("1", "A", "BUY", 1000, 100, 10), tx("2", "A", "SELL", 600, 150, 4)],
      {
        A: { nav: 150, date: "2026-10-10", currency: "NOK", contentHash: "x" },
      },
      "2026-10-11",
      "NOK",
    );
    expect(s.positions[0].units).toBe(6);
    expect(s.realizedGainLoss).toBe(200);
    expect(s.positions[0].costBasis).toBe(600);
    expect(s.unrealizedGainLoss).toBe(300);
    expect(s.totalReturnPercent).toBe(0.5);
  });
  it("rejects over-sell", () =>
    expect(() =>
      calculatePortfolio(
        [tx("1", "A", "BUY", 100, 100, 1), tx("2", "A", "SELL", 200, 100, 2)],
        {},
        "2026-10-11",
        "NOK",
      ),
    ).toThrow(/Over-sell/));
  it("calculates unrealized P/L and market value", () => {
    const s = calculatePortfolio(
      [tx("1", "A", "BUY", 1000, 100, 10)],
      {
        A: { nav: 120, date: "2026-10-10", currency: "NOK", contentHash: "x" },
      },
      "2026-10-11",
      "NOK",
    );
    expect(s.marketValue).toBe(1200);
    expect(s.unrealizedGainLoss).toBe(200);
  });
  it("calculates actual weights", () => {
    const s = calculatePortfolio(
      [tx("1", "A", "BUY", 1000, 100, 10), tx("2", "B", "BUY", 1000, 100, 10)],
      {
        A: { nav: 100, date: "2026-10-10", currency: "NOK", contentHash: "a" },
        B: { nav: 200, date: "2026-10-10", currency: "NOK", contentHash: "b" },
      },
      "2026-10-11",
      "NOK",
    );
    expect(s.positions.find((x) => x.fundId === "A")!.actualWeight).toBeCloseTo(
      1 / 3,
    );
  });
  it("aggregates exposure and target deviation", () => {
    const s = calculatePortfolio(
      [tx("1", "A", "BUY", 1000, 100, 10)],
      {
        A: { nav: 100, date: "2026-10-10", currency: "NOK", contentHash: "a" },
      },
      "2026-10-11",
      "NOK",
      {
        A: {
          regions: { EUROPE: 0.5 },
          sectors: { Tech: 0.2 },
          assets: { Equity: 1 },
          holdings: { X: { name: "X", weight: 0.1 } },
          managementStyle: "passive",
        },
      },
      { A: 0.8 },
    );
    expect(s.exposure.regions.EUROPE).toBe(0.5);
    expect(s.positions[0].deviation).toBe(0.2);
  });
  it("marks fresh NAV across weekend", () =>
    expect(
      navFreshness(
        { nav: 1, date: "2026-10-09", currency: "NOK", contentHash: "x" },
        "2026-10-12",
        "NOK",
      ),
    ).toBe("FRESH"));
  it("marks stale NAV", () =>
    expect(
      navFreshness(
        { nav: 1, date: "2026-10-01", currency: "NOK", contentHash: "x" },
        "2026-10-12",
        "NOK",
      ),
    ).toBe("STALE"));
  it("marks missing NAV", () =>
    expect(navFreshness(null, "2026-10-12", "NOK")).toBe("MISSING"));
  it("requires FX for non-base currency", () =>
    expect(
      navFreshness(
        { nav: 1, date: "2026-10-12", currency: "EUR", contentHash: "x" },
        "2026-10-12",
        "NOK",
      ),
    ).toBe("FX_REQUIRED"));
  it("drops zero position after full sell", () =>
    expect(
      calculatePortfolio(
        [tx("1", "A", "BUY", 100, 100, 1), tx("2", "A", "SELL", 110, 110, 1)],
        {},
        "2026-10-11",
        "NOK",
      ).positions,
    ).toHaveLength(0));
  it("is deterministic", () => {
    const t = [tx("1", "A", "BUY", 100, 100, 1)],
      n = {
        A: { nav: 110, date: "2026-10-10", currency: "NOK", contentHash: "x" },
      };
    expect(calculatePortfolio(t, n, "2026-10-11", "NOK")).toEqual(
      calculatePortfolio(t, n, "2026-10-11", "NOK"),
    );
  });
  it("rejects insufficient manual input", () =>
    expect(() =>
      normalizeTransaction({
        id: "x",
        fundId: "A",
        type: "BUY",
        tradeDate: "2026-10-01",
        amount: 100,
        nav: null,
        units: null,
        currency: "NOK",
        fees: 0,
        source: "MANUAL",
      }),
    ).toThrow());
});
