import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fetchKronFundPage, hashRawContent } from "@/lib/ingestion/kron/fetch-kron-fund";

describe("Kron fetch and hashing", () => {
  it("creates a deterministic SHA-256 raw snapshot hash", () => {
    expect(hashRawContent("<html>fund</html>")).toBe(createHash("sha256").update("<html>fund</html>").digest("hex"));
  });
  it("returns structured response metadata", async () => {
    const fetchImpl = async () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    const result = await fetchKronFundPage("NO0011101545", { fetchImpl: fetchImpl as typeof fetch });
    expect(result).toMatchObject({ isin: "NO0011101545", statusCode: 200, contentType: "text/html; charset=utf-8" });
    expect(result.contentHash).toHaveLength(64);
  });
});
