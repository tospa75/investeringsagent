import type { KronQualityResult, KronValidationResult, ParsedKronFund } from "./kron-types";

export function validateKronFund(parsed: ParsedKronFund): KronValidationResult {
  if (!parsed.pageIsin) return { verified: false, availability: "UNKNOWN", errors: ["ISIN not found on Kron page"] };
  if (parsed.pageIsin !== parsed.requestedIsin) return { verified: false, availability: "UNKNOWN", errors: [`ISIN mismatch: requested ${parsed.requestedIsin}, page ${parsed.pageIsin}`] };
  return { verified: true, availability: parsed.availability === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE", errors: [] };
}

export function scoreKronFund(parsed: ParsedKronFund, validation: KronValidationResult): KronQualityResult {
  const fieldWeights = { name: 25, availability: 15, manager: 7, currency: 7, category: 6 } as const;
  const missingFields: string[] = [];
  const warnings: string[] = [];
  if (!validation.verified) return { score: 0, missingFields, warnings };
  let score = 40;
  for (const [field, weight] of Object.entries(fieldWeights) as [keyof typeof fieldWeights, number][]) {
    const present = field === "availability" ? validation.availability !== "UNKNOWN" : parsed[field] !== null;
    if (present) score += weight;
    else { missingFields.push(field); warnings.push(`${field} not found`); }
  }
  return { score, missingFields, warnings };
}
