"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Card, EmptyState, FormField, Modal, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { type SkillImportInput, useCreateSkill, useDeleteSkill, useImportSkill, useImportSkillPreview, useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { SkillEditor } from "./_components/SkillEditor/SkillEditor";
import { SkillsListView } from "./_components/SkillsListView/SkillsListView";

export function SkillsLab() {
  const t = useTranslations("skills");
  const { data: skills = [], isLoading, isError, error, refetch } = useSkills();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const remove = useDeleteSkill();
  const importPreview = useImportSkillPreview();
  const importSkill = useImportSkill();
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Skill | null>(null);
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<Skill["type"]>("custom");

  const list = skills.filter((skill) => skill.name.toLowerCase().includes(search.toLowerCase()));
  const selected = skills.find((skill) => skill.id === selectedId) ?? list[0];

  React.useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description);
    setBody(selected.body);
    setType(selected.type);
  }, [selected?.id, selected?.version]);

  const save = () => {
    if (!selected) return;
    update.mutate({ id: selected.id, name, description, body, type, enabled: selected.enabled, expected_version: selected.version });
  };
  const toggle = (skill: Skill, enabled: boolean) => update.mutate({ id: skill.id, name: skill.name, description: skill.description, body: skill.body, type: skill.type, enabled, expected_version: skill.version });
  const openAdd = () => {
    setName("");
    setDescription("");
    setBody("");
    setType("custom");
    setAddOpen(true);
  };

  return <div style={{ display: "grid", gridTemplateColumns: "minmax(230px, 320px) minmax(0, 1fr)", gap: 20, minHeight: 460 }}>
    <aside style={{ borderRight: "1px solid var(--border)", paddingRight: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><div style={{ minWidth: 0, flex: 1 }}><TextInput aria-label={t("page.searchPlaceholder")} placeholder={t("page.searchPlaceholder")} value={search} onChange={setSearch} /></div><Button kind="primary" size="sm" onClick={openAdd}>{t("page.addSkill")}</Button></div>
      <SkillsListView skills={list} selectedId={selected?.id ?? null} isLoading={isLoading} error={isError ? error : undefined} onRetry={refetch} onSelect={setSelectedId} onToggle={toggle} onDelete={setDeleteTarget} onAdd={openAdd} />
    </aside>
    <section aria-live="polite">{selected ? <SkillEditor skill={selected} name={name} description={description} body={body} type={type} onName={setName} onDescription={setDescription} onBody={setBody} onType={setType} onSave={save} saving={update.isPending} onDelete={() => setDeleteTarget(selected)} onEnabled={(enabled) => toggle(selected, enabled)} /> : <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />}</section>
    {deleteTarget && <Modal width={520} title="Delete skill" subtitle="This action cannot be undone." onClose={() => setDeleteTarget(null)} footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button kind="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button kind="danger" disabled={remove.isPending} onClick={() => remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}>{remove.isPending ? "Deleting…" : "Delete skill"}</Button></div>}><div style={{ padding: 24, display: "grid", gap: 14 }}><div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", border: "1px solid var(--crit)", borderRadius: 7, background: "var(--crit-bg)", color: "var(--text-secondary)" }}><span style={{ color: "var(--crit)", fontWeight: 700 }}>!</span><span>Deleting this skill also removes it from every agent that uses it.</span></div><Card style={{ padding: "12px 14px", background: "var(--code-bg)" }}><div className="mono" style={{ color: "var(--text-primary)", fontSize: 13 }}>{deleteTarget.name}</div><div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 5 }}>{deleteTarget.description || "No description"}</div></Card></div></Modal>}
    {addOpen && <AddSkillModal t={t} name={name} description={description} body={body} type={type} creating={create.isPending} preview={importPreview} importing={importSkill.isPending} onName={setName} onDescription={setDescription} onBody={setBody} onType={setType} onClose={() => setAddOpen(false)} onCreate={() => create.mutate({ name, description, body, type }, { onSuccess: (skill) => { setAddOpen(false); setSelectedId(skill.id); } })} onImport={(input) => importSkill.mutate(input, { onSuccess: (skill) => { setAddOpen(false); setSelectedId(skill.id); } })} />}
  </div>;
}

function AddSkillModal({ t, name, description, body, type, creating, preview, importing, onName, onDescription, onBody, onType, onClose, onCreate, onImport }: { t: ReturnType<typeof useTranslations>; name: string; description: string; body: string; type: Skill["type"]; creating: boolean; preview: { mutate: (input: SkillImportInput) => void; isPending: boolean; data?: Pick<Skill, "name" | "description" | "body"> }; importing: boolean; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onType: (value: Skill["type"]) => void; onClose: () => void; onCreate: () => void; onImport: (input: SkillImportInput) => void }) {
  const [tab, setTab] = React.useState<"create" | "file" | "url">("create");
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [input, setInput] = React.useState<SkillImportInput | null>(null);
  React.useEffect(() => { onType("custom"); }, [onType]);
  const previewImport = async () => {
    const next: SkillImportInput | null = tab === "url" ? (url.trim() ? { kind: "url", url: url.trim() } : null) : file ? file.name.toLowerCase().endsWith(".zip") ? { kind: "zip", zip_base64: await file.arrayBuffer().then((buffer) => { const bytes = new Uint8Array(buffer); let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192)); return btoa(binary); }) } : { kind: "markdown", markdown: await file.text() } : null;
    if (!next) return;
    setInput(next);
    preview.mutate(next);
  };
  const selectTab = (next: "create" | "file" | "url") => { setTab(next); setInput(null); };
  const tabButton = (key: "create" | "file" | "url", label: string) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => selectTab(key)} style={{ padding: "10px 12px", border: 0, borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent", background: tab === key ? "var(--accent-bg)" : "transparent", borderRadius: "6px 6px 0 0", color: tab === key ? "var(--accent-text)" : "var(--text-secondary)", fontWeight: 600, cursor: "pointer" }}>{label}</button>;
  const importInput = tab === "url" && url.trim() ? { kind: "url" as const, url: url.trim() } : input;
  const footer = tab === "create" ? <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button kind="ghost" onClick={onClose}>{t("modal.cancel")}</Button><Button kind="primary" disabled={creating || !name.trim() || !body.trim()} onClick={onCreate}>{t("editor.create")}</Button></div> : <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button kind="ghost" onClick={onClose}>{t("modal.cancel")}</Button><Button kind="secondary" disabled={preview.isPending || (tab === "url" ? !url.trim() : !file)} onClick={previewImport}>Preview</Button><Button kind="primary" disabled={!importInput || importing} onClick={() => importInput && onImport(importInput)}>Import skill</Button></div>;
  return <Modal width={760} title={t("modal.addTitle")} subtitle={t("modal.addSubtitle")} onClose={onClose} footer={footer}><div role="tablist" style={{ display: "flex", gap: 4, padding: "16px 24px 0", borderBottom: "1px solid var(--border)" }}>{tabButton("create", "Create")}{tabButton("file", "From file")}{tabButton("url", "Import from URL")}</div><div style={{ padding: 24 }}>{tab === "create" ? <div style={{ display: "grid", gap: 4 }}><FormField label={t("editor.name")} required><TextInput aria-label={t("editor.name")} value={name} onChange={onName} /></FormField><FormField label={t("modal.description")}><TextInput aria-label={t("modal.description")} value={description} onChange={onDescription} /></FormField><FormField label={t("modal.type")}><SelectInput aria-label={t("modal.type")} value={type} onChange={(value) => onType(value as Skill["type"])} options={["custom", "rubric", "convention", "security"]} /></FormField><FormField label={t("file.bodyLabel")} required><Textarea aria-label={t("file.bodyLabel")} value={body} onChange={onBody} rows={12} mono /></FormField></div> : tab === "url" ? <FormField label="Public skill URL" hint="Only public HTTPS URLs can be imported."><TextInput aria-label="Skill URL" value={url} placeholder="https://example.com/skill.md" onChange={setUrl} /></FormField> : <FilePicker file={file} onChange={setFile} t={t} />}{preview.data && tab !== "create" && <Card style={{ padding: 16, background: "var(--bg-surface)" }}><strong>{preview.data.name}</strong><p style={{ marginTop: 5, color: "var(--text-secondary)" }}>{preview.data.description}</p><pre className="mono" style={{ marginTop: 12, padding: 12, maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", border: "1px solid var(--border)", borderRadius: 6, background: "var(--code-bg)" }}>{preview.data.body}</pre></Card>}</div></Modal>;
}

function FilePicker({ file, onChange, t }: { file: File | null; onChange: (file: File | null) => void; t: ReturnType<typeof useTranslations> }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return <FormField label={t("modal.skillFile")} hint={t("modal.supportedFormats")}><div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, border: "1px solid var(--border-strong)", borderRadius: 7, background: "var(--bg-elevated)" }}><input ref={inputRef} aria-label={t("modal.skillFile")} type="file" accept=".md,.markdown,.zip,text/markdown,text/plain,application/zip" onChange={(event) => onChange(event.target.files?.[0] ?? null)} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} /><Button type="button" kind="secondary" size="sm" onClick={() => inputRef.current?.click()}>{t("modal.chooseFile")}</Button><span style={{ color: file ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name ?? t("modal.noFileSelected")}</span></div></FormField>;
}

function CreateSkillModal({ t, name, description, body, type, saving, onName, onDescription, onBody, onType, onClose, onCreate }: { t: ReturnType<typeof useTranslations>; name: string; description: string; body: string; type: Skill["type"]; saving: boolean; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onType: (value: Skill["type"]) => void; onClose: () => void; onCreate: () => void }) {
  return <Modal width={760} title={t("modal.createTitle")} subtitle={t("modal.createSubtitle")} onClose={onClose} footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><Button kind="ghost" onClick={onClose}>{t("modal.cancel")}</Button><Button kind="primary" disabled={saving || !name.trim() || !body.trim()} onClick={onCreate}>{t("editor.create")}</Button></div>}><div style={{ padding: 24, display: "grid", gap: 4 }}><FormField label={t("editor.name")} required><TextInput aria-label={t("editor.name")} value={name} onChange={onName} /></FormField><FormField label={t("modal.description")}><TextInput aria-label={t("modal.description")} value={description} onChange={onDescription} /></FormField><FormField label={t("modal.type")}><SelectInput aria-label={t("modal.type")} value={type} onChange={(value) => onType(value as Skill["type"])} options={["custom", "rubric", "convention", "security"]} /></FormField><FormField label={t("file.bodyLabel")} required><Textarea aria-label={t("file.bodyLabel")} value={body} onChange={onBody} rows={12} mono /></FormField></div></Modal>;
}
