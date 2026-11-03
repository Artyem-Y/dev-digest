import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillCase } from "../../src/index.js";

interface FixtureCase {
  id: string;
  prompt: string;
  fixture: string;
  expected_output: string;
}

interface EvalDefinition {
  cases: FixtureCase[];
}

interface ExpectedFinding {
  must_convey: string;
}

interface ExpectedOutput {
  findings: ExpectedFinding[];
}

const here = dirname(fileURLToPath(import.meta.url));
const skillEvalDir = resolve(here, "../../../.claude/skills/onion-architecture/evals");
const definition = JSON.parse(
  readFileSync(join(skillEvalDir, "evals.json"), "utf8"),
) as EvalDefinition;
const caseNames: Record<string, string> = {
  "tenant-scoping": "tenant scoping across repository reads and writes",
  "transactional-side-effect": "transactional side effect boundary",
  "outbox-lifecycle": "outbox lifecycle across modules",
  "peer-schema-import": "peer module schema import",
};

export const cases: SkillCase[] = definition.cases.map((fixtureCase) => {
  const diff = readFileSync(join(skillEvalDir, fixtureCase.fixture), "utf8");
  const expected = JSON.parse(
    readFileSync(join(skillEvalDir, fixtureCase.expected_output), "utf8"),
  ) as ExpectedOutput;

  return {
    name: caseNames[fixtureCase.id] ?? fixtureCase.id,
    kind: "quality",
    prompt: `${fixtureCase.prompt}\n\nReview this change:\n\n\`\`\`diff\n${diff}\n\`\`\``,
    practices: expected.findings.map((finding) => finding.must_convey),
    threshold: 0.8,
    maxTurns: 8,
  };
});
