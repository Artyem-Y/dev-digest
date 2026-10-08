"use client";

import React from "react";
import { Badge, Button, Card, Modal } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";

export function VersionsTab({ skill, versions, restoring, deleting, onRestore, onDelete }: { skill: Skill; versions: SkillVersion[]; restoring: boolean; deleting: boolean; onRestore: (version: number) => void; onDelete: (version: number) => void }) {
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);
  const [fullVersion, setFullVersion] = React.useState<number | null>(null);
  const [deleteVersion, setDeleteVersion] = React.useState<number | null>(null);
  if (versions.length === 0) return <Card style={{ padding: 22, color: "var(--text-secondary)" }}>No saved versions yet.</Card>;
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ padding: "11px 13px", borderRadius: 7, background: "var(--accent-bg)", color: "var(--text-secondary)", fontSize: 13 }}>Skill bodies are versioned immutably. Restoring a version creates a new current version.</div>
    {versions.map((version) => {
      const current = version.version === skill.version;
      const expanded = fullVersion === version.version;
      return <Card key={version.version} pad={false} style={{ overflow: "hidden", borderColor: current ? "var(--accent)" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", background: current ? "var(--accent-bg)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}><strong>v{version.version}</strong>{current && <Badge color="var(--accent-text)" bg="var(--accent-bg)">Current</Badge>}<span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 12 }}>{new Date(version.created_at).toLocaleString()}</span></div>
        <div style={{ padding: 16 }}><pre className="mono" style={{ margin: 0, maxHeight: expanded ? "none" : 180, overflow: expanded ? "visible" : "auto", whiteSpace: "pre-wrap", border: "1px solid var(--border)", borderRadius: 6, background: "var(--code-bg)", padding: "12px 14px", fontSize: 12.5, lineHeight: 1.55 }}>{version.body}</pre><div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}><Button kind="ghost" size="sm" onClick={() => setFullVersion(expanded ? null : version.version)}>{expanded ? "Hide full version" : "View full version"}</Button>{!current && <><Button kind="secondary" size="sm" onClick={() => setDiffVersion(diffVersion === version.version ? null : version.version)}>{diffVersion === version.version ? "Hide diff" : "Diff against current"}</Button><Button kind="primary" size="sm" disabled={restoring || deleting} onClick={() => onRestore(version.version)}>Restore</Button><Button kind="danger" size="sm" disabled={restoring || deleting} onClick={() => setDeleteVersion(version.version)}>Delete</Button></>}</div>{diffVersion === version.version && <article aria-label={`Diff with version ${version.version}`} style={{ marginTop: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 6, background: "var(--code-bg)" }}><strong style={{ fontSize: 13 }}>Current v{skill.version} compared with v{version.version}</strong><pre className="mono" style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: 12 }}>{`--- v${version.version}\n${version.body}\n+++ current v${skill.version}\n${skill.body}`}</pre></article>}</div>
      </Card>;
    })}
    {deleteVersion !== null && <Modal width={460} title="Delete version" subtitle={`Delete v${deleteVersion}? This cannot be undone.`} onClose={() => setDeleteVersion(null)} footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button kind="ghost" onClick={() => setDeleteVersion(null)}>Cancel</Button><Button kind="danger" loading={deleting} onClick={() => { onDelete(deleteVersion); setDeleteVersion(null); }}>Delete version</Button></div>}><div style={{ padding: 24, color: "var(--text-secondary)" }}>The current version cannot be deleted.</div></Modal>}
  </div>;
}
