import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/project-context.json";

const mocks = vi.hoisted(() => ({ change: vi.fn(), reorder: vi.fn() }));
vi.mock("@/lib/repo-context", () => ({ useActiveRepo: () => ({ repoId: "repo" }) }));
vi.mock("@/lib/hooks/project-context", () => ({
  useProjectDocuments: () => ({ data: [{ path: "docs/a.md", availability: "available", estimated_tokens: 4 }, { path: "docs/b.md", availability: "available", estimated_tokens: 5 }], refetch: vi.fn() }),
  useProjectDocument: (_repo: string, path: string | null) => ({ data: path ? { content: "Document content\n\n![tracking image](https://example.com/pixel)" } : undefined }),
  useResolvedProjectContext: () => ({ data: { documents: [], skipped: [] } }),
  useProjectAttachments: () => ({ query: { data: [{ path: "docs/a.md", status: "attached", estimated_tokens: 4 }, { path: "docs/missing.md", status: "missing", estimated_tokens: 0 }], refetch: vi.fn() }, change: { mutate: mocks.change }, reorder: { mutate: mocks.reorder } }),
}));
import { ProjectContext } from "./ProjectContext";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Project Context selection", () => {
  it("shows counts, previews, attach/detach and accessible ordering", () => {
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner="agent" ownerId="agent" /></NextIntlClientProvider>);
    expect(screen.getByText(/2 of 3 attached/)).toBeInTheDocument();
    expect(screen.getByText(/4 estimated tokens total/)).toBeInTheDocument();
    expect(screen.getByText("Unavailable: missing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview docs/b.md" }));
    expect(screen.getByText("Document content")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "tracking image" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Attach docs/b.md" }));
    expect(mocks.change).toHaveBeenCalledWith({ path: "docs/b.md", attached: true });
    fireEvent.click(screen.getByRole("button", { name: "Detach docs/missing.md" }));
    expect(mocks.change).toHaveBeenCalledWith({ path: "docs/missing.md", attached: false });
    fireEvent.click(screen.getByRole("button", { name: "Move docs/a.md down" }));
    expect(mocks.reorder).toHaveBeenCalledWith(["docs/missing.md", "docs/a.md"]);
  });
});
