import type { Skill } from "@devdigest/shared";

export function ConfigTab({ skill }: { skill: Skill }) {
  return <dl><dt>Description</dt><dd>{skill.description}</dd><dt>Type</dt><dd>{skill.type}</dd><dt>Source</dt><dd>{skill.source}</dd><dt>Version</dt><dd>v{skill.version} · {skill.agent_count} agents</dd><dt>Enabled</dt><dd>{skill.enabled ? "Enabled" : "Disabled"}</dd></dl>;
}
