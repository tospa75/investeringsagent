import { createClient } from "@supabase/supabase-js";
import { fetchKronFundPage, ingestKronFund, isinSchema, KRON_TEST_ISINS, KronRepository } from "../lib/ingestion/kron/cli-exports";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const targets = requested.length === 0 || requested[0] === "--batch" ? [...KRON_TEST_ISINS] : requested;
  const environment = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY };
  if (!environment.url || !environment.secretKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const invalid = targets.find((isin) => !isinSchema.safeParse(isin).success);
  if (invalid) throw new Error(`Invalid ISIN: ${invalid}`);
    const repository = new KronRepository(createClient(environment.url, environment.secretKey, { auth: { persistSession: false, autoRefreshToken: false } }));
    const results = [];
    for (const [index, isin] of targets.entries()) {
      if (index > 0) await delay(1_500);
      const result = await ingestKronFund(isin, repository, fetchKronFundPage);
      results.push(result);
      console.log(`\nKron ingestion complete\n\nISIN: ${result.isin}\nFund: ${result.fundName ?? "unknown"}\nStatus: ${result.status}\nQuality: ${result.qualityScore}\nRaw snapshot: ${result.rawSnapshot}`);
      if (result.missingFields.length) console.log(`\nMissing:\n${result.missingFields.map((field) => `- ${field}`).join("\n")}`);
      if (result.errors.length) console.log(`\nErrors:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
    }
    if (results.length > 1) {
      console.log(`\n${results.length} funds processed`);
      for (const status of ["SUCCESS", "PARTIAL", "FAILED"] as const) console.log(`${status}: ${results.filter((result) => result.status === status).length}`);
    }
    if (results.some((result) => result.status === "FAILED")) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unexpected Kron ingestion error");
  process.exitCode = 1;
});
