import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { classifyManagementStyle, managementContentHash, ManagementStyleRepository, parseKronDescription } from "../lib/enrichment";
import { fetchKronFundPage } from "../lib/ingestion/kron/fetch-kron-fund";
import { MVP1_TEST_UNIVERSE } from "../lib/validation/mvp1-test-universe";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment");
  const repo = new ManagementStyleRepository(createClient(url, key, { auth: { persistSession: false } }));
  const funds = MVP1_TEST_UNIVERSE.filter((fund) => !["NO0010089485", "NO0010963432"].includes(fund.isin));
  const rows = [];
  for (const candidate of funds) {
    const fund = await repo.getFund(candidate.isin);
    if (!fund) continue;
    const page = await fetchKronFundPage(candidate.isin);
    const description = parseKronDescription(page.content, candidate.isin);
    let classification = classifyManagementStyle(description), sourceType = "KRON", sourceUrl = page.url;
    let sourceDate: string | null = null, retrievedAt = page.retrievedAt, contentHash = managementContentHash(description);
    if (classification.style === "unknown") {
      const kid = await repo.getLatestKid(fund.id);
      if (kid) {
        const fromKid = classifyManagementStyle(kid.text);
        if (fromKid.style !== "unknown") {
          classification = fromKid; sourceType = "KID"; sourceUrl = kid.sourceUrl;
          sourceDate = kid.sourceDate; retrievedAt = kid.retrievedAt; contentHash = kid.contentHash;
        }
      }
    }
    const persistence = await repo.save({ fundId: fund.id, classification, sourceType, sourceUrl, sourceDate, retrievedAt, contentHash });
    rows.push({ fundId: fund.id, isin: candidate.isin, name: fund.name, activePassive: classification.style.toUpperCase(), sourceType, sourceUrl, sourceDate, retrievedAt, contentHash, dataQuality: classification.quality, evidence: classification.evidence, persistence });
    console.log(`${candidate.isin} ${classification.style.toUpperCase()} ${sourceType} ${persistence}`);
  }
  const totals = { ACTIVE: rows.filter((row) => row.activePassive === "ACTIVE").length, PASSIVE: rows.filter((row) => row.activePassive === "PASSIVE").length, UNKNOWN: rows.filter((row) => row.activePassive === "UNKNOWN").length };
  let lowCostAfter = null;
  try {
    const filterReport = JSON.parse(await readFile("reports/filter-validation.json", "utf8"));
    lowCostAfter = filterReport.profiles.find((profile: { profile: string }) => profile.profile === "low-cost-passive")?.counts ?? null;
  } catch {}
  const report = { generatedAt: new Date().toISOString(), universeSize: rows.length, totals, targetMet: totals.ACTIVE + totals.PASSIVE >= 16, lowCostPassive: { before: { PASS: 0, FAIL: 10, UNKNOWN: 8 }, after: lowCostAfter }, funds: rows };
  const unknownRows = rows.filter((row) => row.activePassive === "UNKNOWN");
  await mkdir("reports", { recursive: true });
  await writeFile("reports/management-style-validation.json", `${JSON.stringify(report, null, 2)}\n`);
  await writeFile("reports/management-style-validation.md", [
    "# Management style validation", "", `Generated: ${report.generatedAt}`, "",
    `- ACTIVE: ${totals.ACTIVE}/18`, `- PASSIVE: ${totals.PASSIVE}/18`, `- UNKNOWN: ${totals.UNKNOWN}/18`, `- 16/18 target: ${report.targetMet ? "MET" : "NOT MET"}`, "",
    "| Fund | ISIN | Style | Source | Quality | Source date |", "|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.name} | ${row.isin} | ${row.activePassive} | [${row.sourceType}](${row.sourceUrl}) | ${row.dataQuality} | ${row.sourceDate ?? "–"} |`),
    "", "## Low-cost Passive", "", "- Before: PASS 0 / FAIL 10 / UNKNOWN 8",
    `- After: ${lowCostAfter ? `PASS ${lowCostAfter.PASS} / FAIL ${lowCostAfter.FAIL} / UNKNOWN ${lowCostAfter.UNKNOWN}` : "rerun filters after enrichment"}`,
    "", "## UNKNOWN gaps", "", ...(unknownRows.length ? unknownRows.map((row) => `- ${row.name}: no explicit source evidence`) : ["- None"]), "",
  ].join("\n"));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
