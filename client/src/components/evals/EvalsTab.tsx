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
  const [inputTab, setInputTab] = React.useState<"diff" | "files" | "meta">("diff");
  React.useEffect(() => { if (detail.data && selectedCase) { setName(detail.data.name); setDiff(detail.data.diff); setFile(detail.data.anchor.file); setStartLine(detail.data.anchor.start_line); setEndLine(detail.data.anchor.end_line); setExpectation(detail.data.expectation); } }, [detail.data, selectedCase]);
  const latest = runs.data?.find((run) => run.snapshot.scope === "suite");
  const score = latest?.result?.score;
  const active = runs.data?.some((run) => run.status === "queued" || run.status === "running");
  if (cases.isLoading || runs.isLoading) return <p>{t("loading")}</p>;
  if (cases.isError || runs.isError) return <div role="alert">{t("loadError")} <button onClick={() => { void cases.refetch(); void runs.refetch(); }}>{t("retry")}</button></div>;
  return <section style={{ display: "grid", gap: 24, paddingBottom: 24, maxWidth: 720 }}>
    <style>{`.eval-case-editor[open] { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; border: 1px solid var(--border-strong); border-radius: 12px; } .eval-case-header { grid-column: 1 / -1; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); } .eval-case-header h2 { font-size: 18px; font-weight: 700; } .eval-case-header p { margin-top: 4px; color: var(--text-secondary); font-size: 13px; } .eval-case-editor > label { display: grid; gap: 6px; align-content: start; color: var(--text-secondary); font-size: 13px; } .eval-case-editor > label:nth-of-type(1) { grid-column: 1; grid-row: 3; } .eval-case-editor > label:nth-of-type(2) { grid-column: 1; grid-row: 5 / span 5; } .eval-case-tabs { grid-column: 1; grid-row: 4; display: flex; gap: 6px; } .eval-case-tabs button { padding: 7px 10px; color: var(--text-secondary); background: transparent; border: 0; border-bottom: 2px solid transparent; } .eval-case-tabs button[aria-selected="true"] { color: var(--text-primary); border-bottom-color: var(--accent); } .eval-case-input-preview { grid-column: 1; grid-row: 5 / span 5; white-space: pre-wrap; overflow-wrap: anywhere; } .eval-case-expected { grid-column: 2; grid-row: 7 / span 3; min-width: 0; font-size: 13px; color: var(--text-secondary); } .eval-case-expected pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 12px; background: var(--bg-primary); border-radius: 7px; color: var(--text-primary); } .eval-case-editor [hidden] { display: none !important; } .eval-case-editor > label:nth-of-type(3) { grid-column: 2; grid-row: 3; } .eval-case-editor > label:nth-of-type(4) { grid-column: 2; grid-row: 4; } .eval-case-editor > label:nth-of-type(5) { grid-column: 2; grid-row: 5; } .eval-case-editor > label:nth-of-type(6) { grid-column: 2; grid-row: 6; } .eval-case-footer { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; position: sticky; bottom: -24px; padding: 12px 0 0; background: var(--bg-surface); border-top: 1px solid var(--border); } .eval-case-editor input, .eval-case-editor textarea, .eval-case-editor select { min-width: 0; width: 100%; padding: 10px; border: 1px solid var(--border-strong); border-radius: 7px; background: var(--bg-primary); color: var(--text-primary); } @media (max-width: 700px) { .eval-case-editor[open] { display: block; } .eval-case-editor > label { margin: 12px 0; } .eval-case-header { margin-bottom: 14px; } .eval-case-footer { position: static; margin-top: 16px; } }`}</style>
    <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 12 }}><h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-secondary)" }}>{t("metrics")}</h2><Link href={`/eval/${agentId}`} style={{ color: "var(--text-secondary)", fontSize: 13, textDecoration: "none" }}>{t("dashboard")}</Link></div>
    {latest && <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: 13 }}>{t("runCaseCount", { count: latest.snapshot.cases.length })}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {[[t("recall"), score?.recall, "#3b82f6"], [t("precision"), score?.precision, "#10b981"], [t("citation"), score?.citationAccuracy, "#f59e0b"]].map(([label, value, color]) => <div key={String(label)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}><small style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>{label}</small><div style={{ fontSize: 28, fontWeight: 700, color: String(color) }}>{percent(value as number | null | undefined)}</div></div>)}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}><small style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>{t("pass")}</small><div style={{ fontSize: 28, fontWeight: 700 }}>{score?.cases ? `${score.cases.filter((item) => item.passed).length}/${score.cases.length}` : "—"}</div></div>
    </div>
    {score && <p style={{ margin: "12px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>{t("counts", { tp: score.counts.truePositive, fp: score.counts.knownFalsePositive, unlabeled: score.counts.unlabeled })}</p>}
    <p style={{ margin: "12px 0 0", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 13 }}>{t("contextOmitted")}</p>
    </div>
    <div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}><h2 style={{ fontSize: 18, flex: 1 }}>{t("cases")}</h2>
    <Button icon="Play" disabled={!cases.data?.length || !!active || start.isPending} onClick={() => start.mutate(agentId)}>{active || start.isPending ? t("running") : t("runAll")}</Button>
    <Button kind="primary" icon="Plus" onClick={() => { setName(""); setDiff(""); setFile(""); setStartLine(1); setEndLine(1); setExpectation("must_find"); setInputTab("diff"); setCreating(true); }}>{t("newCase")}</Button></div>
    {start.isError && <p role="alert">{start.error.message}</p>}
    {startCase.isError && <p role="alert">{startCase.error.message}</p>}
    {!cases.data?.length && <p>{t("noCases")}</p>}
    {cases.data?.map((item) => {
      const caseRun = runs.data?.find((run) => run.snapshot.scope !== undefined && run.snapshot.cases.some((entry) => entry.id === item.id));
      const index = caseRun?.snapshot.cases.findIndex((entry) => entry.id === item.id) ?? -1;
      const scored = index >= 0 ? caseRun?.result?.score?.cases[index] : undefined;
      const result = caseRun?.result?.results.find((entry) => entry.caseId === item.id);
      const status = result?.status === "failed" ? "failed" : scored ? (scored.passed ? "passed" : "failed") : "unrun";
      const expected = item.expectation === "must_find" ? 1 : 0;
      const actual = scored?.matched ? 1 : 0;
      return <article key={item.id} style={{ marginTop: 10, padding: "14px 16px", border: "1px solid var(--border)", background: "var(--bg-surface)", borderRadius: 10 }}><div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <span aria-label={t(status)} title={t(status)} style={{ flex: "0 0 22px", display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: "50%", fontWeight: 700, color: status === "passed" ? "var(--ok)" : status === "failed" ? "var(--danger)" : "var(--text-secondary)", background: status === "passed" ? "var(--ok-bg)" : status === "failed" ? "var(--crit-bg)" : "var(--bg-elevated)" }}>{status === "passed" ? "✓" : status === "failed" ? "×" : "·"}</span>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}><strong style={{ display: "block", overflowWrap: "anywhere" }}>{item.name}</strong>
      <span style={{ display: "block", marginTop: 3, color: "var(--text-secondary)", fontSize: 13, overflowWrap: "anywhere" }}>
        {result?.status === "failed" ? (result.error === "timeout" ? t("timeout") : t("reviewFailed")) : scored ? t("expectedGot", { expected, actual }) : `${item.expectation === "must_find" ? t("mustFind") : t("mustNotFlag")} · ${item.anchor.file}:${item.anchor.start_line}–${item.anchor.end_line}`}
      </span></div>
      <span style={{ padding: "4px 8px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{item.expectation === "must_find" ? t("mustFind") : t("mustNotFlag")}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><Button size="sm" icon="Play" disabled={!!active || start.isPending || startCase.isPending} onClick={() => startCase.mutate({ agentId, caseId: item.id })}>{t("runCase")}</Button>
      <Button size="sm" onClick={() => { setName(item.name); setInputTab("diff"); setSelectedCase(item.id); }}>{t("inspectCase")}</Button>
      <Button size="sm" kind="danger" onClick={() => { if (window.confirm(t("confirmDelete"))) manage.mutate({ caseId: item.id }); }}>{t("deleteCase")}</Button></div>
    </div></article>; })}
    {manage.isError && <p role="alert">{manage.error.message}</p>}
    </div>
    {selectedCase && <dialog className="eval-case-editor" ref={caseDialog} onClose={() => setSelectedCase(null)} aria-label={t("inspectCase")} style={{ background: "var(--bg-surface)", color: "var(--text-primary)", padding: 24, width: "min(920px, 90vw)", maxHeight: "90vh", overflow: "auto", margin: "auto" }}>
      <div className="eval-case-header"><div><h2>{t("inspectCase")}</h2><p>{t("manualEditWarning")}</p></div><Button kind="tertiary" icon="X" aria-label={`${t("close")} ${t("inspectCase")}`} onClick={() => caseDialog.current?.close()} /></div>
      {detail.isLoading && <p>{t("loading")}</p>}{detail.isError && <p role="alert">{t("loadError")}</p>}
      {detail.data && <><label>{t("caseName")} <input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="eval-case-tabs" role="tablist" aria-label={t("inputDiff")}>{([['diff', t('inputDiff')], ['files', t('inputFiles')], ['meta', t('inputPrMeta')]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={inputTab === key} onClick={() => setInputTab(key)}>{label}</button>)}</div><label hidden={inputTab !== "diff"}>{t("caseDiff")} <textarea value={diff} onChange={(event) => setDiff(event.target.value)} rows={12} style={{ display: "block", width: "100%", fontFamily: "monospace" }} /></label><label>{t("caseFile")} <input value={file} onChange={(event) => setFile(event.target.value)} /></label><label>{t("startLine")} <input type="number" min={1} value={startLine} onChange={(event) => setStartLine(Number(event.target.value))} /></label><label>{t("endLine")} <input type="number" min={1} value={endLine} onChange={(event) => setEndLine(Number(event.target.value))} /></label><label>{t("expectation")} <select value={expectation} onChange={(event) => setExpectation(event.target.value as typeof expectation)}><option value="must_find">{t("mustFind")}</option><option value="must_not_flag">{t("mustNotFlag")}</option></select></label><pre className="eval-case-input-preview" hidden={inputTab === "diff"}>{inputTab === "files" ? file || "—" : t("prMetaUnavailable")}</pre><div className="eval-case-expected"><strong>{t("expectedOutput")}</strong><pre>{JSON.stringify({ expectation, anchor: { file, start_line: startLine, end_line: endLine } }, null, 2)}</pre></div>{save.isError && <p role="alert">{save.error.message}</p>}<div className="eval-case-footer"><Button kind="primary" className="eval-case-primary-action" disabled={!name.trim() || !diff || !file || save.isPending} onClick={() => save.mutate({ caseId: selectedCase, input: { name: name.trim(), diff, expectation, anchor: { file, start_line: startLine, end_line: endLine } } }, { onSuccess: () => caseDialog.current?.close() })}>{t("saveCase")}</Button><Button onClick={() => caseDialog.current?.close()}>{t("close")}</Button></div></>}
      </dialog>}
    {creating && <dialog className="eval-case-editor" ref={editorDialog} onClose={() => setCreating(false)} aria-label={t("newCase")} style={{ background: "var(--bg-surface)", color: "var(--text-primary)", padding: 24, width: "min(920px, 90vw)", maxHeight: "90vh", overflow: "auto", margin: "auto" }}>
      <div className="eval-case-header"><div><h2>{t("newCase")}</h2><p>{t("manualCaseWarning")}</p></div><Button kind="tertiary" icon="X" aria-label={`${t("close")} ${t("newCase")}`} onClick={() => editorDialog.current?.close()} /></div>
      <label>{t("caseName")} <input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="eval-case-tabs" role="tablist" aria-label={t("inputDiff")}>{([['diff', t('inputDiff')], ['files', t('inputFiles')], ['meta', t('inputPrMeta')]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={inputTab === key} onClick={() => setInputTab(key)}>{label}</button>)}</div><label hidden={inputTab !== "diff"}>{t("caseDiff")} <textarea value={diff} onChange={(event) => setDiff(event.target.value)} rows={12} style={{ display: "block", width: "100%", fontFamily: "monospace" }} /></label><label>{t("caseFile")} <input value={file} onChange={(event) => setFile(event.target.value)} /></label><label>{t("startLine")} <input type="number" min={1} value={startLine} onChange={(event) => setStartLine(Number(event.target.value))} /></label><label>{t("endLine")} <input type="number" min={1} value={endLine} onChange={(event) => setEndLine(Number(event.target.value))} /></label><label>{t("expectation")} <select value={expectation} onChange={(event) => setExpectation(event.target.value as typeof expectation)}><option value="must_find">{t("mustFind")}</option><option value="must_not_flag">{t("mustNotFlag")}</option></select></label><pre className="eval-case-input-preview" hidden={inputTab === "diff"}>{inputTab === "files" ? file || "—" : t("prMetaUnavailable")}</pre><div className="eval-case-expected"><strong>{t("expectedOutput")}</strong><pre>{JSON.stringify({ expectation, anchor: { file, start_line: startLine, end_line: endLine } }, null, 2)}</pre></div>{save.isError && <p role="alert">{save.error.message}</p>}<div className="eval-case-footer"><Button kind="primary" className="eval-case-primary-action" disabled={!name.trim() || !diff || !file || save.isPending} onClick={() => save.mutate({ caseId: null, input: { name: name.trim(), diff, expectation, anchor: { file, start_line: startLine, end_line: endLine } } }, { onSuccess: () => editorDialog.current?.close() })}>{t("saveCase")}</Button><Button onClick={() => editorDialog.current?.close()}>{t("close")}</Button></div></dialog>}
    <section aria-labelledby="eval-run-history" style={{ display: "grid", gap: 10 }}>
      <h2 id="eval-run-history" style={{ fontSize: 18 }}>{t("history")}</h2>
      {!runs.data?.length && <div style={{ padding: 24, textAlign: "center", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{t("noRuns")}</div>}
      {!!runs.data?.length && <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-surface)" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680, fontSize: 13 }}>
        <thead><tr style={{ color: "var(--text-secondary)", textAlign: "left", background: "var(--bg-elevated)" }}>{[t("ranAt"), t("status"), t("scope"), t("recall"), t("precision"), t("citation")].map((label) => <th key={label} scope="col" style={{ padding: "10px 14px", fontWeight: 600 }}>{label}</th>)}</tr></thead>
        <tbody>{runs.data.map((run) => <tr key={run.id} style={{ borderTop: "1px solid var(--border)" }}>
          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>{new Date(run.created_at).toLocaleString()}</td>
          <td style={{ padding: "11px 14px" }}>{run.status}</td>
          <td style={{ padding: "11px 14px" }}>{run.snapshot.scope === "suite" ? t("suiteRun") : run.snapshot.scope === "case" ? t("caseRun") : t("legacyRun")}</td>
          <td style={{ padding: "11px 14px", color: "#3b82f6", fontWeight: 600 }}>{percent(run.result?.score?.recall)}</td>
          <td style={{ padding: "11px 14px", color: "#10b981", fontWeight: 600 }}>{percent(run.result?.score?.precision)}</td>
          <td style={{ padding: "11px 14px", color: "#f59e0b", fontWeight: 600 }}>{percent(run.result?.score?.citationAccuracy)}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </section>;
}
