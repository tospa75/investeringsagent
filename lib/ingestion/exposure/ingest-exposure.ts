import { fetchKronFundPage } from "@/lib/ingestion/kron/fetch-kron-fund";
import { parseKronExposure } from "./parse-kron-exposure";
import type { ExposureResult } from "./exposure-types";
import { ExposureRepository } from "./exposure-repository";

export async function ingestExposure(isin:string,repository:ExposureRepository,fetcher=fetchKronFundPage):Promise<ExposureResult>{
 const fund=await repository.getFund(isin);if(!fund)return{isin,fundName:null,status:"FAILED",duplicate:false,data:null,errors:["Fund not found"]};
 try{const fetched=await fetcher(isin);if(fetched.statusCode!==200)throw new Error(`Kron returned HTTP ${fetched.statusCode}`);const data=parseKronExposure(fetched.content,isin,fetched.url,fetched.retrievedAt);const duplicate=await repository.save(fund.id,data)==="duplicate";const hasCore=data.geography.length>0&&data.sectors.length>0&&data.holdings.length>0;return{isin,fundName:fund.name,status:hasCore?"SUCCESS":data.holdings.length||data.assetAllocations.length?"PARTIAL":"FAILED",duplicate,data,errors:[]};}catch(error){return{isin,fundName:fund.name,status:"FAILED",duplicate:false,data:null,errors:[error instanceof Error?error.message:"Unknown exposure error"]};}
}
