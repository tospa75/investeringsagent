import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await createServerClient();
  if (!db) return NextResponse.json({ error: "Utilgjengelig" }, { status: 503 });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  const { id } = await params;
  const { data, error } = await db.from("profile_workflows").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  return NextResponse.json(data);
}
