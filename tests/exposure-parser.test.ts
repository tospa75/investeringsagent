import { describe, expect, it } from "vitest";
import { parseKronExposure } from "@/lib/ingestion/exposure";
const html=(details:object)=>`<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{page:{details}}}})}</script></html>`;
const base={isin:"NO0011101545",regions:[{label:"Nord-Amerika",weight:.7},{label:"Europa",weight:.3}],countries:[{label:"USA",weight:1}],sectors:[{label:"Teknologi",weight:.6},{label:"Finans",weight:.4}],holdings:[{label:"Apple",weight:.1},{label:"Microsoft",weight:.08}],assetAllocations:[{label:"Aksjer",weight:1}],netAssetValuePerShare:{date:"2026-09-30"}};
describe("Kron exposure parser",()=>{
 it("parses holdings and concentration metrics without treating NAV date as exposure date",()=>{const x=parseKronExposure(html(base),base.isin,"https://example.test");expect(x.holdings).toHaveLength(2);expect(x.holdings[0].holdingType).toBe("equity");expect(x.sourceDate).toBeNull();expect(x.metrics.top10Weight).toBe(18);expect(x.geographyScope).toBe("COMPLETE")});
 it("marks partial geography without normalizing it to 100",()=>{const x=parseKronExposure(html({...base,regions:[{label:"Europa",weight:.4}]}),base.isin,"x");expect(x.geographyScope).toBe("PARTIAL");expect(x.geography.find(r=>r.region)?.weight).toBe(40)});
 it("warns when a total exceeds 100",()=>{const x=parseKronExposure(html({...base,sectors:[{label:"Teknologi",weight:.8},{label:"Finans",weight:.3}]}),base.isin,"x");expect(x.warnings.some(w=>w.includes("exceeds 100"))).toBe(true)});
 it("uses medium quality when the exposure source date is unavailable",()=>{const x=parseKronExposure(html(base),base.isin,"x");expect(x.qualityStatus).toBe("MEDIUM");expect(x.warnings[0]).toMatch(/source_date missing/)});
 it("rejects an ISIN mismatch",()=>{expect(()=>parseKronExposure(html({...base,isin:"NO0013004622"}),base.isin,"x")).toThrow(/mismatch/)});
});
