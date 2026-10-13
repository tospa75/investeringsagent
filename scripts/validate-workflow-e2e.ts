import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ProfileService } from "../lib/profile";
import { ProfileWorkflowService } from "../lib/workflow";
import { TrackingRepository } from "../lib/tracking";
import { buildRebalancePlan, RebalancingRepository } from "../lib/rebalancing";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !publishable) throw new Error("Missing Supabase environment");
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const password = `${randomUUID()}Aa1!`;
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: `task14c-${randomUUID()}@invalid.local`, password, email_confirm: true,
  });
  if (userError || !created.user) throw new Error(userError?.message ?? "User creation failed");
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  try {
    const { error: loginError } = await client.auth.signInWithPassword({ email: created.user.email!, password });
    if (loginError) throw loginError;
    const profileService = new ProfileService(client);
    const input = {
      mutationKey: "task14c-profile-v1", investmentGoal: "E2E", horizonYears: 15,
      riskWillingness: 6, riskCapacity: 6, initialAmount: 100000, monthlyContribution: 5000,
      managementStyle: "ANY" as const, costSensitivity: 4, maxFundWeight: 0.4, regionMax: null,
    };
    const profileV1 = await profileService.save(created.user.id, input);
    const identical = await profileService.save(created.user.id, { ...input, mutationKey: "task14c-identical" });
    if (!profileV1.inserted || identical.inserted) throw new Error("Semantic profile idempotence failed");

    const workflowService = new ProfileWorkflowService(admin);
    const workflowV1 = await workflowService.run(profileV1.id, profileV1.version);
    if (workflowV1.status !== "COMPLETED") throw new Error(`Workflow failed: ${workflowV1.last_error}`);
    const duplicateWorkflow = await workflowService.run(profileV1.id, profileV1.version);
    if (duplicateWorkflow.id !== workflowV1.id) throw new Error("Duplicate workflow created");

    const profileV2 = await profileService.save(created.user.id, { ...input, mutationKey: "task14c-profile-v2", horizonYears: 16 });
    const workflowV2 = await workflowService.run(profileV2.id, profileV2.version);
    if (workflowV2.status !== "COMPLETED") throw new Error(`V2 workflow failed: ${workflowV2.last_error}`);
    const stale = await workflowService.run(profileV1.id, profileV1.version, "FILTER");
    if (stale.status !== "PARTIAL" || !String(stale.last_error).includes("superseded")) throw new Error("Stale workflow guard failed");

    const { data: proposal, error: proposalError } = await admin.from("portfolio_proposals").select("*")
      .eq("user_profile_id", profileV2.id).eq("profile_version", profileV2.version)
      .order("portfolio_score", { ascending: false }).limit(1).single();
    if (proposalError) throw proposalError;
    const { data: targets, error: targetError } = await admin.from("portfolio_proposal_funds").select("fund_id,target_weight,role")
      .eq("proposal_id", proposal.id);
    if (targetError || !targets?.length) throw new Error(targetError?.message ?? "Proposal targets missing");

    const tracking = new TrackingRepository(client);
    const portfolioId = await tracking.createPortfolio(created.user.id, "Task 14C E2E", "NOK", proposal.id);
    const target = targets[0];
    const { data: nav, error: navError } = await admin.from("fund_nav_history").select("nav,nav_date,currency,content_hash")
      .eq("fund_id", target.fund_id).order("nav_date", { ascending: false }).limit(1).single();
    if (navError) throw navError;
    const transaction = await tracking.addTransaction(portfolioId, {
      id: "task14c-buy", fundId: target.fund_id, type: "BUY", tradeDate: nav.nav_date,
      amount: 10000, nav: Number(nav.nav), units: null, currency: nav.currency, fees: 0, source: "MANUAL",
    });
    const state = await tracking.fetchCurrentPortfolio(portfolioId, {
      [target.fund_id]: { nav: Number(nav.nav), date: nav.nav_date, currency: nav.currency, contentHash: nav.content_hash },
    }, nav.nav_date, "NOK", {}, Object.fromEntries(targets.map((row) => [row.fund_id, Number(row.target_weight)])));
    const snapshotInserted = await new TrackingRepository(admin).saveSnapshot(portfolioId, nav.nav_date, state, { [target.fund_id]: nav.content_hash });

    const monitoringInput = {
      positions: state.positions.map((position) => ({
        fundId: position.fundId, name: position.fundId, marketValue: position.marketValue,
        actualWeight: position.actualWeight, nav: position.nav, navFreshness: position.freshness,
        dataQuality: "HIGH" as const, available: true, documentValid: true, annualCost: null,
      })),
      targets: targets.map((row) => ({ fundId: row.fund_id, weight: Number(row.target_weight), role: row.role === "CORE" ? "CORE" as const : "SATELLITE" as const })),
      newCashAmount: 0,
      settings: { absoluteThreshold: 0.05, relativeThreshold: 0.2, minimumTradeAmount: 500, minimumWeightImpact: 0.005, avoidRealization: false, maxFundWeight: 0.65, transactionCostRate: 0.001 },
      targetModelVersion: proposal.model_version,
      currentDataVersion: { snapshot: nav.content_hash, proposal: proposal.data_version },
    };
    const plan = buildRebalancePlan(monitoringInput);
    const rebalancing = new RebalancingRepository(admin);
    const savedPlan = await rebalancing.savePlan(portfolioId, monitoringInput, plan);
    const eventsInserted = await rebalancing.saveMonitoringEvents(portfolioId, plan);

    const counts: Record<string, number | null> = {};
    for (const table of ["user_profile_revisions", "profile_workflows", "fund_filter_results", "fund_scores", "portfolio_proposals", "portfolios", "transactions", "portfolio_snapshots", "rebalance_plans"]) {
      const column = table === "portfolios" ? "user_id" : table === "user_profile_revisions" || table === "profile_workflows" || table === "fund_filter_results" || table === "fund_scores" || table === "portfolio_proposals" ? "user_profile_id" : null;
      const value = column === "user_id" ? created.user.id : profileV1.id;
      const query = admin.from(table).select("*", { count: "exact", head: true });
      const { count } = column ? await query.eq(column, value) : { count: null };
      counts[table] = count;
    }
    console.log(JSON.stringify({
      status: "PASS", profileV1, identical, profileV2,
      workflows: { first: workflowV1.status, duplicateId: duplicateWorkflow.id === workflowV1.id, second: workflowV2.status, stale: stale.status },
      proposal: { id: proposal.id, funds: targets.length }, transaction: transaction.inserted,
      snapshotInserted, rebalancePlanInserted: savedPlan.inserted, eventsInserted, counts,
    }, null, 2));
  } finally {
    const { error } = await admin.auth.admin.deleteUser(created.user.id);
    if (error) throw new Error(`Cleanup failed: ${error.message}`);
  }
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
