import { describe, expect, it } from "vitest";
import { inferHoldingType, normalizeCountry, normalizeRegion, normalizeSector, parsePercentage } from "@/lib/ingestion/exposure";

describe("exposure normalization",()=>{
 it("maps provider regions",()=>{expect(normalizeRegion("Nord-Amerika")).toBe("NORTH_AMERICA");expect(normalizeRegion("Emerging Asia")).toBe("EMERGING_ASIA");expect(normalizeRegion("Nordics")).toBe("NORDIC")});
 it("maps countries without mixing them with regions",()=>{expect(normalizeCountry("United States")).toBe("USA");expect(normalizeCountry("U.S.")).toBe("USA");expect(normalizeCountry("Norge")).toBe("Norway")});
 it("maps sectors deterministically",()=>{expect(normalizeSector("Teknologi")).toBe("Technology");expect(normalizeSector("Defensivt konsum")).toBe("Consumer Staples");expect(normalizeSector("Forsvar")).toBe("Other")});
 it("parses percentages and Norwegian decimals",()=>{expect(parsePercentage("12,5 %")).toBe(12.5);expect(parsePercentage("101 %")).toBeNull();expect(parsePercentage("-1 %")).toBeNull()});
 it("identifies fund-of-funds holdings",()=>{expect(inferHoldingType("Example UCITS Fund",[{label:"EQUITY",weight:100}])).toBe("fund")});
});
