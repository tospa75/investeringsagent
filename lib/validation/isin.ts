import { z } from "zod";

/** Structural validation only. ISO 6166 checksum validation belongs in a later ingestion phase. */
export const isinSchema = z.string().trim().toUpperCase().regex(
  /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/,
  "ISIN must contain 12 allowed characters: two letters, nine alphanumerics, and a final digit.",
);
