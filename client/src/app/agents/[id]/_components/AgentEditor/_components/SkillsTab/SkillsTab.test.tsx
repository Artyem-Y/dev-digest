import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/agents.json";
import type { Agent, Skill } from "@devdigest/shared";

const replace = vi.fn();

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: [
    { id: "one", name: "Coverage", description: "", type: "rubric", source: "manual", body: "", enabled: true, version: 1 },
    { id: "two", name: "Failure paths", description: "", type: "security", source: "manual", body: "", enabled: false, version: 1 },
  ], isLoading: false, isError: false, refetch: vi.fn() }),
  useAgentSkills: () => ({ data: [{ agent_id: "agent-1", skill_id: "one", order: 0 }], isLoading: false, isError: false }),
  useReplaceAgentSkills: () => ({ mutate: replace, isPending: false }),
}));

import { SkillsTab } from "./SkillsTab";

const agent = { id: "agent-1", name: "Test", description: "", provider: "openai", model: "gpt", system_prompt: "", output_schema: null, enabled: true, version: 1, strategy: "single-pass", ci_fail_on: "critical", repo_intel: true } as Agent;

afterEach(() => { cleanup(); replace.mockReset(); });

describe("SkillsTab", () => {
  it("shows linked count, states, and attaches a skill through the ordered endpoint", () => {
    render(<NextIntlClientProvider locale="en" messages={{ agents: messages }}><SkillsTab agent={agent} /></NextIntlClientProvider>);

    expect(screen.getByText("1 of 1 enabled")).toBeInTheDocument();
    expect(screen.getByText("Coverage")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Failure paths/i }));
    expect(replace).toHaveBeenCalledWith({ agentId: "agent-1", skillIds: ["one", "two"] });
  });
});
