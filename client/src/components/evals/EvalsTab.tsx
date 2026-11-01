"use client";
import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import { useEvalCase, useEvalCases, useEvalRuns, useManageEvalCase, useSaveManualEvalCase, useStartEval, useStartEvalCase } from "@/lib/hooks/evals";

const percent = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value * 100)}%`;
export function EvalsTab({ agentId }: { agentId: string }) {
  const t = useTranslations("eval.pipeline");
  const cases = useEvalCases(agentId);
  const runs = useEvalRuns(agentId);
  const start = useStartEval();
  const startCase = useStartEvalCase();
  const [selectedCase, setSelectedCase] = React.useState<string | null>(null);
  const caseDialog = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => { if (selectedCase) caseDialog.current?.showModal(); }, [selectedCase]);
  const detail = useEvalCase(agentId, selectedCase);
  const manage = useManageEvalCase(agentId);
  const save = useSaveManualEvalCase(agentId);
  const [creating, setCreating] = React.useState(false);
  const editorDialog = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => { if (creating) editorDialog.current?.showModal(); }, [creating]);
  const [name, setName] = React.useState("");
  const [diff, setDiff] = React.useState("");
  const [file, setFile] = React.useState("");
  const [startLine, setStartLine] = React.useState(1);
  const [endLine, setEndLine] = React.useState(1);
  const [expectation, setExpectation] = React.useState<"must_find" | "must_not_flag">("must_find");
  React.useEffect(() => { if (detail.data && selectedCase) { setName(detail.data.name); setDiff(detail.data.diff); setFile(detail.data.anchor.file); setStartLine(detail.data.anchor.start_line); setEndLine(detail.data.anchor.end_line); setExpectation(detail.data.expectation); } }, [detail.data, selectedCase]);
  const latest = runs.data?.[0];
  const score = latest?.result?.score;
  const active = runs.data?.some((run) => run.status === "queued" || run.status === "running");
  if (cases.isLoading || runs.isLoading) return <p>{t("loading")}</p>;
  if (cases.isError || runs.isError) return <div role="alert">{t("loadError")} <button onClick={() => { void cases.refetch(); void runs.refetch(); }}>{t("retry")}</button></div>;
  return <section>
    <style>{`.eval-case-editor[open] { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; border: 1px solid var(--border-strong); border-radius: 12px; } .eval-case-editor > h2, .eval-case-editor > p { grid-column: 1 / -1; } .eval-case-editor > label { display: grid; gap: 6px; align-content: start; color: var(--text-secondary); font-size: 13px; } .eval-case-editor > label:nth-of-type(1) { grid-column: 1; grid-row: 3; } .eval-case-editor > label:nth-of-type(2) { grid-column: 1; grid-row: 4 / span 5; } .eval-case-editor > label:nth-of-type(3) { grid-column: 2; grid-row: 3; } .eval-case-editor > label:nth-of-type(4) { grid-column: 2; grid-row: 4; } .eval-case-editor > label:nth-of-type(5) { grid-column: 2; grid-row: 5; } .eval-case-editor > label:nth-of-type(6) { grid-column: 2; grid-row: 6; } .eval-case-editor input, .eval-case-editor textarea, .eval-case-editor select { min-width: 0; width: 100%; padding: 10px; border: 1px solid var(--border-strong); border-radius: 7px; background: var(--bg-primary); color: var(--text-primary); } .eval-case-editor > button { padding: 8px 14px; border: 1px solid var(--border-strong); border-radius: 6px; background: var(--bg-elevated); color: var(--text-primary); } @media (max-width: 700px) { .eval-case-editor[open] { display: block; } .eval-case-editor > label { margin: 12px 0; } }`}</style>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}><h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-secondary)" }}>{t("metrics")}</h2><Link href={`/eval/${agentId}`} style={{ color: "var(--text-secondary)", fontSize: 13 }}>{t("dashboard")}</Link></div>
    {latest && <p>{t("runCaseCount", { count: latest.snapshot.cases.length })}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {[[t("recall"), score?.recall, "#3b82f6"], [t("precision"), score?.precision, "#10b981"], [t("citation"), score?.citationAccuracy, "#f59e0b"]].map(([label, value, color]) => <div key={String(label)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}><small style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>{label}</small><div style={{ fontSize: 28, fontWeight: 700, color: String(color) }}>{percent(value as number | null | undefined)}</div></div>)}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}><small style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>{t("pass")}</small><div style={{ fontSize: 28, fontWeight: 700 }}>{score?.cases ? `${score.cases.filter((item) => item.passed).length}/${score.cases.length}` : "—"}</div></div>
    </div>
    {score && <p>{t("counts", { tp: score.counts.truePositive, fp: score.counts.knownFalsePositive, unlabeled: score.counts.unlabeled })}</p>}
    <p>{t("contextOmitted")}</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 24 }}><h2 style={{ fontSize: 18, flex: 1 }}>{t("cases")}</h2>
    <Button icon="Play" disabled={!cases.data?.length || !!active || start.isPending} onClick={() => start.mutate(agentId)}>{active || start.isPending ? t("running") : t("runAll")}</Button>
    <Button kind="primary" icon="Plus" onClick={() => { setName(""); setDiff(""); setFile(""); setStartLine(1); setEndLine(1); setExpectation("must_find"); setCreating(true); }}>{t("newCase")}</Button></div>
    {start.isError && <p role="alert">{start.error.message}</p>}
    {startCase.isError && <p role="alert">{startCase.error.message}</p>}
    {!cases.data?.length && <p>{t("noCases")}</p>}
    {cases.data?.map((item) => { const index = latest?.snapshot.cases.findIndex((entry) => entry.id === item.id) ?? -1; const result = latest?.result?.results.find((entry) => entry.caseId === item.id); return <details key={item.id} style={{ marginTop: 10, padding: 16, border: "1px solid var(--border)", background: "var(--bg-surface)", borderRadius: 10 }}>
      <summary>{item.name} · {result?.status === "failed" ? t("failed") : latest?.status === "completed" && index >= 0 && score?.cases[index] ? (score.cases[index].passed ? t("passed") : t("failed")) : t("unrun")}</summary>
      {result?.status === "failed" && <p>{result.error === "timeout" ? t("timeout") : t("reviewFailed")}</p>}
      <p>{item.expectation} · {item.anchor.file}:{item.anchor.start_line}–{item.anchor.end_line}</p>
      <p>{item.finding_id ? t("findingOrigin") : t("manualOrigin")}</p>
      <p>Input: {item.fixture_id === "original-review" ? "Original review diff" : item.fixture_id}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><Button size="sm" icon="Play" disabled={!!active || start.isPending || startCase.isPending} onClick={() => startCase.mutate({ agentId, caseId: item.id })}>{t("runCase")}</Button>
      <Button size="sm" onClick={() => { setName(item.name); setSelectedCase(item.id); }}>{t("inspectCase")}</Button>
      <Button size="sm" kind="danger" onClick={() => { if (window.confirm(t("confirmDelete"))) manage.mutate({ caseId: item.id }); }}>{t("deleteCase")}</Button></div>
    </details>; })}
    {manage.isError && <p role="alert">{manage.error.message}</p>}
    {selectedCase && <dialog className="eval-case-editor" ref={caseDialog} onClose={() => setSelectedCase(null)} aria-label={t("inspectCase")} style={{ background: "var(--bg-surface)", color: "var(--text-primary)", padding: 24, width: "min(900px, 90vw)", maxHeight: "90vh", overflow: "auto", margin: "auto" }}><h2>{t("inspectCase")}</h2>
      {detail.isLoading && <p>{t("loading")}</p>}{detail.isError && <p role="alert">{t("loadError")}</p>}
      {detail.data && <><p>{t("manualEditWarning")}</p><label>{t("caseName")} <input value={name} onChange={(event) => setName(event.target.value)} /></label><label>{t("caseDiff")} <textarea value={diff} onChange={(event) => setDiff(event.target.value)} rows={12} style={{ display: "block", width: "100%", fontFamily: "monospace" }} /></label><label>{t("caseFile")} <input value={file} onChange={(event) => setFile(event.target.value)} /></label><label>{t("startLine")} <input type="number" min={1} value={startLine} onChange={(event) => setStartLine(Number(event.target.value))} /></label><label>{t("endLine")} <input type="number" min={1} value={endLine} onChange={(event) => setEndLine(Number(event.target.value))} /></label><label>{t("expectation")} <select value={expectation} onChange={(event) => setExpectation(event.target.value as typeof expectation)}><option value="must_find">{t("mustFind")}</option><option value="must_not_flag">{t("mustNotFlag")}</option></select></label><button disabled={!name.trim() || !diff || !file || save.isPending} onClick={() => save.mutate({ caseId: selectedCase, input: { name: name.trim(), diff, expectation, anchor: { file, start_line: startLine, end_line: endLine } } }, { onSuccess: () => caseDialog.current?.close() })}>{t("saveCase")}</button>{save.isError && <p role="alert">{save.error.message}</p>}</>}
      <button onClick={() => caseDialog.current?.close()}>{t("close")}</button></dialog>}
    {creating && <dialog className="eval-case-editor" ref={editorDialog} onClose={() => setCreating(false)} aria-label={t("newCase")} style={{ background: "var(--bg-surface)", color: "var(--text-primary)", padding: 24, width: "min(900px, 90vw)", maxHeight: "90vh", overflow: "auto", margin: "auto" }}><h2>{t("newCase")}</h2><p>{t("manualCaseWarning")}</p>
      <label>{t("caseName")} <input value={name} onChange={(event) => setName(event.target.value)} /></label><label>{t("caseDiff")} <textarea value={diff} onChange={(event) => setDiff(event.target.value)} rows={12} style={{ display: "block", width: "100%", fontFamily: "monospace" }} /></label><label>{t("caseFile")} <input value={file} onChange={(event) => setFile(event.target.value)} /></label><label>{t("startLine")} <input type="number" min={1} value={startLine} onChange={(event) => setStartLine(Number(event.target.value))} /></label><label>{t("endLine")} <input type="number" min={1} value={endLine} onChange={(event) => setEndLine(Number(event.target.value))} /></label><label>{t("expectation")} <select value={expectation} onChange={(event) => setExpectation(event.target.value as typeof expectation)}><option value="must_find">{t("mustFind")}</option><option value="must_not_flag">{t("mustNotFlag")}</option></select></label><button disabled={!name.trim() || !diff || !file || save.isPending} onClick={() => save.mutate({ caseId: null, input: { name: name.trim(), diff, expectation, anchor: { file, start_line: startLine, end_line: endLine } } }, { onSuccess: () => editorDialog.current?.close() })}>{t("saveCase")}</button>{save.isError && <p role="alert">{save.error.message}</p>}<button onClick={() => editorDialog.current?.close()}>{t("close")}</button></dialog>}
    <h2>{t("history")}</h2>
    {!runs.data?.length && <p>{t("noRuns")}</p>}
    {runs.data?.map((run) => <p key={run.id}>{new Date(run.created_at).toLocaleString()} · {run.status} · {percent(run.result?.score?.recall)} / {percent(run.result?.score?.precision)} / {percent(run.result?.score?.citationAccuracy)}</p>)}
  </section>;
}
