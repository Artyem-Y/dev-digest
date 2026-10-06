"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, FormField, Modal, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useCreateSkill, useDeleteSkill, useImportSkill, useImportSkillPreview, useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { ImportSkillModal } from "./_components/ImportSkillModal/ImportSkillModal";
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
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
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

  return <div style={{ display: "grid", gridTemplateColumns: "minmax(230px, 320px) minmax(0, 1fr)", gap: 20, minHeight: 460 }}>
    <aside style={{ borderRight: "1px solid var(--border)", paddingRight: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><div style={{ minWidth: 0, flex: 1 }}><TextInput aria-label={t("page.searchPlaceholder")} placeholder={t("page.searchPlaceholder")} value={search} onChange={setSearch} /></div><Button kind="primary" size="sm" onClick={() => setAddOpen(true)}>{t("page.addSkill")}</Button></div>
      <SkillsListView skills={list} selectedId={selected?.id ?? null} isLoading={isLoading} error={isError ? error : undefined} onRetry={refetch} onSelect={setSelectedId} onToggle={toggle} onDelete={setDeleteTarget} onAdd={() => setAddOpen(true)} />
    </aside>
    <section aria-live="polite">{selected ? <SkillEditor skill={selected} name={name} description={description} body={body} type={type} onName={setName} onDescription={setDescription} onBody={setBody} onType={setType} onSave={save} saving={update.isPending} onDelete={() => setDeleteTarget(selected)} onEnabled={(enabled) => toggle(selected, enabled)} /> : <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />}</section>
    {deleteTarget && <Modal title="Delete skill" subtitle={`Delete ${deleteTarget.name}? This cannot be undone.`} onClose={() => setDeleteTarget(null)} footer={<><Button kind="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button kind="danger" onClick={() => remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })} disabled={remove.isPending}>Delete</Button></>} />}
    {addOpen && <Modal title={t("modal.addTitle")} subtitle={t("modal.addSubtitle")} onClose={() => setAddOpen(false)} footer={<Button kind="ghost" onClick={() => setAddOpen(false)}>{t("modal.cancel")}</Button>}><div style={{ display: "flex", gap: 12, padding: 24 }}><Button kind="primary" onClick={() => { setAddOpen(false); setName(""); setDescription(""); setBody(""); setType("custom"); setCreateOpen(true); }}>{t("modal.manual")}</Button><Button kind="secondary" onClick={() => { setAddOpen(false); setImportOpen(true); }}>{t("modal.import")}</Button></div></Modal>}
    {createOpen && <CreateSkillModal t={t} name={name} description={description} body={body} type={type} saving={create.isPending} onName={setName} onDescription={setDescription} onBody={setBody} onType={setType} onClose={() => setCreateOpen(false)} onCreate={() => create.mutate({ name, description, body, type }, { onSuccess: (skill) => { setCreateOpen(false); setSelectedId(skill.id); } })} />}
    {importOpen && <ImportSkillModal preview={importPreview} save={importSkill} onClose={() => setImportOpen(false)} onSaved={(skill) => { setImportOpen(false); setSelectedId(skill.id); }} />}
  </div>;
}

function CreateSkillModal({ t, name, description, body, type, saving, onName, onDescription, onBody, onType, onClose, onCreate }: { t: ReturnType<typeof useTranslations>; name: string; description: string; body: string; type: Skill["type"]; saving: boolean; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onType: (value: Skill["type"]) => void; onClose: () => void; onCreate: () => void }) {
  return <Modal width={760} title={t("modal.createTitle")} subtitle={t("modal.createSubtitle")} onClose={onClose} footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><Button kind="ghost" onClick={onClose}>{t("modal.cancel")}</Button><Button kind="primary" disabled={saving || !name.trim() || !body.trim()} onClick={onCreate}>{t("editor.create")}</Button></div>}><div style={{ padding: 24, display: "grid", gap: 4 }}><FormField label={t("editor.name")} required><TextInput aria-label={t("editor.name")} value={name} onChange={onName} /></FormField><FormField label={t("modal.description")}><TextInput aria-label={t("modal.description")} value={description} onChange={onDescription} /></FormField><FormField label={t("modal.type")}><SelectInput aria-label={t("modal.type")} value={type} onChange={(value) => onType(value as Skill["type"])} options={["custom", "rubric", "convention", "security"]} /></FormField><FormField label={t("file.bodyLabel")} required><Textarea aria-label={t("file.bodyLabel")} value={body} onChange={onBody} rows={12} mono /></FormField></div></Modal>;
}
