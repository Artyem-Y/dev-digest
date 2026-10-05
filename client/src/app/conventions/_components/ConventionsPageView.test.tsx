import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../messages/en/conventions.json";

vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/hooks/core", () => ({ useRepos: () => ({ data: [{ id: "repo-1", full_name: "acme/payments-api", default_branch: "main" }] }) }));
vi.mock("@/lib/hooks/agents", () => ({ useAgents: () => ({ data: [] }) }));
vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ data: [], isLoading: false }),
  useScanConventions: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateConvention: () => ({ mutate: vi.fn() }),
  useCreateConventionsSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ConventionsPageView } from "./ConventionsPageView";

afterEach(cleanup);

describe("ConventionsPageView", () => {
  it("uses the conventions copy for its empty scan state", () => {
    render(<NextIntlClientProvider locale="en" messages={{ conventions: messages }}><ConventionsPageView /></NextIntlClientProvider>);

    expect(screen.getByRole("heading", { name: "Conventions in acme/payments-api" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run extraction" })).toBeInTheDocument();
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
  });
});
