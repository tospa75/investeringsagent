import { describe, expect, it } from "vitest";
import { mapFundRow } from "@/lib/supabase/mappers";
import type { FundRow } from "@/lib/types";

describe("mapFundRow", () => {
  it("maps database snake_case to application camelCase", () => {
    const row: FundRow = { id:"1", isin:"NO0012345678", name:"Fund", manager:"Manager", share_class:"A", currency:"NOK", fund_type:"equity", category:null, active_passive:"active", benchmark:null, inception_date:null, kron_url:null, available_on_kron:true, created_at:"2026-01-01T00:00:00Z", updated_at:"2026-01-01T00:00:00Z" };
    expect(mapFundRow(row)).toMatchObject({ shareClass:"A", fundType:"equity", availableOnKron:true });
  });
});
