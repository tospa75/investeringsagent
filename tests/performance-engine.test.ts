import{describe,expect,it}from"vitest";import{annualizedReturn,annualizedVolatility,calculateMetrics,dailyReturns,findAnomalies,maxDrawdown,periodReturn,sharpeRatio,sortinoRatio,validateNavPoints,ytdReturn}from"@/lib/ingestion/nav";
const series=(start="2020-01-01",days=2200,growth=.0003)=>Array.from({length:days},(_,i)=>({date:new Date(Date.parse(start)+i*864e5).toISOString().slice(0,10),value:100*Math.pow(1+growth,i)}));
describe("performance engine",()=>{
 it("calculates daily returns",()=>expect(dailyReturns([{date:"2026-01-01",value:100},{date:"2026-01-02",value:110}])[0]).toBeCloseTo(.1));
 it("calculates one month return from nearest actual date",()=>expect(periodReturn(series("2025-01-01",400,.001),1)).toBeGreaterThan(.02));
 it("calculates YTD",()=>expect(ytdReturn(series("2025-01-01",500,.001))).not.toBeNull());
 it("annualizes multi-year return",()=>expect(annualizedReturn(series(),3)).toBeCloseTo(Math.pow(1.0003,365.2425)-1,3));
 it("annualizes daily volatility",()=>{const p=Array.from({length:400},(_,i)=>({date:new Date(Date.UTC(2025,0,1)+i*864e5).toISOString().slice(0,10),value:100*Math.pow(i%2?1.01:.99,i)}));expect(annualizedVolatility(p)).toBeGreaterThan(0)});
 it("finds drawdown and recovery time",()=>{const d=maxDrawdown([{date:"2026-01-01",value:100},{date:"2026-01-02",value:80},{date:"2026-01-05",value:101}])!;expect(d.value).toBeCloseTo(-.2);expect(d.recovered).toBe(true);expect(d.recoveryTimeDays).toBe(3)});
 it("handles unrecovered drawdown",()=>expect(maxDrawdown([{date:"2026-01-01",value:100},{date:"2026-01-02",value:80}])?.recoveryDate).toBeNull());
 it("calculates Sharpe and Sortino with explicit rates",()=>{const p=series();expect(sharpeRatio(p,.03)).not.toBeNull();expect(sortinoRatio(p,0)).toBeNull()});
 it("calculates Calmar",()=>{const p=[...series("2020-01-01",1000,.001),{date:"2022-10-01",value:80},{date:"2023-01-01",value:120}];expect(calculateMetrics(p,"v",.03).calmarRatio).not.toBeNull()});
 it("returns null for insufficient requested history",()=>expect(annualizedReturn(series("2025-01-01",300),3)).toBeNull());
 it("deduplicates and rejects invalid NAV",()=>expect(validateNavPoints([{date:"2026-01-01",value:100},{date:"2026-01-01",value:101},{date:"bad",value:2},{date:"2026-01-02",value:-1}])).toHaveLength(1));
 it("flags extreme outliers without correcting them",()=>expect(findAnomalies([{date:"2026-01-01",value:100},{date:"2026-01-02",value:700}])).toHaveLength(1));
});
