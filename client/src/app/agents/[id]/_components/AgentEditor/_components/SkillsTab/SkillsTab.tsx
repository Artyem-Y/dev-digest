"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useReplaceAgentSkills, useSkills } from "@/lib/hooks/skills";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: skills, isLoading: skillsLoading, isError: skillsError, refetch: refetchSkills } = useSkills();
  const { data: links, isLoading: linksLoading, isError: linksError } = useAgentSkills(agent.id);
  const replace = useReplaceAgentSkills();
  const [filter, setFilter] = React.useState("");
  const orderedIds = React.useMemo(() => (links ?? []).slice().sort((a, b) => a.order - b.order).map((link) => link.skill_id), [links]);
  const filtered = (skills ?? []).filter((skill) => skill.name.toLowerCase().includes(filter.toLowerCase()));
  const enabledLinked = (skills ?? []).filter((skill) => orderedIds.includes(skill.id) && skill.enabled).length;

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

  if (skillsLoading || linksLoading) return <div style={{ padding: 28 }}><Skeleton height={42} /><Skeleton height={100} /></div>;
  if (skillsError || linksError) return <ErrorState body={t("skills.loadError")} onRetry={() => refetchSkills()} />;

  return <div style={{ padding: "24px 28px", maxWidth: 820 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><h2 style={{ margin: 0 }}>{t("skills.title")}</h2><span style={{ color: "var(--text-secondary)" }}>{t("skills.enabledCount", { linked: enabledLinked, total: orderedIds.length })}</span></div>
    <p style={{ color: "var(--text-secondary)" }}>{t("skills.orderHint")}</p>
    <input aria-label={t("skills.filterPlaceholder")} placeholder={t("skills.filterPlaceholder")} value={filter} onChange={(event) => setFilter(event.target.value)} style={{ width: "100%", marginBottom: 12 }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {filtered.map((skill) => {
        const linked = orderedIds.includes(skill.id);
        const position = orderedIds.indexOf(skill.id);
        return <label key={skill.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <input aria-label={skill.name} type="checkbox" checked={linked} onChange={() => toggle(skill.id)} disabled={replace.isPending} />
          <span style={{ flex: 1 }}><strong>{skill.name}</strong>{skill.description && <span style={{ display: "block", color: "var(--text-secondary)", fontSize: 13 }}>{skill.description}</span>}</span>
          <Badge color="var(--text-secondary)">{skill.type}</Badge>
          <Badge color={skill.enabled ? "var(--green)" : "var(--text-muted)"}>{skill.enabled ? t("skills.enabled") : t("editor.disabled")}</Badge>
          {linked && <span style={{ display: "flex", gap: 4 }}>
            <button type="button" aria-label={t("skills.moveUp", { name: skill.name })} disabled={replace.isPending || position === 0} onClick={(event) => { event.preventDefault(); move(skill.id, -1); }}>↑</button>
            <button type="button" aria-label={t("skills.moveDown", { name: skill.name })} disabled={replace.isPending || position === orderedIds.length - 1} onClick={(event) => { event.preventDefault(); move(skill.id, 1); }}>↓</button>
          </span>}
        </label>;
      })}
    </div>
  </div>;
}
