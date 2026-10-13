import * as cheerio from "cheerio";

const USER_AGENT = "InvesteringsAgent/0.3 (personal KID discovery; respectful single-request access)";

export async function fetchDiscoveryPage(url: string, fetchImpl: typeof fetch = fetch): Promise<cheerio.CheerioAPI> {
  const response = await fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": USER_AGENT }, redirect: "follow" });
  if (!response.ok) return cheerio.load("");
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  return type.includes("text/html") ? cheerio.load(await response.text()) : cheerio.load("");
}

export function absoluteUrl(href: string, base: string): string {
  return new URL(href, base).toString();
}
