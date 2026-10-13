import type{ParsedScenario,ScenarioType}from"./kid-normalized-types";import{parseDecimal,parsePercentage}from"./text-utils";
const labels:Record<ScenarioType,string>={STRESS:"Stress",UNFAVOURABLE:"Ugunstig|Unfavourable",MODERATE:"Moderat|Moderate",FAVOURABLE:"Gunstig|Favourable"};
type Value={ending:number|null;annual:number|null};
function extract(text:string,label:string,holding:number):Value[]{
 const heading="(?:Hva du kan få tilbake etter kostnader|What you might get back after costs)",returns="(?:Gjennomsnittlig avkastning hvert år|Average return each year)";
 const two=new RegExp(`(?:^|\\s)(?:${label})\\s+${heading}\\s+(?:[A-Z]{3}\\s*)?[\\d .]+\\s+(?:[A-Z]{3}\\s*)?([\\d .]+)\\s+${returns}\\s+[-\\d.,]+\\s*%\\s+([-\\d.,]+)\\s*%`,"gi");
 const twoMatches=[...text.matchAll(two)];if(twoMatches.length)return twoMatches.map(m=>({ending:parseDecimal(m[1]),annual:parsePercentage(m[2])}));
 const single=new RegExp(`(?:^|\\s)(?:${label})\\s+${heading}\\s+(?:[A-Z]{3}\\s*)?([\\d .]+)\\s+${returns}\\s+([-\\d.,]+)\\s*%`,"gi");
 const periodFirst=new RegExp(`(?:Hvis du (?:selger|innløser) etter|If you exit after)\\s*${holding}(?:[.,]0)?\\s*(?:år|years?).{0,100}?(?:${label})\\s+${heading}\\s+(?:[A-Z]{3}\\s*)?([\\d .]+)\\s+${returns}\\s+([-\\d.,]+)\\s*%`,"gi");
 return[...text.matchAll(periodFirst),...text.matchAll(single)].map(m=>({ending:parseDecimal(m[1]),annual:parsePercentage(m[2])}));
}
export function parseScenarios(text:string,holding:number|null,currency:string|null):ParsedScenario[]{if(!holding)return[];const investment=text.match(/(?:Eksempel på investering|example investment|you invest)[^A-Z]{0,30}([A-Z]{3})?\s*([\d .]+)/i);const amount=investment?parseDecimal(investment[2]):null;const result:ParsedScenario[]=[];for(const[type,label]of Object.entries(labels)as[ScenarioType,string][]){const found=extract(text,label,holding).filter((v):v is{ending:number;annual:number}=>v.ending!==null&&v.annual!==null);const unique=[...new Map(found.map(v=>[`${v.ending}|${v.annual}`,v])).values()];if(unique.length===1)result.push({scenarioType:type,holdingPeriodYears:holding,investmentAmount:amount,endingValue:unique[0].ending,averageReturnPerYear:unique[0].annual,currency:investment?.[1]??currency});}return result;}
