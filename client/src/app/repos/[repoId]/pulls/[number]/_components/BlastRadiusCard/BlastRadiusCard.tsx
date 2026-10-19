"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { BlastRadius } from "@/vendor/shared/contracts/brief";
import { githubBlobUrl } from "@/lib/github-urls";

interface BlastRadiusCardProps {
  blast: BlastRadius;
  repoFullName: string;
  headSha: string;
}

export function BlastRadiusCard({ blast, repoFullName, headSha }: BlastRadiusCardProps) {
  const t = useTranslations("blast");
  const [view, setView] = React.useState<"tree" | "graph">("tree");
  const [collapsedSymbols, setCollapsedSymbols] = React.useState<Set<string>>(() => new Set());
  const callerCount = blast.downstream.reduce((count, impact) => count + impact.callers.length, 0);
  const endpointCount = new Set(blast.downstream.flatMap((impact) => impact.endpoints_affected)).size;
  const cronCount = new Set(blast.downstream.flatMap((impact) => impact.crons_affected)).size;

  return (
    <section aria-label={t("title")} style={styles.card}>
      <div data-testid="blast-radius-header" style={styles.header}>
        <div style={styles.titleGroup}>
          <Icon.Workflow size={17} style={styles.titleIcon} />
          <h2 style={styles.title}>{t("title")}</h2>
        </div>
        <div style={styles.viewToggle}>
          <button type="button" aria-pressed={view === "tree"} onClick={() => setView("tree")} style={{ ...styles.viewButton, ...(view === "tree" ? styles.viewButtonActive : {}) }}>{t("view.tree")}</button>
          <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")} style={{ ...styles.viewButton, ...(view === "graph" ? styles.viewButtonActive : {}) }}>{t("view.graph")}</button>
        </div>
      </div>
      <div style={styles.stats}>
        <Stat icon={<Icon.Code size={16} />} value={blast.changed_symbols.length} label={t("stat.symbols")} />
        <Stat icon={<Icon.CornerDownRight size={16} />} value={callerCount} label={t("stat.callers")} />
        <Stat icon={<Icon.Globe size={16} />} value={endpointCount} label={t("stat.endpoints")} />
        <Stat icon={<Icon.Clock size={16} />} value={cronCount} label={t("stat.crons")} />
      </div>

      {blast.degraded && <p role="status" style={styles.notice}>{t("indexDegraded", { reason: blast.reason ?? "unknown" })}</p>}
      {!blast.degraded && callerCount === 0 && view === "tree" && <p style={styles.empty}>{t("noDownstream", { count: blast.changed_symbols.length })}</p>}

      {view === "tree" && blast.changed_symbols.map((changed) => {
        const impact = blast.downstream.find((item) => item.symbol === changed.name);
        const symbolKey = `${changed.file}:${changed.name}`;
        const expanded = !collapsedSymbols.has(symbolKey);
        return (
          <article key={symbolKey} style={styles.symbol}>
            <button
              type="button"
              aria-label={changed.name}
              aria-expanded={expanded}
              onClick={() => setCollapsedSymbols((previous) => {
                const next = new Set(previous);
                if (next.has(symbolKey)) next.delete(symbolKey);
                else next.add(symbolKey);
                return next;
              })}
              style={styles.symbolButton}
            >
              <Icon.ChevronDown size={16} style={{ ...styles.symbolChevron, transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
              <span style={styles.symbolName}>{changed.name}</span>
              <span style={styles.callerBadge}>{t("callerCount", { count: impact?.callers.length ?? 0 })}</span>
            </button>
            {expanded && (
              <div style={styles.symbolDetails}>
                {(impact?.callers ?? []).map((caller) => (
                  <div key={`${caller.file}:${caller.line}:${caller.name}`} style={styles.callerRow}>
                    <Icon.CornerDownRight size={15} style={styles.callerIcon} />
                    <a
                      href={githubBlobUrl(repoFullName, headSha, caller.file, caller.line)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                    >
                      {caller.file}:{caller.line}
                    </a>
                    <span style={styles.callerName}>{caller.name}</span>
                  </div>
                ))}
                {(impact?.endpoints_affected.length ?? 0) > 0 && <FactGroup title={t("endpointsAffected")} values={impact!.endpoints_affected} />}
                {(impact?.crons_affected.length ?? 0) > 0 && <FactGroup title={t("cronsAffected")} values={impact!.crons_affected} />}
              </div>
            )}
          </article>
        );
      })}
      {view === "graph" && <BlastRadiusGraph blast={blast} label={t("graph.ariaLabel")} empty={t("graph.empty")} />}
    </section>
  );
}

function BlastRadiusGraph({ blast, label, empty }: { blast: BlastRadius; label: string; empty: string }) {
  const rows = blast.downstream.flatMap((impact) => impact.callers.map((caller) => ({
    symbol: impact.symbol,
    caller,
    facts: [...impact.endpoints_affected, ...impact.crons_affected],
  })));

  if (rows.length === 0) return <p style={styles.empty}>{empty}</p>;

  let nextY = 42;
  const layout = rows.map((row) => {
    const y = nextY;
    nextY += Math.max(70, row.facts.length * 22 + 24);
    return { ...row, y };
  });

  return (
    <div style={styles.graphViewport}>
      <svg role="img" aria-label={label} viewBox={`0 0 920 ${nextY}`} style={styles.graph}>
        {layout.map((row, index) => (
          <g key={`${row.symbol}:${row.caller.file}:${row.caller.line}:${index}`}>
            <line x1="200" y1={row.y} x2="292" y2={row.y} style={styles.graphEdge} />
            <line x1="540" y1={row.y} x2="620" y2={row.y} style={styles.graphEdge} />
            <rect x="12" y={row.y - 17} width="188" height="34" rx="5" style={styles.symbolNode} />
            <text x="22" y={row.y + 5} style={styles.graphSymbolText}>{row.symbol}</text>
            <rect x="292" y={row.y - 17} width="248" height="34" rx="5" style={styles.callerNode} />
            <text x="302" y={row.y + 5} style={styles.graphCallerText}>{`${row.caller.name} · ${row.caller.file}:${row.caller.line}`}</text>
            {row.facts.map((fact, factIndex) => (
              <text key={`${fact}:${factIndex}`} x="630" y={row.y + 5 + factIndex * 20} style={styles.graphFactText}>{fact}</text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <span style={styles.stat}>{icon}<strong style={styles.statValue}>{value}</strong><span>{label}</span></span>;
}

function FactGroup({ title, values }: { title: string; values: string[] }) {
  return <div style={styles.factGroup}><span style={styles.factTitle}>{title}</span>{values.map((value) => <span key={value} style={styles.chip}>{value}</span>)}</div>;
}

const styles = {
  card: { border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", padding: 20, minWidth: 0 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titleGroup: { display: "flex", alignItems: "center", gap: 9, minWidth: 0 },
  titleIcon: { color: "var(--text-muted)", flexShrink: 0 },
  title: { margin: 0, color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const },
  viewToggle: { display: "inline-flex", flexShrink: 0, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" },
  viewButton: { border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "5px 10px", textTransform: "capitalize" as const },
  viewButtonActive: { background: "var(--accent-bg)", color: "var(--accent-text)" },
  stats: { display: "flex", flexWrap: "wrap" as const, gap: 18, marginTop: 18, paddingBottom: 16, borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13 },
  stat: { display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" as const },
  statValue: { color: "var(--text-primary)", fontSize: 16 },
  notice: { margin: "14px 0 0", color: "var(--warn)", fontSize: 13 },
  empty: { margin: "14px 0 0", color: "var(--text-muted)", fontSize: 13 },
  symbol: { display: "flex", flexDirection: "column" as const, marginTop: 14 },
  symbolButton: { display: "flex", alignItems: "center", gap: 8, width: "100%", border: "1px solid var(--border)", borderRadius: 7, background: "var(--bg-surface)", color: "var(--text-primary)", cursor: "pointer", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 14, fontWeight: 700, padding: "10px 12px", textAlign: "left" as const },
  symbolChevron: { color: "var(--accent-text)", flexShrink: 0, transition: "transform .12s ease" },
  symbolName: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  callerBadge: { marginLeft: "auto", borderRadius: 5, background: "var(--bg-hover)", color: "var(--text-secondary)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "3px 7px", whiteSpace: "nowrap" as const },
  symbolDetails: { display: "flex", flexDirection: "column" as const, gap: 9, margin: "8px 0 0 21px", padding: "4px 0 4px 14px", borderLeft: "1px solid var(--border-strong)" },
  callerRow: { display: "flex", alignItems: "center", gap: 7, minWidth: 0 },
  callerIcon: { color: "var(--text-muted)", flexShrink: 0 },
  link: { minWidth: 0, overflow: "hidden", color: "var(--accent-text)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12.5, textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  callerName: { marginLeft: "auto", color: "var(--text-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  factGroup: { display: "flex", flexWrap: "wrap" as const, gap: 6, alignItems: "center", paddingTop: 2 },
  factTitle: { color: "var(--text-muted)", fontSize: 12 },
  chip: { borderRadius: 4, background: "var(--accent-bg)", color: "var(--accent-text)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11.5, padding: "3px 6px" },
  graphViewport: { marginTop: 16, overflowX: "auto" as const },
  graph: { display: "block", minWidth: 720, width: "100%" },
  graphEdge: { stroke: "var(--border)", strokeWidth: 2 },
  symbolNode: { fill: "var(--bg-subtle)", stroke: "var(--accent-text)", strokeWidth: 1 },
  callerNode: { fill: "var(--bg-subtle)", stroke: "var(--border)", strokeWidth: 1 },
  graphSymbolText: { fill: "var(--text-primary)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12 },
  graphCallerText: { fill: "var(--text-secondary)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11 },
  graphFactText: { fill: "var(--accent-text)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11 },
};
