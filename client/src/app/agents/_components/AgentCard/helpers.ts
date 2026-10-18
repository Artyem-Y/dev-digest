import { MODEL_COLOR } from "./constants";
import type { Skill } from "@devdigest/shared";
import { isUnsafeSkillContent } from "../../../../vendor/shared/skill-safety";

/** Resolve the chip colour for an agent's model (unknown → secondary token). */
export function modelColor(model: string): string {
  return MODEL_COLOR[model] ?? "var(--text-secondary)";
}

/** IDs that may be attached to a review prompt. Compute once for the list. */
export function runnableSkillIds(skills: readonly Skill[] | undefined): ReadonlySet<string> | undefined {
  if (!skills) return undefined;
  return new Set(skills.filter((skill) => skill.enabled && !isUnsafeSkillContent(skill.body)).map((skill) => skill.id));
}
