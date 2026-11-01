import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "../../../messages/en/eval.json";
import { EvalDashboard } from "./EvalDashboard";

const state = vi.hoisted(() => ({ agents: {} as Record<string, unknown>, runs: {} as Record<string, unknown>, retryAgents: vi.fn(), retryRuns: vi.fn() }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/hooks/agents", () => ({ useAgents: () => state.agents }));
vi.mock("@/lib/hooks/evals", () => ({ useEvalRuns: () => state.runs, useStartEval: () => ({ mutate: vi.fn() }), usePromoteEvalRun: () => ({ mutate: vi.fn() }) }));
const show = () => render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalDashboard /></NextIntlClientProvider>);
beforeEach(() => { state.agents = { data: [], refetch: state.retryAgents }; state.runs = { data: [], refetch: state.retryRuns }; vi.clearAllMocks(); });

it("shows loading without inventing metrics", () => {
  state.runs = { isLoading: true, refetch: state.retryRuns };
  show();
  expect(screen.getByText("Loading evals…")).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "Run history" })).not.toBeInTheDocument();
});
it("shows errors and retries both dependencies", () => {
  state.runs = { isError: true, refetch: state.retryRuns };
  show();
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load evals.");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(state.retryAgents).toHaveBeenCalledOnce();
  expect(state.retryRuns).toHaveBeenCalledOnce();
});
it("shows empty agents and run history", () => {
  show();
  expect(screen.getByText("No agents yet.")).toBeInTheDocument();
  expect(screen.getByText("No runs yet.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Run all agents" })).toBeDisabled();
});
