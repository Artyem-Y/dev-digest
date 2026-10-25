import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../../../../../messages/en/brief.json";
import { BriefReviewFocus, BriefRiskAreas, PRBriefCard } from "./PRBriefCard";

const current = {
  cache: {
    cache_state: "current" as const,
    brief: {
      summary: "Rate limiting protects public endpoints.",
      head_sha: "abc",
      intent: { intent: "Protect APIs", in_scope: [], out_of_scope: [] },
      blast: { changed_symbols: [], downstream: [], summary: "", degraded: false, reason: null },
      history: { history: [] },
      risks: { risks: [{ kind: "security", title: "Missing retry header", explanation: "Clients need a retry window.", severity: "high" as const, file_refs: ["src/limit.ts"] }] },
      review_focus: [{ file: "src/limit.ts", line: 42, reason: "Check the limit branch." }],
    },
  },
  sources: [],
};

function renderCard(props: Partial<React.ComponentProps<typeof PRBriefCard>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ brief: messages }}>
      <PRBriefCard data={undefined} isLoading={false} isError={false} isGenerating={false} onGenerate={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("PRBriefCard", () => {
  it("offers an accessible Generate action when no cache exists", () => {
    const onGenerate = vi.fn();
    renderCard({ data: { cache: { cache_state: "missing" }, sources: [] }, onGenerate });

    fireEvent.click(screen.getByRole("button", { name: "Generate brief" }));
    expect(onGenerate).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "PR Brief" })).toBeInTheDocument();
  });

  it("keeps stale Brief feedback out of the verdict banner and offers regeneration", () => {
    renderCard({ data: { ...current, cache: { ...current.cache, cache_state: "stale" } } });

    expect(screen.getByText("This brief is for an earlier commit. Regenerate it before relying on it.")).toBeInTheDocument();
    expect(screen.queryByText("Rate limiting protects public endpoints.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate brief" })).toBeInTheDocument();
  });

  it("keeps the PR Brief heading outside the verdict banner", () => {
    renderCard({ data: current });

    const heading = screen.getByTestId("brief-section-header");
    const banner = screen.getByTestId("brief-verdict-banner");
    expect(heading.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner).not.toContainElement(heading);
  });

  it("shows the factual PR score ring alongside a generated Brief", () => {
    renderCard({ data: current, prScore: 61 });

    expect(screen.getByLabelText("PR score: 61")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText("PR Score")).toBeInTheDocument();
  });

  it("keeps the factual PR score visible before a Brief has been generated", () => {
    renderCard({ data: { cache: { cache_state: "missing" }, sources: [] }, prScore: 61 });

    expect(screen.getByLabelText("PR score: 61")).toBeInTheDocument();
  });

  it("shows an unavailable score ring instead of omitting the PR Score block", () => {
    renderCard({ data: current });

    expect(screen.getByLabelText("PR score unavailable")).toHaveTextContent("—");
    expect(screen.getByText("PR Score")).toBeInTheDocument();
  });

  it("renders a neutral verdict banner when no review has run", () => {
    renderCard({ data: current, review: null });

    expect(screen.getByText("Review not run")).toBeInTheDocument();
    expect(screen.getByText("Run a review to calculate a verdict and score.")).toBeInTheDocument();
    expect(screen.getByLabelText("PR score unavailable")).toBeInTheDocument();
  });

  it("renders review facts in the verdict banner", () => {
    renderCard({
      data: current,
      review: {
        verdict: "request_changes",
        summary: "Two blockers must be fixed before merge.",
        score: 61,
        findingsCount: 6,
        blockers: 2,
      },
    });

    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("6 findings · 2 blockers")).toBeInTheDocument();
    expect(screen.getByText("Two blockers must be fixed before merge.")).toBeInTheDocument();
    expect(screen.getByLabelText("PR score: 61")).toBeInTheDocument();
  });

  it("keeps multi-file risk references compact", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ brief: messages }}>
        <BriefRiskAreas
          brief={{
            ...current.cache.brief,
            risks: {
              risks: [{
                kind: "security",
                title: "Missing retry header",
                explanation: "Clients need a retry window.",
                severity: "high",
                file_refs: ["server/src/brief.ts", "server/src/cache.ts", "client/src/brief.ts"],
              }],
            },
          }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("server/src/brief.ts")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.queryByText("server/src/cache.ts")).not.toBeInTheDocument();
  });

  it("renders Review focus separately and preserves its navigation action", () => {
    const onReviewFocus = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ brief: messages }}>
        <BriefReviewFocus brief={current.cache.brief} onReviewFocus={onReviewFocus} />
      </NextIntlClientProvider>,
    );

    const focus = screen.getByRole("button", { name: "Open src/limit.ts at line 42" });
    expect(screen.getByTestId("brief-review-focus")).toContainElement(focus);
    expect(focus).toHaveProperty("tagName", "BUTTON");
    fireEvent.click(focus);
    expect(onReviewFocus).toHaveBeenCalledWith({ file: "src/limit.ts", line: 42 });
  });

  it("renders Review focus as a routeable Files changed link when a target URL is supplied", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ brief: messages }}>
        <BriefReviewFocus
          brief={current.cache.brief}
          onReviewFocus={vi.fn()}
          focusHref={({ file, line }) => `/repos/repo-1/pulls/42?tab=diff&briefFile=${file}&briefLine=${line}`}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Open src/limit.ts at line 42" })).toHaveAttribute(
      "href",
      "/repos/repo-1/pulls/42?tab=diff&briefFile=src/limit.ts&briefLine=42",
    );
  });

  it("renders a current cached brief and truthfully marks unavailable optional sources", () => {
    renderCard({
      data: {
        ...current,
        sources: [{ source_kind: "blast_radius", path: null, provenance: "pull_request", status: "unavailable", reason_code: "index_failed", estimated_tokens: 0 }],
      },
    });

    expect(screen.queryByText("This brief is for an earlier commit. Regenerate it before relying on it.")).not.toBeInTheDocument();
    expect(screen.getByText("Some optional review sources were unavailable when this brief was generated.")).toBeInTheDocument();
    expect(screen.queryByText("Rate limiting protects public endpoints.")).not.toBeInTheDocument();
  });

  it("announces pending, conflict, and empty successful sections without inventing unavailable data", () => {
    const { rerender } = renderCard({ isGenerating: true, data: { cache: { cache_state: "missing" }, sources: [] } });
    expect(screen.getByRole("button", { name: "Generating brief…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Generating your PR Brief…");

    rerender(
      <NextIntlClientProvider locale="en" messages={{ brief: messages }}>
        <PRBriefCard data={{ ...current, cache: { cache_state: "current", brief: { ...current.cache.brief, risks: { risks: [] }, review_focus: [] } } }} isLoading={false} isError isGenerating={false} errorCode="brief_generation_in_progress" onGenerate={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("A brief is already being generated");
  });

  it("announces completed explicit generation", () => {
    renderCard({ data: current, generationSucceeded: true });
    expect(screen.getByRole("status")).toHaveTextContent("PR Brief generated successfully.");
  });
});
