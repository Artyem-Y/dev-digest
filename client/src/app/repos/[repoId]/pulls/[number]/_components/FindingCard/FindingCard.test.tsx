import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { FindingCard } from "./FindingCard";

afterEach(cleanup);

const FINDING: FindingRecord = {
  id: "f1",
  severity: "CRITICAL",
  category: "security",
  title: "Hardcoded Stripe secret key",
  file: "src/config.ts",
  start_line: 11,
  end_line: 11,
  rationale: "A **live** Stripe key is committed in source.",
  suggestion: "Move the key to an environment variable.",
  confidence: 0.95,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: "r1",
  accepted_at: null,
  dismissed_at: null,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}><NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider></QueryClientProvider>,
  );
}

describe("FindingCard (smoke, both themes)", () => {
  (["dark", "light"] as const).forEach((theme) => {
    it(`renders severity + file:line + rationale in ${theme}`, () => {
      renderWithIntl(
        <div data-theme={theme}>
          <FindingCard f={FINDING} defaultExpanded onAction={() => {}} />
        </div>,
      );
      expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
      expect(screen.getByText("src/config.ts:11")).toBeInTheDocument();
      // category label is shown alongside the severity badge
      expect(screen.getByText("security")).toBeInTheDocument();
    });
  });

  it("fires accept/dismiss actions", () => {
    const onAction = vi.fn();
    renderWithIntl(<FindingCard f={FINDING} defaultExpanded onAction={onAction} />);
    fireEvent.click(screen.getByText("Accept"));
    expect(onAction).toHaveBeenCalledWith("accept");
    fireEvent.click(screen.getByText("Dismiss"));
    expect(onAction).toHaveBeenCalledWith("dismiss");
  });
  it("updates focus and decision without conflicting border styles", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { rerender } = renderWithIntl(<FindingCard f={FINDING} focused defaultExpanded />);
      rerender(
        <QueryClientProvider client={new QueryClient()}><NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
          <FindingCard f={{ ...FINDING, accepted_at: "2026-01-01T00:00:00Z" }} focused={false} defaultExpanded />
        </NextIntlClientProvider></QueryClientProvider>,
      );
      expect(screen.getByRole("button", { name: "Turn into eval case" })).toBeEnabled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally { consoleError.mockRestore(); }
  });
  it("creates a case in one click for a decided finding", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ agent_id: "agent" }), { status: 201, headers: { "content-type": "application/json" } }));
    try {
      renderWithIntl(<FindingCard f={{ ...FINDING, accepted_at: "2026-01-01T00:00:00Z" }} defaultExpanded />);
      fireEvent.click(screen.getByRole("button", { name: "Turn into eval case" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/findings/f1/eval-cases"), expect.objectContaining({ method: "POST", body: "{}" })));
      expect(await screen.findByText("Eval case saved.")).toBeInTheDocument();
    } finally { fetchMock.mockRestore(); }
  });
  it("opens and closes a finding from the keyboard", () => {
    renderWithIntl(<FindingCard f={FINDING} />);
    const header = screen.getByRole("button", { name: FINDING.title });
    fireEvent.keyDown(header, { key: "Enter" });
    expect(header).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(header, { key: " " });
    expect(header).toHaveAttribute("aria-expanded", "false");
  });
});
