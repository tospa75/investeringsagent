import type { KidDocumentAnalysis, KidFundIdentity, KidVerification } from "./kid-types";

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function verifyKidDocument(fund: KidFundIdentity, analysis: KidDocumentAnalysis, authoritative: boolean): KidVerification {
  const notes: string[] = [];
  const isinVerified = analysis.documentIsins.includes(fund.isin);
  const fundNameVerified = normalize(analysis.text).includes(normalize(fund.name));
  const shareClassVerified = Boolean(fund.shareClass && normalize(analysis.text).includes(normalize(fund.shareClass)));
  if (!analysis.isRegulatoryKid) notes.push(`Document classified as ${analysis.documentType}, not a regulatory KID`);
  if (!isinVerified) notes.push(analysis.documentIsins.length ? `ISIN mismatch: found ${analysis.documentIsins.join(", ")}` : "ISIN missing from document content");
  if (!fundNameVerified) notes.push("Exact normalized fund name not found in document");
  if (!analysis.publicationDate) notes.push("Secure publication/update date not found");
  if (!analysis.isRegulatoryKid || !isinVerified) return { status: "INVALID", isinVerified, fundNameVerified, shareClassVerified, confidence: "LOW", notes };
  const confidence = authoritative && fundNameVerified && analysis.publicationDate ? "HIGH" : "MEDIUM";
  return { status: "VALID", isinVerified, fundNameVerified, shareClassVerified, confidence, notes };
}
