import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "../types";
import { SCORE_MODEL_VERSION, ScoringRepository } from "../scoring";
import { PORTFOLIO_MODEL_VERSION } from "./portfolio-engine";
import type { PortfolioFund, PortfolioProposal } from "./portfolio-types";
import type { PortfolioPreference } from "./portfolio-preferences";
const hash = (v: unknown) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex"),
  norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export class PortfolioRepository {
  constructor(private readonly db: SupabaseClient) {}
  async savePreference(
    profileId: string,
    version: number,
    preference: PortfolioPreference,
  ) {
    const { data, error } = await this.db
      .from("portfolio_preferences")
      .upsert(
        {
          user_profile_id: profileId,
          preference_version: version,
          target_risk_proxy: preference.targetRiskProxy,
          preferred_core_weight: preference.preferredCoreWeight,
          preferred_satellite_weight: preference.preferredSatelliteWeight,
          target_region_weights: preference.targetRegionWeights,
          target_sector_weights: preference.targetSectorWeights,
          preferred_equity_weight: preference.preferredEquityWeight,
          preferred_fixed_income_weight: preference.preferredFixedIncomeWeight,
          concentration_tolerance: preference.concentrationTolerance,
        },
        { onConflict: "user_profile_id,preference_version", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  }
  async loadCandidates(
    profileId: string,
    profileVersion: number,
  ): Promise<PortfolioFund[]> {
    const base = await new ScoringRepository(this.db).loadPassFunds(
        profileId,
        profileVersion,
      ),
      { data: scores, error } = await this.db
        .from("fund_scores")
        .select(
          "fund_id,total_score,risk_score,quality_score,score_confidence,data_version,calculated_at",
        )
        .eq("user_profile_id", profileId)
        .eq("profile_version", profileVersion)
        .eq("score_model_version", SCORE_MODEL_VERSION)
        .order("calculated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const latest = new Map<string, any>();
    for (const s of scores ?? [])
      if (!latest.has(s.fund_id)) latest.set(s.fund_id, s);
    const out: PortfolioFund[] = [];
    for (const f of base) {
      const score = latest.get(f.id);
      if (!score) continue;
      const { data: dataset } = await this.db
        .from("exposure_datasets")
        .select("id,quality_status")
        .eq("fund_id", f.id)
        .order("retrieved_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let assets: Record<string, number> = {},
        holdings: PortfolioFund["holdings"] = {};
      if (dataset) {
        const [{ data: a }, { data: h }] = await Promise.all([
          this.db
            .from("fund_asset_allocations")
            .select("asset_class,weight")
            .eq("dataset_id", dataset.id),
          this.db
            .from("fund_holdings")
            .select("holding_identifier,holding_name,weight")
            .eq("dataset_id", dataset.id),
        ]);
        assets = Object.fromEntries(
          (a ?? []).map((x) => [x.asset_class, Number(x.weight) / 100]),
        );
        holdings = Object.fromEntries(
          (h ?? []).map((x) => [
            x.holding_identifier
              ? `id:${x.holding_identifier}`
              : `name:${norm(x.holding_name)}`,
            { name: x.holding_name, weight: Number(x.weight) / 100 },
          ]),
        );
      }
      const parts = [f.managementFee, f.platformFee, f.transactionCost],
        annual =
          f.totalAnnualCost ??
          (parts.some((x) => x !== null)
            ? parts.reduce<number>((s, x) => s + (x ?? 0), 0)
            : null),
        costConfidence =
          f.totalAnnualCost !== null
            ? "HIGH"
            : parts.every((x) => x !== null)
              ? "MEDIUM"
              : annual !== null
                ? "LOW"
                : "LOW";
      out.push({
        id: f.id,
        isin: f.isin,
        name: f.name,
        category: f.category,
        fundScore: Number(score.total_score),
        fundConfidence: score.score_confidence,
        riskScore: Number(score.risk_score),
        qualityScore: Number(score.quality_score),
        activePassive: f.activePassive,
        annualCost: annual,
        costConfidence,
        priipRisk: f.priipRiskScore,
        volatility: f.volatility3y ?? f.volatility1y,
        regions: f.regions ?? {},
        countries: f.countries ?? {},
        sectors: f.sectors ?? {},
        assets,
        holdings,
        exposureQuality: f.dataQuality,
        dataVersion: score.data_version,
      });
    }
    return out;
  }
  async save(
    profileId: string,
    profileVersion: number,
    preferenceVersion: number,
    p: PortfolioProposal,
  ) {
    const dataHash = hash(p.dataVersion),
      row = {
        user_profile_id: profileId,
        proposal_type: p.type,
        portfolio_score: p.totalScore,
        risk_score: p.scores.risk,
        diversification_score: p.scores.diversification,
        preference_score: p.scores.preference,
        cost_score: p.scores.cost,
        robustness_score: p.scores.robustness,
        simplicity_score: p.scores.simplicity,
        portfolio_confidence: p.confidence,
        metrics: p.metrics as unknown as Json,
        explanations: p.explanations as unknown as Json,
        unmet_preferences: p.unmetPreferences as unknown as Json,
        diagnostics: p.diagnostics as unknown as Json,
        model_version: PORTFOLIO_MODEL_VERSION,
        score_model_version: SCORE_MODEL_VERSION,
        profile_version: profileVersion,
        preference_version: preferenceVersion,
        data_version: p.dataVersion as unknown as Json,
        data_version_hash: dataHash,
        calculated_at: new Date().toISOString(),
      };
    const { data, error } = await this.db
      .from("portfolio_proposals")
      .upsert(row, {
        onConflict:
          "user_profile_id,proposal_type,model_version,score_model_version,profile_version,preference_version,data_version_hash",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) {
      const { error: updateError } = await this.db
        .from("portfolio_proposals")
        .update({
          unmet_preferences: p.unmetPreferences as unknown as Json,
          diagnostics: p.diagnostics as unknown as Json,
        })
        .eq("user_profile_id", profileId)
        .eq("proposal_type", p.type)
        .eq("model_version", PORTFOLIO_MODEL_VERSION)
        .eq("score_model_version", SCORE_MODEL_VERSION)
        .eq("profile_version", profileVersion)
        .eq("preference_version", preferenceVersion)
        .eq("data_version_hash", dataHash);
      if (updateError) throw new Error(updateError.message);
      return 0;
    }
    const proposalId = data[0].id,
      { error: e } = await this.db
        .from("portfolio_proposal_funds")
        .insert(
          p.funds.map((x) => ({
            proposal_id: proposalId,
            fund_id: x.fund.id,
            target_weight: x.weight,
            role: x.role,
            fund_score: x.fund.fundScore,
            marginal_contribution: x.marginalContribution,
            explanation: x.explanation,
          })),
        );
    if (e) throw new Error(e.message);
    return 1;
  }
}
