"use client";

import { AppShell } from "@/components/app-shell";
import { ProjectContext } from "@/components/project-context/ProjectContext";

export default function ProjectContextPage() {
  return <AppShell crumb={[{ label: "Project Context" }]}><ProjectContext /></AppShell>;
}
