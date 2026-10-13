export type ParserStatus="SUCCESS"|"PARTIAL"|"FAILED"|"SKIPPED";
export type ScenarioType="STRESS"|"UNFAVOURABLE"|"MODERATE"|"FAVOURABLE";
export interface ParsedCosts { managementFee:number|null; transactionCost:number|null; performanceFee:number|null; entryFee:number|null; exitFee:number|null; otherRecurringCost:number|null; totalAnnualCost:number|null; }
export interface ParsedScenario { scenarioType:ScenarioType; holdingPeriodYears:number; investmentAmount:number|null; endingValue:number|null; averageReturnPerYear:number|null; currency:string|null; }
export interface KidNormalizedData { fundName:string|null; isin:string|null; shareClass:string|null; currency:string|null; priipRiskScore:number|null; riskText:string|null; recommendedHoldingPeriodYears:number|null; costs:ParsedCosts; scenarios:ParsedScenario[]; investmentObjective:string|null; investmentStrategy:string|null; benchmark:string|null; intendedInvestor:string|null; warnings:string[]; missingFields:string[]; qualityScore:number; }
export interface ParserFund { id:string; isin:string; name:string; }
export interface ParserDocument { id:string; fundId:string; sourceUrl:string; publicationDate:string|null; retrievedAt:string; contentHash:string; }
export interface KidParseResult { fund:ParserFund; documentId:string|null; status:ParserStatus; reason:string|null; data:KidNormalizedData|null; }
