import type { IngestionStatus } from "@/lib/types";

export const KRON_TEST_ISINS = ["NO0011101545", "NO0013004622", "NO0010963432"] as const;
export type KronAvailability = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

export interface KronFetchResult {
  isin: string;
  url: string;
  statusCode: number;
  retrievedAt: string;
  content: string;
  contentType: string | null;
  contentHash: string;
}

export interface ParsedKronFund {
  requestedIsin: string;
  pageIsin: string | null;
  name: string | null;
  manager: string | null;
  currency: string | null;
  category: string | null;
  kronUrl: string;
  availability: KronAvailability;
  annualPricePercent: number | null;
  morningstarRating: number | null;
}

export interface KronValidationResult {
  verified: boolean;
  availability: KronAvailability;
  errors: string[];
}

export interface KronQualityResult {
  score: number;
  missingFields: string[];
  warnings: string[];
}

export interface KronIngestionResult {
  isin: string;
  fundId: string | null;
  fundName: string | null;
  status: IngestionStatus;
  qualityScore: number;
  warnings: string[];
  errors: string[];
  missingFields: string[];
  rawSnapshot: "saved" | "duplicate" | "not-saved";
  parsed: ParsedKronFund | null;
}
