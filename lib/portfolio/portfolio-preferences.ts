export interface PortfolioPreference{targetRiskProxy:number|null;preferredCoreWeight:number|null;preferredSatelliteWeight:number|null;targetRegionWeights:Record<string,number>;targetSectorWeights:Record<string,number>;preferredEquityWeight:number|null;preferredFixedIncomeWeight:number|null;concentrationTolerance:number|null}
export const PORTFOLIO_PREFERENCE_VERSION=1;
export const STANDARD_PORTFOLIO_PREFERENCES:Record<string,PortfolioPreference>={
 balanced:{targetRiskProxy:4,preferredCoreWeight:.75,preferredSatelliteWeight:.2,targetRegionWeights:{},targetSectorWeights:{},preferredEquityWeight:.9,preferredFixedIncomeWeight:.1,concentrationTolerance:.3},
 aggressive:{targetRiskProxy:6,preferredCoreWeight:.55,preferredSatelliteWeight:.4,targetRegionWeights:{ASIA:.25},targetSectorWeights:{},preferredEquityWeight:.95,preferredFixedIncomeWeight:.05,concentrationTolerance:.4},
 "europe-asia-tilt":{targetRiskProxy:4,preferredCoreWeight:.55,preferredSatelliteWeight:.4,targetRegionWeights:{EUROPE:.5,ASIA:.2},targetSectorWeights:{},preferredEquityWeight:.95,preferredFixedIncomeWeight:.05,concentrationTolerance:.35},
 "low-cost-passive":{targetRiskProxy:4,preferredCoreWeight:.8,preferredSatelliteWeight:.15,targetRegionWeights:{},targetSectorWeights:{},preferredEquityWeight:.95,preferredFixedIncomeWeight:.05,concentrationTolerance:.3},
};
