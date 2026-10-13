export type DataQuality = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type DataValidity = "VALID" | "STALE" | "CONFLICT" | "MISSING" | "INVALID" | "UNVERIFIED" | "FETCH_FAILED";
export type HoldingType = "equity" | "bond" | "fund" | "cash" | "other";
export type DocumentType = "KID" | "PRIIP" | "PRIIP_KID" | "FACTSHEET" | "PROSPECTUS" | "SFDR" | "OTHER" | "factsheet" | "prospectus" | "other";
export type IngestionStage = "KRON_DISCOVERY" | "KID_DISCOVERY" | "KID_PARSING";
export type IngestionStatus = "SUCCESS" | "PARTIAL" | "FAILED";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Fund {
  id: string; isin: string; name: string; manager: string | null; shareClass: string | null; currency: string | null;
  fundType: string | null; category: string | null; activePassive: "active" | "passive" | "unknown";
  benchmark: string | null; inceptionDate: string | null; kronUrl: string | null;
  availableOnKron: boolean; createdAt: string; updatedAt: string;
}
export interface FundCost { id:string; fundId:string; managementFee:number|null; platformFee:number|null; transactionCost:number|null; performanceFee:number|null; entryFee:number|null; exitFee:number|null; totalAnnualCost:number|null; sourceUrl:string|null; sourceDate:string|null; retrievedAt:string; createdAt:string; }
export interface FundRisk { id:string; fundId:string; priipRiskScore:number|null; recommendedHoldingPeriodYears:number|null; volatility:number|null; maxDrawdown:number|null; recoveryTimeDays:number|null; sourceUrl:string|null; sourceDate:string|null; retrievedAt:string; createdAt:string; }
export interface FundGeography { id:string; fundId:string; region:string|null; country:string|null; weight:number; sourceDate:string|null; retrievedAt:string; }
export interface FundSector { id:string; fundId:string; sector:string; weight:number; sourceDate:string|null; retrievedAt:string; }
export interface FundHolding { id:string; fundId:string; holdingName:string; holdingIdentifier:string|null; holdingType:HoldingType; weight:number; sourceDate:string|null; retrievedAt:string; }
export interface FundDocument { id:string; fundId:string; documentType:DocumentType; sourceUrl:string; publicationDate:string|null; retrievedAt:string; isinVerified:boolean; shareClassVerified:boolean; documentStatus:DataValidity; createdAt:string; }
export interface IngestionRun { id:string; fundId:string|null; startedAt:string; finishedAt:string|null; status:IngestionStatus; dataQualityScore:number|null; warnings:Json; errors:Json; missingFields:Json; createdAt:string; }
export interface RawSourceSnapshot { id:string; fundId:string|null; sourceType:string; sourceUrl:string; contentHash:string; rawContent:Json; retrievedAt:string; createdAt:string; }

export interface FundRow {
  id:string; isin:string; name:string; manager:string|null; share_class:string|null; currency:string|null; fund_type:string|null;
  category:string|null; active_passive:"active"|"passive"|"unknown"; benchmark:string|null;
  inception_date:string|null; kron_url:string|null; available_on_kron:boolean; created_at:string; updated_at:string;
}
