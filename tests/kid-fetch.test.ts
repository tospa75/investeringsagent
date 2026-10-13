import { describe, expect, it, vi } from "vitest";
import { fetchKidDocument, hashDocument, KidFetchError } from "@/lib/ingestion/kid/fetch-kid-document";

describe("KID HTTP fetch", () => {
  it.each([[404,"HTTP_404"],[429,"HTTP_429"],[503,"HTTP_5XX"]] as const)("handles HTTP %s", async (status, code) => {
    const fetchImpl = async () => new Response("error", { status });
    await expect(fetchKidDocument("https://example.test/kid", { fetchImpl:fetchImpl as typeof fetch })).rejects.toMatchObject({ code });
  });
  it("changes hash when document content changes", () => {
    expect(hashDocument(new TextEncoder().encode("version one"))).not.toBe(hashDocument(new TextEncoder().encode("version two")));
  });
  it("retries HTTP 406 with a generic accept header", async () => {
    const fetchImpl=vi.fn().mockResolvedValueOnce(new Response("not acceptable",{status:406})).mockResolvedValueOnce(new Response("KID",{status:200,headers:{"content-type":"text/plain"}}));
    await expect(fetchKidDocument("https://example.test/kid",{fetchImpl})).resolves.toMatchObject({statusCode:200,contentType:"text/plain"});
    expect(fetchImpl.mock.calls[1][1]?.headers).toMatchObject({Accept:"*/*"});
  });
});
