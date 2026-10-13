import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataValidity, DocumentType, IngestionStatus, Json } from "@/lib/types";
import type { KidCandidate, KidFetchResult, KidFundIdentity, KidVerification } from "./kid-types";

export function sanitizeSnapshotText(rawText: string): string {
  return rawText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "\ufffd");
}

export class KidRepository {
  constructor(private readonly database: SupabaseClient) {}

  async getFund(isin: string): Promise<KidFundIdentity | null> {
    const { data, error } = await this.database.from("funds").select("id,isin,name,share_class,kron_url").eq("isin", isin).maybeSingle();
    if (error) throw new Error(`Could not load verified fund: ${error.message}`);
    return data ? { id: data.id as string, isin: data.isin as string, name: data.name as string, shareClass: data.share_class as string | null, kronUrl: data.kron_url as string | null } : null;
  }

  async saveSnapshot(fundId: string, fetched: KidFetchResult, rawText: string): Promise<"saved" | "duplicate"> {
    const { error } = await this.database.from("raw_source_snapshots").insert({
      fund_id: fundId, source_type: "KID", source_url: fetched.finalUrl, content_hash: fetched.contentHash,
      raw_content: sanitizeSnapshotText(rawText), retrieved_at: fetched.retrievedAt,
    });
    if (!error) return "saved";
    if (error.code === "23505") return "duplicate";
    throw new Error(`Could not save KID snapshot: ${error.message}`);
  }

  async saveDocument(input: {
    fund: KidFundIdentity; candidate: KidCandidate; fetched: KidFetchResult; documentType: DocumentType;
    publicationDate: string | null; verification: KidVerification;
  }): Promise<"saved" | "duplicate"> {
    const { data: existing, error: lookupError } = await this.database.from("fund_documents").select("id")
      .eq("fund_id", input.fund.id).eq("content_hash", input.fetched.contentHash).maybeSingle();
    if (lookupError) throw new Error(`Could not check document duplicate: ${lookupError.message}`);
    if (existing) return "duplicate";
    const { error } = await this.database.from("fund_documents").insert({
      fund_id: input.fund.id, document_type: input.documentType, source_url: input.fetched.finalUrl,
      publication_date: input.publicationDate, retrieved_at: input.fetched.retrievedAt,
      isin_verified: input.verification.isinVerified, share_class_verified: input.verification.shareClassVerified,
      document_status: input.verification.status, content_hash: input.fetched.contentHash,
      discovery_method: input.candidate.discoveryMethod, provider_name: input.candidate.providerName,
      http_status: input.fetched.statusCode, content_type: input.fetched.contentType,
      verification_notes: input.verification.notes as Json,
    });
    if (error?.code === "23505") return "duplicate";
    if (error) throw new Error(`Could not save fund document: ${error.message}`);
    return "saved";
  }

  async saveFetchFailure(fund: KidFundIdentity, candidate: KidCandidate, status: DataValidity, errorMessage: string): Promise<void> {
    const { data: existing, error: lookupError } = await this.database.from("fund_documents").select("id")
      .eq("fund_id", fund.id).eq("source_url", candidate.url).eq("document_status", status).limit(1).maybeSingle();
    if (lookupError) throw new Error(`Could not check failed document attempt: ${lookupError.message}`);
    if (existing) return;
    const { error } = await this.database.from("fund_documents").insert({
      fund_id: fund.id, document_type: candidate.documentType, source_url: candidate.url,
      isin_verified: false, share_class_verified: false, document_status: status,
      discovery_method: candidate.discoveryMethod, provider_name: candidate.providerName,
      verification_notes: [errorMessage] as Json,
    });
    if (error) throw new Error(`Could not save failed document attempt: ${error.message}`);
  }

  async createRun(input: { fundId: string; startedAt: string; status: IngestionStatus; quality: number; warnings: string[]; errors: string[] }): Promise<void> {
    const { error } = await this.database.from("ingestion_runs").insert({
      fund_id: input.fundId, stage: "KID_DISCOVERY", started_at: input.startedAt, finished_at: new Date().toISOString(),
      status: input.status, data_quality_score: input.quality, warnings: input.warnings as Json,
      errors: input.errors as Json, missing_fields: [] as Json,
    });
    if (error) throw new Error(`Could not log KID ingestion run: ${error.message}`);
  }
}
