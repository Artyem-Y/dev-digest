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
  it("shows all three severity counters, including zero counts", () => {
    renderRow();
    const critical = screen.getByTitle("Show only CRITICAL findings");
    expect(critical).toHaveTextContent("2");
    expect(screen.getByTitle("Show only WARNING findings")).toHaveTextContent("1");
    expect(screen.getByTitle("Show only SUGGESTION findings")).toHaveTextContent("0");
    expect(critical.parentElement).toHaveStyle({ flexWrap: "nowrap" });
  });

  it("opens the findings tab filtered to the clicked severity", () => {
    renderRow();
    fireEvent.click(screen.getByTitle("Show only CRITICAL findings"));
    expect(push).toHaveBeenCalledWith("/repos/repo1/pulls/482?tab=findings&severity=CRITICAL");
  });

  it("shows a dash if no review exists", () => {
    renderRow({ ...PR, score: null, findings_counts: null });
    expect(screen.queryByTitle("Show only CRITICAL findings")).not.toBeInTheDocument();
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
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
    expect(screen.getByText("98% conf")).toBeInTheDocument();
    expect(screen.queryByText("Superseded finding")).not.toBeInTheDocument();
  });
});
