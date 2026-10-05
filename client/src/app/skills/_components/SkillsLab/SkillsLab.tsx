"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, Modal, Skeleton, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { useCreateSkill, useDeleteSkill, useImportSkill, useImportSkillPreview, useSkills, useUpdateSkill, type SkillImportInput } from "@/lib/hooks/skills";

const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--bg-surface)", cursor: "pointer" };

export function SkillsLab() {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, error, refetch } = useSkills();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const remove = useDeleteSkill();
  const importPreview = useImportSkillPreview();
  const importSkill = useImportSkill();
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<Skill["type"]>("custom");
  const [deleteTarget, setDeleteTarget] = React.useState<Skill | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  const list = (skills ?? []).filter((skill) => skill.name.toLowerCase().includes(search.toLowerCase()));
  const selected = (skills ?? []).find((skill) => skill.id === selectedId) ?? list[0];

  React.useEffect(() => {
    if (selected && !creating) {
      setName(selected.name);
      setDescription(selected.description);
      setBody(selected.body);
    }
  }, [selected?.id, selected?.version, creating]); // intentionally reset editor on selection/version changes

  const startCreate = () => {
    setAddOpen(false);
    setCreating(false);
    setCreateOpen(true);
    setSelectedId(null);
    setName("");
    setDescription("");
    setType("custom");
    setBody("");
  };
  const save = () => {
    if (creating) {
      create.mutate({ name, description, body, type: "custom" }, {
        onSuccess: (skill) => { setCreating(false); setSelectedId(skill.id); },
      });
      return;
    }
    if (selected) update.mutate({ id: selected.id, name, description, body, type: selected.type, enabled: selected.enabled, expected_version: selected.version });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(230px, 320px) minmax(0, 1fr)", gap: 20, minHeight: 460 }}>
      <aside style={{ borderRight: "1px solid var(--border)", paddingRight: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input aria-label={t("page.searchPlaceholder")} placeholder={t("page.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} style={{ minWidth: 0, flex: 1 }} />
          <Button kind="primary" size="sm" onClick={() => setAddOpen(true)}>{t("page.addSkill")}</Button>
        </div>
        {isLoading && <><Skeleton height={64} /><Skeleton height={64} /></>}
        {isError && <ErrorState body={error instanceof ApiError ? error.message : t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && list.length === 0 && <EmptyState icon="Sparkles" title={t("page.empty.title")} body={t("page.empty.body")} cta={t("page.empty.cta")} onCta={() => setAddOpen(true)} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((skill) => <div key={skill.id} role="button" tabIndex={0} onClick={() => { setCreating(false); setSelectedId(skill.id); }} style={{ ...card, cursor: "pointer", outline: selected?.id === skill.id && !creating ? "2px solid var(--accent)" : undefined }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}><strong style={{ flex: 1 }}>{skill.name}</strong><Badge color="var(--text-secondary)">v{skill.version}</Badge><button type="button" aria-label={`Delete ${skill.name}`} onClick={(event) => { event.stopPropagation(); setDeleteTarget(skill); }}>Delete</button></div><p style={{ margin: "4px 0", color: "var(--text-secondary)", fontSize: 12 }}>{skill.description}</p><div style={{ display: "flex", gap: 6, marginTop: 7 }}><Badge color="var(--text-secondary)">{skill.type}</Badge><Badge color="var(--text-secondary)">{skill.agent_count} agents</Badge><Badge color={skill.enabled ? "var(--green)" : "var(--text-muted)"}>{skill.enabled ? t("preview.enabled") : t("preview.disabled")}</Badge></div>
          </div>)}
        </div>
      </aside>
      <section aria-live="polite">
        {!selected && !creating ? <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} /> : <SkillEditor skill={creating ? undefined : selected} name={name} description={description} body={body} onName={setName} onDescription={setDescription} onBody={setBody} onSave={save} saving={create.isPending || update.isPending} onDelete={() => selected && setDeleteTarget(selected)} onEnabled={(enabled) => selected && update.mutate({ id: selected.id, name, description, body, type: selected.type, enabled, expected_version: selected.version })} />}
      </section>
      {deleteTarget && <Modal title="Delete skill" subtitle={`Delete ${deleteTarget.name}? This cannot be undone.`} onClose={() => setDeleteTarget(null)} footer={<><Button kind="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button kind="danger" onClick={() => remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })} disabled={remove.isPending}>Delete</Button></>} />}
      {addOpen && <Modal title="Add skill" subtitle="Choose whether to author a new skill or import an existing one." onClose={() => setAddOpen(false)} footer={<Button kind="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>}><div style={{ display: "flex", gap: 12 }}><Button kind="primary" onClick={startCreate}>Create manually</Button><Button kind="secondary" onClick={() => { setAddOpen(false); setImportOpen(true); }}>Import existing skill</Button></div></Modal>}
      {createOpen && <Modal title="Create skill" subtitle="Choose metadata and Markdown content for a reusable review rule." onClose={() => setCreateOpen(false)} footer={<><Button kind="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button kind="primary" disabled={create.isPending || !name.trim() || !body.trim()} onClick={() => create.mutate({ name, description, body, type }, { onSuccess: (skill) => { setCreateOpen(false); setSelectedId(skill.id); } })}>Create skill</Button></>}><label>Skill name<input aria-label="Skill name" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Description<input aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Type<select aria-label="Type" value={type} onChange={(event) => setType(event.target.value as Skill["type"])}><option value="custom">custom</option><option value="rubric">rubric</option><option value="convention">convention</option><option value="security">security</option></select></label><label>Skill body (Markdown)<textarea aria-label="Skill body (Markdown)" value={body} onChange={(event) => setBody(event.target.value)} rows={12} /></label></Modal>}
      {importOpen && <ImportSkillModal preview={importPreview} save={importSkill} onClose={() => setImportOpen(false)} onSaved={(skill) => { setImportOpen(false); setSelectedId(skill.id); }} />}
    </div>
  );
}

function ImportSkillModal({ preview, save, onClose, onSaved }: { preview: ReturnType<typeof useImportSkillPreview>; save: ReturnType<typeof useImportSkill>; onClose: () => void; onSaved: (skill: Skill) => void }) {
  const [mode, setMode] = React.useState<"url" | "file">("url");
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [data, setData] = React.useState<SkillImportInput | null>(null);
  const runPreview = async () => {
    const input: SkillImportInput | null = mode === "url" ? url.trim() ? { kind: "url", url: url.trim() } : null : file ? file.name.toLowerCase().endsWith(".zip") ? { kind: "zip", zip_base64: await file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer); let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return btoa(binary);
    }) } : { kind: "markdown", markdown: await file.text() } : null;
    if (!input) return;
    setData(input); preview.mutate(input);
  };
  return <Modal title="Import skill" subtitle="Preview Markdown, ZIP, or a public HTTPS URL before saving." onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="secondary" onClick={runPreview} disabled={preview.isPending}>Preview</Button><Button kind="primary" disabled={!data || !preview.data || save.isPending} onClick={() => data && save.mutate({ ...data, name: preview.data!.name, description: preview.data!.description }, { onSuccess: onSaved })}>Import skill</Button></>}>
    <label><input type="radio" checked={mode === "url"} onChange={() => setMode("url")} /> URL</label><label><input type="radio" checked={mode === "file"} onChange={() => setMode("file")} /> .md / .zip</label>
    {mode === "url" ? <input aria-label="Skill URL" value={url} placeholder="https://example.com/skill.md" onChange={(event) => setUrl(event.target.value)} /> : <input aria-label="Skill file" type="file" accept=".md,.markdown,.zip,text/markdown,text/plain,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />}
    {preview.data && <article style={{ border: "1px solid var(--border)", padding: 12, marginTop: 12 }}><strong>{preview.data.name}</strong><p>{preview.data.description}</p><pre style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{preview.data.body}</pre></article>}
  </Modal>;
}

function SkillEditor({ skill, name, description, body, onName, onDescription, onBody, onSave, onDelete, saving, onEnabled }: { skill?: Skill; name: string; description: string; body: string; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onSave: () => void; onDelete: () => void; saving: boolean; onEnabled: (value: boolean) => void }) {
  const t = useTranslations("skills");
  return <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h1 style={{ flex: 1 }}>{skill ? skill.name : t("editor.newTitle")}</h1>{skill && <Badge color="var(--text-secondary)">{t("preview.version", { version: skill.version })}</Badge>}{skill && <label style={{ display: "flex", gap: 6, alignItems: "center" }}>{t("preview.enabled")}<Toggle on={skill.enabled} onChange={onEnabled} size={16} /></label>}</div>
    <label>{t("editor.name")}<input aria-label={t("editor.name")} value={name} onChange={(event) => onName(event.target.value)} style={{ display: "block", width: "100%" }} /></label>
    <label>{t("editor.description")}<input aria-label={t("editor.description")} value={description} onChange={(event) => onDescription(event.target.value)} style={{ display: "block", width: "100%" }} /></label>
    <label>{t("file.bodyLabel")}<textarea aria-label={t("file.bodyLabel")} value={body} onChange={(event) => onBody(event.target.value)} rows={14} style={{ display: "block", width: "100%", fontFamily: "var(--font-mono)" }} /></label>
    <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("preview.bodyHint")}</p>
    <div style={{ display: "flex", gap: 8 }}><Button kind="primary" onClick={onSave} disabled={saving || !name.trim() || !body.trim()}>{saving ? t("preview.saving") : skill ? t("preview.save") : t("editor.create")}</Button>{skill && <a href={`/skills/${skill.id}`}>Open full page</a>}{skill && <Button kind="danger" onClick={onDelete}>Delete</Button>}</div>
  </div>;
}
