import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../messages/en/conventions.json";

const state = vi.hoisted(() => ({
  repos: [] as Array<{ id: string; full_name: string; default_branch: string; clone_path: string | null }>,
  candidates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/hooks/core", () => ({ useRepos: () => ({ data: state.repos }) }));
vi.mock("@/lib/hooks/agents", () => ({ useAgents: () => ({ data: [] }) }));
vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ data: state.candidates, isLoading: false }),
  useScanConventions: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateConvention: () => ({ mutate: vi.fn() }),
  useCreateConventionsSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ConventionsPageView } from "./ConventionsPageView";

afterEach(cleanup);

beforeEach(() => {
  state.repos = [{ id: "repo-1", full_name: "acme/payments-api", default_branch: "main", clone_path: null }];
  state.candidates = [];
});

describe("ConventionsPageView", () => {
  it("prevents extraction until the selected repository has been cloned", () => {
    render(<NextIntlClientProvider locale="en" messages={{ conventions: messages }}><ConventionsPageView /></NextIntlClientProvider>);

    expect(screen.getByRole("heading", { name: "Conventions in acme/payments-api" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run scan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create skill" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("This repository has no local checkout.");
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
  });

  it("opens the editable create-skill modal for accepted conventions", () => {
    state.repos[0]!.clone_path = "/clones/acme/payments-api";
    state.candidates = [{
      id: "candidate-1",
      category: "style",
      rule: "Use async/await instead of then() chains.",
      evidence_path: "src/api.ts",
      evidence_line: 12,
      evidence_snippet: "await load();",
      confidence: 0.91,
      status: "accepted",
    }];

    render(<NextIntlClientProvider locale="en" messages={{ conventions: messages }}><ConventionsPageView /></NextIntlClientProvider>);

    expect(screen.getByRole("button", { name: "Accepted" })).toHaveStyle({ background: "var(--accent)" });
    fireEvent.click(screen.getByText("Use async/await instead of then() chains."));
    expect(screen.getByLabelText("Convention rule")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Create skill" });
    expect(create).toBeEnabled();
    fireEvent.click(create);

    expect(screen.getByRole("dialog")).toHaveTextContent("Create skill from conventions");
    expect(screen.getByDisplayValue("repo-conventions")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/# repo-conventions/)).toBeInTheDocument();
  });
});
