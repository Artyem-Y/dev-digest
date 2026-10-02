"use client";

import { AppShell } from "@/components/app-shell";
import { SkillsLab } from "../SkillsLab";

export function SkillsLabPageView() {
  return <AppShell crumb={[{ label: "Skills Lab" }, { label: "Skills" }]}><div style={{ padding: 28 }}><SkillsLab /></div></AppShell>;
}
