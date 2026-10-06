"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, FormField, Modal, ProgressBar, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import { useRepos } from "@/lib/hooks/core";
import { useAgents } from "@/lib/hooks/agents";
import { useConventions, useCreateConventionsSkill, useScanConventions, useUpdateConvention } from "@/lib/hooks/conventions";
import { githubBlobUrl } from "@/lib/github-urls";

export function ConventionsPageView() {
  const t = useTranslations("conventions");
  const { data: repos = [] } = useRepos();
  const { data: agents = [] } = useAgents();
  const [repoId, setRepoId] = useState<string | undefined>();
  const [editing, setEditing] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const selectedId = repoId ?? repos[0]?.id;
  const repo = repos.find((item) => item.id === selectedId);
  const { data: candidates = [], isLoading } = useConventions(selectedId);
  const scan = useScanConventions();
  const update = useUpdateConvention();
  const createSkill = useCreateConventionsSkill();
  const visibleCandidates = candidates.filter((item) => item.status !== "rejected");
  const accepted = visibleCandidates.filter((item) => item.status === "accepted");
  const canExtract = Boolean(selectedId && repo?.clone_path);
  const suggestedName = "repo-conventions";
  const suggestedBody = [
    `# ${suggestedName}`,
    "",
    t("skill.defaultInstruction"),
    "",
    ...accepted.flatMap((item) => [`## ${item.rule}`, t("skill.evidence", { path: item.evidence_path, line: item.evidence_line }), ""]),
  ].join("\n");

  const runScan = () => selectedId && scan.mutate(selectedId);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "30px 28px 64px" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 24, lineHeight: 1.2, letterSpacing: "-0.035em" }}>
              {t("page.headingPrefix")}<span style={{ color: "var(--accent)" }}>{repo?.full_name ?? t("page.repoFallback")}</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 13.5 }}>{t("page.subtitle")}</p>
            <div style={{ marginTop: 14, maxWidth: 310 }}><SelectInput aria-label={t("page.repository")} value={selectedId ?? ""} onChange={setRepoId} options={repos.map((item) => ({ value: item.id, label: item.full_name }))} mono={false} /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Button kind="secondary" size="sm" icon="RefreshCw" loading={scan.isPending} disabled={!canExtract} onClick={runScan}>
              {visibleCandidates.length > 0 ? t("page.rescan") : t("page.runScan")}
            </Button>
            <Button
              kind="primary"
              size="sm"
              icon="Sparkles"
              disabled={createSkill.isPending || accepted.length === 0}
              onClick={() => setCreateOpen(true)}
            >
              {t("skill.create")}
            </Button>
          </div>
        </header>

        {repo && !repo.clone_path && <div role="status"><Card style={{ marginBottom: 16, color: "var(--text-secondary)", fontSize: 13 }}>{t("page.cloneRequired")}</Card></div>}

        <section aria-label={t("page.candidates")}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge color="var(--accent-text)" bg="var(--accent-bg)" icon="ListChecks">{t("page.acceptedCount", { count: accepted.length })}</Badge>
              {visibleCandidates.length > 0 && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("page.candidateCount", { count: visibleCandidates.length })}</span>}
            </div>
          </div>

          {isLoading ? <p style={{ color: "var(--text-secondary)" }}>{t("page.scanning")}</p> : visibleCandidates.length === 0 ? (
            <Card style={{ padding: "30px 22px", color: "var(--text-secondary)" }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 16 }}>{t("page.empty.title")}</h2>
              <p style={{ marginTop: 6, maxWidth: 560 }}>{t("page.empty.body")}</p>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {visibleCandidates.map((candidate) => <ConventionCard key={candidate.id} candidate={candidate} repo={repo} editing={editing === candidate.id} onEdit={() => setEditing(candidate.id)} onCancel={() => setEditing(null)} onSave={(rule) => {
                if (!selectedId) return;
                update.mutate({ repoId: selectedId, id: candidate.id, status: candidate.status, rule });
                setEditing(null);
              }} onStatus={(status) => selectedId && update.mutate({ repoId: selectedId, id: candidate.id, status })} />)}
            </div>
          )}
        </section>

        {createOpen && selectedId && <CreateSkillModal agents={agents} defaultName={suggestedName} defaultBody={suggestedBody} saving={createSkill.isPending} onClose={() => setCreateOpen(false)} onCreate={(name, description, body, agentId) => createSkill.mutate({ repoId: selectedId, name, description, body, agentId }, { onSuccess: () => setCreateOpen(false) })} />}
      </main>
    </AppShell>
  );
}

function ConventionCard({ candidate, repo, editing, onEdit, onCancel, onSave, onStatus }: {
  candidate: ConventionCandidate;
  repo: { full_name: string; default_branch: string } | undefined;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (rule: string) => void;
  onStatus: (status: ConventionCandidate["status"]) => void;
}) {
  const t = useTranslations("conventions");
  const [rule, setRule] = useState(candidate.rule);
  const confidence = Math.round(candidate.confidence * 100);
  const accepted = candidate.status === "accepted";
  const source = repo ? githubBlobUrl(repo.full_name, repo.default_branch, candidate.evidence_path, candidate.evidence_line) : undefined;

  return <Card pad={false} style={{ borderLeft: `3px solid ${accepted ? "var(--ok)" : "var(--border-strong)"}`, overflow: "hidden" }}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 164px", gap: 18, padding: 18 }}>
      <div style={{ minWidth: 0, cursor: editing ? "default" : "text" }} onClick={() => !editing && onEdit()}>
        {editing ? <div style={{ marginBottom: 12 }} onClick={(event) => event.stopPropagation()}><Textarea aria-label={t("card.rule")} value={rule} autoFocus onChange={setRule} onKeyDown={(event) => event.key === "Enter" && (event.metaKey || event.ctrlKey) && onSave(rule)} rows={3} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}><Button kind="ghost" size="sm" onClick={onCancel}>{t("skill.cancel")}</Button><Button kind="primary" size="sm" onClick={() => onSave(rule)}>{t("card.save")}</Button></div></div> : <h3 style={{ fontSize: 15.5, fontStyle: "italic", lineHeight: 1.4 }}>{candidate.rule}</h3>}
        <a href={source} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mono" style={{ display: "block", marginTop: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-surface)", color: "var(--text-secondary)", padding: "8px 10px", fontSize: 12.5 }}>{candidate.evidence_path}:{candidate.evidence_line}</a>
        <pre className="mono" style={{ margin: 0, border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", background: "var(--code-bg)", color: "var(--text-primary)", padding: "12px 14px", overflowX: "auto", fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{candidate.evidence_snippet}</pre>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13, maxWidth: 240 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("card.confidence")}</span>
          <ProgressBar value={confidence} color={confidence >= 80 ? "var(--ok)" : "var(--warn)"} height={5} />
          <span className="mono" style={{ color: "var(--text-secondary)", fontSize: 12 }}>{confidence}%</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignSelf: "start" }}>
        <Button kind="primary" size="sm" full icon="Check" onClick={() => onStatus("accepted")}>{accepted ? t("card.accepted") : t("card.accept")}</Button>
        <Button kind="ghost" size="sm" full icon="X" onClick={() => onStatus("rejected")}>{t("card.reject")}</Button>
        <Button kind="secondary" size="sm" full onClick={onEdit}>{t("card.edit")}</Button>
      </div>
    </div>
  </Card>;
}

function CreateSkillModal({ agents, defaultName, defaultBody, saving, onClose, onCreate }: {
  agents: Array<{ id: string; name: string }>;
  defaultName: string;
  defaultBody: string;
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, body: string, agentId?: string) => void;
}) {
  const t = useTranslations("conventions");
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(t("skill.defaultDescription"));
  const [body, setBody] = useState(defaultBody);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");

  return <Modal width={800} title={t("skill.modalTitle")} subtitle={t("skill.modalSubtitle")} onClose={onClose} footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><Button kind="ghost" onClick={onClose}>{t("skill.cancel")}</Button><Button kind="primary" icon="Sparkles" onClick={() => onCreate(name, description, body, agentId || undefined)} disabled={saving || !name.trim() || !body.trim()}>{saving ? t("skill.creating") : t("skill.create")}</Button></div>}>
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ padding: "11px 13px", borderRadius: 6, background: "var(--accent-bg)", color: "var(--text-secondary)", fontSize: 13 }}>{t("skill.callout")}</div>
      <FormField label={t("skill.name")}><TextInput value={name} onChange={setName} /></FormField>
      <FormField label={t("skill.description")}><TextInput value={description} onChange={setDescription} /></FormField>
      <FormField label={t("skill.agent")}><SelectInput aria-label={t("skill.agent")} value={agentId} onChange={setAgentId} options={[{ value: "", label: t("skill.noAgent") }, ...agents.map((agent) => ({ value: agent.id, label: agent.name }))]} mono={false} /></FormField>
      <FormField label={t("skill.body")}><Textarea value={body} onChange={setBody} rows={14} mono /></FormField>
    </div>
  </Modal>;
}
