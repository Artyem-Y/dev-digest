import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/eval.json";
import { EvalsTab } from "./EvalsTab";

const mutate = vi.fn();
const mutateCase = vi.fn();
const manageCase = vi.fn();
const saveCase = vi.fn();
const caseDetail = { name: "new case", expectation: "must_find", anchor: { file: "src/a", start_line: 1, end_line: 1 }, diff: "+example" };
vi.mock("@/lib/hooks/evals", () => ({
  useEvalCases: () => ({ data: [{ id: "case-2", name: "new case", expectation: "must_find", anchor: { file: "src/a", start_line: 1, end_line: 1 }, input_diff: "diff", metadata: { title: "PR", description: null } }], isLoading: false }),
  useEvalRuns: () => ({ data: [{ id: "run-2", created_at: "2026-11-01T00:00:00Z", status: "completed", snapshot: { scope: "case", cases: [{ id: "case-2" }] }, result: { results: [], score: { recall: 1, precision: 1, citationAccuracy: 1, counts: { truePositive: 1, knownFalsePositive: 0, unlabeled: 0 }, cases: [{ passed: true, matched: true, unlabeled: 0 }] } } }, { id: "run-1", created_at: "2026-10-31T00:00:00Z", status: "completed", snapshot: { scope: "suite", cases: [{ id: "case-1" }] }, result: { results: [], score: { recall: null, precision: 0.5, citationAccuracy: null, counts: { truePositive: 1, knownFalsePositive: 1, unlabeled: 2 }, cases: [{ passed: true, matched: true, unlabeled: 0 }] } } }], isLoading: false }),
  useStartEval: () => ({ mutate, isPending: false }),
  useStartEvalCase: () => ({ mutate: mutateCase, isPending: false }),
  useEvalCase: (_agentId: string, caseId: string | null) => ({ data: caseId ? caseDetail : undefined, isLoading: false }),
  useManageEvalCase: () => ({ mutate: manageCase, isPending: false }),
  useSaveManualEvalCase: () => ({ mutate: saveCase, isPending: false }),
}));

describe("EvalsTab", () => {
  it("keeps new cases unrun and reports labeled precision and unlabeled predictions", () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalsTab agentId="agent" /></NextIntlClientProvider>);
    expect(screen.getByText("new case")).toBeInTheDocument();
    expect(screen.getByText("Expected 1 finding, got 1 finding")).toBeInTheDocument();
    expect(screen.getAllByText("Labeled precision")).toHaveLength(2);
    expect(screen.getAllByText("50%")).toHaveLength(2);
    expect(screen.getByText(/Single case/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Scope" })).toBeInTheDocument();
    expect(screen.getByText(/2 unlabeled findings/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit case" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Run all evals" }));
    expect(mutate).toHaveBeenCalledWith("agent");
    fireEvent.click(screen.getByRole("button", { name: "Run case" }));
    expect(mutateCase).toHaveBeenCalledWith({ agentId: "agent", caseId: "case-2" });
    fireEvent.click(screen.getByRole("button", { name: "Edit case" }));
    expect(screen.getByLabelText("Unified diff")).toHaveValue("+example");
    expect(screen.getByText(/"must_find"/)).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    expect(screen.getAllByText("src/a").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "PR meta" }));
    expect(screen.getByText("PR metadata is unavailable for this case.")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save case" }));
    expect(saveCase).toHaveBeenCalledWith({ caseId: "case-2", input: { name: "renamed", diff: "+example", expectation: "must_find", anchor: { file: "src/a", start_line: 1, end_line: 1 } } }, expect.any(Object));
  });
  it("creates a manual case from explicit input", () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    render(<NextIntlClientProvider locale="en" messages={{ eval: messages }}><EvalsTab agentId="agent" /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "New eval case" }));
    expect(screen.getByRole("button", { name: /Close New eval case/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save case" })).toHaveClass("eval-case-primary-action");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Manual" } });
    fireEvent.change(screen.getByLabelText("Unified diff"), { target: { value: "diff" } });
    fireEvent.change(screen.getByLabelText("File"), { target: { value: "a.ts" } });
    fireEvent.change(screen.getByLabelText("Expectation"), { target: { value: "must_not_flag" } });
    fireEvent.click(screen.getByRole("button", { name: "Save case" }));
    expect(saveCase).toHaveBeenCalledWith({ caseId: null, input: { name: "Manual", diff: "diff", expectation: "must_not_flag", anchor: { file: "a.ts", start_line: 1, end_line: 1 } } }, expect.any(Object));
  });
});
