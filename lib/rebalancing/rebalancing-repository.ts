import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "../types";
import type { PortfolioMonitoringInput, RebalancePlan } from "./rebalancing-types";

const eventKey = (event: RebalancePlan["monitoringEvents"][number]) => createHash("sha256").update(JSON.stringify([event.eventType, event.fundId ?? null, event.message])).digest("hex");

export class RebalancingRepository {
  constructor(private readonly db: SupabaseClient) {}
  async savePlan(portfolioId: string, input: PortfolioMonitoringInput, plan: RebalancePlan) {
    const { data, error } = await this.db.from("rebalance_plans").upsert({
      portfolio_id: portfolioId,
      deterministic_key: plan.deterministicKey,
      status: plan.status,
      confidence: plan.confidence,
      target_model_version: plan.targetModelVersion,
      current_data_version: plan.currentDataVersion as Json,
      settings: input.settings as unknown as Json,
      new_cash_amount: input.newCashAmount,
      drift_score: plan.driftScore,
      total_turnover: plan.totalTurnover,
      estimated_cost: plan.estimatedCost,
      warnings: plan.warnings as unknown as Json,
    }, { onConflict: "portfolio_id,deterministic_key", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return { inserted: 0, planId: null };
    const planId = data[0].id;
    if (plan.actions.length) {
      const { error: actionError } = await this.db.from("rebalance_plan_actions").insert(plan.actions.map((action) => ({ rebalance_plan_id: planId, fund_id: action.fundId, action_type: action.actionType, amount: action.amount, estimated_units: action.estimatedUnits, reason: action.reason, priority: action.priority, confidence: action.confidence })));
      if (actionError) throw new Error(actionError.message);
    }
    return { inserted: 1, planId };
  }
  async saveMonitoringEvents(portfolioId: string, plan: RebalancePlan) {
    let inserted = 0;
    for (const event of plan.monitoringEvents) {
      const { data, error } = await this.db.from("portfolio_monitoring_events").upsert({ portfolio_id: portfolioId, event_key: eventKey(event), event_type: event.eventType, severity: event.severity, fund_id: event.fundId ?? null, message: event.message, data_version: event.dataVersion as Json }, { onConflict: "portfolio_id,event_key", ignoreDuplicates: true }).select("id");
      if (error) {
        if (error.code === "23505") continue;
        throw new Error(error.message);
      }
      inserted += data?.length ?? 0;
    }
    return inserted;
  }
}
