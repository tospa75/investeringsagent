import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "../types";
import { normalizeTransaction } from "./tracking-engine";
import type {
  NormalizedTransaction,
  PortfolioState,
  TransactionInput,
} from "./tracking-types";
import { calculatePortfolio } from "./tracking-engine";
import type { FundExposure, NavValue } from "./tracking-types";
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export class TrackingRepository {
  constructor(private readonly db: SupabaseClient) {}
  async createPortfolio(
    userId: string,
    name: string,
    baseCurrency = "NOK",
    proposalId: string | null = null,
  ) {
    const { data, error } = await this.db
      .from("portfolios")
      .insert({
        user_id: userId,
        name,
        base_currency: baseCurrency,
        portfolio_proposal_id: proposalId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }
  async addTransaction(portfolioId: string, input: TransactionInput) {
    const t = normalizeTransaction(input),
      row = {
        client_transaction_id: t.id,
        portfolio_id: portfolioId,
        fund_id: t.fundId,
        transaction_type: t.type,
        trade_date: t.tradeDate,
        settlement_date: t.settlementDate ?? null,
        amount: t.amount,
        nav: t.nav,
        units: t.units,
        currency: t.currency,
        fees: t.fees,
        source: t.source,
        notes: t.notes ?? null,
      };
    const { data, error } = await this.db
      .from("transactions")
      .upsert(row, {
        onConflict: "portfolio_id,client_transaction_id",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(error.message);
    return { inserted: data?.length ?? 0, transaction: t };
  }
  async editTransaction(
    transactionId: string,
    replacement: TransactionInput,
    reason: string,
  ) {
    if (!reason.trim()) throw new Error("A correction reason is required");
    const { data: previous, error: readError } = await this.db
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();
    if (readError) throw new Error(readError.message);
    const { data: latest, error: revisionError } = await this.db
      .from("transaction_revisions")
      .select("revision_number")
      .eq("transaction_id", transactionId)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (revisionError) throw new Error(revisionError.message);
    const t = normalizeTransaction(replacement);
    const { error: auditError } = await this.db
      .from("transaction_revisions")
      .insert({
        transaction_id: transactionId,
        revision_number: (latest?.revision_number ?? 0) + 1,
        previous_data: previous as Json,
        reason: reason.trim(),
      });
    if (auditError) throw new Error(auditError.message);
    const { error: updateError } = await this.db
      .from("transactions")
      .update({
        client_transaction_id: t.id,
        fund_id: t.fundId,
        transaction_type: t.type,
        trade_date: t.tradeDate,
        settlement_date: t.settlementDate ?? null,
        amount: t.amount,
        nav: t.nav,
        units: t.units,
        currency: t.currency,
        fees: t.fees,
        source: t.source,
        notes: t.notes ?? null,
      })
      .eq("id", transactionId);
    if (updateError) throw new Error(updateError.message);
    return t;
  }
  async loadTransactions(
    portfolioId: string,
  ): Promise<NormalizedTransaction[]> {
    const { data, error } = await this.db
      .from("transactions")
      .select(
        "client_transaction_id,fund_id,transaction_type,trade_date,settlement_date,amount,nav,units,currency,fees,source,notes",
      )
      .eq("portfolio_id", portfolioId)
      .order("trade_date")
      .order("id");
    if (error) throw new Error(error.message);
    return (data ?? []).map((x) => ({
      id: x.client_transaction_id,
      fundId: x.fund_id,
      type: x.transaction_type,
      tradeDate: x.trade_date,
      settlementDate: x.settlement_date,
      amount: Number(x.amount),
      nav: Number(x.nav),
      units: Number(x.units),
      currency: x.currency,
      fees: Number(x.fees),
      source: x.source,
      notes: x.notes,
    }));
  }
  async fetchCurrentPortfolio(
    portfolioId: string,
    navs: Record<string, NavValue | null>,
    asOf: string,
    baseCurrency: string,
    exposures: Record<string, FundExposure> = {},
    targets: Record<string, number> = {},
  ) {
    return calculatePortfolio(
      await this.loadTransactions(portfolioId),
      navs,
      asOf,
      baseCurrency,
      exposures,
      targets,
    );
  }
  async saveSnapshot(
    portfolioId: string,
    date: string,
    state: PortfolioState,
    dataVersion: Record<string, string | null>,
  ) {
    const dataHash = hash({ dataVersion, state }),
      { data, error } = await this.db
        .from("portfolio_snapshots")
        .upsert(
          {
            portfolio_id: portfolioId,
            snapshot_date: date,
            total_invested: state.totalInvested,
            market_value: state.marketValue,
            unrealized_gain_loss: state.unrealizedGainLoss,
            realized_gain_loss: state.realizedGainLoss,
            total_return_percent: state.totalReturnPercent,
            data_version: dataVersion as unknown as Json,
            data_version_hash: dataHash,
          },
          {
            onConflict: "portfolio_id,snapshot_date,data_version_hash",
            ignoreDuplicates: true,
          },
        )
        .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return 0;
    const id = data[0].id,
      { error: e } = await this.db
        .from("portfolio_position_snapshots")
        .insert(
          state.positions.map((p) => ({
            portfolio_snapshot_id: id,
            fund_id: p.fundId,
            units: p.units,
            nav: p.nav,
            nav_date: p.navDate,
            nav_freshness: p.freshness,
            market_value: p.marketValue,
            cost_basis: p.costBasis,
            unrealized_gain_loss: p.unrealizedGainLoss,
            actual_weight: p.actualWeight,
          })),
        );
    if (e) throw new Error(e.message);
    return 1;
  }
}
