"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@devdigest/ui";
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
  return <AppShell crumb={[{ label: "Skills Lab" }, { label: "Skills" }, { label: skill.name }]}><main style={{ padding: 28, maxWidth: 920 }}>
    <Button kind="ghost" onClick={() => router.push("/skills")}>← All skills</Button><h1>{skill.name}</h1>
    <div role="tablist" style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>{(["config", "preview", "versioning"] as Tab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} style={{ padding: "8px 12px", border: 0, background: "transparent", borderBottom: tab === item ? "2px solid var(--accent)" : undefined }}> {item[0]!.toUpperCase() + item.slice(1)}</button>)}</div>
    {tab === "config" && <ConfigTab skill={skill} />}
    {tab === "preview" && <PreviewTab body={skill.body} />}
    {tab === "versioning" && <VersionsTab skill={skill} versions={versions} restoring={restore.isPending} onRestore={(version) => restore.mutate({ id: skill.id, version, expectedVersion: skill.version })} />}
  </main></AppShell>;
}
