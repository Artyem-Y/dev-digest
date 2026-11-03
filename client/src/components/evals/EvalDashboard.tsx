"use client";
import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { EvalPipelineRun } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { Button, Icon } from "@devdigest/ui";
import { useAgents } from "@/lib/hooks/agents";
import { useEvalRuns, usePromoteEvalRun, useStartAllEvals, useStartEval } from "@/lib/hooks/evals";

const pct = (n: number | null | undefined) => n == null ? "—" : `${Math.round(n * 100)}%`;
const panel: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10 };
const metricColors = { recall: "#3b82f6", precision: "#10b981", citationAccuracy: "#f59e0b" } as const;
const metricKeys = ["recall", "precision", "citationAccuracy"] as const;
const trendOffsets = { recall: -7, precision: 0, citationAccuracy: 7 } as const;
const money = (value: number | null | undefined) => value == null ? "—" : `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`;
/** Sum case execution times; queue and orchestration time are not included. */
export function formatCaseTime(run: EvalPipelineRun): string {
  const results = run.result?.results;
  if (run.status !== "completed" || !results?.length || results.length !== run.snapshot.cases.length || results.some((item) => !Number.isFinite(item.durationMs) || item.durationMs < 0)) return "—";
  return `${(results.reduce((sum, item) => sum + item.durationMs, 0) / 1000).toFixed(2)} s`;
}
function MetricSparkline({ values, color, testId }: { values: Array<number | null | undefined>; color: string; testId?: string }) {
  const points = values.flatMap((value, index) => value == null ? [] : [[index, value] as const]);
  if (points.length < 2) return null;
  const first = points[0]![0], last = points[points.length - 1]![0];
  const polyline = points.map(([index, value]) => `${last === first ? 22 : ((index - first) / (last - first)) * 44},${26 - value * 22}`).join(" ");
  return <svg className="eval-agent-sparkline" data-testid={testId} aria-hidden="true" width="48" height="28" viewBox="0 0 48 28" focusable="false" style={{ flex: "0 0 48px", overflow: "visible" }}><polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
const passCount = (run: EvalPipelineRun) => {
  const cases = run.result?.score?.cases;
  return run.status === "completed" && cases ? `${cases.filter((item) => item.passed).length}/${cases.length}` : "—";
};
// Only fingerprints issued by a verified build pipeline qualify. Legacy labels
// and the unavailable sentinel cannot establish matching execution semantics.
const knownEngine = (version: string) => /^sha256:[a-f0-9]{64}$/.test(version);
export const compatibleEvalRuns = (a: EvalPipelineRun, b: EvalPipelineRun) =>
  a.snapshot.scope === "suite" && b.snapshot.scope === "suite" && a.status === "completed" && b.status === "completed" && knownEngine(a.engine_version) &&
  a.engine_version === b.engine_version && a.dataset_fingerprint === b.dataset_fingerprint && a.scorer_version === b.scorer_version;
function PromptDiff({ before, after }: { before: string; after: string }) {
  const a = before.split("\n"), b = after.split("\n");
  let prefix = 0, suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  const lines = [
    ...a.slice(0, prefix).map((text) => ({ text, change: "unchanged" })),
    ...a.slice(prefix, a.length - suffix).map((text) => ({ text, change: "removed" })),
    ...b.slice(prefix, b.length - suffix).map((text) => ({ text, change: "added" })),
    ...a.slice(a.length - suffix).map((text) => ({ text, change: "unchanged" })),
  ];
  return <pre tabIndex={0} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 240, overflow: "auto", background: "var(--bg-primary)", padding: 16, borderRadius: 8 }}>{lines.map((line, index) => <span key={index} data-change={line.change} style={{ display: "block", background: line.change === "added" ? "var(--ok-bg)" : line.change === "removed" ? "var(--crit-bg)" : undefined }}>{line.change === "added" ? "+ " : line.change === "removed" ? "− " : "  "}{line.text}</span>)}</pre>;
}
function Comparison({ runs, onClose, agentVersion }: { runs: [EvalPipelineRun, EvalPipelineRun]; onClose: () => void; agentVersion?: number }) {
  const t = useTranslations("eval.pipeline");
  const promote = usePromoteEvalRun();
  const dialog = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => { dialog.current?.showModal(); }, []);
  const [old, current] = [...runs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const comparable = compatibleEvalRuns(old!, current!);
  return <dialog ref={dialog} onClose={onClose} aria-labelledby="eval-comparison-title" style={{ maxWidth: 1000, width: "90%", maxHeight: "90vh", overflowY: "auto", margin: "auto", background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: 24 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20 }}><h2 id="eval-comparison-title" style={{ fontSize: 18, fontWeight: 700 }}>{t("compare")}</h2><Button kind="tertiary" icon="X" aria-label={`${t("close")} ${t("compare")}`} onClick={() => dialog.current?.close()} /></div>
    {!comparable && <p role="alert">{t("incompatible")}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
      {([['recall', t('recall')], ['precision', t('precision')], ['citationAccuracy', t('citation')]] as const).map(([key, label]) => { const a = old!.result?.score?.[key], b = current!.result?.score?.[key]; return <div key={key} style={{ ...panel, padding: 16 }}><small>{label}</small><div>{pct(a)} → <strong style={{ color: metricColors[key], fontSize: 22 }}>{pct(b)}</strong> {comparable && a != null && b != null ? `(${((b - a) * 100).toFixed(1)} pp)` : ""}</div></div>; })}
      <div style={{ ...panel, padding: 16 }}><small>{t("cost")}</small><div>{money(old!.result?.costUsd)} → <strong style={{ fontSize: 22 }}>{money(current!.result?.costUsd)}</strong></div></div>
    </div>
    <p>{t("configuration")}: {old!.snapshot.agent.provider}/{old!.snapshot.agent.model} → {current!.snapshot.agent.provider}/{current!.snapshot.agent.model}</p>
    <p>{t("skills")}: {old!.snapshot.agent.skills.length} → {current!.snapshot.agent.skills.length}</p>
    {old!.result?.score && <p>{t("counts", { tp: old!.result.score.counts.truePositive, fp: old!.result.score.counts.knownFalsePositive, unlabeled: old!.result.score.counts.unlabeled })}</p>}
    {current!.result?.score && <p>{t("counts", { tp: current!.result.score.counts.truePositive, fp: current!.result.score.counts.knownFalsePositive, unlabeled: current!.result.score.counts.unlabeled })}</p>}
    <h3>{t("promptDiff")}</h3><p>{t("oldPrompt")} (−) · {t("newPrompt")} (+)</p><PromptDiff before={old!.snapshot.agent.systemPrompt} after={current!.snapshot.agent.systemPrompt} />
    {JSON.stringify(old!.snapshot.agent.skills) !== JSON.stringify(current!.snapshot.agent.skills) && <><h3>{t("oldSkills")}</h3><pre style={{ whiteSpace: "pre-wrap" }}>{old!.snapshot.agent.skills.join("\n\n")}</pre><h3>{t("newSkills")}</h3><pre style={{ whiteSpace: "pre-wrap" }}>{current!.snapshot.agent.skills.join("\n\n")}</pre></>}
    <div style={{ display: "flex", gap: 10, marginTop: 20, position: "sticky", bottom: -24, padding: "14px 0", background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}><Button onClick={() => dialog.current?.close()}>{t("close")}</Button>
    <Button kind="primary" disabled={!agentVersion || current!.snapshot.scope !== "suite" || current!.status !== "completed" || !current!.snapshot.promotion || promote.isPending} onClick={() => { if (agentVersion && window.confirm(t("confirmPromote"))) promote.mutate({ agentId: current!.agent_id, runId: current!.id, expectedVersion: agentVersion }); }}>{t("promoteRun")}</Button></div>
    {promote.isError && <p role="alert">{promote.error.message}</p>}{promote.isSuccess && <p role="status">{t("promoted", { version: promote.data.version })}</p>}
  </dialog>;
}

export function EvalDashboard({ agentId }: { agentId?: string }) {
  const t = useTranslations("eval.pipeline");
  const agents = useAgents();
  const runs = useEvalRuns(agentId);
  const start = useStartEval();
  const startAll = useStartAllEvals();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [comparing, setComparing] = React.useState(false);
  const [runningAll, setRunningAll] = React.useState(false);
  const [runAllErrors, setRunAllErrors] = React.useState<Array<{ agentId: string; name: string; error: string }>>([]);
  const [period, setPeriod] = React.useState("all");
  const visibleRuns = React.useMemo(() => (runs.data ?? []).filter((run) => period === "all" || Date.parse(run.created_at) >= Date.now() - Number(period) * 86400000), [runs.data, period]);
  const selectedRuns = visibleRuns.filter((run) => selected.includes(run.id));
  const agent = agents.data?.find((item) => item.id === agentId);
  const newestComplete = visibleRuns.find((run) => run.snapshot.scope === "suite" && run.status === "completed" && run.result?.score);
  const completed = newestComplete ? visibleRuns.filter((run) => compatibleEvalRuns(run, newestComplete)).reverse() : [];
  const previousComplete = completed.length > 1 ? completed[completed.length - 2] : undefined;
  const precisionDelta = newestComplete?.result?.score?.precision != null && previousComplete?.result?.score?.precision != null
    ? newestComplete.result.score.precision - previousComplete.result.score.precision : null;
  return <AppShell crumb={[{ label: "Skills Lab" }, { label: "Eval Dashboard", href: "/eval" }, ...(agent ? [{ label: agent.name }] : [])]}>
    <main style={{ maxWidth: 980, margin: "auto", padding: "20px 28px 40px" }}>
      <style>{`.eval-configure-link { display: inline-flex; align-items: center; white-space: nowrap; font-size: 12px; color: var(--text-secondary); text-decoration: none; } .eval-configure-link:hover, .eval-configure-link:focus-visible { color: var(--accent-text); text-decoration: underline; text-underline-offset: 2px; } @media (max-width: 700px) { .eval-agent-card { gap: 12px !important; position: relative; } .eval-agent-card .eval-agent-meta { flex: 0 0 calc(100% - 52px) !important; padding-right: 18px; } .eval-agent-card .eval-agent-metric { flex: 1 1 0 !important; min-width: 0 !important; } .eval-agent-card .eval-agent-sparkline { display: none; } .eval-agent-card .eval-agent-arrow { position: absolute; right: 16px; top: 26px; } }`}</style>
      {agentId && <Link href="/eval" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", textDecoration: "none", fontSize: 13 }}>← {t("allAgents")}</Link>}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 16, marginTop: 16 }}><div style={{ flex: "1 1 240px" }}><h1 style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, fontSize: 22, fontWeight: 700 }}><span>{agentId ? agent?.name ?? t("agent") : t("dashboardTitle")}</span>{agentId && agent && <span className="mono" style={{ padding: "4px 8px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>{agent.provider}/{agent.model}</span>}</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{agentId ? t("agentDescription") : t("dashboardDescription")}</p></div>
      {agentId && <div className="eval-dashboard-actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}><Link className="mono eval-configure-link" href={`/agents/${agentId}?tab=evals`}>{t("configure")}</Link><label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border-strong)", borderRadius: 6, background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 13 }}><span className="sr-only">{t("runPeriod")}</span><Icon.Calendar size={15} /><select aria-label={t("runPeriod")} value={period} onChange={(event) => { setPeriod(event.target.value); setSelected([]); }} style={{ background: "transparent", color: "var(--text-primary)", border: 0 }}><option value="all">{t("allTime")}</option><option value="1">{t("oneDay")}</option><option value="7">{t("sevenDays")}</option><option value="30">{t("thirtyDays")}</option></select></label><Button kind="primary" icon="Play" disabled={start.isPending || runs.data?.some((run) => run.status === "running" || run.status === "queued")} onClick={() => start.mutate(agentId)}>{t("runAll")}</Button></div>}
      {!agentId && <Button kind="primary" icon="Play" disabled={runningAll || !agents.data?.length} onClick={async () => {
        setRunningAll(true); setRunAllErrors([]);
        const failures: Array<{ agentId: string; name: string; error: string }> = [];
        try {
          const result = await startAll.mutateAsync();
          for (const item of result) if (item.error) {
            const message = item.error === "empty" ? t("batchEmpty")
              : item.error === "active" ? t("batchActive")
              : item.error === "limit" ? t("batchLimit")
              : item.error === "fixture_unavailable" ? t("batchFixtureUnavailable")
              : item.error === "capacity" ? t("batchCapacity") : t("batchGeneric");
            failures.push({ agentId: item.agent_id, name: agents.data?.find((agent) => agent.id === item.agent_id)?.name ?? item.agent_id, error: message });
          }
        } catch (error) { failures.push({ agentId: "", name: "", error: error instanceof Error ? error.message : t("loadError") }); }
        setRunAllErrors(failures); setRunningAll(false);
      }}>{runningAll ? t("running") : t("runAllAgents")}</Button>}</div>
      {runAllErrors.length > 0 && <div role="alert" style={{ marginTop: 16, padding: 14, border: "1px solid var(--warn)", borderRadius: 8, background: "var(--warn-bg)" }}><p>{t("runAllFailed")}</p><ul style={{ margin: "8px 0 0", paddingLeft: 20, display: "grid", gap: 6 }}>{runAllErrors.map((item, index) => <li key={`${item.agentId}-${index}`}>{item.name && <strong>{item.name}: </strong>}{item.error}{item.agentId && <> <Link className="mono eval-configure-link" href={`/agents/${item.agentId}?tab=evals`}>{t("configureCases")} →</Link></>}</li>)}</ul></div>}
      {agentId && start.isError && <p role="alert">{start.error.message}</p>}
      {(runs.isLoading || agents.isLoading) && <p>{t("loading")}</p>}
      {(runs.isError || agents.isError) && <p role="alert">{t("loadError")} <button onClick={() => { void runs.refetch(); void agents.refetch(); }}>{t("retry")}</button></p>}
      {agentId && precisionDelta != null && precisionDelta < 0 && <div role="status" style={{ marginTop: 20, padding: "11px 14px", borderRadius: 8, border: "1px solid var(--warn)", background: "var(--warn-bg)", color: "var(--text-secondary)" }}>{t("precisionDip", { points: Math.abs(precisionDelta * 100).toFixed(1) })}</div>}
      {agentId && newestComplete && <p>{t("runCaseCount", { count: newestComplete.snapshot.cases.length })}</p>}
      {!agentId && <section aria-label={t("agents")} style={{ marginTop: 28 }}><h2 style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>{t("agents")}</h2>
        {!agents.isLoading && !agents.isError && !agents.data?.length && <p>{t("noAgents")}</p>}
        <div style={{ display: "grid", gap: 10 }}>{agents.data?.map((item) => { const history = visibleRuns.filter((run) => run.agent_id === item.id && run.snapshot.scope === "suite" && run.status === "completed").slice(0, 5).reverse(); const latest = history[history.length - 1]; const recallHistory = latest ? history.filter((run) => compatibleEvalRuns(run, latest)).map((run) => run.result?.score?.recall) : []; return <Link className="eval-agent-card" key={item.id} href={`/eval/${item.id}`} style={{ ...panel, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, padding: "16px 18px", color: "inherit", textDecoration: "none" }}>
          <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 8, background: "var(--accent-subtle, rgba(59,130,246,.12))", color: "var(--accent)" }}><Icon.Cpu size={20} /></span>
          <div className="eval-agent-meta" style={{ flex: "1 1 150px", minWidth: 0 }}><strong>{item.name}</strong><div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{latest ? `${new Date(latest.created_at).toLocaleString()} · ${latest.status}` : t("noRuns")}</div></div>
          <MetricSparkline testId="eval-agent-trend-recall" values={recallHistory} color={metricColors.recall} />
          {([['recall', t('recall')], ['precision', t('precision')], ['citationAccuracy', t('citation')]] as const).map(([key, label]) => <div className="eval-agent-metric" key={key} style={{ flex: "0 1 90px", minWidth: 65 }}><small style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>{label}</small><div style={{ color: metricColors[key], fontSize: 22, fontWeight: 700 }}>{pct(latest?.result?.score?.[key])}</div></div>)}<Icon.ChevronRight className="eval-agent-arrow" aria-hidden="true" size={16} />
        </Link>; })}</div>
      </section>}
      {agentId && <section aria-label={t("metrics")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 24 }}>
        {([['recall', t('recall')], ['precision', t('precision')], ['citationAccuracy', t('citation')]] as const).map(([key, label]) => { const latest = newestComplete?.result?.score?.[key]; const previous = completed.length > 1 ? completed[completed.length - 2]?.result?.score?.[key] : null; const history = completed.map((run) => run.result?.score?.[key]); return <div key={key} style={{ ...panel, padding: 20, minHeight: 112 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><small style={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700 }}>{label}</small><MetricSparkline testId={`eval-metric-trend-${key}`} values={history} color={metricColors[key]} /></div><div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "baseline" }}><strong style={{ color: metricColors[key], fontSize: 30 }}>{pct(latest)}</strong>{latest != null && previous != null && <span style={{ color: latest >= previous ? "var(--ok)" : "var(--danger)", fontSize: 12 }}>{latest >= previous ? "+" : ""}{((latest - previous) * 100).toFixed(1)} pp</span>}</div></div>; })}
      </section>}
      {agentId && <section aria-label={t("metricTrend")} style={{ ...panel, padding: 20, marginTop: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><h2 style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>{t("metricTrend")}</h2><div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "var(--text-secondary)", fontSize: 12 }}>{metricKeys.map((key) => <span key={key}><span aria-hidden="true" style={{ color: metricColors[key] }}>━ </span>{key === "recall" ? t("recall") : key === "precision" ? t("precision") : t("citation")}</span>)}</div></div>
        {completed.length > 0 ? <>
        <svg viewBox="0 0 400 120" role="img" aria-label={t("metricTrend")} style={{ width: "100%", maxWidth: 800, height: 180 }}>
          {[0, 0.5, 1].map((value) => <g key={value}><line x1="25" x2="390" y1={110 - value * 100} y2={110 - value * 100} stroke="var(--border)" strokeWidth="0.5" /><text x="1" y={113 - value * 100} fill="var(--text-secondary)" fontSize="7">{value.toFixed(1)}</text></g>)}
          {([['recall', '#3b82f6'], ['precision', '#10b981'], ['citationAccuracy', '#f59e0b']] as const).map(([key, color]) => {
            const points = completed.map((run, index) => { const value = run.result!.score![key]; const x = (completed.length === 1 ? 205 : 25 + index * 365 / (completed.length - 1)) + trendOffsets[key]; return value == null ? null : `${x},${110 - value * 100}`; });
            return <g key={key}>{points.map((point, index) => point && <circle key={index} cx={point.split(',')[0]} cy={point.split(',')[1]} r="3" fill={color} />)}{points.slice(1).map((point, index) => point && points[index] ? <line key={index} x1={points[index]!.split(',')[0]} y1={points[index]!.split(',')[1]} x2={point.split(',')[0]} y2={point.split(',')[1]} stroke={color} strokeWidth="2" /> : null)}</g>;
          })}
        </svg></> : <p style={{ minHeight: 180, display: "grid", placeItems: "center", color: "var(--text-secondary)", fontSize: 13 }}>{t("noRuns")}</p>}
      </section>}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 32 }}><h2 style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>{t("history")}</h2>
      {!agentId && <label>{t("runPeriod")} <select aria-label={t("runPeriod")} value={period} onChange={(event) => { setPeriod(event.target.value); setSelected([]); }}><option value="all">{t("allTime")}</option><option value="1">{t("oneDay")}</option><option value="7">{t("sevenDays")}</option><option value="30">{t("thirtyDays")}</option></select></label>}
      {agentId && <Button kind="primary" disabled={selectedRuns.length !== 2} onClick={() => setComparing(true)}>{t("compare")}</Button>}</div>
      {!runs.isLoading && !visibleRuns.length && <p style={{ ...panel, marginTop: 12, padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>{t("noRuns")}</p>}
      {!!visibleRuns.length && <div style={{ ...panel, overflowX: "auto", marginTop: 12 }}><table aria-label={t("history")} style={{ width: "100%", minWidth: 780, borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
        <thead><tr style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 10, letterSpacing: ".05em" }}>
          {agentId && <th scope="col" style={{ padding: 12 }}><span className="sr-only">{t("select")}</span></th>}
          {!agentId && <th scope="col" style={{ padding: 12 }}>{t("agent")}</th>}
          {[t("ranAt"), t("status"), t("recall"), t("precision"), t("citation"), t("pass"), t("cost"), t("caseTime")].map((label) => <th scope="col" key={label} style={{ padding: 12 }}>{label}</th>)}
        </tr></thead><tbody>{visibleRuns.map((run) => <tr key={run.id} style={{ borderTop: "1px solid var(--border)" }}>
          {agentId && <td style={{ padding: 12 }}><input type="checkbox" aria-label={t("selectRun", { date: new Date(run.created_at).toLocaleString() })} checked={selected.includes(run.id)} disabled={!selected.includes(run.id) && selected.length === 2} onChange={(event) => setSelected(event.target.checked ? [...selected, run.id] : selected.filter((id) => id !== run.id))} /></td>}
          {!agentId && <td style={{ padding: 12 }}><Link href={`/eval/${run.agent_id}`}>{agents.data?.find((item) => item.id === run.agent_id)?.name ?? t("agent")}</Link></td>}
          <td style={{ padding: 12, whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{new Date(run.created_at).toLocaleString()}</td><td style={{ padding: 12 }}>{run.status} · {run.snapshot.scope ?? "legacy"}</td>
          {metricKeys.map((key) => { const value = run.result?.score?.[key]; return <td key={key} style={{ padding: 12, minWidth: 110 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span aria-hidden="true" style={{ height: 6, width: 48, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%`, background: metricColors[key] }} /></span><span>{pct(value)}</span></div></td>; })}
          <td style={{ padding: 12, whiteSpace: "nowrap" }}>{passCount(run)}</td><td style={{ padding: 12 }}>{money(run.result?.costUsd)}</td><td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatCaseTime(run)}</td>
        </tr>)}</tbody></table></div>}
      {comparing && selectedRuns.length === 2 && <Comparison runs={[selectedRuns[0]!, selectedRuns[1]!]} agentVersion={agent?.version} onClose={() => setComparing(false)} />}
    </main>
  </AppShell>;
}
