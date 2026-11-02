import { describe, expect, it } from "vitest";
import { skillContent, skillContentFromDir } from "./load.js";
import { join } from "node:path";
import { REPO_ROOT } from "./paths.js";

describe("skillContent", () => {
  it("includes linked rules documents in the candidate skill payload", () => {
    const content = skillContent("onion-architecture");

    expect(content).toContain("## rules: dependency-rule.md");
    expect(content).toContain("Runtime calls can go outward through a port");
    expect(content).toContain("Do not pass the full `Container` into new domain/application code");
  });

  it("does not include eval fixtures or oracle data in the skill payload", () => {
    const content = skillContent("onion-architecture");

    expect(content).not.toContain("use-case-direct-drizzle-write");
    expect(content).not.toContain("must_convey");
    expect(content).not.toContain("Review this proposed backend change");
  });

  it("loads the versioned baseline separately from the candidate skill", () => {
    const baseline = skillContentFromDir(
      join(REPO_ROOT, ".claude/skills/onion-architecture/evals/versions/v1.1.0"),
    );
    const candidate = skillContent("onion-architecture");

    expect(baseline).not.toContain("Tenant context through repository predicates");
    expect(baseline).not.toContain("External effects and database transactions");
    expect(candidate).toContain("Tenant context through repository predicates");
    expect(candidate).toContain("External effects and database transactions");
  });
});
