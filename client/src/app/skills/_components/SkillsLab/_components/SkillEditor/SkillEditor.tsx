"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, FormField, Icon, Markdown, Modal, SelectInput, Textarea, TextInput, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkillVersion, useRestoreSkill, useSkillVersions } from "@/lib/hooks/skills";

export function SkillEditor({ skill, name, description, body, type, onName, onDescription, onBody, onType, onSave, onDelete, saving, onEnabled }: { skill?: Skill; name: string; description: string; body: string; type: Skill["type"]; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onType: (value: Skill["type"]) => void; onSave: () => void; onDelete: () => void; saving: boolean; onEnabled: (value: boolean) => void }) {
  const t = useTranslations("skills");
  const [tab, setTab] = React.useState<"config" | "preview" | "versions">("config");
  const { data: versions = [], isLoading: versionsLoading } = useSkillVersions(skill?.id);
  const restore = useRestoreSkill();
  const removeVersion = useDeleteSkillVersion();
  return <Card pad={false} style={{ maxWidth: 820, overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 20px", borderBottom: "1px solid var(--border)" }}><h1 style={{ flex: 1, fontSize: 20 }}>{skill ? skill.name : t("editor.newTitle")}</h1>{skill && <Badge color="var(--text-secondary)">{t("preview.version", { version: skill.version })}</Badge>}{skill && <label style={{ display: "flex", gap: 6, alignItems: "center" }}>{t("preview.enabled")}<Toggle on={skill.enabled} onChange={onEnabled} ariaLabel={`Enable ${skill.name}`} size={16} /></label>}</div>
    <div role="tablist" style={{ display: "flex", gap: 4, padding: "0 16px", borderBottom: "1px solid var(--border)" }}>{(["config", "preview", "versions"] as const).map((item) => { const TabIcon = item === "config" ? Icon.Settings : item === "preview" ? Icon.Eye : Icon.History; return <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 12px", border: 0, borderBottom: tab === item ? "2px solid var(--accent)" : "2px solid transparent", background: "transparent", color: tab === item ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: 600 }}><TabIcon aria-hidden size={14} />{item.charAt(0).toUpperCase() + item.slice(1)}</button>; })}</div>
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 4 }}>
    {tab === "preview" ? <article style={{ minHeight: 260, padding: 16, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-surface)" }}><Markdown>{body}</Markdown></article> : tab === "versions" ? <VersionHistory skill={skill} versions={versions} loading={versionsLoading} restoring={restore.isPending} deleting={removeVersion.isPending} onRestore={(version) => skill && restore.mutate({ id: skill.id, version, expectedVersion: skill.version })} onDelete={(version) => skill && removeVersion.mutate({ id: skill.id, version })} /> : <>
    <FormField label={t("editor.name")} required><TextInput aria-label={t("editor.name")} value={name} onChange={onName} /></FormField>
    <FormField label={t("editor.description")}><TextInput aria-label={t("editor.description")} value={description} onChange={onDescription} /></FormField>
    <FormField label={t("modal.type")}><SelectInput aria-label={t("modal.type")} value={type} onChange={(value) => onType(value as Skill["type"])} options={["rubric", "security", "convention", "custom"]} /></FormField>
    <FormField label={t("file.bodyLabel")} required hint={t("preview.bodyHint")}><Textarea aria-label={t("file.bodyLabel")} value={body} onChange={onBody} rows={14} mono /></FormField>
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}><Button kind="primary" onClick={onSave} disabled={saving || !name.trim() || !body.trim()}>{saving ? t("preview.saving") : skill ? t("preview.save") : t("editor.create")}</Button>{skill && <Button kind="secondary" onClick={() => window.location.assign(`/skills/${skill.id}`)}>Open full page</Button>}{skill && <Button kind="danger" onClick={onDelete}>Delete</Button>}</div>
    </>}</div></Card>;
}

function VersionHistory({ skill, versions, loading, restoring, deleting, onRestore, onDelete }: { skill?: Skill; versions: Array<{ version: number; body: string; created_at: string }>; loading: boolean; restoring: boolean; deleting: boolean; onRestore: (version: number) => void; onDelete: (version: number) => void }) {
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);
  const [deleteVersion, setDeleteVersion] = React.useState<number | null>(null);
  if (!skill) return null;
  if (loading) return <div style={{ minHeight: 160, color: "var(--text-secondary)" }}>Loading version history…</div>;
  return <div style={{ display: "grid", gap: 10 }}>
    <div style={{ padding: "12px 14px", borderRadius: 7, background: "var(--accent-bg)", color: "var(--text-secondary)", fontSize: 13 }}>Changes to a skill body create immutable versions. Restore creates a new current version.</div>
    {versions.map((version) => {
      const current = version.version === skill.version;
      return <article key={version.version} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 14, alignItems: "center", padding: "14px 16px", border: `1px solid ${current ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, background: current ? "var(--accent-bg)" : "var(--bg-surface)" }}>
        <div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong>v{version.version}</strong>{current && <Badge color="var(--accent-text)" bg="var(--accent-bg)">Current</Badge>}</div><div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>{new Date(version.created_at).toLocaleString()}</div><p className="mono" style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{version.body.split("\n").find(Boolean) ?? "Empty body"}</p></div>
        {!current && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Button kind="secondary" size="sm" onClick={() => setDiffVersion(diffVersion === version.version ? null : version.version)}>{diffVersion === version.version ? "Hide diff" : "Diff"}</Button><Button kind="primary" size="sm" disabled={restoring || deleting} onClick={() => onRestore(version.version)}>Restore</Button><Button kind="danger" size="sm" icon="Trash" aria-label={`Delete version ${version.version}`} title={`Delete version ${version.version}`} disabled={restoring || deleting} onClick={() => setDeleteVersion(version.version)} /></div>}
        {diffVersion === version.version && <article aria-label={`Diff with version ${version.version}`} style={{ gridColumn: "1 / -1", marginTop: 2, padding: 14, border: "1px solid var(--border)", borderRadius: 6, background: "var(--code-bg)" }}><strong style={{ fontSize: 13 }}>Current v{skill.version} compared with v{version.version}</strong><pre className="mono" style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: 12 }}>{`--- v${version.version}\n${version.body}\n+++ current v${skill.version}\n${skill.body}`}</pre></article>}
      </article>;
    })}
    {deleteVersion !== null && <Modal width={460} title="Delete version" subtitle={`Delete v${deleteVersion}? This cannot be undone.`} onClose={() => setDeleteVersion(null)} footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button kind="ghost" onClick={() => setDeleteVersion(null)}>Cancel</Button><Button kind="danger" loading={deleting} onClick={() => { onDelete(deleteVersion); setDeleteVersion(null); }}>Delete version</Button></div>}><div style={{ padding: 24, color: "var(--text-secondary)" }}>The current version cannot be deleted.</div></Modal>}
  </div>;
}
