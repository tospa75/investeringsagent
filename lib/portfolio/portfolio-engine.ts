import { deriveMaxAcceptableRisk } from "../filtering";
import type {
  FundRole,
  PortfolioContext,
  PortfolioFund,
  PortfolioMetrics,
  PortfolioProposal,
  ProposalFund,
  ProposalType,
} from "./portfolio-types";
export const PORTFOLIO_MODEL_VERSION = "PORTFOLIO_CONSTRUCTION_MODEL_V1_3",
  PORTFOLIO_WEIGHTS = {
    risk: 0.25,
    diversification: 0.2,
    preference: 0.2,
    cost: 0.15,
    robustness: 0.1,
    simplicity: 0.1,
  };
const clamp = (n: number) => Math.max(0, Math.min(100, n)),
  round = (n: number) => Math.round(n * 1e6) / 1e6;
export function holdingsOverlap(a: PortfolioFund, b: PortfolioFund) {
  const keys = Object.keys(a.holdings).filter((k) => b.holdings[k]),
    overlap = keys.reduce(
      (s, k) => s + Math.min(a.holdings[k].weight, b.holdings[k].weight),
      0,
    ),
    n = Math.min(
      Object.keys(a.holdings).length,
      Object.keys(b.holdings).length,
    ),
    confidence = n >= 30 ? "HIGH" : n >= 10 ? "MEDIUM" : "LOW";
  return { overlap: round(overlap), confidence } as const;
}
export function classifyRole(f: PortfolioFund): FundRole | null {
  const asset = Object.entries(f.assets).sort((a, b) => b[1] - a[1])[0],
    region = Object.entries(f.regions).sort((a, b) => b[1] - a[1])[0],
    sector = Object.entries(f.sectors).sort((a, b) => b[1] - a[1])[0];
  if (asset && /bond|fixed|obligation/i.test(asset[0]) && asset[1] >= 0.5)
    return "FIXED_INCOME";
  if (
    region &&
    /EMERGING|LATIN|MIDDLE_EAST|AFRICA/i.test(region[0]) &&
    region[1] >= 0.5
  )
    return "EMERGING_MARKETS";
  if (f.category && /vekstmarkeder|emerging/i.test(f.category))
    return "EMERGING_MARKETS";
  if (sector && sector[1] >= 0.5) return "SECTOR";
  if (f.category && /global/i.test(f.category)) return "CORE";
  if (
    Object.keys(f.regions).length >= 3 &&
    (!region || region[1] < 0.65) &&
    (!sector || sector[1] < 0.4)
  )
    return "CORE";
  if (region && region[1] >= 0.65) return "REGION";
  return null;
}
const aggregate = (
  funds: ProposalFund[],
  field: "regions" | "countries" | "sectors" | "assets",
) => {
  const out: Record<string, number> = {};
  for (const x of funds)
    for (const [k, v] of Object.entries(x.fund[field]))
      out[k] = (out[k] ?? 0) + x.weight * v;
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, round(v)]));
};
export function portfolioMetrics(funds: ProposalFund[]): PortfolioMetrics {
  const regions = aggregate(funds, "regions"),
    countries = aggregate(funds, "countries"),
    sectors = aggregate(funds, "sectors"),
    assets = aggregate(funds, "assets"),
    holdingMap: Record<string, { name: string; weight: number }> = {};
  for (const x of funds)
    for (const [k, h] of Object.entries(x.fund.holdings)) {
      const old = holdingMap[k] ?? { name: h.name, weight: 0 };
      old.weight += x.weight * h.weight;
      holdingMap[k] = old;
    }
  const topHoldings = Object.entries(holdingMap)
      .map(([key, v]) => ({ key, name: v.name, weight: round(v.weight) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20),
    pairs = [] as ReturnType<typeof holdingsOverlap>[];
  for (let i = 0; i < funds.length; i++)
    for (let j = i + 1; j < funds.length; j++)
      pairs.push(holdingsOverlap(funds[i].fund, funds[j].fund));
  const knownCost = funds.filter((x) => x.fund.annualCost !== null),
    weightedCost = knownCost.length
      ? knownCost.reduce((s, x) => s + x.weight * x.fund.annualCost!, 0) /
        knownCost.reduce((s, x) => s + x.weight, 0)
      : null,
    costConfidence =
      knownCost.length === funds.length &&
      funds.every((x) => x.fund.costConfidence === "HIGH")
        ? "HIGH"
        : knownCost.length === funds.length
          ? "MEDIUM"
          : "LOW",
    weightedRisk = funds.every((x) => x.fund.priipRisk !== null)
      ? funds.reduce((s, x) => s + x.weight * x.fund.priipRisk!, 0)
      : null,
    overlapConfidence = pairs.every((x) => x.confidence === "HIGH")
      ? "HIGH"
      : pairs.some((x) => x.confidence === "LOW")
        ? "LOW"
        : "MEDIUM",
    satelliteAllocation = funds
      .filter((x) => ["SECTOR", "THEMATIC", "SMALL_CAP", "EMERGING_MARKETS", "TACTICAL"].includes(x.role))
      .reduce((s, x) => s + x.weight, 0),
    flags = [];
  if (costConfidence !== "HIGH") flags.push("COST_PARTIAL");
  if (overlapConfidence === "LOW") flags.push("OVERLAP_PARTIAL");
  return {
    regions,
    countries,
    sectors,
    assets,
    topHoldings,
    weightedCost: weightedCost === null ? null : round(weightedCost),
    costConfidence,
    weightedRisk: weightedRisk === null ? null : round(weightedRisk),
    averageOverlap: pairs.length
      ? round(pairs.reduce((s, x) => s + x.overlap, 0) / pairs.length)
      : 0,
    overlapConfidence,
    maxUnderlyingWeight: topHoldings[0]?.weight ?? 0,
    satelliteAllocation: round(satelliteAllocation),
    flags,
  };
}
function weights(
  selected: Array<{
    fund: PortfolioFund;
    role: FundRole;
    marginalContribution: number;
  }>,
  c: PortfolioContext,
) {
  const raw = selected.map((x) =>
      x.role === "CORE" ? 1.5 : x.role === "FIXED_INCOME" ? 1.2 : 0.7,
    ),
    sum = raw.reduce((a, b) => a + b, 0),
    w = raw.map((x) => x / sum),
    max = c.profile.maxWeightPerFund,
    min = c.profile.minWeightPerFund;
  for (let z = 0; z < 20; z++) {
    for (let i = 0; i < w.length; i++)
      w[i] = Math.max(min, Math.min(max, w[i]));
    const d = 1 - w.reduce((a, b) => a + b, 0),
      eligible = w
        .map((x, i) => ({ x, i }))
        .filter((v) => (d > 0 ? v.x < max : v.x > min));
    if (Math.abs(d) < 1e-9 || !eligible.length) break;
    for (const e of eligible) w[e.i] += d / eligible.length;
  }
  return selected.map(
    (x, i): ProposalFund => ({
      ...x,
      weight: round(w[i]),
      explanation: `${x.role}: valgt for score ${x.fund.fundScore.toFixed(1)} og marginal porteføljenytte ${x.marginalContribution.toFixed(2)}.`,
    }),
  );
}
function hardViolations(
  funds: ProposalFund[],
  m: PortfolioMetrics,
  c: PortfolioContext,
) {
  const v: string[] = [];
  if (funds.length > c.profile.maxFundCount) v.push("MAX_FUND_COUNT");
  if (funds.some((x) => x.weight > c.profile.maxWeightPerFund + 1e-6))
    v.push("MAX_SINGLE_FUND_WEIGHT");
  if (funds.some((x) => x.weight < c.profile.minWeightPerFund - 1e-6))
    v.push("MIN_FUND_WEIGHT");
  if (m.maxUnderlyingWeight > c.maxUnderlyingWeight)
    v.push("MAX_UNDERLYING_WEIGHT");
  if (m.satelliteAllocation > c.maxSatelliteAllocation)
    v.push("MAX_SATELLITE_ALLOCATION");
  if (
    c.profile.riskWillingnessScore >= 6 &&
    funds
      .filter((x) => x.role === "FIXED_INCOME")
      .reduce((s, x) => s + x.weight, 0) > 0.3
  )
    v.push("MAX_FIXED_INCOME_FOR_AGGRESSIVE");
  for (const x of c.profile.constraints.filter((x) => x.isHard)) {
    const key = x.dimension ?? "";
    if (
      x.constraintType === "MAX_COUNTRY_WEIGHT" &&
      (m.countries[key] ?? 0) > (x.valueNumeric ?? 1)
    )
      v.push(`MAX_COUNTRY_WEIGHT:${key}`);
    if (
      x.constraintType === "MIN_REGION_WEIGHT" &&
      (m.regions[key] ?? 0) < (x.valueNumeric ?? 0)
    )
      v.push(`MIN_REGION_WEIGHT:${key}`);
    if (
      x.constraintType === "MAX_SECTOR_CONCENTRATION" &&
      Math.max(0, ...Object.values(m.sectors)) > (x.valueNumeric ?? 1)
    )
      v.push("MAX_SECTOR_WEIGHT");
  }
  return [...new Set(v)];
}
function evaluate(funds: ProposalFund[], c: PortfolioContext) {
  const m = portfolioMetrics(funds),
    target = deriveMaxAcceptableRisk(c.profile),
    risk =
      m.weightedRisk === null
        ? 50
        : clamp(
            100 -
              (m.weightedRisk > target
                ? (m.weightedRisk - target) * 28
                : (target - m.weightedRisk) * 12),
          ),
    maxSector = Math.max(0, ...Object.values(m.sectors)),
    maxGeo = Math.max(0, ...Object.values(m.countries)),
    diversification = clamp(
      100 -
        m.averageOverlap * 50 -
        maxSector * 20 -
        maxGeo * 15 -
        m.maxUnderlyingWeight * 100 +
        Math.min(funds.length, 4) * 5,
    ),
    asia = Object.entries(m.regions)
      .filter(([key]) => /ASIA|PACIFIC/i.test(key))
      .reduce((sum, [, value]) => sum + value, 0),
    regionValues: Record<string, number> = { ...m.regions, ASIA: asia },
    portfolioPreference = c.portfolioPreference,
    matches = [
      ...Object.entries(portfolioPreference.targetRegionWeights).map(
        ([key, target]) => clamp(100 - Math.abs((regionValues[key] ?? 0) - target) * 125),
      ),
      ...Object.entries(portfolioPreference.targetSectorWeights).map(
        ([key, target]) => clamp(100 - Math.abs((m.sectors[key] ?? 0) - target) * 125),
      ),
      ...(portfolioPreference.targetRiskProxy === null || m.weightedRisk === null
        ? []
        : [clamp(100 - Math.abs(m.weightedRisk - portfolioPreference.targetRiskProxy) * 20)]),
      ...(portfolioPreference.preferredSatelliteWeight === null
        ? []
        : [clamp(100 - Math.abs(m.satelliteAllocation - portfolioPreference.preferredSatelliteWeight) * 125)]),
      ...(portfolioPreference.preferredEquityWeight === null
        ? []
        : [clamp(100 - Math.abs((m.assets.Equity ?? m.assets.EQUITY ?? 0) - portfolioPreference.preferredEquityWeight) * 100)]),
    ],
    preference = matches.length
      ? matches.reduce((a, b) => a + b, 0) / matches.length
      : 50,
    cost = m.weightedCost === null ? 50 : clamp(100 - m.weightedCost * 4000),
    robustness = funds.reduce(
      (s, x) =>
        s +
        x.weight *
          (x.fund.fundConfidence === "HIGH"
            ? 100
            : x.fund.fundConfidence === "MEDIUM"
              ? 70
              : 35),
      0,
    ),
    simplicity = clamp(
      100 -
        (funds.length - 1) * 10 -
        m.averageOverlap * 25 -
        funds.filter((x) => x.weight < 0.05).length * 20,
    ),
    scores = {
      risk: round(risk),
      diversification: round(diversification),
      preference: round(preference),
      cost: round(cost),
      robustness: round(robustness),
      simplicity: round(simplicity),
    },
    total = round(
      scores.risk * 0.25 +
        scores.diversification * 0.2 +
        scores.preference * 0.2 +
        scores.cost * 0.15 +
        scores.robustness * 0.1 +
        scores.simplicity * 0.1,
    );
  return { m, scores, total, violations: hardViolations(funds, m, c) };
}
export function constructPortfolio(
  type: ProposalType,
  candidates: PortfolioFund[],
  c: PortfolioContext,
): PortfolioProposal | null {
  const maxByType = { SIMPLE: 3, BALANCED: 5, OFFENSIVE: 6 }[type],
    minByType = { SIMPLE: 1, BALANCED: 3, OFFENSIVE: 3 }[type],
    required = Math.ceil(1 / c.profile.maxWeightPerFund),
    target = Math.min(
      c.profile.maxFundCount,
      maxByType,
      Math.max(
        minByType,
        type === "BALANCED"
          ? c.profile.targetFundCount
          : type === "OFFENSIVE"
            ? c.profile.targetFundCount + 1
            : 1,
      ),
    );
  if (required > maxByType || candidates.length < Math.max(required, minByType))
    return null;
  const usable = candidates
      .map((f) => ({ fund: f, role: classifyRole(f) }))
      .filter(
        (x): x is { fund: PortfolioFund; role: FundRole } => x.role !== null,
      )
      .sort(
        (a, b) =>
          b.fund.fundScore - a.fund.fundScore ||
          a.fund.isin.localeCompare(b.fund.isin),
      ),
    selected: Array<{
      fund: PortfolioFund;
      role: FundRole;
      marginalContribution: number;
    }> = [];
  while (selected.length < target) {
    let best: null | {
      fund: PortfolioFund;
      role: FundRole;
      marginalContribution: number;
    } = null;
    for (const x of usable.filter(
      (x) => !selected.some((s) => s.fund.id === x.fund.id),
    )) {
      const before = selected.length
          ? evaluate(weights(selected, c), c).total
          : 0,
        trial = weights([...selected, { ...x, marginalContribution: 0 }], c),
        after = evaluate(trial, c);
      if (after.violations.length) continue;
      const marginal = after.total - before;
      if (
        !best ||
        marginal > best.marginalContribution ||
        (marginal === best.marginalContribution && x.fund.isin < best.fund.isin)
      )
        best = { ...x, marginalContribution: round(marginal) };
    }
    if (
      !best ||
      (best.marginalContribution < -0.01 &&
        selected.length >= Math.max(required, minByType))
    )
      break;
    selected.push(best);
  }
  if (selected.length < Math.max(required, minByType)) return null;
  const funds = weights(selected, c),
    e = evaluate(funds, c);
  if (e.violations.length) return null;
  const confidences = funds.map((x) => x.fund.fundConfidence),
    confidence =
      confidences.every((x) => x === "HIGH") &&
      e.m.overlapConfidence !== "LOW" &&
      e.m.costConfidence !== "LOW"
        ? "HIGH"
        : confidences.some((x) => x === "LOW") || e.m.costConfidence === "LOW"
          ? "LOW"
          : "MEDIUM",
    dataVersion = Object.fromEntries(
      funds.map((x) => [x.fund.isin, JSON.stringify(x.fund.dataVersion)]),
    ),
    asiaTarget = c.portfolioPreference.targetRegionWeights.ASIA,
    candidateAsia = Math.max(
      0,
      ...candidates.map((candidate) =>
        Object.entries(candidate.regions)
          .filter(([key]) => /ASIA|PACIFIC/i.test(key))
          .reduce((sum, [, value]) => sum + value, 0),
      ),
    ),
    portfolioAsia = Object.entries(e.m.regions)
      .filter(([key]) => /ASIA|PACIFIC/i.test(key))
      .reduce((sum, [, value]) => sum + value, 0),
    unmetPreferences: Array<{ code: string; reason: string }> = [];
  if (asiaTarget && candidateAsia < 0.05)
    unmetPreferences.push({
      code: "ASIA_EXPOSURE_UNAVAILABLE",
      reason: `Ingen PASS-kandidat har minst 5 % dokumentert Asia-eksponering; porteføljen oppnår ${(portfolioAsia * 100).toFixed(1)} % mot mål ${(asiaTarget * 100).toFixed(1)} %.`,
    });
  const targetRisk = c.portfolioPreference.targetRiskProxy,
    maxRisk = Math.max(0, ...candidates.map((candidate) => candidate.priipRisk ?? 0));
  if (targetRisk !== null && maxRisk < targetRisk)
    unmetPreferences.push({
      code: "TARGET_RISK_UNREACHABLE",
      reason: `Høyeste dokumenterte kandidat-risiko er ${maxRisk}, under mål ${targetRisk}.`,
    });
  return {
    type,
    funds,
    scores: e.scores,
    totalScore: e.total,
    confidence,
    metrics: e.m,
    hardViolations: e.violations,
    unmetPreferences,
    diagnostics: [],
    dataVersion,
    explanations: [
      "Deterministisk greedy-konstruksjon med marginal nytte.",
      "Porteføljerisiko er en robust proxy, ikke covariance-optimalisering.",
    ],
  };
}
