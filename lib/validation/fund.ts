import { z } from "zod";
import { isinSchema } from "./isin";

export const fundSchema = z.object({
  isin: isinSchema,
  name: z.string().trim().min(1).max(300),
  manager: z.string().trim().min(1).max(200),
  shareClass: z.string().trim().min(1).max(100),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be an ISO-style three-letter code."),
  fundType: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(150).nullable().optional(),
  activePassive: z.enum(["active", "passive", "unknown"]).default("unknown"),
  benchmark: z.string().trim().max(300).nullable().optional(),
  inceptionDate: z.iso.date().nullable().optional(),
  kronUrl: z.url().nullable().optional(),
  availableOnKron: z.boolean().default(false),
});

export type FundInput = z.infer<typeof fundSchema>;
