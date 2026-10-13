import type { IngestionStatus } from "@/lib/types";
import { fetchKronFundPage, KronFetchError } from "./fetch-kron-fund";
import { KronParseError, parseKronFundPage } from "./parse-kron-fund";
import { scoreKronFund, validateKronFund } from "./kron-validator";
import type { KronFetchResult, KronIngestionResult } from "./kron-types";
import { KronRepository } from "./kron-repository";

function httpError(result: KronFetchResult): string | null {
  if (result.statusCode === 404) return "Kron fund page returned HTTP 404";
  if (result.statusCode === 429) return "Kron rate limit returned HTTP 429";
  if (result.statusCode >= 500) return `Kron server returned HTTP ${result.statusCode}`;
  if (result.statusCode < 200 || result.statusCode >= 300) return `Kron returned HTTP ${result.statusCode}`;
  if (!result.contentType?.toLowerCase().includes("text/html")) return `Unexpected content type: ${result.contentType ?? "missing"}`;
  return null;
}

export async function ingestKronFund(
  isin: string,
  repository: KronRepository,
  fetcher: (isin: string) => Promise<KronFetchResult> = fetchKronFundPage,
): Promise<KronIngestionResult> {
  const startedAt = new Date().toISOString();
  let fundId: string | null = null;
  let rawSnapshot: KronIngestionResult["rawSnapshot"] = "not-saved";
  let fundName: string | null = null;
  let parsed: KronIngestionResult["parsed"] = null;
  let status: IngestionStatus = "FAILED";
  let qualityScore = 0;
  let warnings: string[] = [];
  let errors: string[] = [];
  let missingFields: string[] = [];

  try {
    fundId = await repository.findFundId(isin);
    const fetched = await fetcher(isin);
    const responseError = httpError(fetched);
    if (responseError) throw new Error(responseError);
    rawSnapshot = await repository.saveRawSnapshot(fetched, fundId);
    parsed = parseKronFundPage(fetched.content, isin, fetched.url);
    fundName = parsed.name;
    const validation = validateKronFund(parsed);
    const quality = scoreKronFund(parsed, validation);
    qualityScore = quality.score;
    warnings = quality.warnings;
    errors = validation.errors;
    missingFields = quality.missingFields;
    if (validation.verified) {
      fundId = await repository.upsertVerifiedFund(parsed, validation.availability === "AVAILABLE");
      await repository.attachRawSnapshot(fetched, fundId);
      status = warnings.length > 0 ? "PARTIAL" : "SUCCESS";
    }
  } catch (error) {
    const message = error instanceof KronFetchError || error instanceof KronParseError || error instanceof Error ? error.message : "Unknown ingestion error";
    errors.push(message);
  }

  try {
    await repository.createIngestionRun({ fundId, startedAt, status, qualityScore, warnings, errors, missingFields });
  } catch (runError) {
    errors.push(runError instanceof Error ? runError.message : "Could not log ingestion run");
    status = "FAILED";
  }
  return { isin, fundId, fundName, status, qualityScore, warnings, errors, missingFields, rawSnapshot, parsed };
}
