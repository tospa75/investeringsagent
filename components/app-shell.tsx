"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [["/", "Oversikt", "⌂"], ["/analysis", "Analyse", "◎"], ["/portfolio", "Portefølje", "▥"], ["/monitoring", "Overvåkning", "◉"], ["/settings", "Innstillinger", "⚙"]] as const;
export function AppShell({ children }: { children: React.ReactNode }) {
  if(usePathname()==="/login") return <main>{children}</main>;
  return <div className="app-shell"><aside className="sidebar"><Link href="/" className="logo"><span>IA</span><strong>InvesteringsAgent</strong></Link><nav aria-label="Hovedmeny">{nav.map(([href, label, icon]) => <Link href={href} key={href}><span aria-hidden>{icon}</span>{label}</Link>)}</nav><div className="sidebar-foot"><div className="avatar">TS</div><div><strong>Demoportefølje</strong><small>Sikker økt</small></div></div></aside><div className="app-content"><header className="mobile-header"><Link href="/" className="logo"><span>IA</span><strong>InvesteringsAgent</strong></Link><span className="live-dot">Oppdatert</span></header><main>{children}</main></div><nav className="bottom-nav" aria-label="Mobil hovedmeny">{nav.map(([href, label, icon]) => <Link href={href} key={href}><span aria-hidden>{icon}</span><small>{label}</small></Link>)}</nav></div>;
}
