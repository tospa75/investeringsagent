import type { NavFreshness } from "../tracking";

export type RebalanceFundStatus = "WITHIN_RANGE" | "OVERWEIGHT" | "UNDERWEIGHT" | "TARGET_ZERO" | "MISSING_POSITION" | "UNKNOWN";
export type PortfolioBalanceStatus = "IN_BALANCE" | "REBALANCE_RECOMMENDED" | "REBALANCE_REQUIRED" | "UNKNOWN";
export type RebalanceConfidence = "HIGH" | "MEDIUM" | "LOW";
export type MonitoringSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface RebalancePosition {
  fundId: string;
  name: string;
  marketValue: number | null;
  actualWeight: number | null;
  nav: number | null;
  navFreshness: NavFreshness;
  annualCost?: number | null;
  volatility?: number | null;
  dataQuality?: "HIGH" | "MEDIUM" | "LOW" | "MISSING";
  available?: boolean;
  documentValid?: boolean;
  managementStyle?: "active" | "passive" | "unknown";
}

export interface RebalanceTarget { fundId: string; weight: number; role?: "CORE" | "SATELLITE" }
export interface MonitoringEventInput { eventType: string; severity: MonitoringSeverity; fundId?: string | null; message: string; dataVersion: Record<string, unknown> }
export interface RebalanceSettings {
  absoluteThreshold: number;
  relativeThreshold: number;
  minimumTradeAmount: number;
  minimumWeightImpact: number;
  avoidRealization: boolean;
  maxFundWeight?: number;
  maxRegionWeights?: Record<string, number>;
  minRegionWeights?: Record<string, number>;
  maxSectorWeights?: Record<string, number>;
  maxUnderlyingHoldingWeight?: number;
  maxSatelliteWeight?: number;
  maxAnnualCost?: number;
  transactionCostRate?: number;
}
export interface PortfolioMonitoringInput {
  positions: RebalancePosition[];
  targets: RebalanceTarget[];
  newCashAmount: number;
  settings: RebalanceSettings;
  exposures?: { regions?: Record<string, number>; sectors?: Record<string, number>; holdings?: Array<{ key: string; name: string; weight: number }>; managementStyle?: Record<string, number> };
  targetRisk?: number | null;
  portfolioRisk?: number | null;
  targetModelVersion: string;
  currentDataVersion: Record<string, unknown>;
  fundChanges?: MonitoringEventInput[];
}
export interface FundDrift { fundId: string; name: string; targetWeight: number; actualWeight: number | null; deviationPercentagePoints: number | null; relativeDeviation: number | null; status: RebalanceFundStatus }
export interface RebalanceAction { fundId: string; actionType: "BUY" | "SELL" | "HOLD"; amount: number | null; estimatedUnits: number | null; reason: string; priority: number; confidence: RebalanceConfidence }
export interface RebalancePlan { status: PortfolioBalanceStatus; confidence: RebalanceConfidence; driftScore: number | null; funds: FundDrift[]; actions: RebalanceAction[]; monitoringEvents: MonitoringEventInput[]; newCashAllocated: number; totalTurnover: number; estimatedCost: number; targetModelVersion: string; currentDataVersion: Record<string, unknown>; warnings: string[]; deterministicKey: string }
