"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const steps = ["Mål", "Risiko", "Investering", "Preferanser", "Portefølje", "Oppsummering"];
const initial = {
  goal: "Langsiktig sparing",
  risk: 4,
  riskCapacity: 4,
  amount: 100000,
  monthly: 5000,
  horizon: 10,
  managementStyle: "PREFER_PASSIVE",
  costSensitivity: 4,
  maxFundWeight: 0.4,
  maxUs: true,
};

type FormState = typeof initial;
type Workflow = { id: string; status: string; current_stage: string; failed_stage: string | null; last_error: string | null };

export function ProfileWorkflowWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const key = useRef(crypto.randomUUID());

  useEffect(() => {
    fetch("/api/profile")
      .then((response) => response.ok ? response.json() : null)
      .then((profile) => {
        if (!profile?.input) return;
        const value = profile.input;
        setForm({
          goal: value.investmentGoal,
          risk: value.riskWillingness,
          riskCapacity: value.riskCapacity,
          amount: value.initialAmount,
          monthly: value.monthlyContribution,
          horizon: value.horizonYears,
          managementStyle: value.managementStyle,
          costSensitivity: value.costSensitivity,
          maxFundWeight: value.maxFundWeight,
          maxUs: value.regionMax?.region === "NORTH_AMERICA",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage("Lagrer profil og starter analyse …");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key.current },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setWorkflow(result.workflow);
      setMessage(result.workflow.status === "COMPLETED"
        ? result.inserted ? "Profil og nytt porteføljeforslag er klare." : "Profilen var uendret. Eksisterende analyse er fortsatt gyldig."
        : "Profilen er lagret, men analysen trenger oppfølging.");
      key.current = crypto.randomUUID();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profilen kunne ikke lagres.");
    } finally {
      setSaving(false);
    }
  }

  async function retry() {
    if (!workflow || saving) return;
    setSaving(true);
    setMessage("Prøver analysen på nytt …");
    const response = await fetch(`/api/workflows/${workflow.id}/retry`, { method: "POST" });
    const result = await response.json();
    setWorkflow(result);
    setMessage(result.status === "COMPLETED" ? "Analysen er fullført." : result.last_error ?? "Analysen feilet.");
    setSaving(false);
    router.refresh();
  }

  if (loading) return <section className="wizard"><div className="card wizard-card"><p>Laster profilen din …</p></div></section>;
  return <section className="wizard">
    <div className="wizard-progress"><span>Steg {step + 1} av 6</span><strong>{steps[step]}</strong><div className="steps">{steps.map((label, index) => <span key={label} className={index <= step ? "done" : ""} />)}</div></div>
    <div className="card wizard-card">
      {step === 0 && <><p className="eyebrow">Ditt mål</p><h1>Hva investerer du for?</h1><div className="choice-grid">{["Langsiktig sparing", "Pensjon", "Større kjøp"].map((goal) => <button type="button" key={goal} className={form.goal === goal ? "selected" : ""} onClick={() => setForm({ ...form, goal })}>{goal}</button>)}</div></>}
      {step === 1 && <><p className="eyebrow">Risiko</p><h1>Hvor mye risiko passer for deg?</h1><div className="form-grid"><label>Vilje: {form.risk}/7<input aria-label="Risikovilje" type="range" min="1" max="7" value={form.risk} onChange={(event) => setForm({ ...form, risk: +event.target.value })} /></label><label>Evne: {form.riskCapacity}/7<input aria-label="Risikoevne" type="range" min="1" max="7" value={form.riskCapacity} onChange={(event) => setForm({ ...form, riskCapacity: +event.target.value })} /></label></div></>}
      {step === 2 && <><p className="eyebrow">Investering</p><h1>Hvor mye vil du investere?</h1><div className="form-grid"><label>Startbeløp<input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: +event.target.value })} /></label><label>Månedlig<input type="number" value={form.monthly} onChange={(event) => setForm({ ...form, monthly: +event.target.value })} /></label><label>Horisont<input type="range" min="1" max="30" value={form.horizon} onChange={(event) => setForm({ ...form, horizon: +event.target.value })} /><span>{form.horizon} år</span></label></div></>}
      {step === 3 && <><p className="eyebrow">Preferanser</p><h1>Hva er viktig?</h1><label>Forvaltningsstil<select value={form.managementStyle} onChange={(event) => setForm({ ...form, managementStyle: event.target.value })}><option value="ANY">Ingen preferanse</option><option value="PREFER_PASSIVE">Foretrekk passiv</option><option value="ONLY_PASSIVE">Kun passiv</option><option value="PREFER_ACTIVE">Foretrekk aktiv</option><option value="ONLY_ACTIVE">Kun aktiv</option></select></label><div className="preference-row"><div><strong>USA maks 40 %</strong><small>Hard regel</small></div><input type="checkbox" checked={form.maxUs} onChange={(event) => setForm({ ...form, maxUs: event.target.checked })} /></div></>}
      {step === 4 && <><p className="eyebrow">Portefølje</p><h1>Balansert oppsett</h1><div className="form-grid"><label>Maks vekt per fond<input type="number" min="0.2" max="1" step="0.05" value={form.maxFundWeight} onChange={(event) => setForm({ ...form, maxFundWeight: +event.target.value })} /></label><label>Kostnadsfølsomhet: {form.costSensitivity}/5<input type="range" min="1" max="5" value={form.costSensitivity} onChange={(event) => setForm({ ...form, costSensitivity: +event.target.value })} /></label></div></>}
      {step === 5 && <><p className="eyebrow">Oppsummering</p><h1>Profilen din</h1><dl className="summary-list"><div><dt>Mål</dt><dd>{form.goal}</dd></div><div><dt>Horisont</dt><dd>{form.horizon} år</dd></div><div><dt>Risiko</dt><dd>{form.risk}/7</dd></div><div><dt>Hard regel</dt><dd>{form.maxUs ? "USA maks 40 %" : "Ingen"}</dd></div></dl>{workflow && <p className="calculation" role="status">Workflow: {workflow.status} · {workflow.current_stage}</p>}{message && <p className="calculation" role="status">{message}</p>}{workflow?.failed_stage && <button type="button" className="button secondary" disabled={saving} onClick={retry}>Prøv {workflow.failed_stage.toLowerCase()} på nytt</button>}</>}
      <div className="wizard-actions"><button type="button" className="button secondary" disabled={step === 0 || saving} onClick={() => setStep((value) => value - 1)}>Tilbake</button>{step < 5 ? <button type="button" className="button primary" onClick={() => setStep((value) => value + 1)}>Fortsett</button> : <button type="button" className="button primary" disabled={saving} onClick={save}>{saving ? "Analyserer …" : "Lagre og analyser"}</button>}</div>
    </div>
  </section>;
}
