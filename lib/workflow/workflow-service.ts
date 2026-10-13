import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateFund, FilterRepository, validateProfile, type UserProfile } from "../filtering";
import { rankScores, scoreFund, ScoringRepository, type SoftPreference } from "../scoring";
import { constructPortfolio, PortfolioRepository, type PortfolioPreference } from "../portfolio";

export type WorkflowStage = "FILTER" | "SCORE" | "PORTFOLIO";
export const workflowStagePlan = (retryFrom?: WorkflowStage) => {
  const stages: WorkflowStage[] = ["FILTER", "SCORE", "PORTFOLIO"];
  return stages.slice(retryFrom ? stages.indexOf(retryFrom) : 0);
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class StaleWorkflowError extends Error {}

export class ProfileWorkflowService {
  constructor(private db: SupabaseClient) {}

  async ensure(profileId: string, profileVersion: number) {
    const deterministicKey = digest({ profileId, profileVersion });
    const { data, error } = await this.db.from("profile_workflows").upsert({
      user_profile_id: profileId,
      profile_version: profileVersion,
      preference_version: profileVersion,
      deterministic_key: deterministicKey,
      status: "PROFILE_SAVED",
      current_stage: "PROFILE",
    }, { onConflict: "user_profile_id,profile_version", ignoreDuplicates: true }).select("*");
    if (error) throw new Error(error.message);
    if (data?.[0]) return data[0];
    const { data: existing, error: readError } = await this.db
      .from("profile_workflows").select("*")
      .eq("user_profile_id", profileId).eq("profile_version", profileVersion).single();
    if (readError) throw new Error(readError.message);
    return existing;
  }

  async assertCurrent(profileId: string, profileVersion: number) {
    const { data, error } = await this.db.from("user_profiles").select("profile_version").eq("id", profileId).single();
    if (error) throw new Error(error.message);
    if (data.profile_version !== profileVersion)
      throw new StaleWorkflowError("A newer profile version superseded this workflow.");
  }

  private async set(workflowId: string, values: Record<string, unknown>) {
    const { error } = await this.db.from("profile_workflows").update(values).eq("id", workflowId);
    if (error) throw new Error(error.message);
  }

  private async loadProfile(profileId: string, profileVersion: number): Promise<UserProfile> {
    const [{ data: row, error }, { data: constraints, error: constraintError }] = await Promise.all([
      this.db.from("user_profiles").select("*").eq("id", profileId).single(),
      this.db.from("user_constraints").select("*").eq("user_profile_id", profileId).eq("profile_version", profileVersion),
    ]);
    if (error) throw new Error(error.message);
    if (constraintError) throw new Error(constraintError.message);
    return validateProfile({
      investmentHorizonYears: Number(row.investment_horizon_years),
      investmentGoal: row.investment_goal,
      goalFlexibility: row.goal_flexibility,
      riskWillingnessScore: row.risk_willingness_score,
      riskCapacityScore: row.risk_capacity_score,
      liquidityNeedScore: row.liquidity_need_score,
      initialAmount: Number(row.initial_amount),
      monthlyContribution: Number(row.monthly_contribution),
      investmentMode: row.investment_mode,
      accountType: row.account_type,
      managementStylePreference: row.management_style_preference,
      costSensitivity: row.cost_sensitivity,
      currencyHedgingPreference: row.currency_hedging_preference,
      esgImportance: row.esg_importance,
      targetFundCount: row.target_fund_count,
      maxFundCount: row.max_fund_count,
      maxWeightPerFund: Number(row.max_weight_per_fund),
      minWeightPerFund: Number(row.min_weight_per_fund),
      targetAnnualReturn: row.target_annual_return === null ? null : Number(row.target_annual_return),
      targetEndValue: row.target_end_value === null ? null : Number(row.target_end_value),
      tacticalViewEnabled: row.tactical_view_enabled,
      profileVersion,
      constraints: (constraints ?? []).map((item) => ({
        constraintType: item.constraint_type,
        dimension: item.dimension,
        operator: item.operator,
        valueNumeric: item.value_numeric === null ? null : Number(item.value_numeric),
        valueText: item.value_text,
        isHard: item.is_hard,
        priority: item.priority,
      })),
    });
  }

  private async loadPreferences(profileId: string, version: number): Promise<SoftPreference[]> {
    const { data, error } = await this.db.from("user_preferences").select("*")
      .eq("user_profile_id", profileId).eq("preference_version", version);
    if (error) throw new Error(error.message);
    return (data ?? []).map((item) => ({
      type: item.preference_type,
      dimension: item.dimension,
      targetValue: item.target_value === null ? null : Number(item.target_value),
      preferenceValue: item.preference_value === "PREFER_PASSIVE" ? "PASSIVE" : item.preference_value,
      strength: Number(item.strength),
    }));
  }

  private async loadPortfolioPreference(profileId: string, version: number): Promise<PortfolioPreference> {
    const { data, error } = await this.db.from("portfolio_preferences").select("*")
      .eq("user_profile_id", profileId).eq("preference_version", version).single();
    if (error) throw new Error(error.message);
    return {
      targetRiskProxy: data.target_risk_proxy === null ? null : Number(data.target_risk_proxy),
      preferredCoreWeight: data.preferred_core_weight === null ? null : Number(data.preferred_core_weight),
      preferredSatelliteWeight: data.preferred_satellite_weight === null ? null : Number(data.preferred_satellite_weight),
      targetRegionWeights: data.target_region_weights ?? {},
      targetSectorWeights: data.target_sector_weights ?? {},
      preferredEquityWeight: data.preferred_equity_weight === null ? null : Number(data.preferred_equity_weight),
      preferredFixedIncomeWeight: data.preferred_fixed_income_weight === null ? null : Number(data.preferred_fixed_income_weight),
      concentrationTolerance: data.concentration_tolerance === null ? null : Number(data.concentration_tolerance),
    };
  }

  async run(profileId: string, profileVersion: number, retryFrom?: WorkflowStage) {
    const workflow = await this.ensure(profileId, profileVersion);
    if (workflow.status === "COMPLETED" && !retryFrom) return workflow;
    const order: WorkflowStage[] = ["FILTER", "SCORE", "PORTFOLIO"];
    const start = retryFrom ? order.indexOf(retryFrom) : 0;
    await this.set(workflow.id, {
      attempt_count: workflow.attempt_count + 1,
      started_at: new Date().toISOString(),
      completed_at: null,
      failed_stage: null,
      last_error: null,
    });
    let stage = order[Math.max(0, start)];
    try {
      const profile = await this.loadProfile(profileId, profileVersion);
      let dataVersion: Record<string, unknown> = workflow.data_version ?? {};

      if (start <= 0) {
        stage = "FILTER";
        await this.assertCurrent(profileId, profileVersion);
        await this.set(workflow.id, { status: "FILTERING", current_stage: "FILTER" });
        const repository = new FilterRepository(this.db);
        const funds = (await repository.loadFunds()).filter((fund) => !["NO0010089485", "NO0010963432"].includes(fund.isin));
        const results = funds.map((fund) => evaluateFund(profile, fund));
        await repository.saveResults(profileId, results);
        dataVersion = { ...dataVersion, funds: digest(results.map((result) => result.dataVersion)) };
        await this.set(workflow.id, { data_version: dataVersion });
      }

      if (start <= 1) {
        stage = "SCORE";
        await this.assertCurrent(profileId, profileVersion);
        await this.set(workflow.id, { status: "SCORING", current_stage: "SCORE" });
        const repository = new ScoringRepository(this.db);
        const preferences = await this.loadPreferences(profileId, profileVersion);
        const funds = await repository.loadPassFunds(profileId, profileVersion);
        const peers = new Map<string, number[]>();
        for (const fund of funds) {
          const parts = [fund.managementFee, fund.platformFee, fund.transactionCost];
          const cost = fund.totalAnnualCost ?? (parts.every((value) => value === null) ? null : parts.reduce<number>((sum, value) => sum + (value ?? 0), 0));
          if (cost !== null) {
            const key = `${fund.category ?? fund.fundType ?? "unknown"}|${fund.activePassive}`;
            peers.set(key, [...(peers.get(key) ?? []), cost]);
          }
        }
        const scores = rankScores(funds.map((fund) => scoreFund(fund, {
          profile,
          preferences,
          preferenceVersion: profileVersion,
          peerCosts: peers.get(`${fund.category ?? fund.fundType ?? "unknown"}|${fund.activePassive}`) ?? [],
        })));
        for (const score of scores) await repository.save(profileId, score);
        dataVersion = { ...dataVersion, scores: digest(scores.map((score) => score.dataVersion)) };
        await this.set(workflow.id, { data_version: dataVersion });
      }

      if (start <= 2) {
        stage = "PORTFOLIO";
        await this.assertCurrent(profileId, profileVersion);
        await this.set(workflow.id, { status: "BUILDING_PORTFOLIO", current_stage: "PORTFOLIO" });
        const repository = new PortfolioRepository(this.db);
        const candidates = await repository.loadCandidates(profileId, profileVersion);
        const preferences = await this.loadPreferences(profileId, profileVersion);
        const portfolioPreference = await this.loadPortfolioPreference(profileId, profileVersion);
        let proposals = 0;
        for (const type of ["SIMPLE", "BALANCED", "OFFENSIVE"] as const) {
          const proposal = constructPortfolio(type, candidates, {
            profile,
            preferences,
            preferenceVersion: profileVersion,
            maxSatelliteAllocation: type === "SIMPLE" ? 0.2 : type === "BALANCED" ? 0.4 : 0.6,
            maxUnderlyingWeight: 0.1,
            portfolioPreference,
          });
          if (proposal) {
            await repository.save(profileId, profileVersion, profileVersion, proposal);
            proposals++;
          }
        }
        if (!proposals) throw new Error("No feasible portfolio proposal for this profile.");
        dataVersion = { ...dataVersion, portfolio: digest({ profileVersion, proposals }) };
      }

      await this.assertCurrent(profileId, profileVersion);
      await this.set(workflow.id, {
        status: "COMPLETED",
        current_stage: "COMPLETE",
        data_version: dataVersion,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      const stale = error instanceof StaleWorkflowError;
      await this.set(workflow.id, {
        status: stale || stage !== "FILTER" ? "PARTIAL" : "FAILED",
        failed_stage: stage,
        last_error: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
      });
    }
    const { data, error } = await this.db.from("profile_workflows").select("*").eq("id", workflow.id).single();
    if (error) throw new Error(error.message);
    return data;
  }
}
