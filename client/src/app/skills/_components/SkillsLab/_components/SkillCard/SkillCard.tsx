"use client";

import React from "react";
import { Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";

const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--bg-surface)", transition: "border-color .15s ease, background .15s ease" };

const typeColors: Record<Skill["type"], string> = {
  rubric: "var(--accent-text)",
  security: "var(--crit)",
  convention: "var(--ok)",
  custom: "var(--warn)",
};

export function SkillCard({ skill, selected, onSelect, onToggle, onDelete }: { skill: Skill; selected: boolean; onSelect: () => void; onToggle: (enabled: boolean) => void; onDelete: () => void }) {
  return <article style={{ ...card, borderColor: selected ? "var(--accent)" : undefined, background: selected ? "var(--accent-bg)" : undefined, boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined }}>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button type="button" onClick={onSelect} style={{ flex: 1, minWidth: 0, textAlign: "left", border: 0, background: "transparent", color: "inherit", padding: 0, cursor: "pointer", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skill.name}</button>
      <Badge color="var(--text-secondary)">v{skill.version}</Badge>
      <Toggle on={skill.enabled} onChange={onToggle} ariaLabel={`Enable ${skill.name}`} size={14} />
      <button type="button" aria-label={`Delete ${skill.name}`} onClick={onDelete} style={{ border: 0, borderRadius: 5, padding: "3px 6px", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>×</button>
    </div>
    <button type="button" onClick={onSelect} style={{ display: "block", width: "100%", textAlign: "left", border: 0, background: "transparent", color: "inherit", padding: 0, cursor: "pointer" }}>
      <p style={{ margin: "4px 0", color: "var(--text-secondary)", fontSize: 12 }}>{skill.description}</p>
      <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}><Badge color={typeColors[skill.type]}>{skill.type}</Badge><Badge color="var(--text-secondary)">{skill.source}</Badge><Badge color="var(--text-secondary)">{skill.agent_count ?? 0} agents</Badge></div>
    </button>
  </article>;
}
