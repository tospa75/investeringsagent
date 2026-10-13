import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeKidDocument, KidAnalysisError } from "@/lib/ingestion/kid/analyze-kid-document";
import type { KidFetchResult, KidFundIdentity } from "@/lib/ingestion/kid/kid-types";
import { verifyKidDocument } from "@/lib/ingestion/kid/verify-kid-document";

const bytes = (fixture: string) => new TextEncoder().encode(readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8"));
const fetched = (fixture: string, type = "text/plain"): KidFetchResult => ({ sourceUrl:"https://example.test/kid", finalUrl:"https://example.test/kid", statusCode:200, contentType:type, retrievedAt:"2026-10-11T12:00:00Z", lastModified:null, contentHash:"hash", bytes:bytes(fixture) });
const fund: KidFundIdentity = { id:"1", isin:"NO0011101545", name:"Kron Indeks Global", shareClass:null, kronUrl:null };

describe("KID document analysis and identity", () => {
  it("classifies PRIIP KID, extracts date and verifies matching ISIN", async () => {
    const analysis = await analyzeKidDocument(fetched("kid-valid.txt"));
    expect(analysis).toMatchObject({ documentType:"PRIIP_KID", publicationDate:"2026-02-01", documentIsins:["NO0011101545"], isRegulatoryKid:true });
    expect(verifyKidDocument(fund, analysis, true)).toMatchObject({ status:"VALID", isinVerified:true, fundNameVerified:true, confidence:"HIGH" });
  });
  it("rejects an ISIN mismatch", async () => {
    const verification = verifyKidDocument(fund, await analyzeKidDocument(fetched("kid-mismatch.txt")), true);
    expect(verification).toMatchObject({ status:"INVALID", isinVerified:false, confidence:"LOW" });
    expect(verification.notes[0]).toContain("ISIN mismatch");
  });
  it("rejects a document with no ISIN and keeps an uncertain date null", async () => {
    const analysis = await analyzeKidDocument(fetched("kid-no-isin.txt"));
    expect(analysis.publicationDate).toBeNull();
    const verification = verifyKidDocument(fund, analysis, true);
    expect(verification.status).toBe("INVALID");
    expect(verification.notes).toContain("ISIN missing from document content");
  });
  it("rejects an unsupported content type", async () => {
    await expect(analyzeKidDocument(fetched("kid-valid.txt", "application/zip"))).rejects.toThrow("Unsupported document content type");
  });
  it("reports deterministic PDF extraction failure", async () => {
    const invalidPdf = { ...fetched("kid-valid.txt", "application/pdf"), bytes:new Uint8Array([0x25,0x50,0x44,0x46,0x2d]) };
    await expect(analyzeKidDocument(invalidPdf)).rejects.toBeInstanceOf(KidAnalysisError);
  });
});
