"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Modal } from "@devdigest/ui";
import type { BlastRadius } from "@/vendor/shared/contracts/brief";
import { githubBlobUrl, githubPrUrl } from "@/lib/github-urls";

interface BlastRadiusCardProps {
  blast: BlastRadius;
  repoFullName: string;
  headSha: string;
}

export function BlastRadiusCard({ blast, repoFullName, headSha }: BlastRadiusCardProps) {
  const t = useTranslations("blast");
  const [graphOpen, setGraphOpen] = React.useState(false);
  const [collapsedSymbols, setCollapsedSymbols] = React.useState<Set<string>>(new Set());
  const callerCount = blast.downstream.reduce((count, impact) => count + impact.callers.length, 0);
  const endpointCount = new Set(blast.downstream.flatMap((impact) => impact.endpoints_affected)).size;
  const cronCount = new Set(blast.downstream.flatMap((impact) => impact.crons_affected)).size;
  const priorPrs = blast.prior_prs?.history ?? [];
  const impactedSymbols = blast.changed_symbols.filter((changed) =>
    (blast.downstream.find((impact) => impact.symbol === changed.name)?.callers.length ?? 0) > 0,
  );
  const symbolsWithoutCallers = blast.changed_symbols.filter((changed) =>
    (blast.downstream.find((impact) => impact.symbol === changed.name)?.callers.length ?? 0) === 0,
  );

  return (
    <section aria-label={t("title")} style={styles.card}>
      <div data-testid="blast-radius-header" style={styles.header}>
        <div style={styles.titleGroup}>
          <Icon.Workflow size={17} style={styles.titleIcon} />
          <h2 style={styles.title}>{t("title")}</h2>
        </div>
        <div style={styles.viewToggle}>
          <button type="button" aria-pressed="true" style={{ ...styles.viewButton, ...styles.viewButtonActive }}>{t("view.tree")}</button>
          <button type="button" aria-haspopup="dialog" aria-expanded={graphOpen} onClick={() => setGraphOpen(true)} style={styles.viewButton}>{t("view.graph")}</button>
        </div>
      </div>
      <div style={styles.stats}>
        <Stat icon={<Icon.Code size={16} />} value={blast.changed_symbols.length} label={t("stat.symbols")} />
        <Stat icon={<Icon.CornerDownRight size={16} />} value={callerCount} label={t("stat.callers")} />
        <Stat icon={<Icon.Globe size={16} />} value={endpointCount} label={t("stat.endpoints")} />
        <Stat icon={<Icon.Clock size={16} />} value={cronCount} label={t("stat.crons")} />
      </div>

      {blast.degraded && <p role="status" style={styles.notice}>{t("indexDegraded", { reason: blast.reason ?? "unknown" })}</p>}
      {!blast.degraded && callerCount === 0 && <p style={styles.empty}>{t("noDownstream", { count: blast.changed_symbols.length })}</p>}

      {impactedSymbols.map((changed) => {
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
      {symbolsWithoutCallers.length > 0 && (
        <details style={styles.noCallersSection}>
          <summary style={styles.noCallersSummary}>{t("noCallerSymbols", { count: symbolsWithoutCallers.length })}</summary>
          <div style={styles.noCallersList}>
            {symbolsWithoutCallers.map((symbol) => (
              <div key={`${symbol.file}:${symbol.name}`} style={styles.noCallersRow}>
                <span style={styles.symbolName}>{symbol.name}</span>
                <span style={styles.noCallersFile}>{symbol.file}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {graphOpen && (
        <Modal width={1320} title={t("title")} subtitle={t("graph.ariaLabel")} onClose={() => setGraphOpen(false)}>
          <BlastRadiusGraph
            blast={blast}
            label={t("graph.ariaLabel")}
            empty={t("graph.empty")}
            legend={{
              symbol: t("graph.legend.symbol"),
              caller: t("graph.legend.caller"),
              endpoint: t("graph.legend.endpoint"),
              cron: t("graph.legend.cron"),
            }}
          />
        </Modal>
      )}
      {priorPrs.length > 0 && (
        <details style={styles.historySection}>
          <summary style={styles.historySummary}>
            <Icon.History size={16} style={styles.historyIcon} />
            <span>{t("priorPrs")}</span>
            <span style={styles.historyCount}>{priorPrs.length}</span>
          </summary>
          <div style={styles.historyList}>
            {priorPrs.map((pull) => (
              <div key={pull.pr_number} style={styles.historyRow}>
                <a
                  href={githubPrUrl(repoFullName, pull.pr_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.historyLink}
                >
                  #{pull.pr_number} {pull.title}
                </a>
                <span style={styles.historyMeta}>{t("overlapFiles", { count: pull.files_overlap.length })}</span>
                <time dateTime={pull.merged_at} style={styles.historyDate}>{pull.merged_at.slice(0, 10)}</time>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

type GraphCaller = {
  key: string;
  name: string;
  file: string;
  line: number;
  symbols: Set<string>;
  endpoints: Set<string>;
  crons: Set<string>;
};

type GraphNodeType = "symbol" | "caller" | "endpoint" | "cron";
type GraphHover = { type: GraphNodeType; key: string } | null;

function BlastRadiusGraph({
  blast,
  label,
  empty,
  legend,
}: {
  blast: BlastRadius;
  label: string;
  empty: string;
  legend: Record<"symbol" | "caller" | "endpoint" | "cron", string>;
}) {
  const [hovered, setHovered] = React.useState<GraphHover>(null);
  const callerByKey = new Map<string, GraphCaller>();
  const symbols = new Set<string>();
  const endpoints = new Set<string>();
  const crons = new Set<string>();

  for (const impact of blast.downstream) {
    for (const caller of impact.callers) {
      symbols.add(impact.symbol);
      const key = `${caller.file}:${caller.line}:${caller.name}`;
      const graphCaller = callerByKey.get(key) ?? {
        key,
        name: caller.name,
        file: caller.file,
        line: caller.line,
        symbols: new Set<string>(),
        endpoints: new Set<string>(),
        crons: new Set<string>(),
      };
      graphCaller.symbols.add(impact.symbol);
      impact.endpoints_affected.forEach((endpoint) => {
        graphCaller.endpoints.add(endpoint);
        endpoints.add(endpoint);
      });
      impact.crons_affected.forEach((cron) => {
        graphCaller.crons.add(cron);
        crons.add(cron);
      });
      callerByKey.set(key, graphCaller);
    }
  }

  if (callerByKey.size === 0) return <p style={styles.graphEmpty}>{empty}</p>;

  const symbolNodes = [...symbols].sort();
  const callerNodes = [...callerByKey.values()].sort((left, right) => left.key.localeCompare(right.key));
  const endpointNodes = [...endpoints].sort();
  const cronNodes = [...crons].sort();
  const columns = [symbolNodes, callerNodes, endpointNodes, cronNodes] as const;
  const graphHeight = Math.max(330, ...columns.map((items) => 94 + items.length * 66));
  const symbolY = new Map(symbolNodes.map((symbol, index) => [symbol, 82 + index * 66]));
  const callerY = new Map(callerNodes.map((caller, index) => [caller.key, 82 + index * 66]));
  const endpointY = new Map(endpointNodes.map((endpoint, index) => [endpoint, 82 + index * 66]));
  const cronY = new Map(cronNodes.map((cron, index) => [cron, 82 + index * 66]));
  const activeNodeIds = connectedNodeIds(hovered, callerNodes);
  const hasHover = hovered !== null;

  return (
    <div data-testid="blast-radius-graph-viewport" style={styles.graphViewport}>
      <svg role="group" aria-label={label} viewBox={`0 0 1240 ${graphHeight}`} style={styles.graph}>
        <g data-testid="blast-radius-graph-column">
          <text x="24" y="32" style={styles.graphColumnSymbol}>{symbolNodes.length} {legend.symbol.toUpperCase()}</text>
        </g>
        <g data-testid="blast-radius-graph-column">
          <text x="300" y="32" style={styles.graphColumnCaller}>{callerNodes.length} {legend.caller.toUpperCase()}</text>
        </g>
        <g data-testid="blast-radius-graph-column">
          <text x="650" y="32" style={styles.graphColumnEndpoint}>{endpointNodes.length} {legend.endpoint.toUpperCase()}</text>
        </g>
        <g data-testid="blast-radius-graph-column">
          <text x="970" y="32" style={styles.graphColumnCron}>{cronNodes.length} {legend.cron.toUpperCase()}</text>
        </g>

        {callerNodes.flatMap((caller) => [...caller.symbols].map((symbol) => (
          <path
            key={`${symbol}:${caller.key}`}
            d={curve(244, symbolY.get(symbol)!, 300, callerY.get(caller.key)!)}
            data-active={isActiveEdge(activeNodeIds, nodeId("symbol", symbol), nodeId("caller", caller.key))}
            data-dimmed={hasHover && !isActiveEdge(activeNodeIds, nodeId("symbol", symbol), nodeId("caller", caller.key))}
            style={{ ...styles.graphEdge, ...(isActiveEdge(activeNodeIds, nodeId("symbol", symbol), nodeId("caller", caller.key)) ? styles.graphEdgeActive : {}), ...(hasHover && !isActiveEdge(activeNodeIds, nodeId("symbol", symbol), nodeId("caller", caller.key)) ? styles.graphEdgeDimmed : {}) }}
          />
        )))}
        {callerNodes.flatMap((caller) => [...caller.endpoints].map((endpoint) => (
          <path
            key={`${caller.key}:${endpoint}`}
            d={curve(570, callerY.get(caller.key)!, 650, endpointY.get(endpoint)!)}
            data-active={isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("endpoint", endpoint))}
            data-dimmed={hasHover && !isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("endpoint", endpoint))}
            style={{ ...styles.graphEdge, ...(isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("endpoint", endpoint)) ? styles.graphEdgeActive : {}), ...(hasHover && !isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("endpoint", endpoint)) ? styles.graphEdgeDimmed : {}) }}
          />
        )))}
        {callerNodes.flatMap((caller) => [...caller.crons].map((cron) => (
          <path
            key={`${caller.key}:${cron}`}
            d={curve(570, callerY.get(caller.key)!, 970, cronY.get(cron)!)}
            data-active={isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("cron", cron))}
            data-dimmed={hasHover && !isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("cron", cron))}
            style={{ ...styles.graphEdge, ...(isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("cron", cron)) ? styles.graphEdgeActive : {}), ...(hasHover && !isActiveEdge(activeNodeIds, nodeId("caller", caller.key), nodeId("cron", cron)) ? styles.graphEdgeDimmed : {}) }}
          />
        )))}

        {symbolNodes.map((symbol) => <GraphNode key={symbol} x={24} y={symbolY.get(symbol)!} width={220} tone="symbol" kindLabel={legend.symbol} label={symbol} active={activeNodeIds.has(nodeId("symbol", symbol))} dimmed={hasHover && !activeNodeIds.has(nodeId("symbol", symbol))} onHoverChange={(isHovered) => setHovered(isHovered ? { type: "symbol", key: symbol } : null)} />)}
        {callerNodes.map((caller) => (
          <GraphNode
            key={caller.key}
            x={300}
            y={callerY.get(caller.key)!}
            width={270}
            tone="caller"
            kindLabel={legend.caller}
            label={caller.name}
            subtitle={`${caller.file}:${caller.line}`}
            active={activeNodeIds.has(nodeId("caller", caller.key))}
            dimmed={hasHover && !activeNodeIds.has(nodeId("caller", caller.key))}
            onHoverChange={(isHovered) => setHovered(isHovered ? { type: "caller", key: caller.key } : null)}
          />
        ))}
        {endpointNodes.map((endpoint) => <GraphNode key={endpoint} x={650} y={endpointY.get(endpoint)!} width={250} tone="endpoint" kindLabel={legend.endpoint} label={endpoint} active={activeNodeIds.has(nodeId("endpoint", endpoint))} dimmed={hasHover && !activeNodeIds.has(nodeId("endpoint", endpoint))} onHoverChange={(isHovered) => setHovered(isHovered ? { type: "endpoint", key: endpoint } : null)} />)}
        {cronNodes.map((cron) => <GraphNode key={cron} x={970} y={cronY.get(cron)!} width={220} tone="cron" kindLabel={legend.cron} label={cron} active={activeNodeIds.has(nodeId("cron", cron))} dimmed={hasHover && !activeNodeIds.has(nodeId("cron", cron))} onHoverChange={(isHovered) => setHovered(isHovered ? { type: "cron", key: cron } : null)} />)}
      </svg>
      <div style={styles.graphLegend} aria-label={titledLegend(legend)}>
        <GraphLegendItem tone="symbol" label={legend.symbol} />
        <GraphLegendItem tone="caller" label={legend.caller} />
        <GraphLegendItem tone="endpoint" label={legend.endpoint} />
        <GraphLegendItem tone="cron" label={legend.cron} />
      </div>
    </div>
  );
}

function curve(fromX: number, fromY: number, toX: number, toY: number): string {
  const control = Math.max(36, (toX - fromX) / 2);
  return `M ${fromX} ${fromY} C ${fromX + control} ${fromY}, ${toX - control} ${toY}, ${toX} ${toY}`;
}

function nodeId(type: GraphNodeType, key: string): string {
  return `${type}:${key}`;
}

function connectedNodeIds(hovered: GraphHover, callers: GraphCaller[]): Set<string> {
  if (!hovered) return new Set();
  const adjacent = new Map<string, Set<string>>();
  const connect = (left: string, right: string) => {
    const leftConnections = adjacent.get(left) ?? new Set<string>();
    leftConnections.add(right);
    adjacent.set(left, leftConnections);
    const rightConnections = adjacent.get(right) ?? new Set<string>();
    rightConnections.add(left);
    adjacent.set(right, rightConnections);
  };

  for (const caller of callers) {
    const callerNode = nodeId("caller", caller.key);
    caller.symbols.forEach((symbol) => connect(callerNode, nodeId("symbol", symbol)));
    caller.endpoints.forEach((endpoint) => connect(callerNode, nodeId("endpoint", endpoint)));
    caller.crons.forEach((cron) => connect(callerNode, nodeId("cron", cron)));
  }

  const active = new Set<string>();
  const pending = [nodeId(hovered.type, hovered.key)];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (active.has(current)) continue;
    active.add(current);
    adjacent.get(current)?.forEach((next) => pending.push(next));
  }
  return active;
}

function isActiveEdge(activeNodeIds: Set<string>, from: string, to: string): boolean {
  return activeNodeIds.has(from) && activeNodeIds.has(to);
}

function GraphNode({ x, y, width, tone, kindLabel, label, subtitle, active, dimmed, onHoverChange }: {
  x: number; y: number; width: number; tone: GraphNodeType; kindLabel: string; label: string; subtitle?: string; active: boolean; dimmed: boolean; onHoverChange: (isHovered: boolean) => void;
}) {
  const nodeStyle = {
    symbol: styles.symbolNode,
    caller: styles.callerNode,
    endpoint: styles.endpointNode,
    cron: styles.cronNode,
  }[tone];
  const textStyle = tone === "caller" ? styles.graphCallerText : styles.graphNodeText;
  return (
    <g
      role="group"
      tabIndex={0}
      aria-label={`${kindLabel}: ${label}`}
      data-active={active}
      data-dimmed={dimmed}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      style={{ ...styles.graphNodeTarget, ...(dimmed ? styles.graphNodeDimmed : {}) }}
    >
      <rect x={x} y={y - 17} width={width} height="34" rx="6" style={{ ...nodeStyle, ...(active ? styles.graphNodeActive : {}) }} />
      <text x={x + 12} y={subtitle ? y - 2 : y + 5} style={textStyle}>{shorten(label, tone === "caller" ? 31 : 29)}</text>
      {subtitle && <text x={x + 12} y={y + 12} style={styles.graphCallerSubtext}>{shorten(subtitle, 37)}</text>}
    </g>
  );
}

function GraphLegendItem({ tone, label }: { tone: "symbol" | "caller" | "endpoint" | "cron"; label: string }) {
  const color = {
    symbol: "var(--accent-text)",
    caller: "var(--text-muted)",
    endpoint: "var(--ok)",
    cron: "var(--warn)",
  }[tone];
  return <span style={styles.graphLegendItem}><span aria-hidden="true" style={{ ...styles.graphLegendSwatch, borderColor: color }} />{label}</span>;
}

function titledLegend(legend: Record<"symbol" | "caller" | "endpoint" | "cron", string>): string {
  return Object.values(legend).join(", ");
}

function shorten(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
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
  noCallersSection: { marginTop: 14, border: "1px solid var(--border)", borderRadius: 7, background: "var(--bg-surface)" },
  noCallersSummary: { cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 13, fontWeight: 700, padding: "10px 12px" },
  noCallersList: { display: "flex", flexDirection: "column" as const, gap: 7, padding: "0 12px 12px" },
  noCallersRow: { display: "flex", alignItems: "center", gap: 10, minWidth: 0, color: "var(--text-primary)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 13 },
  noCallersFile: { minWidth: 0, overflow: "hidden", color: "var(--text-muted)", fontSize: 12, textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  historySection: { marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 },
  historySummary: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--text-primary)", fontSize: 13, fontWeight: 700, listStyle: "none" },
  historyIcon: { color: "var(--text-muted)", flexShrink: 0 },
  historyCount: { borderRadius: 5, background: "var(--bg-hover)", color: "var(--text-secondary)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12, padding: "2px 7px" },
  historyList: { display: "flex", flexDirection: "column" as const, gap: 9, marginTop: 12, paddingLeft: 24 },
  historyRow: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  historyLink: { minWidth: 0, overflow: "hidden", color: "var(--accent-text)", fontSize: 13, textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  historyMeta: { color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" as const },
  historyDate: { marginLeft: "auto", color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" as const },
  callerRow: { display: "flex", alignItems: "center", gap: 7, minWidth: 0 },
  callerIcon: { color: "var(--text-muted)", flexShrink: 0 },
  link: { minWidth: 0, overflow: "hidden", color: "var(--accent-text)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12.5, textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  callerName: { marginLeft: "auto", color: "var(--text-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  factGroup: { display: "flex", flexWrap: "wrap" as const, gap: 6, alignItems: "center", paddingTop: 2 },
  factTitle: { color: "var(--text-muted)", fontSize: 12 },
  chip: { borderRadius: 4, background: "var(--accent-bg)", color: "var(--accent-text)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11.5, padding: "3px 6px" },
  graphViewport: { minWidth: 0, padding: "18px 24px 20px" },
  graph: { display: "block", minWidth: 1240, width: "100%" },
  graphEmpty: { margin: 0, padding: "20px 24px", color: "var(--text-muted)", fontSize: 13 },
  graphEdge: { fill: "none", stroke: "var(--border-strong)", strokeWidth: 1.5 },
  graphEdgeActive: { stroke: "var(--accent-text)", strokeWidth: 2.5 },
  graphEdgeDimmed: { opacity: 0.2 },
  graphNodeTarget: { cursor: "default", outline: "none" },
  graphNodeDimmed: { opacity: 0.28 },
  graphNodeActive: { fill: "var(--accent-bg)", strokeWidth: 2 },
  symbolNode: { fill: "var(--bg-surface)", stroke: "var(--accent-text)", strokeWidth: 1 },
  callerNode: { fill: "var(--bg-surface)", stroke: "var(--border)", strokeWidth: 1 },
  endpointNode: { fill: "var(--bg-surface)", stroke: "var(--ok)", strokeWidth: 1 },
  cronNode: { fill: "var(--bg-surface)", stroke: "var(--warn)", strokeWidth: 1 },
  graphColumnSymbol: { fill: "var(--accent-text)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
  graphColumnCaller: { fill: "var(--text-muted)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
  graphColumnEndpoint: { fill: "var(--ok)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
  graphColumnCron: { fill: "var(--warn)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
  graphNodeText: { fill: "var(--text-primary)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12 },
  graphCallerText: { fill: "var(--text-primary)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11.5 },
  graphCallerSubtext: { fill: "var(--text-muted)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 10 },
  graphLegend: { display: "flex", flexWrap: "wrap" as const, gap: 12, marginTop: 14, color: "var(--text-secondary)", fontSize: 11 },
  graphLegendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  graphLegendSwatch: { width: 10, height: 10, border: "1px solid", borderRadius: 2 },
};
