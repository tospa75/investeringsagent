import type { KidCandidate, KidFundIdentity, KidProvider } from "../kid-types";
import { absoluteUrl, fetchDiscoveryPage } from "./provider-utils";

const DNB_PAGES: Record<string, string> = {
  NO0013004622: "https://www.dnb.no/sparing/fond/fond-liste/private-banking/d/dnb-teknologi-b-NO0013004622",
};

export class DnbKidProvider implements KidProvider {
  name = "DNB / Morningstar";
  canHandle(fund: KidFundIdentity) { return fund.isin in DNB_PAGES; }
  async discover(fund: KidFundIdentity, fetchImpl?: typeof fetch): Promise<KidCandidate | null> {
    const pageUrl = DNB_PAGES[fund.isin];
    if (!pageUrl) return null;
    const $ = await fetchDiscoveryPage(pageUrl, fetchImpl);
    const href = $("a[href*='doc.morningstar.com'][href*='documenttype=299']").first().attr("href");
    return href ? { url: absoluteUrl(href, pageUrl), documentType: "PRIIP_KID", discoveryMethod: "MANAGER_PAGE", providerName: this.name, authoritative: true } : null;
  }
}
