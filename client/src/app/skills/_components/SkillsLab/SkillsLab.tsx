"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, Skeleton, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { useCreateSkill, useSkills, useUpdateSkill } from "@/lib/hooks/skills";

const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--bg-surface)", cursor: "pointer" };

export function SkillsLab() {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, error, refetch } = useSkills();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState("");
  const [description, setDescription] = React.useState("");

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
    setCreating(true);
    setSelectedId(null);
    setName("");
    setDescription("");
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
          <Button kind="primary" size="sm" onClick={startCreate}>{t("page.addSkill")}</Button>
        </div>
        {isLoading && <><Skeleton height={64} /><Skeleton height={64} /></>}
        {isError && <ErrorState body={error instanceof ApiError ? error.message : t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && list.length === 0 && <EmptyState icon="Sparkles" title={t("page.empty.title")} body={t("page.empty.body")} cta={t("page.empty.cta")} onCta={startCreate} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((skill) => <button key={skill.id} type="button" onClick={() => { setCreating(false); setSelectedId(skill.id); }} style={{ ...card, textAlign: "left", outline: selected?.id === skill.id && !creating ? "2px solid var(--accent)" : undefined }}>
            <strong>{skill.name}</strong><div style={{ display: "flex", gap: 6, marginTop: 7 }}><Badge color="var(--text-secondary)">{skill.type}</Badge><Badge color={skill.enabled ? "var(--green)" : "var(--text-muted)"}>{skill.enabled ? t("preview.enabled") : t("preview.disabled")}</Badge></div>
          </button>)}
        </div>
      </aside>
      <section aria-live="polite">
        {!selected && !creating ? <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} /> : <SkillEditor skill={creating ? undefined : selected} name={name} description={description} body={body} onName={setName} onDescription={setDescription} onBody={setBody} onSave={save} saving={create.isPending || update.isPending} onEnabled={(enabled) => selected && update.mutate({ id: selected.id, name, description, body, type: selected.type, enabled, expected_version: selected.version })} />}
      </section>
    </div>
  );
}

function SkillEditor({ skill, name, description, body, onName, onDescription, onBody, onSave, saving, onEnabled }: { skill?: Skill; name: string; description: string; body: string; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onSave: () => void; saving: boolean; onEnabled: (value: boolean) => void }) {
  const t = useTranslations("skills");
  return <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h1 style={{ flex: 1 }}>{skill ? skill.name : t("editor.newTitle")}</h1>{skill && <Badge color="var(--text-secondary)">{t("preview.version", { version: skill.version })}</Badge>}{skill && <label style={{ display: "flex", gap: 6, alignItems: "center" }}>{t("preview.enabled")}<Toggle on={skill.enabled} onChange={onEnabled} size={16} /></label>}</div>
    <label>{t("editor.name")}<input aria-label={t("editor.name")} value={name} onChange={(event) => onName(event.target.value)} style={{ display: "block", width: "100%" }} /></label>
    <label>{t("editor.description")}<input aria-label={t("editor.description")} value={description} onChange={(event) => onDescription(event.target.value)} style={{ display: "block", width: "100%" }} /></label>
    <label>{t("file.bodyLabel")}<textarea aria-label={t("file.bodyLabel")} value={body} onChange={(event) => onBody(event.target.value)} rows={14} style={{ display: "block", width: "100%", fontFamily: "var(--font-mono)" }} /></label>
    <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("preview.bodyHint")}</p>
    <Button kind="primary" onClick={onSave} disabled={saving || !name.trim() || !body.trim()}>{saving ? t("preview.saving") : skill ? t("preview.save") : t("editor.create")}</Button>
  </div>;
}
