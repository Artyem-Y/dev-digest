import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../../../../../messages/en/brief.json";
import { PRBriefCard } from "./PRBriefCard";

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
      <PRBriefCard data={undefined} isLoading={false} isError={false} isGenerating={false} onGenerate={vi.fn()} onReviewFocus={vi.fn()} {...props} />
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

  it("renders a stale brief, grounded risks and keyboard-operable review focus", () => {
    const onReviewFocus = vi.fn();
    renderCard({ data: { ...current, cache: { ...current.cache, cache_state: "stale" } }, onReviewFocus });

    expect(screen.getByText("This brief is for an earlier commit. Regenerate it before relying on it.")).toBeInTheDocument();
    expect(screen.getByText("Rate limiting protects public endpoints.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Risk areas" })).toBeInTheDocument();
    expect(screen.getByText("High · Missing retry header")).toBeInTheDocument();
    const focus = screen.getByRole("button", { name: "Open src/limit.ts at line 42" });
    fireEvent.keyDown(focus, { key: "Enter" });
    fireEvent.click(focus);
    expect(onReviewFocus).toHaveBeenCalledWith({ file: "src/limit.ts", line: 42 });
    expect(screen.getByRole("button", { name: "Regenerate brief" })).toBeInTheDocument();
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
        <PRBriefCard data={{ ...current, cache: { cache_state: "current", brief: { ...current.cache.brief, risks: { risks: [] }, review_focus: [] } } }} isLoading={false} isError isGenerating={false} errorCode="brief_generation_in_progress" onGenerate={vi.fn()} onReviewFocus={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("A brief is already being generated");
    expect(screen.getByText("No notable risks were returned.")).toBeInTheDocument();
    expect(screen.getByText("No review focus was returned.")).toBeInTheDocument();
  });

  it("announces completed explicit generation", () => {
    renderCard({ data: current, generationSucceeded: true });
    expect(screen.getByRole("status")).toHaveTextContent("PR Brief generated successfully.");
  });
});
