import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "../types";

export interface ProfileInput {
  mutationKey: string;
  investmentGoal: string;
  horizonYears: number;
  riskWillingness: number;
  riskCapacity: number;
  initialAmount: number;
  monthlyContribution: number;
  managementStyle: "ONLY_PASSIVE" | "PREFER_PASSIVE" | "ANY" | "PREFER_ACTIVE" | "ONLY_ACTIVE";
  costSensitivity: number;
  maxFundWeight: number;
  regionMax?: { region: string; weight: number } | null;
}

export interface LoadedProfile {
  id: string;
  version: number;
  input: Omit<ProfileInput, "mutationKey">;
}

const canonical = (input: Omit<ProfileInput, "mutationKey">) => JSON.stringify(input);
export const sameProfileInput = (
  left: Omit<ProfileInput, "mutationKey">,
  right: Omit<ProfileInput, "mutationKey">,
) => canonical(left) === canonical(right);

export class ProfileService {
  constructor(private db: SupabaseClient) {}

  async load(userId: string): Promise<LoadedProfile | null> {
    const { data: profile, error } = await this.db
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("profile_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) return null;
    const { data: constraints, error: constraintError } = await this.db
      .from("user_constraints")
      .select("constraint_type,dimension,value_numeric")
      .eq("user_profile_id", profile.id)
      .eq("profile_version", profile.profile_version)
      .order("priority");
    if (constraintError) throw new Error(constraintError.message);
    const region = constraints?.find((row) => row.constraint_type === "MAX_REGION_WEIGHT");
    return {
      id: profile.id,
      version: profile.profile_version,
      input: {
        investmentGoal: profile.investment_goal,
        horizonYears: Number(profile.investment_horizon_years),
        riskWillingness: profile.risk_willingness_score,
        riskCapacity: profile.risk_capacity_score,
        initialAmount: Number(profile.initial_amount),
        monthlyContribution: Number(profile.monthly_contribution),
        managementStyle: profile.management_style_preference,
        costSensitivity: profile.cost_sensitivity,
        maxFundWeight: Number(profile.max_weight_per_fund),
        regionMax: region
          ? { region: region.dimension!, weight: Number(region.value_numeric) }
          : null,
      },
    };
  }

  async save(userId: string, input: ProfileInput) {
    if (
      !input.mutationKey ||
      input.horizonYears <= 0 ||
      input.riskWillingness < 1 ||
      input.riskWillingness > 7 ||
      input.riskCapacity < 1 ||
      input.riskCapacity > 7
    ) throw new Error("Invalid profile input");

    const existing = await this.load(userId);
    if (existing) {
      const { data: duplicate, error } = await this.db
        .from("user_profile_revisions")
        .select("id")
        .eq("user_profile_id", existing.id)
        .eq("mutation_key", input.mutationKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const { mutationKey: _mutationKey, ...semanticInput } = input;
      if (duplicate || sameProfileInput(existing.input, semanticInput))
        return { id: existing.id, version: existing.version, inserted: false };
    }

    const version = (existing?.version ?? 0) + 1;
    const row = {
      user_id: userId,
      profile_name: `user-${userId}`,
      investment_horizon_years: input.horizonYears,
      investment_goal: input.investmentGoal,
      goal_flexibility: 3,
      risk_willingness_score: input.riskWillingness,
      risk_capacity_score: input.riskCapacity,
      liquidity_need_score: 2,
      initial_amount: input.initialAmount,
      monthly_contribution: input.monthlyContribution,
      investment_mode: "MONTHLY",
      account_type: "ASK",
      management_style_preference: input.managementStyle,
      cost_sensitivity: input.costSensitivity,
      currency_hedging_preference: "ANY",
      esg_importance: 3,
      target_fund_count: 4,
      max_fund_count: 6,
      max_weight_per_fund: input.maxFundWeight,
      min_weight_per_fund: 0.05,
      target_annual_return: null,
      target_end_value: null,
      tactical_view_enabled: false,
      profile_version: version,
      updated_at: new Date().toISOString(),
    };
    let profileId = existing?.id;
    if (profileId) {
      const { error } = await this.db.from("user_profiles").update(row).eq("id", profileId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await this.db.from("user_profiles").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      profileId = data.id;
    }

    const snapshot = { input: { ...input, mutationKey: undefined }, profile: row };
    const { error: revisionError } = await this.db.from("user_profile_revisions").insert({
      user_profile_id: profileId,
      profile_version: version,
      mutation_key: input.mutationKey,
      snapshot: snapshot as unknown as Json,
    });
    if (revisionError) throw new Error(revisionError.message);
    if (input.regionMax) {
      const { error } = await this.db.from("user_constraints").insert({
        user_profile_id: profileId,
        profile_version: version,
        constraint_type: "MAX_REGION_WEIGHT",
        dimension: input.regionMax.region,
        operator: "<=",
        value_numeric: input.regionMax.weight,
        is_hard: true,
        priority: 100,
      });
      if (error) throw new Error(error.message);
    }
    const { error: preferenceError } = await this.db.from("user_preferences").insert({
      user_profile_id: profileId,
      preference_version: version,
      preference_type: "MANAGEMENT_STYLE",
      dimension: null,
      target_value: null,
      preference_value: input.managementStyle,
      strength: 0.8,
    });
    if (preferenceError) throw new Error(preferenceError.message);
    const { error: portfolioPreferenceError } = await this.db.from("portfolio_preferences").insert({
      user_profile_id: profileId,
      preference_version: version,
      target_risk_proxy: (input.riskWillingness + input.riskCapacity) / 2,
      preferred_core_weight: 0.8,
      preferred_satellite_weight: 0.2,
      target_region_weights: {},
      target_sector_weights: {},
      preferred_equity_weight: null,
      preferred_fixed_income_weight: null,
      concentration_tolerance: input.maxFundWeight,
    });
    if (portfolioPreferenceError) throw new Error(portfolioPreferenceError.message);
    return { id: profileId!, version, inserted: true };
  }
}
