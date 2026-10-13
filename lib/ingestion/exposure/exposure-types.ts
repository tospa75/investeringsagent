export type ExposureQuality = "HIGH" | "MEDIUM" | "LOW" | "MISSING" | "CONFLICT";
export type ExposureScope = "COMPLETE" | "PARTIAL";
export type HoldingType = "equity" | "bond" | "fund" | "cash" | "other";
export interface WeightedLabel { label: string; weight: number }
export interface GeographyRow { region: string | null; country: string | null; weight: number }
export interface HoldingRow { holdingName: string; holdingIdentifier: string | null; holdingType: HoldingType; weight: number }
export interface ExposureData {
  isin: string; sourceType: string; sourceUrl: string; sourceDate: string | null; retrievedAt: string; contentHash: string;
  geography: GeographyRow[]; sectors: WeightedLabel[]; holdings: HoldingRow[]; assetAllocations: WeightedLabel[];
  geographyScope: ExposureScope; sectorScope: ExposureScope; qualityStatus: ExposureQuality; warnings: string[];
  metrics: { top10Weight: number | null; largestHoldingWeight: number | null; numberOfReportedHoldings: number; cashWeight: number | null; equityWeight: number | null; bondWeight: number | null };
}
export interface ExposureResult { isin: string; fundName: string | null; status: "SUCCESS" | "PARTIAL" | "FAILED"; duplicate: boolean; data: ExposureData | null; errors: string[] }
