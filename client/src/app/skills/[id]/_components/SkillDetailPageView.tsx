"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card } from "@devdigest/ui";
import { useRestoreSkill, useSkill, useSkillVersions } from "@/lib/hooks/skills";
import { ConfigTab } from "./SkillDetail/_components/ConfigTab";
import { PreviewTab } from "./SkillDetail/_components/PreviewTab";
import { VersionsTab } from "./SkillDetail/_components/VersionsTab";

type Tab = "config" | "preview" | "versioning";

export function SkillDetailPageView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: skill, isLoading } = useSkill(params.id);
  const { data: versions = [] } = useSkillVersions(params.id);
  const restore = useRestoreSkill();
  const [tab, setTab] = React.useState<Tab>("config");
  if (isLoading) return <AppShell crumb={[{ label: "Skills Lab" }]}><main style={{ padding: 28 }}>Loading…</main></AppShell>;
  if (!skill) return <AppShell crumb={[{ label: "Skills Lab" }]}><main style={{ padding: 28 }}>Skill not found.</main></AppShell>;
  return <AppShell crumb={[{ label: "Skills Lab" }, { label: "Skills" }, { label: skill.name }]}><main style={{ maxWidth: 980, margin: "0 auto", padding: "26px 28px 64px" }}>
    <Button kind="ghost" size="sm" onClick={() => router.push("/skills")}>← All skills</Button>
    <Card pad={false} style={{ marginTop: 14, overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 24px", borderBottom: "1px solid var(--border)" }}><div style={{ minWidth: 0, flex: 1 }}><h1 style={{ fontSize: 22, letterSpacing: "-0.025em", overflow: "hidden", textOverflow: "ellipsis" }}>{skill.name}</h1><p style={{ color: "var(--text-secondary)", marginTop: 5 }}>{skill.description}</p></div><Badge color="var(--text-secondary)">v{skill.version}</Badge><Badge color={skill.enabled ? "var(--ok)" : "var(--text-muted)"}>{skill.enabled ? "Enabled" : "Disabled"}</Badge></header>
      <div role="tablist" style={{ display: "flex", gap: 4, padding: "0 20px", borderBottom: "1px solid var(--border)" }}>{(["config", "preview", "versioning"] as Tab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} style={{ padding: "12px 13px", border: 0, borderBottom: tab === item ? "2px solid var(--accent)" : "2px solid transparent", background: "transparent", color: tab === item ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: 600 }}> {item[0]!.toUpperCase() + item.slice(1)}</button>)}</div>
      <section style={{ padding: 24 }}>{tab === "config" && <ConfigTab skill={skill} />}{tab === "preview" && <PreviewTab body={skill.body} />}{tab === "versioning" && <VersionsTab skill={skill} versions={versions} restoring={restore.isPending} onRestore={(version) => restore.mutate({ id: skill.id, version, expectedVersion: skill.version })} />}</section>
    </Card>
  </main></AppShell>;
}
