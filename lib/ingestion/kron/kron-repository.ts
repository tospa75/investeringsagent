import type { SupabaseClient } from "@supabase/supabase-js";
import type { KronFetchResult, ParsedKronFund } from "./kron-types";
import type { IngestionStatus, Json } from "@/lib/types";

export class KronRepository {
  constructor(private readonly database: SupabaseClient) {}

  async findFundId(isin: string): Promise<string | null> {
    const { data, error } = await this.database.from("funds").select("id").eq("isin", isin).maybeSingle();
    if (error) throw new Error(`Could not look up fund: ${error.message}`);
    return data?.id ?? null;
  }

  async upsertVerifiedFund(parsed: ParsedKronFund, availableOnKron: boolean): Promise<string> {
    const existingId = await this.findFundId(parsed.requestedIsin);
    const provided = {
      name: parsed.name,
      manager: parsed.manager,
      currency: parsed.currency,
      category: parsed.category,
      kron_url: parsed.kronUrl,
      available_on_kron: availableOnKron,
    };
    const nonNullFields = Object.fromEntries(Object.entries(provided).filter(([, value]) => value !== null));
    if (existingId) {
      const { error } = await this.database.from("funds").update(nonNullFields).eq("id", existingId);
      if (error) throw new Error(`Could not update fund: ${error.message}`);
      return existingId;
    }
    const { data, error } = await this.database.from("funds").insert({ isin: parsed.requestedIsin, ...nonNullFields }).select("id").single();
    if (error || !data) throw new Error(`Could not create fund: ${error?.message ?? "missing returned row"}`);
    return data.id as string;
  }

  async saveRawSnapshot(fetchResult: KronFetchResult, fundId: string | null): Promise<"saved" | "duplicate"> {
    const { error } = await this.database.from("raw_source_snapshots").insert({
      fund_id: fundId, source_type: "KRON", source_url: fetchResult.url,
      content_hash: fetchResult.contentHash, raw_content: fetchResult.content,
      retrieved_at: fetchResult.retrievedAt,
    });
    if (!error) return "saved";
    if (error.code === "23505") return "duplicate";
    throw new Error(`Could not save raw snapshot: ${error.message}`);
  }

  async attachRawSnapshot(fetchResult: KronFetchResult, fundId: string): Promise<void> {
    const { error } = await this.database.from("raw_source_snapshots").update({ fund_id: fundId })
      .eq("source_type", "KRON").eq("source_url", fetchResult.url).eq("content_hash", fetchResult.contentHash);
    if (error) throw new Error(`Could not attach raw snapshot to fund: ${error.message}`);
  }

  async createIngestionRun(input: {
    fundId: string | null; startedAt: string; status: IngestionStatus; qualityScore: number;
    warnings: string[]; errors: string[]; missingFields: string[];
  }): Promise<void> {
    const { error } = await this.database.from("ingestion_runs").insert({
      fund_id: input.fundId, started_at: input.startedAt, finished_at: new Date().toISOString(),
      status: input.status, data_quality_score: input.qualityScore,
      warnings: input.warnings as Json, errors: input.errors as Json, missing_fields: input.missingFields as Json,
    });
    if (error) throw new Error(`Could not create ingestion run: ${error.message}`);
  }
}
