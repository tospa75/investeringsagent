import type { ScoreConfidence, SoftPreference } from "../scoring";
import type { UserProfile } from "../filtering";
import type { PortfolioPreference } from "./portfolio-preferences";
export type ProposalType = "SIMPLE" | "BALANCED" | "OFFENSIVE";
export type FundRole =
  | "CORE"
  | "REGION"
  | "SECTOR"
  | "THEMATIC"
  | "SMALL_CAP"
  | "EMERGING_MARKETS"
  | "FIXED_INCOME"
  | "TACTICAL";
export interface PortfolioFund {
  id: string;
  isin: string;
  name: string;
  category: string | null;
  fundScore: number;
  fundConfidence: ScoreConfidence;
  riskScore: number;
  qualityScore: number;
  activePassive: "active" | "passive" | "unknown";
  annualCost: number | null;
  costConfidence: "HIGH" | "MEDIUM" | "LOW";
  priipRisk: number | null;
  volatility: number | null;
  regions: Record<string, number>;
  countries: Record<string, number>;
  sectors: Record<string, number>;
  assets: Record<string, number>;
  holdings: Record<string, { name: string; weight: number }>;
  exposureQuality: string | null;
  dataVersion: Record<string, string | null>;
}
export interface PortfolioContext {
  profile: UserProfile;
  preferences: SoftPreference[];
  preferenceVersion: number;
  maxSatelliteAllocation: number;
  maxUnderlyingWeight: number;
  portfolioPreference: PortfolioPreference;
  existingPositions?: Array<{ fundId: string; weight: number }>;
}
export interface PortfolioMetrics {
  regions: Record<string, number>;
  countries: Record<string, number>;
  sectors: Record<string, number>;
  assets: Record<string, number>;
  topHoldings: Array<{ key: string; name: string; weight: number }>;
  weightedCost: number | null;
  costConfidence: "HIGH" | "MEDIUM" | "LOW";
  weightedRisk: number | null;
  averageOverlap: number;
  overlapConfidence: ScoreConfidence;
  maxUnderlyingWeight: number;
  satelliteAllocation: number;
  flags: string[];
}
export interface ProposalFund {
  fund: PortfolioFund;
  weight: number;
  role: FundRole;
  marginalContribution: number;
  explanation: string;
}
export interface PortfolioProposal {
  type: ProposalType;
  funds: ProposalFund[];
  scores: {
    risk: number;
    diversification: number;
    preference: number;
    cost: number;
    robustness: number;
    simplicity: number;
  };
  totalScore: number;
  confidence: ScoreConfidence;
  metrics: PortfolioMetrics;
  hardViolations: string[];
  unmetPreferences: Array<{ code: string; reason: string }>;
  diagnostics: string[];
  dataVersion: Record<string, string | null>;
  explanations: string[];
}
