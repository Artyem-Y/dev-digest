import React from "react";
import type { ShellContext, Crumb } from "./types";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppFrame({
  ctx,
  crumb,
  children,
}: {
  ctx: ShellContext;
  crumb?: Crumb[];
  children?: React.ReactNode;
}) {
  const [navigationOpen, setNavigationOpen] = React.useState(false);
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: "var(--bg-primary)",
        alignItems: "stretch",
      }}
    >
      <style>{` .dd-mobile-nav-toggle { display: none; } @media (max-width: 700px) { .dd-shell-sidebar { display: none; } .dd-shell-sidebar[data-open="true"] { display: block; position: fixed; inset: 0 auto 0 0; z-index: 50; box-shadow: 0 0 0 100vmax rgba(0,0,0,.6); } .dd-shell-sidebar aside { height: 100%; } .dd-mobile-nav-toggle { display: inline-flex; position: fixed; bottom: 16px; right: 16px; z-index: 51; align-items: center; justify-content: center; border: 1px solid var(--border-strong); border-radius: 8px; padding: 10px 14px; background: var(--bg-elevated); color: var(--text-primary); } .dd-shell-search { display: none !important; } .dd-shell-topbar { gap: 8px !important; padding: 0 12px !important; } .dd-shell-topbar nav { overflow: hidden; } } `}</style>
      <div className="dd-shell-sidebar" data-open={navigationOpen} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setNavigationOpen(false); }}><Sidebar ctx={ctx} /></div>
      <button className="dd-mobile-nav-toggle" aria-expanded={navigationOpen} aria-label={navigationOpen ? "Close navigation" : "Open navigation"} onClick={() => setNavigationOpen((open) => !open)}>{navigationOpen ? "×" : "☰"}</button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar ctx={ctx} crumb={crumb} />
        <main style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
