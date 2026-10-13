import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ingestKronFund } from "@/lib/ingestion/kron/ingest-kron-fund";
import type { KronRepository } from "@/lib/ingestion/kron/kron-repository";

describe("ingestKronFund", () => {
  it("marks mismatch FAILED, saves raw data, logs the run, and never updates the fund", async () => {
    const content = readFileSync(new URL("./fixtures/kron-mismatch.html", import.meta.url), "utf8");
    const repository = {
      findFundId: vi.fn().mockResolvedValue("existing-id"),
      saveRawSnapshot: vi.fn().mockResolvedValue("saved"),
      upsertVerifiedFund: vi.fn(),
      attachRawSnapshot: vi.fn(),
      createIngestionRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as KronRepository;
    const result = await ingestKronFund("NO0011101545", repository, async (isin) => ({
      isin, url: `https://www.kron.no/fond/${isin}`, statusCode: 200, retrievedAt: "2026-10-11T12:00:00Z",
      content, contentType: "text/html", contentHash: "hash",
    }));
    expect(result.status).toBe("FAILED");
    expect(result.qualityScore).toBe(0);
    expect(result.errors[0]).toContain("ISIN mismatch");
    expect(repository.saveRawSnapshot).toHaveBeenCalledOnce();
    expect(repository.upsertVerifiedFund).not.toHaveBeenCalled();
    expect(repository.createIngestionRun).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
  });
});
