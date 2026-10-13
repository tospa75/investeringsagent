import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KronParseError, parseKronFundPage } from "@/lib/ingestion/kron/parse-kron-fund";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const url = "https://www.kron.no/fond/NO0011101545";

describe("parseKronFundPage", () => {
  it("parses explicit high-confidence fields", () => {
    expect(parseKronFundPage(fixture("kron-complete.html"), "NO0011101545", url)).toMatchObject({
      name: "Kron Indeks Global", pageIsin: "NO0011101545", manager: "Storebrand Asset Management",
      currency: "NOK", category: "Globale, Store selskaper, Blanding", annualPricePercent: 0.15, morningstarRating: 4,
    });
  });
  it("returns null for missing fields", () => {
    const parsed = parseKronFundPage(fixture("kron-missing-fields.html"), "NO0010963432", url);
    expect(parsed).toMatchObject({ manager: null, currency: null, category: null, annualPricePercent: null, morningstarRating: null });
  });
  it("throws a controlled parsing error for non-HTML", () => {
    expect(() => parseKronFundPage("not html", "NO0011101545", url)).toThrow(KronParseError);
  });
  it("throws a controlled parsing error when the fund heading is absent", () => {
    expect(() => parseKronFundPage("<html><body><p>ISIN:</p><p>NO0011101545</p></body></html>", "NO0011101545", url)).toThrow("Fund name heading not found");
  });
});
