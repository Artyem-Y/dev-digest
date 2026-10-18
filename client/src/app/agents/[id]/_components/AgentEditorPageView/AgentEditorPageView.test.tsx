import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentEditorPageView } from "./AgentEditorPageView";

const agent = {
  id: "agent-1",
  name: "General Reviewer",
  description: "Reviews a PR.",
  provider: "openai",
  model: "gpt-6-luna",
  system_prompt: "Review.",
  output_schema: null,
  strategy: "single-pass" as const,
  ci_fail_on: "critical" as const,
  repo_intel: true,
  enabled: true,
  version: 1,
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "agent-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=config"),
}));
vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: [agent] }),
  useAgent: () => ({ data: agent, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateAgent: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: [{ id: "review-skill", enabled: true, body: "Review API changes." }] }),
}));
vi.mock("../../../_components/AgentCard/helpers", () => ({
  runnableSkillIds: (skills: Array<{ id: string }>) => new Set(skills.map((skill) => skill.id)),
}));
vi.mock("../../../_components/AgentCard", () => ({
  AgentCard: ({ runnableSkillIds }: { runnableSkillIds?: ReadonlySet<string> }) => (
    <div>skill IDs: {runnableSkillIds ? [...runnableSkillIds].join(", ") : "missing"}</div>
  ),
}));
vi.mock("../AgentEditor", () => ({ AgentEditor: () => <div>editor</div> }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@devdigest/ui", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Dropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
  ErrorState: () => <div>error</div>,
  Skeleton: () => <div>skeleton</div>,
  Icon: { Cpu: () => <span>cpu</span> },
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("AgentEditorPageView", () => {
  it("passes the shared runnable skill set to sidebar cards", () => {
    render(<AgentEditorPageView />);

    expect(screen.getByText("skill IDs: review-skill")).toBeInTheDocument();
  });
});
