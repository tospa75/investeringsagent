import { createHash } from "node:crypto";
import { inferHoldingType, normalizeAssetClass, normalizeCountry, normalizeRegion, normalizeSector } from "./normalize";
import type { ExposureData, ExposureScope, WeightedLabel } from "./exposure-types";

type Raw={isin?:string;countries?:WeightedLabel[];regions?:WeightedLabel[];sectors?:WeightedLabel[];holdings?:WeightedLabel[];assetAllocations?:WeightedLabel[];netAssetValuePerShare?:{date?:string}};
function sum(rows:{weight:number}[]){return rows.reduce((n,r)=>n+r.weight,0)}
function rows(raw:unknown):WeightedLabel[]{return Array.isArray(raw)?raw.filter((x):x is WeightedLabel=>Boolean(x)&&typeof x.label==="string"&&typeof x.weight==="number").map(x=>({label:x.label,weight:x.weight*100})):[]}
function scope(items:WeightedLabel[]):ExposureScope{return items.length>0&&sum(items)>=95&&sum(items)<=105?"COMPLETE":"PARTIAL"}
export function parseKronExposure(html:string,requestedIsin:string,url:string,retrievedAt=new Date().toISOString()):ExposureData{
 const match=html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);if(!match)throw new Error("Kron exposure JSON not found");const details=JSON.parse(match[1]).props?.pageProps?.page?.details as Raw|undefined;if(!details||details.isin!==requestedIsin)throw new Error("Kron exposure ISIN mismatch");
 const countries=rows(details.countries),regions=rows(details.regions),rawSectors=rows(details.sectors),rawHoldings=rows(details.holdings),assets=rows(details.assetAllocations).map(x=>({...x,label:normalizeAssetClass(x.label)}));
 const geography=[...regions.map(x=>({region:normalizeRegion(x.label),country:null,weight:x.weight})),...countries.map(x=>({region:null,country:normalizeCountry(x.label),weight:x.weight}))];
 const holdings=rawHoldings.map(x=>({holdingName:x.label,holdingIdentifier:null,holdingType:inferHoldingType(x.label,assets),weight:x.weight}));const warnings:string[]=["source_date missing: Kron exposes a NAV date, not an exposure date"];const regionTotal=sum(regions),countryTotal=sum(countries),sectorTotal=sum(rawSectors);for(const[name,total]of [["regions",regionTotal],["countries",countryTotal],["sectors",sectorTotal]] as const)if(total>100.5)warnings.push(`${name} total exceeds 100% (${total.toFixed(2)}%)`);
 const findAsset=(label:string)=>assets.find(x=>x.label===label)?.weight??null;const contentHash=createHash("sha256").update(JSON.stringify({countries,regions,rawSectors,rawHoldings,assets})).digest("hex");
 return{isin:requestedIsin,sourceType:"KRON",sourceUrl:url,sourceDate:null,retrievedAt,contentHash,geography,sectors:rawSectors.map(x=>({label:normalizeSector(x.label),weight:x.weight})),holdings,assetAllocations:assets,geographyScope:scope(regions),sectorScope:scope(rawSectors),qualityStatus:"MEDIUM",warnings,metrics:{top10Weight:holdings.length?sum(holdings.slice(0,10)):null,largestHoldingWeight:holdings[0]?.weight??null,numberOfReportedHoldings:holdings.length,cashWeight:findAsset("CASH"),equityWeight:findAsset("EQUITY"),bondWeight:findAsset("BOND")}};
}
