import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KronRepository } from "@/lib/ingestion/kron/kron-repository";
import type { ParsedKronFund } from "@/lib/ingestion/kron/kron-types";

describe("KronRepository null protection", () => {
  it("does not include missing source fields in an existing fund update", async () => {
    const updatePayloads: Record<string, unknown>[] = [];
    const database = {
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "fund-id" }, error: null }) }) }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      })),
    } as unknown as SupabaseClient;
    const parsed: ParsedKronFund = {
      requestedIsin: "NO0011101545", pageIsin: "NO0011101545", name: "Kron Indeks Global",
      manager: null, currency: null, category: null, kronUrl: "https://www.kron.no/fond/NO0011101545",
      availability: "UNKNOWN", annualPricePercent: 0.15, morningstarRating: 4,
    };

    await new KronRepository(database).upsertVerifiedFund(parsed, true);

    expect(updatePayloads).toEqual([{
      name: "Kron Indeks Global",
      kron_url: "https://www.kron.no/fond/NO0011101545",
      available_on_kron: true,
    }]);
  });
});
