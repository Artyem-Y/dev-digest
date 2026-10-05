"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Modal } from "@devdigest/ui";
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
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input aria-label={t("page.searchPlaceholder")} placeholder={t("page.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} style={{ minWidth: 0, flex: 1 }} /><Button kind="primary" size="sm" onClick={() => setAddOpen(true)}>{t("page.addSkill")}</Button></div>
      <SkillsListView skills={list} selectedId={selected?.id ?? null} isLoading={isLoading} error={isError ? error : undefined} onRetry={refetch} onSelect={setSelectedId} onToggle={toggle} onDelete={setDeleteTarget} onAdd={() => setAddOpen(true)} />
    </aside>
    <section aria-live="polite">{selected ? <SkillEditor skill={selected} name={name} description={description} body={body} onName={setName} onDescription={setDescription} onBody={setBody} onSave={save} saving={update.isPending} onDelete={() => setDeleteTarget(selected)} onEnabled={(enabled) => toggle(selected, enabled)} /> : <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />}</section>
    {deleteTarget && <Modal title="Delete skill" subtitle={`Delete ${deleteTarget.name}? This cannot be undone.`} onClose={() => setDeleteTarget(null)} footer={<><Button kind="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button kind="danger" onClick={() => remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })} disabled={remove.isPending}>Delete</Button></>} />}
    {addOpen && <Modal title="Add skill" subtitle="Choose whether to author a new skill or import an existing one." onClose={() => setAddOpen(false)} footer={<Button kind="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>}><div style={{ display: "flex", gap: 12 }}><Button kind="primary" onClick={() => { setAddOpen(false); setName(""); setDescription(""); setBody(""); setType("custom"); setCreateOpen(true); }}>Create manually</Button><Button kind="secondary" onClick={() => { setAddOpen(false); setImportOpen(true); }}>Import existing skill</Button></div></Modal>}
    {createOpen && <CreateSkillModal name={name} description={description} body={body} type={type} saving={create.isPending} onName={setName} onDescription={setDescription} onBody={setBody} onType={setType} onClose={() => setCreateOpen(false)} onCreate={() => create.mutate({ name, description, body, type }, { onSuccess: (skill) => { setCreateOpen(false); setSelectedId(skill.id); } })} />}
    {importOpen && <ImportSkillModal preview={importPreview} save={importSkill} onClose={() => setImportOpen(false)} onSaved={(skill) => { setImportOpen(false); setSelectedId(skill.id); }} />}
  </div>;
}

function CreateSkillModal({ name, description, body, type, saving, onName, onDescription, onBody, onType, onClose, onCreate }: { name: string; description: string; body: string; type: Skill["type"]; saving: boolean; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onType: (value: Skill["type"]) => void; onClose: () => void; onCreate: () => void }) {
  return <Modal title="Create skill" subtitle="Choose metadata and Markdown content for a reusable review rule." onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" disabled={saving || !name.trim() || !body.trim()} onClick={onCreate}>Create skill</Button></>}><label>Skill name<input aria-label="Skill name" value={name} onChange={(event) => onName(event.target.value)} /></label><label>Description<input aria-label="Description" value={description} onChange={(event) => onDescription(event.target.value)} /></label><label>Type<select aria-label="Type" value={type} onChange={(event) => onType(event.target.value as Skill["type"])}><option value="custom">custom</option><option value="rubric">rubric</option><option value="convention">convention</option><option value="security">security</option></select></label><label>Skill body (Markdown)<textarea aria-label="Skill body (Markdown)" value={body} onChange={(event) => onBody(event.target.value)} rows={12} /></label></Modal>;
}
