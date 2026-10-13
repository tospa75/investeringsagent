import { NextResponse } from "next/server";
import { ProfileService } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { ProfileWorkflowService } from "@/lib/workflow";

export async function GET() {
  const db = await createServerClient();
  if (!db) return NextResponse.json({ error: "Utilgjengelig" }, { status: 503 });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  return NextResponse.json(await new ProfileService(db).load(user.id));
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
    const result = await new ProfileService(db).save(user.id, {
      mutationKey: key,
      investmentGoal: body.goal,
      horizonYears: body.horizon,
      riskWillingness: body.risk,
      riskCapacity: body.riskCapacity ?? body.risk,
      initialAmount: body.amount,
      monthlyContribution: body.monthly,
      managementStyle: body.managementStyle ?? (body.passive ? "PREFER_PASSIVE" : "ANY"),
      costSensitivity: body.costSensitivity ?? 4,
      maxFundWeight: body.maxFundWeight ?? 0.4,
      regionMax: body.maxUs ? { region: "NORTH_AMERICA", weight: 0.4 } : null,
    });
    const workflow = await new ProfileWorkflowService(createAdminClient()).run(result.id, result.version);
    return NextResponse.json({ ...result, workflow }, { status: result.inserted ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profilen kunne ikke lagres" }, { status: 400 });
  }
}
