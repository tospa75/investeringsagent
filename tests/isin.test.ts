import { describe, expect, it } from "vitest";
import { isinSchema } from "@/lib/validation/isin";

describe("isinSchema", () => {
  it("accepts a structurally valid ISIN and normalizes case", () => expect(isinSchema.parse("no0012345678")).toBe("NO0012345678"));
  it.each(["NO123", "NØ0012345678", "NO001234567X", "123456789012"])("rejects %s", (value) => expect(isinSchema.safeParse(value).success).toBe(false));
});
