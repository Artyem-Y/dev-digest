"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";

export function SkillEditor({ skill, name, description, body, onName, onDescription, onBody, onSave, onDelete, saving, onEnabled }: { skill?: Skill; name: string; description: string; body: string; onName: (value: string) => void; onDescription: (value: string) => void; onBody: (value: string) => void; onSave: () => void; onDelete: () => void; saving: boolean; onEnabled: (value: boolean) => void }) {
  const t = useTranslations("skills");
  return <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h1 style={{ flex: 1 }}>{skill ? skill.name : t("editor.newTitle")}</h1>{skill && <Badge color="var(--text-secondary)">{t("preview.version", { version: skill.version })}</Badge>}{skill && <label style={{ display: "flex", gap: 6, alignItems: "center" }}>{t("preview.enabled")}<Toggle on={skill.enabled} onChange={onEnabled} ariaLabel={`Enable ${skill.name}`} size={16} /></label>}</div>
    <label>{t("editor.name")}<input aria-label={t("editor.name")} value={name} onChange={(event) => onName(event.target.value)} style={{ display: "block", width: "100%" }} /></label>
    <label>{t("editor.description")}<input aria-label={t("editor.description")} value={description} onChange={(event) => onDescription(event.target.value)} style={{ display: "block", width: "100%" }} /></label>
    <label>{t("file.bodyLabel")}<textarea aria-label={t("file.bodyLabel")} value={body} onChange={(event) => onBody(event.target.value)} rows={14} style={{ display: "block", width: "100%", fontFamily: "var(--font-mono)" }} /></label>
    <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("preview.bodyHint")}</p>
    <div style={{ display: "flex", gap: 8 }}><Button kind="primary" onClick={onSave} disabled={saving || !name.trim() || !body.trim()}>{saving ? t("preview.saving") : skill ? t("preview.save") : t("editor.create")}</Button>{skill && <a href={`/skills/${skill.id}`}>Open full page</a>}{skill && <Button kind="danger" onClick={onDelete}>Delete</Button>}</div>
  </div>;
}
