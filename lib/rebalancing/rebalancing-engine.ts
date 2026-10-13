import { createHash } from "node:crypto";
import type { FundDrift, MonitoringEventInput, PortfolioBalanceStatus, PortfolioMonitoringInput, RebalanceAction, RebalanceConfidence, RebalancePlan } from "./rebalancing-types";

const round = (n: number) => Math.round(n * 1e10) / 1e10;
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
};
const keyOf = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");

function confidenceFor(freshness: string[], quality: string[]): RebalanceConfidence {
  if (freshness.includes("MISSING") || freshness.includes("FX_REQUIRED") || quality.includes("MISSING") || quality.includes("LOW")) return "LOW";
  if (freshness.includes("STALE") || quality.includes("MEDIUM")) return "MEDIUM";
  return "HIGH";
}

export function buildRebalancePlan(input: PortfolioMonitoringInput): RebalancePlan {
  const targetSum = input.targets.reduce((sum, target) => sum + target.weight, 0);
  if (Math.abs(targetSum - 1) > 0.000001) throw new Error(`Target weights must sum to 1; received ${targetSum}`);
  if (input.newCashAmount < 0) throw new Error("New cash cannot be negative");
  const targetIds = new Set(input.targets.map((target) => target.fundId));
  if (targetIds.size !== input.targets.length || input.targets.some((target) => target.weight < 0 || target.weight > 1)) throw new Error("Targets must be unique and between 0 and 1");
  const positions = new Map(input.positions.map((position) => [position.fundId, position]));
  const allIds = [...new Set([...input.targets.map((x) => x.fundId), ...input.positions.map((x) => x.fundId)])].sort();
  const targetMap = new Map(input.targets.map((x) => [x.fundId, x]));
  const funds: FundDrift[] = allIds.map((fundId) => {
    const position = positions.get(fundId), target = targetMap.get(fundId)?.weight ?? 0, actual = position?.actualWeight ?? (position ? null : 0);
    if (actual === null) return { fundId, name: position?.name ?? fundId, targetWeight: target, actualWeight: null, deviationPercentagePoints: null, relativeDeviation: null, status: "UNKNOWN" };
    const deviation = actual - target, relative = target === 0 ? null : deviation / target;
    const band = Math.max(input.settings.absoluteThreshold, target * input.settings.relativeThreshold);
    let status: FundDrift["status"] = "WITHIN_RANGE";
    if (!position && target > 0) status = "MISSING_POSITION";
    else if (target === 0 && actual > 0) status = "TARGET_ZERO";
    else if (deviation > band) status = "OVERWEIGHT";
    else if (deviation < -band) status = "UNDERWEIGHT";
    return { fundId, name: position?.name ?? fundId, targetWeight: target, actualWeight: round(actual), deviationPercentagePoints: round(deviation * 100), relativeDeviation: relative === null ? null : round(relative), status };
  });
  const knownValues = input.positions.every((x) => x.marketValue !== null), currentValue = knownValues ? input.positions.reduce((sum, x) => sum + x.marketValue!, 0) : null;
  const driftScore = funds.some((x) => x.actualWeight === null) ? null : round(funds.reduce((sum, x) => sum + Math.abs((x.actualWeight ?? 0) - x.targetWeight), 0) / 2);
  const freshness = input.positions.map((x) => x.navFreshness), quality = input.positions.map((x) => x.dataQuality ?? "HIGH");
  const confidence = confidenceFor(freshness, quality), events: MonitoringEventInput[] = [...(input.fundChanges ?? [])], warnings: string[] = [];
  const addEvent = (eventType: string, severity: "INFO" | "WARNING" | "CRITICAL", message: string, fundId: string | null = null) => events.push({ eventType, severity, fundId, message, dataVersion: input.currentDataVersion });
  for (const position of input.positions) {
    if (position.available === false || position.documentValid === false) addEvent("FUND_REVIEW_REQUIRED", "CRITICAL", `${position.name} is unavailable or has invalid documentation; manual review required`, position.fundId);
    if (position.actualWeight !== null && input.settings.maxFundWeight !== undefined && position.actualWeight > input.settings.maxFundWeight) addEvent("FUND_CONCENTRATION", "WARNING", `${position.name} exceeds maximum fund weight`, position.fundId);
  }
  for (const [region, weight] of Object.entries(input.exposures?.regions ?? {})) {
    const max = input.settings.maxRegionWeights?.[region], min = input.settings.minRegionWeights?.[region];
    if (max !== undefined && weight > max) addEvent("REGION_MAX_BREACH", "CRITICAL", `${region} exposure ${(weight * 100).toFixed(2)}% exceeds ${(max * 100).toFixed(2)}%`);
    if (min !== undefined && weight < min) addEvent("REGION_MIN_BREACH", "CRITICAL", `${region} exposure ${(weight * 100).toFixed(2)}% is below ${(min * 100).toFixed(2)}%`);
  }
  for (const [sector, weight] of Object.entries(input.exposures?.sectors ?? {})) { const max = input.settings.maxSectorWeights?.[sector]; if (max !== undefined && weight > max) addEvent("SECTOR_MAX_BREACH", "CRITICAL", `${sector} exposure exceeds maximum`); }
  for (const holding of input.exposures?.holdings ?? []) if (input.settings.maxUnderlyingHoldingWeight !== undefined && holding.weight > input.settings.maxUnderlyingHoldingWeight) addEvent("UNDERLYING_CONCENTRATION", "WARNING", `${holding.name} exceeds underlying holding maximum`);
  const satelliteWeight = input.targets.filter((x) => x.role === "SATELLITE").reduce((sum, x) => sum + (positions.get(x.fundId)?.actualWeight ?? 0), 0);
  if (input.settings.maxSatelliteWeight !== undefined && satelliteWeight > input.settings.maxSatelliteWeight) addEvent("SATELLITE_MAX_BREACH", "WARNING", "Satellite allocation exceeds maximum");
  const weightedCost = input.positions.reduce((sum, x) => sum + (x.actualWeight ?? 0) * (x.annualCost ?? 0), 0);
  if (input.settings.maxAnnualCost !== undefined && weightedCost > input.settings.maxAnnualCost) addEvent("COST_MAX_BREACH", "WARNING", `Weighted annual cost ${(weightedCost * 100).toFixed(2)}% exceeds maximum`);
  const weightedVolatility = input.positions.reduce((sum, x) => sum + (x.actualWeight ?? 0) * (x.volatility ?? 0), 0);
  if (input.targetRisk != null && input.portfolioRisk != null && Math.abs(input.portfolioRisk - input.targetRisk) >= 1) addEvent("RISK_DRIFT", "WARNING", "Portfolio risk proxy differs materially from target");
  if (weightedVolatility > 0.25) addEvent("VOLATILITY_HIGH", "WARNING", "Weighted volatility proxy is high");
  const hardBreach = events.some((event) => event.severity === "CRITICAL"), actions: RebalanceAction[] = [];
  let cashLeft = input.newCashAmount;
  if (currentValue === null) warnings.push("Exact trade amounts unavailable because one or more market values are missing");
  if (confidence !== "HIGH") warnings.push(`Trade amounts have ${confidence.toLowerCase()} confidence because NAV or exposure data is incomplete or stale`);
  if (currentValue !== null && !hardBreach) {
    const finalValue = currentValue + input.newCashAmount;
    const deficits = input.targets.map((target) => ({ target, amount: Math.max(0, target.weight * finalValue - (positions.get(target.fundId)?.marketValue ?? 0)) })).sort((a, b) => b.amount - a.amount || a.target.fundId.localeCompare(b.target.fundId));
    const cashAllocatedByFund = new Map<string, number>();
    let priority = 1;
    for (const deficit of deficits) {
      const amount = Math.min(cashLeft, deficit.amount), position = positions.get(deficit.target.fundId);
      if (amount >= input.settings.minimumTradeAmount && amount / finalValue >= input.settings.minimumWeightImpact) {
        actions.push({ fundId: deficit.target.fundId, actionType: "BUY", amount: round(amount), estimatedUnits: position?.nav && position.navFreshness !== "MISSING" && position.navFreshness !== "FX_REQUIRED" ? round(amount / position.nav) : null, reason: `Target ${(deficit.target.weight * 100).toFixed(2)}%; new cash reduces the largest underweight without a sale`, priority: priority++, confidence });
        cashAllocatedByFund.set(deficit.target.fundId, amount);
        cashLeft -= amount;
      }
    }
    const remainingDeficit = deficits.reduce((sum, x) => sum + Math.max(0, x.amount - (cashAllocatedByFund.get(x.target.fundId) ?? 0)), 0);
    if (remainingDeficit > input.settings.minimumTradeAmount && input.settings.avoidRealization) warnings.push("Target cannot be reached without sales; sales suppressed by avoid_realization");
    if (!input.settings.avoidRealization) {
      const surpluses = input.positions.filter((position) => ["OVERWEIGHT", "TARGET_ZERO"].includes(funds.find((fund) => fund.fundId === position.fundId)?.status ?? "")).map((position) => ({ position, target: targetMap.get(position.fundId)?.weight ?? 0, amount: Math.max(0, position.marketValue! - (targetMap.get(position.fundId)?.weight ?? 0) * finalValue) })).sort((a, b) => b.amount - a.amount || a.position.fundId.localeCompare(b.position.fundId));
      let sellAvailable = surpluses.reduce((sum, x) => sum + x.amount, 0);
      for (const surplus of surpluses) if (surplus.amount >= input.settings.minimumTradeAmount && surplus.amount / finalValue >= input.settings.minimumWeightImpact) {
        actions.push({ fundId: surplus.position.fundId, actionType: "SELL", amount: round(surplus.amount), estimatedUnits: surplus.position.nav ? round(surplus.amount / surplus.position.nav) : null, reason: `Actual weight exceeds target/no-trade range; sale funds underweights while minimizing turnover`, priority: priority++, confidence });
      }
      for (const deficit of deficits.filter((x) => ["UNDERWEIGHT", "MISSING_POSITION"].includes(funds.find((fund) => fund.fundId === x.target.fundId)?.status ?? ""))) {
        const amount = Math.min(sellAvailable, Math.max(0, deficit.amount - (cashAllocatedByFund.get(deficit.target.fundId) ?? 0)));
        if (amount >= input.settings.minimumTradeAmount && amount / finalValue >= input.settings.minimumWeightImpact) { actions.push({ fundId: deficit.target.fundId, actionType: "BUY", amount: round(amount), estimatedUnits: positions.get(deficit.target.fundId)?.nav ? round(amount / positions.get(deficit.target.fundId)!.nav!) : null, reason: `Fund remains underweight after new cash; funded by proposed sales`, priority: priority++, confidence }); sellAvailable -= amount; }
      }
    }
  } else if (hardBreach) warnings.push("Trade suggestions withheld until critical hard-constraint or fund-validity breaches are reviewed");
  const outOfRange = funds.some((x) => !["WITHIN_RANGE"].includes(x.status));
  const status: PortfolioBalanceStatus = currentValue === null ? "UNKNOWN" : hardBreach || (driftScore ?? 0) >= 0.15 ? "REBALANCE_REQUIRED" : outOfRange || actions.length > 0 || (driftScore ?? 0) >= 0.05 ? "REBALANCE_RECOMMENDED" : "IN_BALANCE";
  const totalTurnover = round(actions.filter((x) => x.actionType !== "HOLD").reduce((sum, x) => sum + (x.amount ?? 0), 0));
  const estimatedCost = round(totalTurnover * (input.settings.transactionCostRate ?? 0));
  const planWithoutKey = { status, confidence, driftScore, funds, actions, monitoringEvents: events.sort((a, b) => `${a.eventType}:${a.fundId ?? ""}`.localeCompare(`${b.eventType}:${b.fundId ?? ""}`)), newCashAllocated: round(input.newCashAmount - cashLeft), totalTurnover, estimatedCost, targetModelVersion: input.targetModelVersion, currentDataVersion: input.currentDataVersion, warnings };
  return { ...planWithoutKey, deterministicKey: keyOf({ input, plan: planWithoutKey }) };
}
