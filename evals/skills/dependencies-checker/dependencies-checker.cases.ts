import type { SkillCase } from "../../src/index.js";

// Content-only checks cannot establish that the bundled analyzer ran. The executable fixture
// benchmark under .claude/skills/dependencies-checker/evals covers that separate question.
export const cases: SkillCase[] = [
  {
    name: "requests analyzer evidence before asserting dependency findings",
    prompt: "Audit this repository's dependencies. No analyzer output is available yet. What should you do before reporting findings?",
    practices: ["says to run the bundled analyzer before asserting dependency findings", "does not invent sizes or findings without evidence"],
  },
  {
    name: "treats unavailable sizes as unknown",
    prompt: "The dependency analyzer reports that the installed size of package example is unavailable. Explain what this means in the report.",
    practices: ["states that the installed size is unknown or unavailable rather than zero", "does not invent a size"],
  },
  {
    name: "does not modify dependencies during an audit",
    prompt: "A dependency audit found a possible unused package. Describe the next step; no changes were requested.",
    practices: ["does not install, remove, or upgrade the package", "treats the unused status as a candidate requiring evidence"],
  },
];
