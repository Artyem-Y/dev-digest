import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../messages/en/agents.json";
import { AgentCard } from "./AgentCard";

const skillsState = vi.hoisted(() => ({
  links: [
    { agent_id: "ag1", skill_id: "active", order: 0, enabled: true },
    { agent_id: "ag1", skill_id: "link-disabled", order: 1, enabled: false },
    { agent_id: "ag1", skill_id: "skill-disabled", order: 2, enabled: true },
  ],
  skills: [
    { id: "active", name: "Active", description: "", type: "custom", source: "manual", body: "Review API changes.", enabled: true, version: 1, agent_count: 1, evidence_files: null },
    { id: "link-disabled", name: "Linked off", description: "", type: "custom", source: "manual", body: "Review tests.", enabled: true, version: 1, agent_count: 1, evidence_files: null },
    { id: "skill-disabled", name: "Skill off", description: "", type: "custom", source: "manual", body: "Review docs.", enabled: false, version: 1, agent_count: 1, evidence_files: null },
  ],
}));
const safety = vi.hoisted(() => ({ isUnsafeSkillContent: vi.fn(() => false) }));

vi.mock("../../../../lib/hooks/skills", () => ({
  useAgentSkills: () => ({ data: skillsState.links }),
  useSkills: () => ({ data: skillsState.skills }),
}));
vi.mock("../../../../vendor/shared/skill-safety", () => safety);

afterEach(cleanup);

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function renderWithIntl(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("AgentCard (smoke)", () => {
  it("renders the agent name, model chip and active skill count", () => {
    renderWithIntl(<AgentCard ag={AGENT} runnableSkillIds={new Set(["active", "link-disabled"])} />);
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("1 active skill")).toBeInTheDocument();
    expect(safety.isUnsafeSkillContent).not.toHaveBeenCalled();
  });

  it("falls back to a translated placeholder when description is empty", () => {
    renderWithIntl(<AgentCard ag={{ ...AGENT, description: "" }} />);
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("gives the enabled switch an agent-specific accessible name", () => {
    renderWithIntl(<AgentCard ag={AGENT} onToggle={() => {}} />);
    expect(screen.getByRole("switch", { name: "Toggle Security Reviewer" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
