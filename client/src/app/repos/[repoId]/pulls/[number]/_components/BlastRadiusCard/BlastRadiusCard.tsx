"use client";

import React from "react";
import { useTranslations } from "next-intl";
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
      <h2 style={styles.title}>{t("title")}</h2>
      <div style={styles.viewToggle}>
        <button type="button" aria-pressed={view === "tree"} onClick={() => setView("tree")} style={{ ...styles.viewButton, ...(view === "tree" ? styles.viewButtonActive : {}) }}>{t("view.tree")}</button>
        <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")} style={{ ...styles.viewButton, ...(view === "graph" ? styles.viewButtonActive : {}) }}>{t("view.graph")}</button>
      </div>
      <div style={styles.stats}>
        <Stat value={blast.changed_symbols.length} label={t("stat.symbols")} />
        <Stat value={callerCount} label={t("stat.callers")} />
        <Stat value={endpointCount} label={t("stat.endpoints")} />
        <Stat value={cronCount} label={t("stat.crons")} />
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
              aria-expanded={expanded}
              onClick={() => setCollapsedSymbols((previous) => {
                const next = new Set(previous);
                if (next.has(symbolKey)) next.delete(symbolKey);
                else next.add(symbolKey);
                return next;
              })}
              style={styles.symbolButton}
            >
              {changed.name}
            </button>
            {expanded && (impact?.callers ?? []).map((caller) => (
              <a
                key={`${caller.file}:${caller.line}:${caller.name}`}
                href={githubBlobUrl(repoFullName, headSha, caller.file, caller.line)}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                {caller.file}:{caller.line}
              </a>
            ))}
            {expanded && (impact?.endpoints_affected.length ?? 0) > 0 && <FactGroup title={t("endpointsAffected")} values={impact!.endpoints_affected} />}
            {expanded && (impact?.crons_affected.length ?? 0) > 0 && <FactGroup title={t("cronsAffected")} values={impact!.crons_affected} />}
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

function Stat({ value, label }: { value: number; label: string }) {
  return <span style={styles.stat}><strong>{value}</strong> {label}</span>;
}

function FactGroup({ title, values }: { title: string; values: string[] }) {
  return <div style={styles.factGroup}><span style={styles.factTitle}>{title}</span>{values.map((value) => <span key={value} style={styles.chip}>{value}</span>)}</div>;
}

const styles = {
  card: { border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-elevated)", padding: 20 },
  title: { margin: 0, color: "var(--text-primary)", fontSize: 16 },
  viewToggle: { display: "inline-flex", marginTop: 12, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" },
  viewButton: { border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontWeight: 700, padding: "5px 10px" },
  viewButtonActive: { background: "var(--accent-bg)", color: "var(--accent-text)" },
  stats: { display: "flex", flexWrap: "wrap" as const, gap: 14, marginTop: 12, color: "var(--text-secondary)", fontSize: 13 },
  stat: { whiteSpace: "nowrap" as const },
  notice: { margin: "14px 0 0", color: "var(--warn)", fontSize: 13 },
  empty: { margin: "14px 0 0", color: "var(--text-muted)", fontSize: 13 },
  symbol: { display: "flex", flexDirection: "column" as const, gap: 8, borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 },
  symbolButton: { alignSelf: "flex-start", border: 0, background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 14, fontWeight: 700, padding: 0, textAlign: "left" as const },
  link: { alignSelf: "flex-start", color: "var(--accent-text)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12.5 },
  factGroup: { display: "flex", flexWrap: "wrap" as const, gap: 6, alignItems: "center" },
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
