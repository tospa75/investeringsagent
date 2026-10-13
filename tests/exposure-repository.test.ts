import { describe, expect, it, vi } from "vitest";
import { ExposureRepository } from "@/lib/ingestion/exposure";
describe("exposure database mapping",()=>{
 it("returns duplicate before writing child rows",async()=>{const maybeSingle=vi.fn().mockResolvedValue({data:{id:"dataset"},error:null});const chain:any={eq:vi.fn(()=>chain),maybeSingle};const select=vi.fn(()=>chain);const from=vi.fn(()=>({select}));const repo=new ExposureRepository({from} as never);const result=await repo.save("fund",{sourceType:"KRON",contentHash:"hash"} as never);expect(result).toBe("duplicate");expect(from).toHaveBeenCalledWith("exposure_datasets");expect(maybeSingle).toHaveBeenCalledOnce();});
});
