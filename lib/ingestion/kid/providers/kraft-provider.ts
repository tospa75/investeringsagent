import type { KidCandidate, KidFundIdentity, KidProvider } from "../kid-types";
import { absoluteUrl, fetchDiscoveryPage } from "./provider-utils";

const KRAFT_PAGES: Record<string, string> = { NO0010963432: "https://kraftfinans.no/vare-fond/kraft-strategisk/" };

export class KraftKidProvider implements KidProvider {
  name = "Kraft Finans";
  canHandle(fund: KidFundIdentity) { return fund.isin in KRAFT_PAGES; }
  async discover(fund: KidFundIdentity, fetchImpl?: typeof fetch): Promise<KidCandidate | null> {
    const pageUrl = KRAFT_PAGES[fund.isin];
    if (!pageUrl) return null;
    const $ = await fetchDiscoveryPage(pageUrl, fetchImpl);
    const link = $("a").filter((_, element) => /nøkkelinformasjon/i.test($(element).text()) && /strategisk\s+a/i.test($(element).text())).first();
    const href = link.attr("href");
    return href ? { url: absoluteUrl(href, pageUrl), documentType: "PRIIP_KID", discoveryMethod: "MANAGER_PAGE", providerName: this.name, authoritative: true } : null;
  }
}
