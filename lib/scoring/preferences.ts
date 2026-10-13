export type PreferenceType="PREFERRED_REGION"|"PREFERRED_COUNTRY"|"PREFERRED_SECTOR"|"UNDERWEIGHT_REGION"|"UNDERWEIGHT_COUNTRY"|"UNDERWEIGHT_SECTOR"|"TARGET_REGION_WEIGHT"|"TARGET_SECTOR_WEIGHT"|"MANAGEMENT_STYLE"|"COST"|"DIVERSIFICATION";
export interface SoftPreference{type:PreferenceType;dimension:string|null;targetValue:number|null;preferenceValue:string|null;strength:number}
export const PREFERENCE_VERSION=1;
export const STANDARD_SOFT_PREFERENCES:Record<string,SoftPreference[]>={
 balanced:[{type:"COST",dimension:null,targetValue:null,preferenceValue:"LOWER",strength:.5},{type:"DIVERSIFICATION",dimension:null,targetValue:null,preferenceValue:"HIGHER",strength:.5}],
 aggressive:[{type:"DIVERSIFICATION",dimension:null,targetValue:null,preferenceValue:"HIGHER",strength:.35}],
 "europe-asia-tilt":[{type:"TARGET_REGION_WEIGHT",dimension:"EUROPE",targetValue:.5,preferenceValue:null,strength:1},{type:"TARGET_REGION_WEIGHT",dimension:"DEVELOPED_ASIA",targetValue:.2,preferenceValue:null,strength:.7},{type:"UNDERWEIGHT_COUNTRY",dimension:"USA",targetValue:.2,preferenceValue:null,strength:1}],
 "low-cost-passive":[{type:"MANAGEMENT_STYLE",dimension:null,targetValue:null,preferenceValue:"PASSIVE",strength:1},{type:"COST",dimension:null,targetValue:null,preferenceValue:"LOWER",strength:1},{type:"DIVERSIFICATION",dimension:null,targetValue:null,preferenceValue:"HIGHER",strength:.6}],
};
