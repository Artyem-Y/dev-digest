"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Markdown } from "@devdigest/ui";
import { useRestoreSkill, useSkill, useSkillVersions } from "@/lib/hooks/skills";

type Tab = "config" | "preview" | "versioning";

export function SkillDetailPageView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: skill, isLoading } = useSkill(params.id);
  const { data: versions = [] } = useSkillVersions(params.id);
  const restore = useRestoreSkill();
  const [tab, setTab] = React.useState<Tab>("config");
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);
  if (isLoading) return <AppShell crumb={[{ label: "Skills Lab" }]}><main style={{ padding: 28 }}>Loading…</main></AppShell>;
  if (!skill) return <AppShell crumb={[{ label: "Skills Lab" }]}><main style={{ padding: 28 }}>Skill not found.</main></AppShell>;
  return <AppShell crumb={[{ label: "Skills Lab" }, { label: "Skills" }, { label: skill.name }]}><main style={{ padding: 28, maxWidth: 920 }}>
    <Button kind="ghost" onClick={() => router.push("/skills")}>← All skills</Button><h1>{skill.name}</h1>
    <div role="tablist" style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>{(["config", "preview", "versioning"] as Tab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} style={{ padding: "8px 12px", border: 0, background: "transparent", borderBottom: tab === item ? "2px solid var(--accent)" : undefined }}> {item[0]!.toUpperCase() + item.slice(1)}</button>)}</div>
    {tab === "config" && <dl><dt>Description</dt><dd>{skill.description}</dd><dt>Type</dt><dd>{skill.type}</dd><dt>Version</dt><dd>v{skill.version} · {skill.agent_count} agents</dd><dt>Enabled</dt><dd>{skill.enabled ? "Enabled" : "Disabled"}</dd></dl>}
    {tab === "preview" && <article style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}><Markdown>{skill.body}</Markdown></article>}
    {tab === "versioning" && <div style={{ display: "grid", gap: 12 }}>{versions.map((version) => <article key={version.version} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}><strong>v{version.version}</strong><span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{new Date(version.created_at).toLocaleString()}</span><pre style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{version.body}</pre>{version.version !== skill.version && <div style={{ display: "flex", gap: 8 }}><Button kind="secondary" onClick={() => setDiffVersion(diffVersion === version.version ? null : version.version)}>Diff</Button><Button kind="secondary" disabled={restore.isPending} onClick={() => restore.mutate({ id: skill.id, version: version.version, expectedVersion: skill.version })}>Restore this version</Button></div>}{diffVersion === version.version && <article aria-label={`Diff with version ${version.version}`} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}><strong>Current vs v{version.version}</strong><pre style={{ whiteSpace: "pre-wrap" }}>--- v{version.version}{"\n"}{version.body}{"\n"}+++ current v{skill.version}{"\n"}{skill.body}</pre></article>}</article>)}</div>}
  </main></AppShell>;
}
