import * as cheerio from "cheerio";
import type { KronAvailability, ParsedKronFund } from "./kron-types";

export class KronParseError extends Error {
  constructor(message: string) { super(message); this.name = "KronParseError"; }
}

function textTokens($: cheerio.CheerioAPI): string[] {
  return $("body").find("*").contents().filter(function () { return this.type === "text"; }).map(function () {
    return $(this).text().replace(/\s+/g, " ").trim();
  }).get().filter(Boolean);
}

function labelledValue(tokens: string[], label: string): string | null {
  const index = tokens.findIndex((token) => token.toLocaleLowerCase("nb-NO") === label.toLocaleLowerCase("nb-NO"));
  return index >= 0 ? tokens[index + 1] ?? null : null;
}

function percent(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^([0-9]+(?:[,.][0-9]+)?)\s*%$/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function availabilityFromText(text: string): KronAvailability {
  return /(?:ikke lenger tilgjengelig|ikke tilgjengelig|kan ikke kjøpes)/i.test(text) ? "UNAVAILABLE" : "UNKNOWN";
}

export function parseKronFundPage(html: string, requestedIsin: string, kronUrl: string): ParsedKronFund {
  if (!/<html[\s>]/i.test(html)) throw new KronParseError("Response is not an HTML document");
  const $ = cheerio.load(html);
  const tokens = textTokens($);
  const name = $("h1").first().text().replace(/\s+/g, " ").trim() || null;
  if (!name) throw new KronParseError("Fund name heading not found");
  const pageIsinValue = labelledValue(tokens, "ISIN:");
  const ratingValue = labelledValue(tokens, "Morningstar-rating:");
  const rating = ratingValue?.match(/^[1-5]$/) ? Number(ratingValue) : null;

  return {
    requestedIsin,
    pageIsin: pageIsinValue?.match(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)?.[0] ?? null,
    name,
    manager: labelledValue(tokens, "Forvalter:"),
    currency: labelledValue(tokens, "Valuta:")?.match(/^[A-Z]{3}$/)?.[0] ?? null,
    category: labelledValue(tokens, "Kategori:"),
    kronUrl,
    availability: availabilityFromText($("body").text()),
    annualPricePercent: percent(labelledValue(tokens, "Årlig pris")),
    morningstarRating: rating,
  };
}
