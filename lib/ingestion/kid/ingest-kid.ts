import { analyzeKidDocument } from "./analyze-kid-document";
import { discoverKid } from "./discover-kid";
import { fetchKidDocument, KidFetchError } from "./fetch-kid-document";
import { KidRepository } from "./kid-repository";
import type { KidIngestionResult } from "./kid-types";
import { verifyKidDocument } from "./verify-kid-document";

const qualityScore = { HIGH: 100, MEDIUM: 80, LOW: 0, UNKNOWN: 0 } as const;

export async function ingestKid(
  isin: string,
  repository: KidRepository,
  dependencies: { discover?: typeof discoverKid; fetch?: typeof fetchKidDocument; analyze?: typeof analyzeKidDocument } = {},
): Promise<KidIngestionResult> {
  const startedAt = new Date().toISOString();
  const fund = await repository.getFund(isin);
  if (!fund) throw new Error(`Verified fund not found for ISIN ${isin}`);
  let result: KidIngestionResult = {
    fund, providerName: null, discoveryMethod: null, documentType: null, publicationDate: null,
    status: "UNVERIFIED", confidence: "UNKNOWN", isinVerified: false, snapshot: "not-saved", errors: [], notes: [],
  };
  try {
    const candidate = await (dependencies.discover ?? discoverKid)(fund);
    if (!candidate) {
      result.notes.push("No KID candidate discovered");
      await repository.createRun({ fundId: fund.id, startedAt, status: "PARTIAL", quality: 0, warnings: result.notes, errors: [] });
      return result;
    }
    result = { ...result, providerName: candidate.providerName, discoveryMethod: candidate.discoveryMethod, documentType: candidate.documentType };
    let fetched;
    try { fetched = await (dependencies.fetch ?? fetchKidDocument)(candidate.url); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Document fetch failed";
      result.status = "FETCH_FAILED"; result.errors.push(message);
      await repository.saveFetchFailure(fund, candidate, "FETCH_FAILED", message);
      await repository.createRun({ fundId: fund.id, startedAt, status: "FAILED", quality: 0, warnings: [], errors: result.errors });
      return result;
    }
    const analysis = await (dependencies.analyze ?? analyzeKidDocument)(fetched);
    result.snapshot = await repository.saveSnapshot(fund.id, fetched, analysis.text);
    const verification = verifyKidDocument(fund, analysis, candidate.authoritative);
    await repository.saveDocument({ fund, candidate, fetched, documentType: analysis.documentType, publicationDate: analysis.publicationDate, verification });
    result = {
      ...result, documentType: analysis.documentType, publicationDate: analysis.publicationDate,
      status: verification.status, confidence: verification.confidence, isinVerified: verification.isinVerified, notes: verification.notes,
    };
    await repository.createRun({
      fundId: fund.id, startedAt, status: verification.status === "VALID" ? (verification.notes.length ? "PARTIAL" : "SUCCESS") : "FAILED",
      quality: qualityScore[verification.confidence], warnings: verification.notes, errors: verification.status === "VALID" ? [] : verification.notes,
    });
  } catch (error) {
    const message = error instanceof KidFetchError || error instanceof Error ? error.message : "Unexpected KID ingestion error";
    result.status = "INVALID"; result.errors.push(message);
    try { await repository.createRun({ fundId: fund.id, startedAt, status: "FAILED", quality: 0, warnings: [], errors: result.errors }); }
    catch (runError) { result.errors.push(runError instanceof Error ? runError.message : "Could not log failed KID run"); }
  }
  return result;
}
