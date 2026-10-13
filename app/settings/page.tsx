import Link from "next/link";
import { LogoutButton } from "@/components/forms";
import { EmptyState, StatusBadge } from "@/components/ui";
import { loadDashboard, loadProfile, loadProposal, loadWorkflow } from "@/lib/ui/loaders";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const [profile, dashboard, workflow, proposal] = await Promise.all([
    loadProfile(), loadDashboard(), loadWorkflow(), loadProposal(),
  ]);
  return <div className="page">
    <header className="page-header"><div><p className="eyebrow">Innstillinger</p><h1>Profil og data</h1></div></header>
    <div className="settings-grid">
      {profile ? <section className="card settings-card"><div className="settings-icon">◎</div><div><h2>Investeringsprofil</h2><p>Risiko {profile.risk_willingness_score}/7 · {profile.investment_horizon_years} års horisont · versjon {profile.profile_version}</p><p>Siste analyse: {workflow?.completed_at ? new Date(workflow.completed_at).toLocaleString("nb-NO") : "Ikke fullført"}</p><p>Fondmodell: {proposal?.score_model_version ?? "–"} · porteføljemodell: {proposal?.model_version ?? "–"}</p><StatusBadge tone={workflow?.status === "COMPLETED" ? "success" : workflow?.status === "FAILED" ? "critical" : "neutral"}>{workflow?.status ?? "INGEN ANALYSE"}</StatusBadge><br /><Link href="/onboarding" className="text-link">Rediger profil →</Link></div></section> : <EmptyState title="Ingen profil" text="Opprett investeringsprofilen din." href="/onboarding" action="Start" />}
      {dashboard?.portfolio ? <section className="card settings-card"><div className="settings-icon">▥</div><div><h2>{dashboard.portfolio.name}</h2><p>{dashboard.transactions.length} transaksjoner</p><Link href="/portfolio" className="text-link">Se porteføljen →</Link></div></section> : <EmptyState title="Ingen portefølje" text="Opprett din første portefølje." href="/portfolio/new" action="Opprett" />}
    </div>
    <section className="card session-card"><div><h2>Innlogget økt</h2><p>Økten lagres sikkert i nettleseren.</p></div><StatusBadge tone="success">Aktiv</StatusBadge><LogoutButton /></section>
  </div>;
}
