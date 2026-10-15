import { describe, it, expect, afterEach, vi } from "vitest";
import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgents: () => ({ data: [
    { id: "a1", name: "Security", model: "gpt-4.1", enabled: true },
    { id: "a2", name: "Performance", model: "gpt-4.1", enabled: false },
  ] }),
}));
const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useRunReview: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

import { RunReviewDropdown } from "./RunReviewDropdown";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("RunReviewDropdown (smoke)", () => {
  it("renders the trigger label", () => {
    renderWithIntl(<RunReviewDropdown prId="pr1" />);
    expect(screen.getByText("Run Review")).toBeInTheDocument();
  });

  it("lets the reviewer select agents with checkboxes before starting a multi-agent review", async () => {
    mocks.mutateAsync.mockResolvedValue({ runs: [] });
    renderWithIntl(<RunReviewDropdown prId="pr1" />);

    fireEvent.click(screen.getByText("Run Review"));
    expect(screen.getByRole("checkbox", { name: "Security" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Performance" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all agents" }));
    expect(screen.getByRole("checkbox", { name: "Performance" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Run selected agents" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith({ prId: "pr1", agentIds: ["a1", "a2"] }));
  });
});
