import type {
  FundExposure,
  NavFreshness,
  NavValue,
  NormalizedTransaction,
  PortfolioState,
  Position,
  TransactionInput,
} from "./tracking-types";
const round = (n: number) => Math.round(n * 1e10) / 1e10;
export function normalizeTransaction(
  input: TransactionInput,
): NormalizedTransaction {
  let { amount, nav, units } = input;
  if (input.type !== "ADJUSTMENT") {
    if (amount === null && nav !== null && units !== null) amount = nav * units;
    if (units === null && amount !== null && nav !== null) units = amount / nav;
    if (nav === null && amount !== null && units !== null) nav = amount / units;
    if (amount === null || nav === null || units === null)
      throw new Error("At least two of amount, NAV and units are required");
    if (amount <= 0 || nav <= 0 || units <= 0)
      throw new Error("BUY/SELL amount, NAV and units must be positive");
    if (Math.abs(amount - nav * units) > Math.max(0.01, amount * 0.0001))
      throw new Error("Transaction inputs are inconsistent");
  } else {
    if (units === null || units === 0)
      throw new Error("ADJUSTMENT requires non-zero units");
    nav = nav ?? 0;
    amount = amount ?? 0;
  }
  if (!/^[A-Z]{3}$/.test(input.currency) || input.fees < 0)
    throw new Error("Invalid currency or fees");
  return {
    ...input,
    amount: round(amount),
    nav: round(nav),
    units: round(units),
  };
}
function weekdays(from: string, to: string) {
  let count = 0,
    d = new Date(`${from}T00:00:00Z`),
    end = new Date(`${to}T00:00:00Z`);
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
export function navFreshness(
  nav: NavValue | null,
  asOf: string,
  baseCurrency: string,
): NavFreshness {
  if (!nav) return "MISSING";
  if (nav.currency !== baseCurrency) return "FX_REQUIRED";
  return weekdays(nav.date, asOf) <= 3 ? "FRESH" : "STALE";
}
export function calculatePortfolio(
  transactions: NormalizedTransaction[],
  navs: Record<string, NavValue | null>,
  asOf: string,
  baseCurrency: string,
  exposures: Record<string, FundExposure> = {},
  targets: Record<string, number> = {},
): PortfolioState {
  const states = new Map<
    string,
    { units: number; costBasis: number; realized: number; invested: number }
  >();
  for (const t of [...transactions].sort(
    (a, b) =>
      a.tradeDate.localeCompare(b.tradeDate) || a.id.localeCompare(b.id),
  )) {
    const s = states.get(t.fundId) ?? {
      units: 0,
      costBasis: 0,
      realized: 0,
      invested: 0,
    };
    if (t.type === "BUY") {
      s.units += t.units;
      s.costBasis += t.amount + t.fees;
      s.invested += t.amount + t.fees;
    } else if (t.type === "SELL") {
      if (t.units > s.units + 1e-10)
        throw new Error(`Over-sell rejected for ${t.fundId}`);
      const avg = s.units ? s.costBasis / s.units : 0,
        basis = avg * t.units,
        proceeds = t.amount - t.fees;
      s.units -= t.units;
      s.costBasis -= basis;
      s.realized += proceeds - basis;
    } else {
      s.units += t.units;
      if (s.units < -1e-10)
        throw new Error(`Negative adjusted position for ${t.fundId}`);
      s.costBasis += t.amount;
    }
    states.set(t.fundId, s);
  }
  const positions = [...states.entries()]
      .filter(([, s]) => s.units > 1e-10)
      .map<Position>(([fundId, s]) => {
        const nav = navs[fundId] ?? null,
          freshness = navFreshness(nav, asOf, baseCurrency),
          marketValue =
            freshness === "FX_REQUIRED" || freshness === "MISSING"
              ? null
              : s.units * nav!.nav,
          unrealized = marketValue === null ? null : marketValue - s.costBasis;
        return {
          fundId,
          units: round(s.units),
          averageCost: round(s.costBasis / s.units),
          costBasis: round(s.costBasis),
          realizedGainLoss: round(s.realized),
          totalInvested: round(s.invested),
          nav: nav?.nav ?? null,
          navDate: nav?.date ?? null,
          freshness,
          marketValue: marketValue === null ? null : round(marketValue),
          unrealizedGainLoss: unrealized === null ? null : round(unrealized),
          unrealizedReturnPercent:
            unrealized === null || s.costBasis === 0
              ? null
              : round(unrealized / s.costBasis),
          actualWeight: null,
          targetWeight: targets[fundId] ?? null,
          deviation: null,
        };
      }),
    known = positions.every((p) => p.marketValue !== null),
    marketValue = known
      ? positions.reduce((s, p) => s + p.marketValue!, 0)
      : null,
    totalCost = positions.reduce((s, p) => s + p.costBasis, 0),
    realized = [...states.values()].reduce((s, x) => s + x.realized, 0);
  if (marketValue !== null)
    for (const p of positions) {
      p.actualWeight = marketValue ? p.marketValue! / marketValue : 0;
      p.deviation =
        p.targetWeight === null ? null : round(p.actualWeight - p.targetWeight);
    }
  const exposure = {
      regions: {} as Record<string, number>,
      sectors: {} as Record<string, number>,
      assets: {} as Record<string, number>,
      holdings: [] as Array<{ key: string; name: string; weight: number }>,
      managementStyle: {} as Record<string, number>,
    },
    holdingMap: Record<string, { name: string; weight: number }> = {};
  if (marketValue !== null)
    for (const p of positions) {
      const e = exposures[p.fundId];
      if (!e || p.actualWeight === null) continue;
      for (const field of ["regions", "sectors", "assets"] as const)
        for (const [k, v] of Object.entries(e[field]))
          exposure[field][k] = (exposure[field][k] ?? 0) + p.actualWeight * v;
      exposure.managementStyle[e.managementStyle] =
        (exposure.managementStyle[e.managementStyle] ?? 0) + p.actualWeight;
      for (const [k, h] of Object.entries(e.holdings)) {
        const x = holdingMap[k] ?? { name: h.name, weight: 0 };
        x.weight += p.actualWeight * h.weight;
        holdingMap[k] = x;
      }
    }
  exposure.holdings = Object.entries(holdingMap)
    .map(([key, x]) => ({ key, ...x }))
    .sort((a, b) => b.weight - a.weight);
  const flags = [
      ...new Set(
        positions
          .filter((p) => p.freshness !== "FRESH")
          .map((p) => `${p.fundId}:${p.freshness}`),
      ),
    ],
    unrealized = marketValue === null ? null : marketValue - totalCost,
    totalInvested = [...states.values()].reduce((s, x) => s + x.invested, 0);
  return {
    positions,
    totalInvested: round(totalInvested),
    marketValue: marketValue === null ? null : round(marketValue),
    unrealizedGainLoss: unrealized === null ? null : round(unrealized),
    realizedGainLoss: round(realized),
    totalReturnPercent:
      unrealized === null || totalInvested === 0
        ? null
        : round((realized + unrealized) / totalInvested),
    exposure,
    flags,
  };
}
