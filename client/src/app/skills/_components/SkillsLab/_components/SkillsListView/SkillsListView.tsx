"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { SkillCard } from "../SkillCard/SkillCard";

export function SkillsListView({ skills, selectedId, isLoading, error, onRetry, onSelect, onToggle, onDelete, onAdd }: { skills: Skill[]; selectedId: string | null; isLoading: boolean; error: unknown; onRetry: () => void; onSelect: (id: string) => void; onToggle: (skill: Skill, enabled: boolean) => void; onDelete: (skill: Skill) => void; onAdd: () => void }) {
  const t = useTranslations("skills");
  if (isLoading) return <><Skeleton height={64} /><Skeleton height={64} /></>;
  if (error) return <ErrorState body={error instanceof ApiError ? error.message : t("page.loadError")} onRetry={onRetry} />;
  if (!skills.length) return <EmptyState icon="Sparkles" title={t("page.empty.title")} body={t("page.empty.body")} cta={t("page.empty.cta")} onCta={onAdd} />;
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{skills.map((skill) => <SkillCard key={skill.id} skill={skill} selected={skill.id === selectedId} onSelect={() => onSelect(skill.id)} onToggle={(enabled) => onToggle(skill, enabled)} onDelete={() => onDelete(skill)} />)}</div>;
}
