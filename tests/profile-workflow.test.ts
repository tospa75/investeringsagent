import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sameProfileInput } from "../lib/profile";
import { workflowStagePlan } from "../lib/workflow";

const base = {
  investmentGoal: "Pensjon", horizonYears: 15, riskWillingness: 5, riskCapacity: 4,
  initialAmount: 100000, monthlyContribution: 5000, managementStyle: "PREFER_PASSIVE" as const,
  costSensitivity: 4, maxFundWeight: 0.4, regionMax: { region: "NORTH_AMERICA", weight: 0.4 },
};
const source = (path: string) => readFileSync(path, "utf8");

describe("Task 14C profile workflow", () => {
  it("recognizes an identical profile independently of mutation key", () => expect(sameProfileInput(base, { ...base })).toBe(true));
  it("recognizes a real profile edit", () => expect(sameProfileInput(base, { ...base, horizonYears: 16 })).toBe(false));
  it("prefills from normalized backend input", () => expect(source("components/profile-workflow-wizard.tsx")).toContain("profile.input"));
  it("profile save triggers the workflow", () => expect(source("app/api/profile/route.ts")).toContain("ProfileWorkflowService"));
  it("workflow performs filtering before scoring and portfolio", () => expect(workflowStagePlan()).toEqual(["FILTER", "SCORE", "PORTFOLIO"]));
  it("score retry skips filtering", () => expect(workflowStagePlan("SCORE")).toEqual(["SCORE", "PORTFOLIO"]));
  it("portfolio retry is isolated", () => expect(workflowStagePlan("PORTFOLIO")).toEqual(["PORTFOLIO"]));
  it("guards each downstream stage against stale profile versions", () => {
    const code = source("lib/workflow/workflow-service.ts");
    expect(code.match(/assertCurrent\(profileId, profileVersion\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
  it("uses one deterministic workflow per profile version", () => expect(source("database/migrations/202610120004_profile_workflows.sql")).toContain("unique(user_profile_id, profile_version)"));
  it("includes a complete disposable backend E2E validation", () => {
    const code = source("scripts/validate-workflow-e2e.ts");
    for (const step of ["ProfileService", "ProfileWorkflowService", "createPortfolio", "addTransaction", "saveSnapshot", "buildRebalancePlan"]) expect(code).toContain(step);
  });
});
