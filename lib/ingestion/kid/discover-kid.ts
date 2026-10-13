import * as cheerio from "cheerio";
import type { KidCandidate, KidFundIdentity, KidProvider } from "./kid-types";
import { DnbKidProvider } from "./providers/dnb-provider";
import { KraftKidProvider } from "./providers/kraft-provider";
import { SamRepositoryProvider } from "./providers/sam-provider";
import { FidelityKidProvider } from "./providers/fidelity-provider";
import { JpmKidProvider } from "./providers/jpm-provider";
import { KlpKidProvider } from "./providers/klp-provider";
import { AlfredBergKidProvider } from "./providers/alfred-berg-provider";

const USER_AGENT = "InvesteringsAgent/0.3 (personal KID discovery; respectful single-request access)";
export const DEFAULT_KID_PROVIDERS: KidProvider[] = [new FidelityKidProvider(),new JpmKidProvider(),new KlpKidProvider(),new AlfredBergKidProvider(),new DnbKidProvider(),new KraftKidProvider(),new SamRepositoryProvider()];

export function discoverKidLinkInKronHtml(html: string, pageUrl: string): KidCandidate | null {
  const $ = cheerio.load(html);
  const link = $("a").filter((_, element) => /(?:priip|nøkkelinformasjon|\bkid\b)/i.test($(element).text())).first();
  const href = link.attr("href");
  return href ? { url: new URL(href, pageUrl).toString(), documentType: "PRIIP_KID", discoveryMethod: "KRON_PAGE_LINK", providerName: "Kron", authoritative: true } : null;
}

export async function discoverKid(
  fund: KidFundIdentity,
  options: { providers?: KidProvider[]; fetchImpl?: typeof fetch } = {},
): Promise<KidCandidate | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (fund.kronUrl) {
    try {
      const response = await fetchImpl(fund.kronUrl, { headers: { Accept: "text/html", "User-Agent": USER_AGENT }, redirect: "follow" });
      if (response.ok && response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
        const direct = discoverKidLinkInKronHtml(await response.text(), fund.kronUrl);
        if (direct) return direct;
      }
    } catch { /* Provider fallback is intentional. */ }
  }
  for (const provider of options.providers ?? DEFAULT_KID_PROVIDERS) {
    if (!provider.canHandle(fund)) continue;
    try {
      const candidate = await provider.discover(fund, fetchImpl);
      if (candidate) return candidate;
    } catch { /* Continue to the next provider. */ }
  }
  return null;
}
