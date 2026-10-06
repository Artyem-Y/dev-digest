"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Checkbox, ErrorState, Skeleton, TextInput, Toggle } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useReplaceAgentSkills, useSetAgentSkillEnabled, useSkills } from "@/lib/hooks/skills";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: skills, isLoading: skillsLoading, isError: skillsError, refetch: refetchSkills } = useSkills();
  const { data: links, isLoading: linksLoading, isError: linksError } = useAgentSkills(agent.id);
  const replace = useReplaceAgentSkills();
  const setEnabled = useSetAgentSkillEnabled();
  const [filter, setFilter] = React.useState("");
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const orderedIds = React.useMemo(() => (links ?? []).slice().sort((a, b) => a.order - b.order).map((link) => link.skill_id), [links]);
  const filtered = (skills ?? []).filter((skill) => skill.name.toLowerCase().includes(filter.toLowerCase()));
  const enabledLinked = (links ?? []).filter((link) => link.enabled !== false && (skills ?? []).some((skill) => skill.id === link.skill_id && skill.enabled)).length;

  const save = (next: string[]) => replace.mutate({ agentId: agent.id, skillIds: next });
  const toggle = (skillId: string) => save(orderedIds.includes(skillId) ? orderedIds.filter((id) => id !== skillId) : [...orderedIds, skillId]);
  const move = (skillId: string, offset: -1 | 1) => {
    const at = orderedIds.indexOf(skillId);
    const target = at + offset;
    if (at < 0 || target < 0 || target >= orderedIds.length) return;
    const next = [...orderedIds];
    const current = next[at];
    const destination = next[target];
    if (!current || !destination) return;
    next[at] = destination;
    next[target] = current;
    save(next);
  };
  const reorderEnabled = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const enabledIds = (links ?? []).filter((link) => link.enabled).sort((a, b) => a.order - b.order).map((link) => link.skill_id);
    if (!enabledIds.includes(sourceId) || !enabledIds.includes(targetId)) return;
    const moved = enabledIds.filter((id) => id !== sourceId);
    moved.splice(moved.indexOf(targetId), 0, sourceId);
    let cursor = 0;
    save(orderedIds.map((id) => enabledIds.includes(id) ? moved[cursor++]! : id));
  };

  if (skillsLoading || linksLoading) return <div style={{ padding: 28 }}><Skeleton height={42} /><Skeleton height={100} /></div>;
  if (skillsError || linksError) return <ErrorState body={t("skills.loadError")} onRetry={() => refetchSkills()} />;

  return <div style={{ padding: "24px 28px", maxWidth: 820 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><h2 style={{ margin: 0 }}>{t("skills.title")}</h2><span style={{ color: "var(--text-secondary)" }}>{t("skills.enabledCount", { linked: enabledLinked, total: orderedIds.length })}</span></div>
    <p style={{ color: "var(--text-secondary)" }}>{t("skills.orderHint")}</p>
    <div style={{ marginBottom: 12 }}><TextInput aria-label={t("skills.filterPlaceholder")} placeholder={t("skills.filterPlaceholder")} value={filter} onChange={setFilter} /></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {filtered.map((skill) => {
        const linked = orderedIds.includes(skill.id);
        const linkEnabled = links?.find((link) => link.skill_id === skill.id)?.enabled !== false;
        const position = orderedIds.indexOf(skill.id);
        return <label key={skill.id} draggable={linked && linkEnabled} onDragStart={() => setDraggedId(skill.id)} onDragOver={(event) => { if (linked && linkEnabled) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (draggedId) reorderEnabled(draggedId, skill.id); setDraggedId(null); }} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)", borderRadius: 8, padding: 12, opacity: draggedId === skill.id ? 0.55 : 1, cursor: linked && linkEnabled ? "grab" : undefined }}>
          <Checkbox checked={linked} onChange={() => toggle(skill.id)} ariaLabel={skill.name} />
          <span style={{ flex: 1 }}><strong>{skill.name}</strong>{skill.description && <span style={{ display: "block", color: "var(--text-secondary)", fontSize: 13 }}>{skill.description}</span>}</span>
          <Badge color="var(--text-secondary)">{skill.type}</Badge>
          <Badge color={skill.enabled ? "var(--green)" : "var(--text-muted)"}>{skill.enabled ? t("skills.enabled") : t("editor.disabled")}</Badge>
          {linked && <Toggle on={linkEnabled} onChange={(enabled) => setEnabled.mutate({ agentId: agent.id, skillId: skill.id, enabled })} ariaLabel={`Enable ${skill.name}`} size={16} />}
          {linked && <span style={{ display: "flex", gap: 4 }}>
            <Button kind="ghost" size="sm" aria-label={t("skills.moveUp", { name: skill.name })} disabled={replace.isPending || !linkEnabled || position === 0} onClick={(event) => { event.preventDefault(); move(skill.id, -1); }}>↑</Button>
            <Button kind="ghost" size="sm" aria-label={t("skills.moveDown", { name: skill.name })} disabled={replace.isPending || !linkEnabled || position === orderedIds.length - 1} onClick={(event) => { event.preventDefault(); move(skill.id, 1); }}>↓</Button>
          </span>}
        </label>;
      })}
    </div>
  </div>;
}
