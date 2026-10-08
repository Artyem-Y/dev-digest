import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/agents.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../../../../../lib/hooks/agents", () => ({ useCreateAgent: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

import { CreateAgentModal } from "./CreateAgentModal";

describe("CreateAgentModal", () => {
  it("starts a new agent form without inheriting a reviewer prompt", () => {
    render(<NextIntlClientProvider locale="en" messages={{ agents: messages }}><CreateAgentModal onClose={vi.fn()} /></NextIntlClientProvider>);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByPlaceholderText("Security Reviewer")).toHaveValue("");
    expect(within(dialog).getByPlaceholderText("What this agent reviews")).toHaveValue("");
    expect(within(dialog).getAllByRole("textbox").at(-1)).toHaveValue("");
  });
});
