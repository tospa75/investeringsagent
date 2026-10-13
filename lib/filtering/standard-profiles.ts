import type{UserConstraint,UserProfile}from"./filter-types";
const c=(constraintType:UserConstraint["constraintType"],valueNumeric:number|null=null,dimension:string|null=null,valueText:string|null=null,priority=100):UserConstraint=>({constraintType,dimension,operator:constraintType.startsWith("MIN")?">=":constraintType.startsWith("EXCLUDE")?"EXCLUDE":"<=",valueNumeric,valueText,isHard:true,priority});
const base:UserProfile={investmentHorizonYears:7,investmentGoal:"long_term_growth",goalFlexibility:3,riskWillingnessScore:4,riskCapacityScore:4,liquidityNeedScore:2,initialAmount:100000,monthlyContribution:5000,investmentMode:"monthly",accountType:"ASK",managementStylePreference:"ANY",costSensitivity:3,currencyHedgingPreference:"ANY",esgImportance:3,targetFundCount:5,maxFundCount:8,maxWeightPerFund:.3,minWeightPerFund:.05,targetAnnualReturn:null,targetEndValue:null,tacticalViewEnabled:false,profileVersion:1,constraints:[]};
export const STANDARD_PROFILES:Record<string,UserProfile>={
 conservative:{...base,riskWillingnessScore:2,riskCapacityScore:3,liquidityNeedScore:3,constraints:[c("MAX_TOTAL_COST",.008),c("MAX_SECTOR_CONCENTRATION",.35),c("MIN_DATA_QUALITY",null,null,"MEDIUM")]},
 balanced:{...base,constraints:[c("MAX_TOTAL_COST",.015),c("MAX_SECTOR_CONCENTRATION",.5)]},
 aggressive:{...base,riskWillingnessScore:7,riskCapacityScore:6,investmentHorizonYears:10,constraints:[c("MAX_TOTAL_COST",.025)]},
 "europe-asia-tilt":{...base,constraints:[c("MAX_COUNTRY_WEIGHT",.45,"USA"),c("MIN_REGION_WEIGHT",.2,"EUROPE")]},
 "low-cost-passive":{...base,managementStylePreference:"ONLY_PASSIVE",constraints:[c("MAX_TOTAL_COST",.006),c("MIN_DATA_QUALITY",null,null,"MEDIUM")]},
};
export const CONTRADICTORY_PROFILE:UserProfile={...base,constraints:[c("MIN_COUNTRY_WEIGHT",.4,"USA"),c("MAX_COUNTRY_WEIGHT",.2,"USA")]};
