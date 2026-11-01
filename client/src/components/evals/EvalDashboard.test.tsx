import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "../../../messages/en/eval.json";
import { EvalDashboard, compatibleEvalRuns } from "./EvalDashboard";
import type { EvalPipelineRun } from "@devdigest/shared";

vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/hooks/agents", () => ({ useAgents: () => ({ data: [{ id: "a", name: "Reviewer", version: 4 }] }) }));
const startAll = vi.fn().mockResolvedValue({});
const promote = vi.fn();
vi.mock("@/lib/hooks/evals", () => ({
  useStartEval: () => ({ mutate: vi.fn(), mutateAsync: startAll }),
  usePromoteEvalRun: () => ({ mutate: promote }),
  useEvalRuns: () => ({ data: ["one", "two"].map((id, index) => ({ id, agent_id: "a", status: "completed", created_at: `2026-10-3${index}T00:00:00Z`, dataset_fingerprint: "same", engine_version: "unavailable", scorer_version: "1", snapshot: { agent: { provider: "openai", model: "m", systemPrompt: id, skills: [] }, cases: [], ...(index ? { promotion: {} } : {}) }, result: { score: { recall: 0.5, precision: 0.5, citationAccuracy: 1, counts: { truePositive: 1, knownFalsePositive: 1, unlabeled: 0 } }, costUsd: null } })) }),
}));

it("suppresses deltas when the engine revision is unavailable even for the same dataset", () => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = vi.fn();
  render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalDashboard agentId="a" /></NextIntlClientProvider>);
  for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
  fireEvent.click(screen.getByRole("button", { name: "Compare runs" }));
  expect(screen.getByRole("alert")).toHaveTextContent("engine revision cannot be verified");
  expect(screen.queryByText(/pp\)/)).not.toBeInTheDocument();
  expect(screen.getByText("− one")).toHaveAttribute("data-change", "removed");
  expect(screen.getByText("+ two")).toHaveAttribute("data-change", "added");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Promote newer run" }));
  expect(promote).toHaveBeenCalledWith({ agentId: "a", runId: "two", expectedVersion: 4 });
});

it("filters the run history by a selected period", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
  render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalDashboard agentId="a" /></NextIntlClientProvider>);
  fireEvent.change(screen.getByLabelText("Run period"), { target: { value: "1" } });
  expect(within(screen.getByRole("table", { name: "Run history" })).getAllByRole("row")).toHaveLength(2);
  vi.useRealTimers();
});

it("requires equal known engine, dataset and scorer identities", () => {
  const run = { status: "completed", engine_version: `sha256:${"a".repeat(64)}`, dataset_fingerprint: "dataset", scorer_version: "scorer" } as EvalPipelineRun;
  expect(compatibleEvalRuns(run, { ...run })).toBe(true);
  expect(compatibleEvalRuns(run, { ...run, engine_version: `sha256:${"b".repeat(64)}` })).toBe(false);
  expect(compatibleEvalRuns(run, { ...run, dataset_fingerprint: "other" })).toBe(false);
  expect(compatibleEvalRuns(run, { ...run, scorer_version: "other" })).toBe(false);
  expect(compatibleEvalRuns(run, { ...run, status: "failed" })).toBe(false);
  expect(compatibleEvalRuns({ ...run, engine_version: "unavailable" }, { ...run, engine_version: "unavailable" })).toBe(false);
});

it("shows labeled metrics and recent runs on the dashboard", () => {
  render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalDashboard /></NextIntlClientProvider>);
  expect(within(screen.getByRole("region", { name: "Agents" })).getByRole("link", { name: /Reviewer/ })).toHaveAttribute("href", "/eval/a");
  expect(screen.getAllByText("Labeled precision").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Run history" })).toBeInTheDocument();
  expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
});

it("starts each agent through the real start action", async () => {
  render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalDashboard /></NextIntlClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Run all agents" }));
  await waitFor(() => expect(startAll).toHaveBeenCalledWith("a"));
});

it("shows the reason an agent's evaluation could not start", async () => {
  startAll.mockRejectedValueOnce(new Error("Create an eval case first."));
  render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalDashboard /></NextIntlClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Run all agents" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reviewer: Create an eval case first.");
});

it("renders the agent history as a labeled table with pass and cost", () => {
  render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalDashboard agentId="a" /></NextIntlClientProvider>);
  const table = screen.getByRole("table", { name: "Run history" });
  expect(within(table).getByRole("columnheader", { name: "Ran at" })).toBeInTheDocument();
  expect(within(table).getByRole("columnheader", { name: "Pass" })).toBeInTheDocument();
  expect(within(table).getByRole("columnheader", { name: "Cost" })).toBeInTheDocument();
  expect(within(table).getAllByRole("row")).toHaveLength(3);
});
