import { describe, expect, it, vi } from "vitest";
import { discoverKid, discoverKidLinkInKronHtml } from "@/lib/ingestion/kid/discover-kid";
import type { KidFundIdentity, KidProvider } from "@/lib/ingestion/kid/kid-types";

const fund: KidFundIdentity = { id: "fund-1", isin: "NO0011101545", name: "Kron Indeks Global", shareClass: null, kronUrl: null };

describe("KID discovery", () => {
  it("discovers an explicit KID link on the Kron page", () => {
    const candidate = discoverKidLinkInKronHtml('<a href="/documents/kid.pdf">Nøkkelinformasjon</a>', "https://www.kron.no/fond/NO0011101545");
    expect(candidate).toMatchObject({ url: "https://www.kron.no/documents/kid.pdf", discoveryMethod: "KRON_PAGE_LINK", documentType: "PRIIP_KID" });
  });
  it("uses providers in priority order and returns the first known document", async () => {
    const first: KidProvider = { name: "first", canHandle: () => true, discover: vi.fn().mockResolvedValue(null) };
    const second: KidProvider = { name: "second", canHandle: () => true, discover: vi.fn().mockResolvedValue({ url: "https://example.test/kid.pdf", documentType: "PRIIP_KID", discoveryMethod: "MANAGER_PAGE", providerName: "second", authoritative: true }) };
    const candidate = await discoverKid(fund, { providers: [first, second] });
    expect(candidate?.providerName).toBe("second");
    expect(first.discover).toHaveBeenCalledOnce();
    expect(second.discover).toHaveBeenCalledOnce();
  });
});
