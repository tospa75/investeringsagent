import{describe,expect,it}from"vitest";import{parseScenarios}from"@/lib/ingestion/kid-parser/parse-scenarios";
describe("scenario layouts",()=>{
 it("parses scenario-first rows",()=>expect(parseScenarios("Example investment USD 10000 Stress What you might get back after costs USD 7000 Average return each year -6.9%",5,"USD")).toMatchObject([{scenarioType:"STRESS",endingValue:7000}]));
 it("parses period-first Morningstar-style rows",()=>expect(parseScenarios("Example investment USD 10000 If you exit after 5 years Moderate What you might get back after costs USD 15000 Average return each year 8.4%",5,"USD")).toMatchObject([{scenarioType:"MODERATE",holdingPeriodYears:5,endingValue:15000}]));
 it("rejects an ambiguous duplicate scenario",()=>expect(parseScenarios("Example investment USD 10000 Stress What you might get back after costs USD 7000 Average return each year -6.9% Stress What you might get back after costs USD 8000 Average return each year -4.4%",5,"USD")).toEqual([]));
});
