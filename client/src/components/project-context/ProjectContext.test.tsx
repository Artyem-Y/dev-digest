import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/project-context.json";

const mocks = vi.hoisted(() => ({ change: vi.fn(), reorder: vi.fn(), retryPreview: vi.fn(), refreshCatalog: vi.fn(), previewError: false, pendingPath: null as string | null, resolvedTokens: 0, documents: [{ path: "docs/a.md", availability: "available", estimated_tokens: 4 }, { path: "docs/b.md", availability: "available", estimated_tokens: 5 }] }));
vi.mock("@/lib/repo-context", () => ({ useActiveRepo: () => ({ repoId: "repo" }) }));
vi.mock("@/lib/hooks/project-context", () => ({
  useProjectDocuments: () => ({ data: mocks.documents, dataUpdatedAt: 1700000000000, refetch: mocks.refreshCatalog }),
  useReindexProjectDocuments: () => ({ mutate: mocks.refreshCatalog, reset: vi.fn() }),
  useProjectDocument: (_repo: string, path: string | null) => ({ data: path && !mocks.previewError ? { content: "Document content\n\n![tracking image](https://example.com/pixel)", used_by_agents: 2 } : undefined, isError: mocks.previewError, refetch: mocks.retryPreview }),
  useResolvedProjectContext: () => ({ data: { documents: mocks.resolvedTokens ? [{ path: "docs/a.md", provenance: ["linked_skill"], estimated_tokens: mocks.resolvedTokens }] : [], skipped: [] } }),
  useProjectAttachments: () => ({ query: { data: [{ path: "docs/a.md", status: "attached", estimated_tokens: 4 }, { path: "docs/missing.md", status: "missing", estimated_tokens: 0 }], refetch: vi.fn() }, change: { mutate: mocks.change, isPending: mocks.pendingPath !== null, variables: mocks.pendingPath ? { path: mocks.pendingPath, attached: true } : undefined }, reorder: { mutate: mocks.reorder } }),
}));
import { ProjectContext } from "./ProjectContext";
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.previewError = false; mocks.pendingPath = null; mocks.resolvedTokens = 0; mocks.documents = [{ path: "docs/a.md", availability: "available", estimated_tokens: 4 }, { path: "docs/b.md", availability: "available", estimated_tokens: 5 }]; });

describe("Project Context selection", () => {
  it("keeps other skill document checkboxes enabled while one attachment is saving", () => {
    mocks.pendingPath = "docs/b.md";
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner="skill" ownerId="skill" /></NextIntlClientProvider>);
    expect(screen.getByRole("checkbox", { name: "Attach docs/b.md" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Detach docs/a.md" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Detach docs/missing.md" })).toBeEnabled();
  });
  it("places a document preview immediately after its row, before later documents", () => {
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner="agent" ownerId="agent" /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Preview docs/a.md" }));
    const preview = screen.getByRole("region", { name: "Preview docs/a.md" });
    const laterDocument = screen.getByRole("button", { name: "Preview docs/b.md" });
    expect(preview.compareDocumentPosition(laterDocument) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it.each([undefined, "agent"] as const)("retries a failed document preview for owner %s", (owner) => {
    mocks.previewError = true;
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner={owner} ownerId={owner ? "agent" : undefined} /></NextIntlClientProvider>);
    if (owner) fireEvent.click(screen.getByRole("button", { name: "Preview docs/b.md" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.retryPreview).toHaveBeenCalledOnce();
    if (owner) expect(screen.getByRole("checkbox", { name: "Detach docs/a.md" })).toBeChecked();
  });
  it("opens the first catalog document and allows selecting another", () => {
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext /></NextIntlClientProvider>);
    expect(screen.getByText("Document content")).toBeInTheDocument();
    expect(screen.getByText("Used by 2 agents")).toBeInTheDocument();
    expect(screen.getByText(/2 documents · refreshed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh local documents" }));
    expect(mocks.refreshCatalog).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Preview docs/a.md" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Preview docs/b.md" }));
    expect(screen.getByRole("button", { name: "Preview docs/b.md" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a dedicated empty catalog state", () => {
    const documents = mocks.documents;
    mocks.documents = [];
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext /></NextIntlClientProvider>);
    expect(screen.getByRole("heading", { name: "No spec files yet" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search documents")).not.toBeInTheDocument();
    mocks.documents = documents;
  });
  it("shows counts, previews, attach/detach and accessible ordering", () => {
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner="agent" ownerId="agent" /></NextIntlClientProvider>);
    expect(screen.getByText(/2 of 3 attached/)).toBeInTheDocument();
    expect(screen.getByText(/4 estimated tokens total/)).toBeInTheDocument();
    expect(screen.getByText("Unavailable: missing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview docs/b.md" }));
    expect(screen.getByText("Document content")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "tracking image" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Detach docs/a.md" })).toBeChecked();
    expect(screen.getAllByText("docs").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Attach docs/b.md" }));
    expect(mocks.change).toHaveBeenCalledWith({ path: "docs/b.md", attached: true });
    fireEvent.click(screen.getByRole("checkbox", { name: "Detach docs/missing.md" }));
    expect(mocks.change).toHaveBeenCalledWith({ path: "docs/missing.md", attached: false });
    fireEvent.click(screen.getByRole("button", { name: "Move docs/a.md down" }));
    expect(mocks.reorder).toHaveBeenCalledWith(["docs/missing.md", "docs/a.md"]);
  });
  it("shows the skill context heading and selected paths", () => {
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner="skill" ownerId="skill" /></NextIntlClientProvider>);
    expect(screen.getByRole("heading", { name: "Project context to use" })).toBeInTheDocument();
    expect(screen.getByText("2 attached")).toBeInTheDocument();
    expect(screen.getByText(/## Project specifications/)).toHaveTextContent("docs/a.md");
    const preview = screen.getByRole("button", { name: "Preview docs/a.md" });
    expect(preview).not.toHaveTextContent("Preview");
    expect(screen.getAllByText("docs/").length).toBeGreaterThan(0);
  });
  it("warns the agent when resolved context including inherited documents exceeds 8000 tokens", () => {
    mocks.resolvedTokens = 8001;
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner="agent" ownerId="agent" /></NextIntlClientProvider>);
    expect(screen.getByRole("status")).toHaveTextContent(/8,?000 estimated tokens/);
  });
  it("shows the full directory and a distinct category for nested documents", () => {
    mocks.documents = [{ path: "docs/specs/design.md", availability: "available", estimated_tokens: 5 }, { path: "client/INSIGHTS.md", availability: "available", estimated_tokens: 4 }];
    render(<NextIntlClientProvider locale="en" messages={{ "project-context": messages }}><ProjectContext owner="skill" ownerId="skill" /></NextIntlClientProvider>);
    const spec = screen.getByRole("checkbox", { name: "Attach docs/specs/design.md" }).parentElement!;
    expect(within(spec).getByText("docs/specs/")).toBeInTheDocument();
    expect(within(spec).getByText("specs")).toBeInTheDocument();
    const insight = screen.getByRole("checkbox", { name: "Attach client/INSIGHTS.md" }).parentElement!;
    expect(within(insight).getByText("client/")).toBeInTheDocument();
    expect(within(insight).getByText("insights")).toBeInTheDocument();
  });
});
