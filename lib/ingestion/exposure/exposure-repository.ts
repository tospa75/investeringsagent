import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types";
import type { ExposureData } from "./exposure-types";

export class ExposureRepository {
 constructor(private readonly database:SupabaseClient){}
 async getFund(isin:string){const{data,error}=await this.database.from("funds").select("id,name").eq("isin",isin).maybeSingle();if(error)throw new Error(`Could not load fund: ${error.message}`);return data as {id:string;name:string}|null;}
 async save(fundId:string,data:ExposureData):Promise<"saved"|"duplicate">{
  const{data:existing,error:lookupError}=await this.database.from("exposure_datasets").select("id").eq("fund_id",fundId).eq("source_type",data.sourceType).eq("content_hash",data.contentHash).maybeSingle();if(lookupError)throw new Error(`Could not check exposure duplicate: ${lookupError.message}`);if(existing)return"duplicate";
  const{data:dataset,error}=await this.database.from("exposure_datasets").insert({fund_id:fundId,source_type:data.sourceType,source_url:data.sourceUrl,source_date:data.sourceDate,retrieved_at:data.retrievedAt,content_hash:data.contentHash,quality_status:data.qualityStatus,geography_scope:data.geographyScope,sector_scope:data.sectorScope,top_10_weight:data.metrics.top10Weight,largest_holding_weight:data.metrics.largestHoldingWeight,number_of_reported_holdings:data.metrics.numberOfReportedHoldings,cash_weight:data.metrics.cashWeight,equity_weight:data.metrics.equityWeight,bond_weight:data.metrics.bondWeight,warnings:data.warnings as Json}).select("id").single();if(error||!dataset)throw new Error(`Could not save exposure dataset: ${error?.message??"missing row"}`);const common={fund_id:fundId,dataset_id:dataset.id,source_type:data.sourceType,source_url:data.sourceUrl,source_date:data.sourceDate,retrieved_at:data.retrievedAt,content_hash:data.contentHash,quality_status:data.qualityStatus};
  const writes=[data.geography.length&&this.database.from("fund_geography").insert(data.geography.map(x=>({...common,...x}))),data.sectors.length&&this.database.from("fund_sectors").insert(data.sectors.map(x=>({...common,sector:x.label,weight:x.weight}))),data.holdings.length&&this.database.from("fund_holdings").insert(data.holdings.map(x=>({...common,holding_name:x.holdingName,holding_identifier:x.holdingIdentifier,holding_type:x.holdingType,weight:x.weight}))),data.assetAllocations.length&&this.database.from("fund_asset_allocations").insert(data.assetAllocations.map(x=>({...common,asset_class:x.label,weight:x.weight})))].filter(Boolean) as PromiseLike<{error:unknown}>[];
  for(const write of writes){const result=await write;if(result.error)throw new Error(`Could not save exposure rows: ${JSON.stringify(result.error)}`);}return"saved";
 }
}
