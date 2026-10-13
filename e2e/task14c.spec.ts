import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { persistSession: false } });
let userId = "", email = "", password = "";

test.beforeEach(async () => {
  email = `task14c-browser-${randomUUID()}@invalid.local`;
  password = `${randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error;
  userId = data.user.id;
});
test.afterEach(async () => { if (userId) await admin.auth.admin.deleteUser(userId); });

test("complete automatic profile-to-portfolio flow", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/onboarding");
  for (let index = 0; index < 5; index++) await page.getByRole("button", { name: "Fortsett" }).click();
  await page.getByRole("button", { name: "Lagre og analyser" }).click();
  await expect(page.getByText(/Profil og nytt porteføljeforslag er klare/)).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/Workflow: COMPLETED/)).toBeVisible();

  await page.goto("/onboarding");
  await expect(page.getByText("Langsiktig sparing")).toBeVisible();
  await page.getByRole("button", { name: "Fortsett" }).click();
  await page.getByLabel("Risikovilje").fill("6");
  for (let index = 0; index < 4; index++) await page.getByRole("button", { name: "Fortsett" }).click();
  await page.getByRole("button", { name: "Lagre og analyser" }).click();
  await expect(page.getByText(/Workflow: COMPLETED/)).toBeVisible({ timeout: 120000 });

  await page.goto("/analysis");
  await expect(page.getByRole("heading", { name: "Fond og porteføljeforslag" })).toBeVisible();
  await page.goto("/proposals");
  await expect(page.getByText("Målvekter")).toBeVisible();

  await page.goto("/portfolio/new");
  await page.getByLabel("Navn").fill("E2E-portefølje");
  await page.getByRole("button", { name: "Opprett portefølje" }).click();
  await expect(page.getByText("Porteføljen er opprettet")).toBeVisible();
  const { data: portfolio } = await admin.from("portfolios").select("id,portfolio_proposal_id").eq("user_id", userId).single();
  if (!portfolio?.portfolio_proposal_id) throw new Error("Portfolio was not linked to current proposal");
  const { data: target } = await admin.from("portfolio_proposal_funds").select("fund_id").eq("proposal_id", portfolio.portfolio_proposal_id).limit(1).single();
  const { data: nav } = await admin.from("fund_nav_history").select("nav").eq("fund_id", target!.fund_id).order("nav_date", { ascending: false }).limit(1).single();

  await page.goto("/transactions");
  await page.getByLabel("Fond").selectOption(target!.fund_id);
  await page.getByLabel("Beløp (NOK)").fill("10000");
  await page.getByLabel("NAV/kurs").fill(String(nav!.nav));
  await page.getByRole("button", { name: /Registrer kjøp/ }).click();
  await expect(page.getByText("Transaksjonen er registrert")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("E2E-portefølje")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Logg ut" }).click();
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await page.goto("/transactions");
  await expect(page.getByText("10 000 kr")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) < 500)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
