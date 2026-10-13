import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KidRepository, sanitizeSnapshotText } from "@/lib/ingestion/kid/kid-repository";
import type { KidFetchResult } from "@/lib/ingestion/kid/kid-types";

const fetched: KidFetchResult = { sourceUrl:"https://example.test/kid", finalUrl:"https://example.test/kid.pdf", statusCode:200, contentType:"application/pdf", retrievedAt:"2026-10-11T12:00:00Z", lastModified:null, contentHash:"same-hash", bytes:new Uint8Array() };

describe("KidRepository mapping and deduplication", () => {
  it("replaces JSON-incompatible PDF control characters before persistence", () => {
    expect(sanitizeSnapshotText("før\u0000etter\u0007\nbeholdt")).toBe("før�etter�\nbeholdt");
  });
  it("maps a duplicate snapshot constraint to duplicate", async () => {
    const database = { from:vi.fn(() => ({ insert:vi.fn().mockResolvedValue({ error:{ code:"23505", message:"duplicate" } }) })) } as unknown as SupabaseClient;
    await expect(new KidRepository(database).saveSnapshot("fund-1", fetched, "text")).resolves.toBe("duplicate");
  });
  it("maps verified document metadata to the database", async () => {
    const inserted:Record<string,unknown>[]=[];
    const database = { from:vi.fn(() => ({
      select:() => ({ eq:() => ({ eq:() => ({ maybeSingle:async()=>({data:null,error:null}) }) }) }),
      insert:(payload:Record<string,unknown>)=>{inserted.push(payload);return Promise.resolve({error:null});},
    })) } as unknown as SupabaseClient;
    const repository=new KidRepository(database);
    await repository.saveDocument({
      fund:{id:"fund-1",isin:"NO0011101545",name:"Kron Indeks Global",shareClass:null,kronUrl:null},
      candidate:{url:fetched.sourceUrl,documentType:"PRIIP_KID",discoveryMethod:"PUBLIC_DISTRIBUTOR",providerName:"provider",authoritative:false},
      fetched,documentType:"PRIIP_KID",publicationDate:"2026-02-01",
      verification:{status:"VALID",isinVerified:true,fundNameVerified:true,shareClassVerified:false,confidence:"MEDIUM",notes:[]},
    });
    expect(inserted[0]).toMatchObject({ fund_id:"fund-1",document_type:"PRIIP_KID",document_status:"VALID",isin_verified:true,content_hash:"same-hash",provider_name:"provider" });
  });
  it("does not duplicate an identical failed document attempt", async () => {
    const insert=vi.fn();
    const database={from:vi.fn(()=>({select:()=>({eq:()=>({eq:()=>({eq:()=>({limit:()=>({maybeSingle:async()=>({data:{id:"existing"},error:null})})})})})}),insert}))}as unknown as SupabaseClient;
    const repository=new KidRepository(database);
    await repository.saveFetchFailure({id:"fund-1",isin:"LU0069449576",name:"World",shareClass:null,kronUrl:null},{url:"https://example.test/missing.pdf",documentType:"PRIIP_KID",discoveryMethod:"PUBLIC_DISTRIBUTOR",providerName:"provider",authoritative:false},"FETCH_FAILED","HTTP 404");
    expect(insert).not.toHaveBeenCalled();
  });
});
