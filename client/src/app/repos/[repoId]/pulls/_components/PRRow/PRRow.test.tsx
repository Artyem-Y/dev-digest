import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import messages from "../../../../../../../messages/en/prReview.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

let reviewsData: unknown[] = [];
vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: reviewsData }),
}));

import { PRRow } from "./PRRow";

const PR: PrMeta = {
  id: "pr1",
  number: 482,
  title: "Add rate limiting",
  author: "marisa.koch",
  branch: "feat/rate-limit",
  base: "main",
  head_sha: "abc",
  additions: 247,
  deletions: 38,
  files_count: 9,
  status: "needs_review",
  opened_at: null,
  updated_at: null,
  score: 61,
  cost_usd: null,
  findings_counts: { CRITICAL: 2, WARNING: 1, SUGGESTION: 0 },
};

function renderRow(pr: PrMeta = PR) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={pr} repoId="repo1" />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  push.mockClear();
  reviewsData = [];
});

describe("PRRow findings column", () => {
  it("shows only non-zero severity counters", () => {
    renderRow();
    const critical = screen.getByLabelText("CRITICAL findings: 2");
    expect(critical).toHaveTextContent("2");
    expect(screen.getByLabelText("WARNING findings: 1")).toHaveTextContent("1");
    expect(screen.queryByLabelText("SUGGESTION findings: 0")).not.toBeInTheDocument();
    expect(critical.parentElement).toHaveStyle({ flexWrap: "nowrap" });
  });

  it("keeps severity chips informational and lets their click open the PR row", () => {
    renderRow();
    fireEvent.click(screen.getByLabelText("CRITICAL findings: 2"));
    expect(push).toHaveBeenCalledWith("/repos/repo1/pulls/482");
  });

  it("shows a dash if no review exists", () => {
    renderRow({ ...PR, score: null, findings_counts: null });
    expect(screen.queryByLabelText("CRITICAL findings: 2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Findings preview")).toHaveTextContent("—");
  });

  it("shows the current agents' findings in the hover preview", () => {
    reviewsData = [
      {
        id: "new-review",
        pr_id: "pr1",
        agent_id: "agent1",
        kind: "review",
        created_at: "2026-10-02T10:00:00.000Z",
        findings: [{
          id: "finding1",
          severity: "CRITICAL",
          category: "security",
          title: "Hardcoded secret",
          file: "src/config.ts",
          start_line: 12,
          rationale: "A credential is committed in source.",
          confidence: 0.98,
        }],
      },
      {
        id: "old-review",
        pr_id: "pr1",
        agent_id: "agent1",
        kind: "review",
        created_at: "2026-10-01T10:00:00.000Z",
        findings: [{
          id: "old-finding",
          severity: "WARNING",
          category: "perf",
          title: "Superseded finding",
          file: "src/old.ts",
          start_line: 1,
          rationale: "This belongs to the prior review.",
          confidence: 0.7,
        }],
      },
    ];
    renderRow();
    fireEvent.mouseEnter(screen.getByLabelText("Findings preview"));
    expect(screen.getByText("1 findings")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
    expect(screen.getByText("98% conf")).toBeInTheDocument();
    expect(screen.getByText("A credential is committed in source.")).toHaveStyle({ WebkitLineClamp: "2" });
    expect(screen.queryByText("Superseded finding")).not.toBeInTheDocument();
  });
});
