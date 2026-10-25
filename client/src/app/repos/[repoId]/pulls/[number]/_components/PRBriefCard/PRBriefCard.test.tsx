import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../../../../../messages/en/brief.json";
import { BriefReviewFocus, PRBriefCard } from "./PRBriefCard";

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

  it("renders a stale Brief summary and regenerate action", () => {
    renderCard({ data: { ...current, cache: { ...current.cache, cache_state: "stale" } } });

    expect(screen.getByText("This brief is for an earlier commit. Regenerate it before relying on it.")).toBeInTheDocument();
    expect(screen.getByText("Rate limiting protects public endpoints.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate brief" })).toBeInTheDocument();
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
    expect(screen.getByText("Rate limiting protects public endpoints.")).toBeInTheDocument();
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
