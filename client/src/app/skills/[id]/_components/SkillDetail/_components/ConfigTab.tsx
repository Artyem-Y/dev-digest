import type { Skill } from "@devdigest/shared";
import { Badge, Card, Markdown } from "@devdigest/ui";

export function ConfigTab({ skill }: { skill: Skill }) {
  return <div style={{ display: "grid", gap: 18 }}>
    <Card style={{ background: "var(--bg-surface)" }}><dl style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", rowGap: 14, columnGap: 18, margin: 0 }}><dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Description</dt><dd style={{ margin: 0 }}>{skill.description || "—"}</dd><dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Type</dt><dd style={{ margin: 0 }}><Badge color={skill.type === "security" ? "var(--crit)" : skill.type === "convention" ? "var(--ok)" : "var(--accent-text)"}>{skill.type}</Badge></dd><dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Source</dt><dd style={{ margin: 0 }}><Badge color="var(--text-secondary)">{skill.source}</Badge></dd><dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Version</dt><dd style={{ margin: 0 }}>v{skill.version} · {skill.agent_count} agents</dd><dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Enabled</dt><dd style={{ margin: 0 }}><Badge color={skill.enabled ? "var(--ok)" : "var(--text-muted)"}>{skill.enabled ? "Enabled" : "Disabled"}</Badge></dd></dl></Card>
    <div><h2 style={{ fontSize: 14, marginBottom: 10 }}>Current body</h2><Card style={{ padding: 18, background: "var(--code-bg)" }}><Markdown>{skill.body}</Markdown></Card></div>
  </div>;
}
