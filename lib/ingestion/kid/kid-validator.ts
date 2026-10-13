import { z } from "zod";

export const kidCandidateSchema = z.object({
  url: z.url(), documentType: z.enum(["KID", "PRIIP_KID"]),
  discoveryMethod: z.enum(["KRON_PAGE_LINK", "MANAGER_PAGE", "PUBLIC_DISTRIBUTOR"]),
  providerName: z.string().min(1), authoritative: z.boolean(),
});
