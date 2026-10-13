import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackingRepository } from "@/lib/tracking";
import type { NavValue } from "@/lib/tracking";

async function refreshSnapshot(
  db: NonNullable<Awaited<ReturnType<typeof createServerClient>>>,
  repository: TrackingRepository,
  portfolio: { id: string; base_currency: string; portfolio_proposal_id: string | null },
) {
  const transactions = await repository.loadTransactions(portfolio.id);
  const fundIds = [...new Set(transactions.map((transaction) => transaction.fundId))];
  if (!fundIds.length) return 0;

  const { data: navRows, error: navError } = await db
    .from("fund_nav_history")
    .select("fund_id,nav,nav_date,currency,content_hash")
    .in("fund_id", fundIds)
    .order("nav_date", { ascending: false });
  if (navError) throw new Error(navError.message);
  const navs: Record<string, NavValue | null> = Object.fromEntries(
    fundIds.map((fundId) => [fundId, null]),
  );
  for (const row of navRows ?? []) {
    if (navs[row.fund_id]) continue;
    navs[row.fund_id] = {
      nav: Number(row.nav),
      date: row.nav_date,
      currency: row.currency,
      contentHash: row.content_hash,
    };
  }

  const targets: Record<string, number> = {};
  if (portfolio.portfolio_proposal_id) {
    const { data: targetRows, error: targetError } = await db
      .from("portfolio_proposal_funds")
      .select("fund_id,target_weight")
      .eq("proposal_id", portfolio.portfolio_proposal_id);
    if (targetError) throw new Error(targetError.message);
    for (const row of targetRows ?? []) targets[row.fund_id] = Number(row.target_weight);
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const state = await repository.fetchCurrentPortfolio(
    portfolio.id,
    navs,
    snapshotDate,
    portfolio.base_currency,
    {},
    targets,
  );
  const dataVersion = Object.fromEntries(
    Object.entries(navs).map(([fundId, nav]) => [fundId, nav?.contentHash ?? null]),
  );
  return repository.saveSnapshot(portfolio.id, snapshotDate, state, dataVersion);
}

export async function POST(request: Request) {
  try {
    const db = await createServerClient();
    if (!db) return NextResponse.json({ error: "Utilgjengelig" }, { status: 503 });
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
    const body = await request.json();
    const key = request.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Mangler idempotensnøkkel" }, { status: 400 });
    const { data: portfolio } = await db
      .from("portfolios")
      .select("id,base_currency,portfolio_proposal_id")
      .eq("id", body.portfolioId)
      .single();
    if (!portfolio) return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 });

    const repository = new TrackingRepository(db);
    const result = await repository.addTransaction(body.portfolioId, {
      id: key,
      fundId: body.fundId,
      type: body.type,
      tradeDate: body.tradeDate,
      amount: body.amount,
      nav: body.nav,
      units: body.units,
      currency: "NOK",
      fees: body.fees ?? 0,
      source: "MANUAL",
      notes: body.notes ?? null,
    });
    const admin = createAdminClient();
    const snapshotsInserted = await refreshSnapshot(
      admin,
      new TrackingRepository(admin),
      portfolio,
    );
    return NextResponse.json({ ...result, snapshotsInserted }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Transaksjonen er ugyldig" }, { status: 400 });
  }
}
