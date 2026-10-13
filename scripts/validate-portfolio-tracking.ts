import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { calculatePortfolio, TrackingRepository } from "../lib/tracking";
import type { FundExposure, NavValue, TransactionInput } from "../lib/tracking";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const repo = new TrackingRepository(db);
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email: `task12-validation-${randomUUID()}@invalid.local`,
    email_confirm: true,
    password: `${randomUUID()}Aa1!`,
  });
  if (userError || !created.user) throw new Error(userError?.message ?? "User creation failed");
  let validationPortfolioId: string | null = null;
  try {
    const { data: funds, error } = await db.from("funds").select("id,isin,name,active_passive").in("isin", ["NO0011101545", "NO0012882036"]).order("isin");
    if (error || funds?.length !== 2) throw new Error(error?.message ?? "Validation funds missing");
    const { data: proposal } = await db.from("portfolio_proposals").select("id").eq("model_version", "PORTFOLIO_CONSTRUCTION_MODEL_V1_3").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const targets: Record<string, number> = {};
    if (proposal) {
      const { data: targetRows, error: targetError } = await db
        .from("portfolio_proposal_funds")
        .select("fund_id,target_weight")
        .eq("proposal_id", proposal.id);
      if (targetError) throw new Error(targetError.message);
      for (const row of targetRows ?? []) targets[row.fund_id] = Number(row.target_weight);
    }
    const portfolioId = await repo.createPortfolio(created.user.id, "Task 12 validation", "NOK", proposal?.id ?? null);
    validationPortfolioId = portfolioId;
    const navs: Record<string, NavValue | null> = {};
    const exposures: Record<string, FundExposure> = {};
    for (const fund of funds) {
      const { data: nav, error: navError } = await db.from("fund_nav_history").select("nav,nav_date,currency,content_hash").eq("fund_id", fund.id).order("nav_date", { ascending: false }).limit(1).single();
      if (navError) throw new Error(navError.message);
      navs[fund.id] = { nav: Number(nav.nav), date: nav.nav_date, currency: nav.currency, contentHash: nav.content_hash };
      const { data: dataset } = await db.from("exposure_datasets").select("id").eq("fund_id", fund.id).order("retrieved_at", { ascending: false }).limit(1).maybeSingle();
      const regions: Record<string, number> = {}, sectors: Record<string, number> = {}, assets: Record<string, number> = {}, holdings: FundExposure["holdings"] = {};
      if (dataset) {
        const [{ data: geography }, { data: sectorRows }, { data: assetRows }, { data: holdingRows }] = await Promise.all([
          db.from("fund_geography").select("region,weight").eq("dataset_id", dataset.id).not("region", "is", null),
          db.from("fund_sectors").select("sector,weight").eq("dataset_id", dataset.id),
          db.from("fund_asset_allocations").select("asset_class,weight").eq("dataset_id", dataset.id),
          db.from("fund_holdings").select("holding_identifier,holding_name,weight").eq("dataset_id", dataset.id),
        ]);
        for (const row of geography ?? []) regions[row.region] = (regions[row.region] ?? 0) + Number(row.weight) / 100;
        for (const row of sectorRows ?? []) sectors[row.sector] = Number(row.weight) / 100;
        for (const row of assetRows ?? []) assets[row.asset_class] = Number(row.weight) / 100;
        for (const row of holdingRows ?? []) holdings[row.holding_identifier ?? row.holding_name.toLowerCase()] = { name: row.holding_name, weight: Number(row.weight) / 100 };
      }
      exposures[fund.id] = { regions, sectors, assets, holdings, managementStyle: fund.active_passive };
    }
    const [a, b] = funds;
    const snapshotDate = Object.values(navs).map((x) => x!.date).sort().at(-1)!;
    const inputs: TransactionInput[] = [
      { id: "validation-buy-a1", fundId: a.id, type: "BUY", tradeDate: "2026-09-01", amount: 9000, nav: navs[a.id]!.nav * .9, units: null, currency: "NOK", fees: 10, source: "MANUAL" },
      { id: "validation-buy-a2", fundId: a.id, type: "BUY", tradeDate: "2026-09-15", amount: 5000, nav: navs[a.id]!.nav, units: null, currency: "NOK", fees: 5, source: "MANUAL" },
      { id: "validation-buy-b", fundId: b.id, type: "BUY", tradeDate: "2026-09-10", amount: 10500, nav: navs[b.id]!.nav * 1.05, units: null, currency: "NOK", fees: 10, source: "MANUAL" },
      { id: "validation-sell-a", fundId: a.id, type: "SELL", tradeDate: "2026-10-01", amount: null, nav: navs[a.id]!.nav * .95, units: 10, currency: "NOK", fees: 5, source: "MANUAL" },
    ];
    const first = []; for (const input of inputs) first.push(await repo.addTransaction(portfolioId, input));
    const second = []; for (const input of inputs) second.push(await repo.addTransaction(portfolioId, input));
    const { data: transactionToCorrect, error: correctionLookupError } = await db
      .from("transactions")
      .select("id")
      .eq("portfolio_id", portfolioId)
      .eq("client_transaction_id", inputs[0].id)
      .single();
    if (correctionLookupError) throw new Error(correctionLookupError.message);
    await repo.editTransaction(
      transactionToCorrect.id,
      { ...inputs[0], notes: "Validated correction audit trail" },
      "Task 12 correction audit validation",
    );
    const transactions = await repo.loadTransactions(portfolioId);
    const state = calculatePortfolio(transactions, navs, snapshotDate, "NOK", exposures, targets);
    const version = Object.fromEntries(Object.entries(navs).map(([id, value]) => [id, value!.contentHash]));
    const snapshotFirst = await repo.saveSnapshot(portfolioId, snapshotDate, state, version);
    const snapshotSecond = await repo.saveSnapshot(portfolioId, snapshotDate, state, version);
    const counts: Record<string, number | null> = {};
    for (const table of ["portfolios", "transactions", "transaction_revisions", "portfolio_snapshots", "portfolio_position_snapshots"]) {
      const { count } = await db.from(table).select("*", { count: "exact", head: true }); counts[table] = count;
    }
    const report = { generatedAt: new Date().toISOString(), temporaryUser: true, cleanedUp: true, peakDatabaseRows: counts, transactionCount: transactions.length, firstSaveInserted: first.reduce((s, x) => s + x.inserted, 0), secondSaveInserted: second.reduce((s, x) => s + x.inserted, 0), snapshotFirst, snapshotSecond, funds, state };
    await mkdir("reports", { recursive: true });
    await writeFile("reports/portfolio-tracking-validation.json", `${JSON.stringify(report, null, 2)}\n`);
    await writeFile("reports/portfolio-tracking-validation.md", ["# Portfolio tracking validation", "", `Generated: ${report.generatedAt}`, "", "- Temporary validation user: yes (cleaned up)", `- Linked target proposal: ${proposal?.id ?? "none"}`, `- Transactions: ${transactions.length}`, `- First/second transaction inserts: ${report.firstSaveInserted}/${report.secondSaveInserted}`, `- First/second snapshot inserts: ${snapshotFirst}/${snapshotSecond}`, `- Total invested: ${state.totalInvested.toFixed(2)} NOK`, `- Market value: ${state.marketValue?.toFixed(2) ?? "unknown"} NOK`, `- Realized P/L: ${state.realizedGainLoss.toFixed(2)} NOK`, `- Unrealized P/L: ${state.unrealizedGainLoss?.toFixed(2) ?? "unknown"} NOK`, `- Total return: ${state.totalReturnPercent === null ? "unknown" : (state.totalReturnPercent * 100).toFixed(2) + " %"}`, `- Flags: ${state.flags.join(", ") || "none"}`, "", "## Positions", "", "| Fund | Units | Avg cost | Cost basis | NAV | Freshness | Market value | Unrealized P/L | Actual | Target | Deviation |", "|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|", ...state.positions.map((position) => `| ${funds.find((fund) => fund.id === position.fundId)?.name} | ${position.units.toFixed(4)} | ${position.averageCost.toFixed(4)} | ${position.costBasis.toFixed(2)} | ${position.nav?.toFixed(4) ?? "–"} | ${position.freshness} | ${position.marketValue?.toFixed(2) ?? "–"} | ${position.unrealizedGainLoss?.toFixed(2) ?? "–"} | ${position.actualWeight === null ? "–" : (position.actualWeight * 100).toFixed(2) + " %"} | ${position.targetWeight === null ? "–" : (position.targetWeight * 100).toFixed(2) + " %"} | ${position.deviation === null ? "–" : (position.deviation * 100).toFixed(2) + " pp"} |`), "", "## Exposure", "", `- Regions: ${JSON.stringify(state.exposure.regions)}`, `- Sectors: ${JSON.stringify(state.exposure.sectors)}`, `- Assets: ${JSON.stringify(state.exposure.assets)}`, `- Management style: ${JSON.stringify(state.exposure.managementStyle)}`].join("\n") + "\n");
  } finally {
    if (validationPortfolioId) {
      const { data: transactionRows, error: transactionError } = await db
        .from("transactions")
        .select("id")
        .eq("portfolio_id", validationPortfolioId);
      if (transactionError) throw new Error(transactionError.message);
      const transactionIds = (transactionRows ?? []).map((row) => row.id);
      if (transactionIds.length) {
        const { error: revisionDeleteError } = await db
          .from("transaction_revisions")
          .delete()
          .in("transaction_id", transactionIds);
        if (revisionDeleteError) throw new Error(revisionDeleteError.message);
      }
    }
    const { error: cleanupError } = await db.auth.admin.deleteUser(created.user.id);
    if (cleanupError) throw new Error(cleanupError.message);
  }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
