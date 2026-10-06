"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Skeleton, TextInput, Toggle } from "@devdigest/ui";
import type { Agent, Skill } from "@devdigest/shared";
import { useAgentSkills, useReplaceAgentSkills, useSetAgentSkillEnabled, useSkills } from "@/lib/hooks/skills";
import { isUnsafeSkillContent } from "@/vendor/shared/skill-safety";

const typeColors = {
  rubric: "var(--accent-text)",
  security: "var(--crit)",
  convention: "var(--ok)",
  custom: "var(--warn)",
} as const;

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: skills, isLoading: skillsLoading, isError: skillsError, refetch: refetchSkills } = useSkills();
  const { data: links, isLoading: linksLoading, isError: linksError } = useAgentSkills(agent.id);
  const replace = useReplaceAgentSkills();
  const setEnabled = useSetAgentSkillEnabled();
  const [filter, setFilter] = React.useState("");
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const orderedIds = React.useMemo(() => (links ?? []).slice().sort((a, b) => a.order - b.order).map((link) => link.skill_id), [links]);
  const filtered = React.useMemo(() => {
    const linkBySkill = new Map((links ?? []).map((link) => [link.skill_id, link]));
    return (skills ?? [])
      .filter((skill) => skill.name.toLowerCase().includes(filter.toLowerCase()))
      .sort((left, right) => {
        const leftLink = linkBySkill.get(left.id);
        const rightLink = linkBySkill.get(right.id);
        const rank = (skill: Skill, link: typeof leftLink) => !link ? 2 : link.enabled !== false && skill.enabled ? 0 : 1;
        const rankDifference = rank(left, leftLink) - rank(right, rightLink);
        if (rankDifference !== 0) return rankDifference;
        if (leftLink && rightLink) return leftLink.order - rightLink.order;
        return left.name.localeCompare(right.name);
      });
  }, [filter, links, skills]);
  const enabledLinked = (links ?? []).filter((link) => link.enabled !== false && (skills ?? []).some((skill) => skill.id === link.skill_id && skill.enabled && !isUnsafeSkillContent(skill.body))).length;

  const save = (next: string[]) => replace.mutate({ agentId: agent.id, skillIds: next });
  const toggle = (skillId: string) => save(orderedIds.includes(skillId) ? orderedIds.filter((id) => id !== skillId) : [...orderedIds, skillId]);
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
        const unsafe = isUnsafeSkillContent(skill.body);
        const enabled = !unsafe && linked && linkEnabled;
        return <label key={skill.id} draggable={!unsafe && linked && linkEnabled} onDragStart={() => setDraggedId(skill.id)} onDragOver={(event) => { if (!unsafe && linked && linkEnabled) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (draggedId) reorderEnabled(draggedId, skill.id); setDraggedId(null); }} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${unsafe ? "var(--crit)" : "var(--border)"}`, borderRadius: 8, padding: 12, background: unsafe ? "var(--crit-bg)" : undefined, opacity: draggedId === skill.id ? 0.55 : 1, cursor: !unsafe && linked && linkEnabled ? "grab" : undefined }}>
          <Toggle on={enabled} onChange={(next) => { if (unsafe) return; if (!linked && next) toggle(skill.id); else if (linked) setEnabled.mutate({ agentId: agent.id, skillId: skill.id, enabled: next }); }} ariaLabel={`Enable ${skill.name}`} size={16} disabled={unsafe} />
          <span style={{ flex: 1 }}><strong>{skill.name}</strong>{skill.description && <span style={{ display: "block", color: "var(--text-secondary)", fontSize: 13 }}>{skill.description}</span>}</span>
          <Badge color={typeColors[skill.type]}>{skill.type}</Badge>
        </label>;
      })}
    </div>
  </div>;
}
