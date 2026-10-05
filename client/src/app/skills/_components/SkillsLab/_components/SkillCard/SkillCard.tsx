"use client";

import React from "react";
import { Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";

const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--bg-surface)" };

export function SkillCard({ skill, selected, onSelect, onToggle, onDelete }: { skill: Skill; selected: boolean; onSelect: () => void; onToggle: (enabled: boolean) => void; onDelete: () => void }) {
  return <article style={{ ...card, outline: selected ? "2px solid var(--accent)" : undefined }}>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button type="button" onClick={onSelect} style={{ flex: 1, textAlign: "left", border: 0, background: "transparent", color: "inherit", padding: 0, cursor: "pointer" }}><strong>{skill.name}</strong></button>
      <Badge color="var(--text-secondary)">v{skill.version}</Badge>
      <Toggle on={skill.enabled} onChange={onToggle} ariaLabel={`Enable ${skill.name}`} size={14} />
      <button type="button" aria-label={`Delete ${skill.name}`} onClick={onDelete}>Delete</button>
    </div>
    <button type="button" onClick={onSelect} style={{ display: "block", width: "100%", textAlign: "left", border: 0, background: "transparent", color: "inherit", padding: 0, cursor: "pointer" }}>
      <p style={{ margin: "4px 0", color: "var(--text-secondary)", fontSize: 12 }}>{skill.description}</p>
      <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}><Badge color="var(--text-secondary)">{skill.type}</Badge><Badge color="var(--text-secondary)">{skill.source}</Badge><Badge color="var(--text-secondary)">{skill.agent_count ?? 0} agents</Badge></div>
    </button>
  </article>;
}
