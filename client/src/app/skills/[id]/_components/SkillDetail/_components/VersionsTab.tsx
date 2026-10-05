"use client";

import React from "react";
import { Button } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";

export function VersionsTab({ skill, versions, restoring, onRestore }: { skill: Skill; versions: SkillVersion[]; restoring: boolean; onRestore: (version: number) => void }) {
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);
  return <div style={{ display: "grid", gap: 12 }}>{versions.map((version) => <article key={version.version} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}><strong>v{version.version}</strong><span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{new Date(version.created_at).toLocaleString()}</span><pre style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{version.body}</pre>{version.version !== skill.version && <div style={{ display: "flex", gap: 8 }}><Button kind="secondary" onClick={() => setDiffVersion(diffVersion === version.version ? null : version.version)}>Diff</Button><Button kind="secondary" disabled={restoring} onClick={() => onRestore(version.version)}>Restore this version</Button></div>}{diffVersion === version.version && <article aria-label={`Diff with version ${version.version}`} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}><strong>Current vs v{version.version}</strong><pre style={{ whiteSpace: "pre-wrap" }}>--- v{version.version}{"\n"}{version.body}{"\n"}+++ current v{skill.version}{"\n"}{skill.body}</pre></article>}</article>)}</div>;
}
