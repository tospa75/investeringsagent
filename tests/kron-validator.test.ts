import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseKronFundPage } from "@/lib/ingestion/kron/parse-kron-fund";
import { scoreKronFund, validateKronFund } from "@/lib/ingestion/kron/kron-validator";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const url = "https://www.kron.no/fond/NO0011101545";

describe("Kron validation and quality", () => {
  it("verifies matching ISIN and scores complete data at 100", () => {
    const parsed = parseKronFundPage(fixture("kron-complete.html"), "NO0011101545", url);
    const validation = validateKronFund(parsed);
    expect(validation).toEqual({ verified: true, availability: "AVAILABLE", errors: [] });
    expect(scoreKronFund(parsed, validation)).toEqual({ score: 100, missingFields: [], warnings: [] });
  });
  it("fails an ISIN mismatch and forces quality to zero", () => {
    const parsed = parseKronFundPage(fixture("kron-mismatch.html"), "NO0011101545", url);
    const validation = validateKronFund(parsed);
    expect(validation.verified).toBe(false);
    expect(validation.errors[0]).toContain("ISIN mismatch");
    expect(scoreKronFund(parsed, validation).score).toBe(0);
  });
  it("scores only verified, present fields", () => {
    const parsed = parseKronFundPage(fixture("kron-missing-fields.html"), "NO0010963432", url);
    const quality = scoreKronFund(parsed, validateKronFund(parsed));
    expect(quality.score).toBe(80);
    expect(quality.missingFields).toEqual(["manager", "currency", "category"]);
  });
});
