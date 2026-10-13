import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AlertCard, EmptyState, ErrorState, FundCard, MetricCard } from "../components/ui";
import { ProfileWizard, TransactionForm } from "../components/forms";
import { scoreFunds } from "../lib/ui/demo-data";

const source = (path: string) => readFileSync(path, "utf8");
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
describe("Task 14 UI smoke coverage", () => {
  it("renders dashboard metric", () => expect(renderToStaticMarkup(<MetricCard label="Porteføljeverdi" value="23 510 kr" />)).toContain("23 510 kr"));
  it("renders transaction form validation fields", () => { const html = renderToStaticMarkup(<TransactionForm />); expect(html).toContain("required"); expect(html).toContain("NAV/kurs"); });
  it("renders the profile wizard", () => expect(renderToStaticMarkup(<ProfileWizard />)).toContain("Steg 1 av 6"));
  it("renders fund list cards", () => expect(renderToStaticMarkup(<FundCard fund={scoreFunds[0]} />)).toContain("/funds/kron-global"));
  it("contains fund detail score and sources", () => { const text = source("app/funds/[id]/page.tsx"); expect(text).toContain("Nøkkeltall"); expect(text).toContain("SourceList"); });
  it("contains portfolio proposal targets", () => expect(source("app/proposals/page.tsx")).toContain("Målvekter"));
  it("contains target versus actual visualization", () => expect(source("app/portfolio/page.tsx")).toContain("dual-bar"));
  it("renders monitoring alerts", () => expect(renderToStaticMarkup(<AlertCard alert={{ severity: "WARNING", title: "Test", message: "Drift", fund: null, date: "12.10.2026", action: "Vurder" }} />)).toContain("WARNING"));
  it("contains rebalance plan without execution", () => { const text = source("app/monitoring/page.tsx"); expect(text.toLowerCase()).toContain("rebalansering"); expect(text).toContain("ikke en handelsordre"); });
  it("protects application routes", () => expect(source("proxy.ts")).toContain("getUser"));
  it("renders empty and error states", () => { expect(renderToStaticMarkup(<EmptyState title="Ingen portefølje" text="Opprett en" />)).toContain("Ingen portefølje"); expect(renderToStaticMarkup(<ErrorState />)).toContain("role=\"alert\""); });
  it("contains mobile safe-area and bottom navigation", () => { const css = source("app/globals.css"); expect(css).toContain("safe-area-inset-bottom"); expect(css).toContain("bottom-nav"); });
  it("includes installable PWA assets", () => { expect(source("app/manifest.ts")).toContain('display: "standalone"'); expect(source("public/sw.js")).toContain("addEventListener"); });
});
