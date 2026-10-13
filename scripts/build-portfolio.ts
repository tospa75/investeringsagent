import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { STANDARD_PROFILES, validateProfile } from "../lib/filtering";
import {
  constructPortfolio,
  PortfolioRepository,
  PORTFOLIO_MODEL_VERSION,
  PORTFOLIO_PREFERENCE_VERSION,
  STANDARD_PORTFOLIO_PREFERENCES,
  type PortfolioProposal,
} from "../lib/portfolio";
import {
  PREFERENCE_VERSION,
  SCORE_MODEL_VERSION,
  STANDARD_SOFT_PREFERENCES,
} from "../lib/scoring";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment");
  const args = process.argv.slice(2),
    requested = args[args.indexOf("--profile") + 1],
    names =
      args.includes("--all-profiles") || !requested
        ? ["balanced", "aggressive", "europe-asia-tilt", "low-cost-passive"]
        : [requested];
  if (names.some((x) => !STANDARD_PROFILES[x]))
    throw new Error(`Unknown profile: ${requested}`);
  const db = createClient(url, key, { auth: { persistSession: false } }),
    repo = new PortfolioRepository(db),
    reports = [];
  for (const name of names) {
    const profile = validateProfile(STANDARD_PROFILES[name]),
      { data: p, error } = await db
        .from("user_profiles")
        .select("id,profile_version")
        .eq("profile_name", name)
        .single();
    if (error) throw new Error(error.message);
    const portfolioPreference = STANDARD_PORTFOLIO_PREFERENCES[name];
    if (!portfolioPreference) throw new Error(`Missing portfolio preference: ${name}`);
    const preferenceRows = await repo.savePreference(
      p.id,
      PORTFOLIO_PREFERENCE_VERSION,
      portfolioPreference,
    );
    const candidates = await repo.loadCandidates(p.id, p.profile_version),
      proposals: Array<PortfolioProposal & { inserted: number }> = [],
      diagnostics: string[] = [];
    for (const type of ["SIMPLE", "BALANCED", "OFFENSIVE"] as const) {
      const proposal = constructPortfolio(type, candidates, {
        profile,
        preferences: STANDARD_SOFT_PREFERENCES[name] ?? [],
        preferenceVersion: PREFERENCE_VERSION,
        maxSatelliteAllocation:
          type === "SIMPLE" ? 0.2 : type === "BALANCED" ? 0.4 : 0.6,
        maxUnderlyingWeight: 0.1,
        portfolioPreference,
      });
      if (!proposal && type === "SIMPLE")
        diagnostics.push("INFEASIBLE_BY_WEIGHT_BOUNDS");
      if (proposal) {
        const signature = proposal.funds
          .map((x) => `${x.fund.id}:${x.weight}`)
          .sort()
          .join("|");
        if (name === "aggressive") {
          const balanced = reports.find((report) => report.profile === "balanced");
          const balancedSignature = balanced?.proposals[0]?.funds
            .map((x) => `${x.fund.id}:${x.weight}`)
            .sort()
            .join("|");
          if (balancedSignature === signature)
            proposal.diagnostics.push(
              "BALANCED_AGGRESSIVE_IDENTICAL_NO_POSITIVE_MARGINAL_ALTERNATIVE",
            );
        }
        const duplicate = proposals.some(
          (existing) =>
            existing.funds
              .map((x) => `${x.fund.id}:${x.weight}`)
              .sort()
              .join("|") === signature,
        );
        if (duplicate) {
          diagnostics.push(`DUPLICATE_ALTERNATIVE_SUPPRESSED:${type}`);
          continue;
        }
        const inserted = await repo.save(
          p.id,
          p.profile_version,
          PREFERENCE_VERSION,
          proposal,
        );
        proposals.push({ ...proposal, inserted });
      }
    }
    reports.push({
      profile: name,
      profileId: p.id,
      profileVersion: p.profile_version,
      candidateCount: candidates.length,
      preferenceRows,
      diagnostics,
      proposals,
    });
    console.log(`\n${name}: ${proposals.length} proposals`);
    for (const p of proposals)
      console.log(
        `${p.type} ${p.totalScore.toFixed(1)} ${p.confidence} cost ${p.metrics.weightedCost === null ? "n/a" : (p.metrics.weightedCost * 100).toFixed(2) + "%"} | ${p.funds.map((x) => `${x.fund.name} ${(x.weight * 100).toFixed(1)}% ${x.role}`).join("; ")}`,
      );
  }
  const report = {
    generatedAt: new Date().toISOString(),
    modelVersion: PORTFOLIO_MODEL_VERSION,
    scoreModelVersion: SCORE_MODEL_VERSION,
    preferenceVersion: PREFERENCE_VERSION,
    profiles: reports,
  };
  await mkdir("reports", { recursive: true });
  await writeFile(
    "reports/portfolio-construction-validation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    "reports/portfolio-construction-validation.md",
    [
      "# Portfolio construction validation",
      "",
      `Generated: ${report.generatedAt}`,
      `Model: ${PORTFOLIO_MODEL_VERSION}`,
      "",
      ...reports.flatMap((r) => [
        `## ${r.profile}`,
        "",
        `- Candidates: ${r.candidateCount}`,
        `- Proposals: ${r.proposals.length}`,
        `- Diagnostics: ${r.diagnostics.join(", ") || "none"}`,
        ...(r.proposals.length
          ? []
          : [
              "- No feasible proposal within fund-count/weight/role constraints.",
            ]),
        "",
        ...r.proposals.flatMap((p) => [
          `### ${p.type}`,
          "",
          `- Portfolio score: ${p.totalScore.toFixed(1)}`,
          `- Confidence: ${p.confidence}`,
          `- New row: ${p.inserted}`,
          `- Weighted cost: ${p.metrics.weightedCost === null ? "n/a" : (p.metrics.weightedCost * 100).toFixed(3) + " %"}`,
          `- Average documented overlap: ${(p.metrics.averageOverlap * 100).toFixed(1)} % (${p.metrics.overlapConfidence})`,
          `- Risk proxy: ${p.metrics.weightedRisk ?? "n/a"}`,
          `- Satellite allocation: ${(p.metrics.satelliteAllocation * 100).toFixed(1)} %`,
          `- Flags: ${p.metrics.flags.join(", ") || "none"}`,
          `- Proposal diagnostics: ${p.diagnostics.join(", ") || "none"}`,
          `- Unmet preferences: ${p.unmetPreferences.map((x) => `${x.code}: ${x.reason}`).join("; ") || "none"}`,
          "",
          "| Fund | Weight | Role | Fund score | Marginal contribution |",
          "|---|---:|---|---:|---:|",
          ...p.funds.map(
            (x) =>
              `| ${x.fund.name} | ${(x.weight * 100).toFixed(1)} % | ${x.role} | ${x.fund.fundScore.toFixed(1)} | ${x.marginalContribution.toFixed(2)} |`,
          ),
          "",
          "Top regions: " +
            Object.entries(p.metrics.regions)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
              .join(", "),
          "",
          "Top sectors: " +
            Object.entries(p.metrics.sectors)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
              .join(", "),
          "",
          "Top holdings: " +
            p.metrics.topHoldings
              .slice(0, 10)
              .map((x) => `${x.name} ${(x.weight * 100).toFixed(2)}%`)
              .join(", "),
          "",
        ]),
      ]),
    ].join("\n"),
  );
}
void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
