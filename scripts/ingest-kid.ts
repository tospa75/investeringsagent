import { createClient } from "@supabase/supabase-js";
import { ingestKid, KidRepository } from "../lib/ingestion/kid";
import { KRON_TEST_ISINS } from "../lib/ingestion/kron/kron-types";
import { isinSchema } from "../lib/validation/isin";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const targets = args.length === 0 || args[0] === "--batch" ? [...KRON_TEST_ISINS] : args;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const invalid = targets.find((isin) => !isinSchema.safeParse(isin).success);
  if (invalid) throw new Error(`Invalid ISIN: ${invalid}`);
  const repository = new KidRepository(createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }));
  const results = [];
  for (const [index, isin] of targets.entries()) {
    if (index > 0) await delay(1_500);
    try {
      const result = await ingestKid(isin, repository);
      results.push(result);
      console.log(`\nKID discovery complete\n\nFund: ${result.fund.name}\nISIN: ${result.fund.isin}\nProvider: ${result.providerName ?? "none"}\nDocument: ${result.documentType ?? "none"}\nISIN verified: ${result.isinVerified ? "yes" : "no"}\nDocument date: ${result.publicationDate ?? "unknown"}\nStatus: ${result.status}\nConfidence: ${result.confidence}\nSnapshot: ${result.snapshot}`);
      if (result.notes.length) console.log(`Notes:\n${result.notes.map((note) => `- ${note}`).join("\n")}`);
      if (result.errors.length) console.log(`Errors:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
    } catch (error) {
      console.error(`\n${isin}: ${error instanceof Error ? error.message : "unexpected error"}`);
    }
  }
  console.log(`\n${targets.length} funds processed`);
  for (const status of ["VALID", "UNVERIFIED", "INVALID", "FETCH_FAILED"] as const) console.log(`${status}: ${results.filter((result) => result.status === status).length}`);
  const failedCount = targets.length - results.length + results.filter((result) => result.status === "INVALID" || result.status === "FETCH_FAILED").length;
  console.log(`FAILED: ${failedCount}`);
  if (failedCount) process.exitCode = 1;
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Unexpected KID batch error"); process.exitCode = 1; });
