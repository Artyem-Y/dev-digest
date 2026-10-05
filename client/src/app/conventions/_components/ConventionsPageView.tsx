"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { Button, FormField, Modal, TextInput, Textarea } from "@devdigest/ui";
import { useRepos } from "@/lib/hooks/core";
import { useAgents } from "@/lib/hooks/agents";
import { useConventions, useCreateConventionsSkill, useScanConventions, useUpdateConvention } from "@/lib/hooks/conventions";
import { githubBlobUrl } from "@/lib/github-urls";

export function ConventionsPageView() {
  const t = useTranslations("conventions");
  const { data: repos = [] } = useRepos();
  const { data: agents = [] } = useAgents();
  const [repoId, setRepoId] = useState<string | undefined>();
  const selectedId = repoId ?? repos[0]?.id;
  const repo = repos.find((item) => item.id === selectedId);
  const { data: candidates = [], isLoading } = useConventions(selectedId);
  const scan = useScanConventions();
  const update = useUpdateConvention();
  const createSkill = useCreateConventionsSkill();
  const [editing, setEditing] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const visibleCandidates = candidates.filter((item) => item.status !== "rejected");
  const accepted = visibleCandidates.filter((item) => item.status === "accepted");
  const suggestedName = "repo-conventions";
  const suggestedBody = [
    `# ${suggestedName}`,
    "",
    "Flag changes that violate these verified repository conventions.",
    "",
    ...accepted.flatMap((item) => [`## ${item.rule}`, `Evidence: \`${item.evidence_path}:${item.evidence_line}\`.`, ""]),
  ].join("\n");

  return <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}><main style={{ padding: 28, maxWidth: 980, margin: "0 auto" }}>
    <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
      <div><h1 style={{ marginBottom: 6 }}>{t("page.headingPrefix")}{repo?.full_name ?? t("page.repoFallback")}</h1><p style={{ color: "var(--text-secondary)" }}>{t("page.subtitle")}</p></div>
      <div style={{ display: "flex", gap: 8 }}>
        <select aria-label="Repository" value={selectedId ?? ""} onChange={(event) => setRepoId(event.target.value)}>{repos.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
        <button type="button" disabled={!selectedId || scan.isPending} onClick={() => selectedId && scan.mutate(selectedId)}>{scan.isPending ? t("page.scanning") : t("page.runExtraction")}</button>
        <button type="button" disabled={!selectedId || scan.isPending || visibleCandidates.length === 0} onClick={() => selectedId && scan.mutate(selectedId)}>{t("page.rescan")}</button>
        {accepted.length > 0 && <button type="button" disabled={!selectedId || createSkill.isPending} onClick={() => setCreateOpen(true)}>Create skill</button>}
      </div>
    </div>
    {isLoading ? <p>{t("page.scanning")}</p> : visibleCandidates.length === 0 ? <div style={{ padding: 28, color: "var(--text-secondary)" }}><h2>{t("page.empty.title")}</h2><p>{t("page.empty.body")}</p></div> : <div style={{ display: "grid", gap: 12, marginTop: 24 }}>{visibleCandidates.map((candidate) => <article key={candidate.id} style={{ border: "1px solid var(--border)", borderLeft: `3px solid ${candidate.status === "accepted" ? "var(--green)" : "var(--border)"}`, borderRadius: 8, padding: 16 }}>
      {editing === candidate.id ? <input aria-label="Convention rule" defaultValue={candidate.rule} autoFocus onKeyDown={(event) => { if (event.key === "Enter" && selectedId) { update.mutate({ repoId: selectedId, id: candidate.id, status: candidate.status, rule: event.currentTarget.value }); setEditing(null); } }} /> : <h3 style={{ marginTop: 0 }}>{candidate.rule}</h3>}
      <a href={repo ? githubBlobUrl(repo.full_name, repo.default_branch, candidate.evidence_path, candidate.evidence_line) : "#"} target="_blank" rel="noreferrer">{candidate.evidence_path}:{candidate.evidence_line}</a>
      <pre style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 10 }}>{candidate.evidence_snippet}</pre>
      <small>{t("card.confidence")}: {Math.round(candidate.confidence * 100)}% · {candidate.category}</small>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button type="button" onClick={() => selectedId && update.mutate({ repoId: selectedId, id: candidate.id, status: "accepted" })}>Accept</button><button type="button" onClick={() => selectedId && update.mutate({ repoId: selectedId, id: candidate.id, status: "rejected" })}>Reject</button><button type="button" onClick={() => setEditing(candidate.id)}>Edit</button></div>
    </article>)}</div>}
    {createOpen && selectedId && <CreateSkillModal agents={agents} defaultName={suggestedName} defaultBody={suggestedBody} saving={createSkill.isPending} onClose={() => setCreateOpen(false)} onCreate={(name, description, body, agentId) => createSkill.mutate({ repoId: selectedId, name, description, body, agentId }, { onSuccess: () => setCreateOpen(false) })} />}
  </main></AppShell>;
}

function CreateSkillModal({ agents, defaultName, defaultBody, saving, onClose, onCreate }: { agents: Array<{ id: string; name: string }>; defaultName: string; defaultBody: string; saving: boolean; onClose: () => void; onCreate: (name: string, description: string, body: string, agentId?: string) => void }) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("Repository conventions extracted from verified evidence");
  const [body, setBody] = useState(defaultBody);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  return <Modal title="Create skill from conventions" subtitle="Only accepted conventions are included. You can edit everything before saving." onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" onClick={() => onCreate(name, description, body, agentId || undefined)} disabled={saving || !name.trim() || !body.trim()}>{saving ? "Creating…" : "Create skill"}</Button></>}>
    <FormField label="Name"><TextInput value={name} onChange={setName} /></FormField>
    <FormField label="Description"><TextInput value={description} onChange={setDescription} /></FormField>
    <FormField label="Attach to agent"><select aria-label="Attach to agent" value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">No agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></FormField>
    <FormField label="Skill body"><Textarea value={body} onChange={setBody} rows={14} mono /></FormField>
  </Modal>;
}
