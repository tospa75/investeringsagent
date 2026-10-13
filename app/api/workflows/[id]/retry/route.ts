import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { ProfileWorkflowService, type WorkflowStage } from "@/lib/workflow";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await createServerClient();
  if (!db) return NextResponse.json({ error: "Utilgjengelig" }, { status: 503 });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  const { id } = await params;
  const { data: workflow } = await db.from("profile_workflows").select("*").eq("id", id).maybeSingle();
  if (!workflow) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  const retryFrom = workflow.failed_stage as WorkflowStage | null;
  if (!retryFrom) return NextResponse.json(workflow);
  const result = await new ProfileWorkflowService(createAdminClient()).run(
    workflow.user_profile_id,
    workflow.profile_version,
    retryFrom,
  );
  return NextResponse.json(result);
}
