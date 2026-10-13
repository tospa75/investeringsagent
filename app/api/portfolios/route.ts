import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const db = await createServerClient();
    if (!db) return NextResponse.json({ error: "Utilgjengelig" }, { status: 503 });
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
    const body = await request.json();
    const key = request.headers.get("idempotency-key");
    if (!key || !body.name?.trim()) return NextResponse.json({ error: "Ugyldig input" }, { status: 400 });
    const { data: profile } = await db.from("user_profiles").select("id,profile_version")
      .eq("user_id", user.id).order("profile_version", { ascending: false }).limit(1).maybeSingle();
    let proposalId: string | null = null;
    if (profile) {
      const { data: proposal } = await db.from("portfolio_proposals").select("id")
        .eq("user_profile_id", profile.id).eq("profile_version", profile.profile_version)
        .order("portfolio_score", { ascending: false }).limit(1).maybeSingle();
      proposalId = proposal?.id ?? null;
    }
    const values = {
      user_id: user.id,
      client_portfolio_id: key,
      name: body.name.trim(),
      base_currency: body.baseCurrency ?? "NOK",
      portfolio_proposal_id: proposalId,
    };
    const { data, error } = await db.from("portfolios").insert(values).select("id").single();
    if (!error) return NextResponse.json({ id: data.id, inserted: true }, { status: 201 });

    // The idempotency index is partial (client_portfolio_id IS NOT NULL), so
    // PostgREST cannot target it with ON CONFLICT. Resolve a duplicate by
    // returning the row created by the original request instead.
    if (error.code === "23505") {
      const { data: existing, error: lookupError } = await db.from("portfolios").select("id")
        .eq("user_id", user.id).eq("client_portfolio_id", key).maybeSingle();
      if (lookupError || !existing) throw lookupError ?? error;
      return NextResponse.json({ id: existing.id, inserted: false }, { status: 200 });
    }
    throw error;
  } catch {
    return NextResponse.json({ error: "Porteføljen kunne ikke opprettes" }, { status: 400 });
  }
}
