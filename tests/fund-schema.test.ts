import { describe, expect, it } from "vitest";
import { fundSchema } from "@/lib/validation/fund";

describe("fundSchema", () => {
  it("validates the minimum fund payload", () => {
    const result = fundSchema.parse({ isin:"NO0012345678", name:"Development Test Fund", manager:"Example Manager", shareClass:"A", currency:"NOK", fundType:"equity" });
    expect(result.activePassive).toBe("unknown");
    expect(result.availableOnKron).toBe(false);
  });
  it("rejects an invalid currency", () => expect(fundSchema.safeParse({ isin:"NO0012345678", name:"Fund", manager:"Manager", shareClass:"A", currency:"nok", fundType:"equity" }).success).toBe(false));
});
