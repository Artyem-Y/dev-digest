import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Gallery } from "../components/showcase";
import { DiffViewer } from "../components/diff-viewer";
import type { FindingRecord, PrFile } from "../lib/types";
import shellMessages from "../../messages/en/shell.json";

afterEach(cleanup);

const themes: ("dark" | "light")[] = ["dark", "light"];

describe("web smoke (both themes)", () => {
  themes.forEach((theme) => {
    it(`component gallery renders in ${theme}`, () => {
      render(
        <div data-theme={theme}>
          <Gallery />
        </div>
      );
      // a few representative components are present
      expect(screen.getAllByText("Primary").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    });
  });

  it("diff viewer parses a unified patch", () => {
    const files: PrFile[] = [
      {
        path: "src/config.ts",
        additions: 2,
        deletions: 1,
        patch: "@@ -1,2 +1,3 @@\n const a = 1;\n-const b = 2;\n+const b = 3;\n+const c = 4;",
      },
    ];
    render(
      <NextIntlClientProvider locale="en" messages={{ shell: shellMessages }}>
        <div data-theme="dark">
          <DiffViewer files={files} />
        </div>
      </NextIntlClientProvider>
    );
    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
    expect(screen.getByText("const c = 4;")).toBeInTheDocument();
  });

  it("diff viewer can receive files after an empty state", () => {
    const files: PrFile[] = [{
      path: "src/config.ts",
      additions: 1,
      deletions: 0,
      patch: "@@ -1,1 +1,2 @@\n const a = 1;\n+const b = 2;",
    }];
    const wrap = (viewerFiles: PrFile[]) => (
      <NextIntlClientProvider locale="en" messages={{ shell: shellMessages }}>
        <DiffViewer files={viewerFiles} />
      </NextIntlClientProvider>
    );
    const { rerender } = render(wrap([]));

    expect(screen.getByText("No changed files.")).toBeInTheDocument();
    rerender(wrap(files));

    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
  });

  it("renders an inline review finding and retains an unmatched finding", () => {
    const files: PrFile[] = [{ path: "src/config.ts", additions: 1, deletions: 0, patch: "@@ -1,1 +1,2 @@\n const a = 1;\n+const b = 2;" }];
    const findings = [
      { id: 'line', severity: 'WARNING', category: 'bug', title: 'On line', file: 'src/config.ts', start_line: 2, end_line: 2, rationale: 'r', suggestion: null, confidence: 1, kind: 'finding', trifecta_components: null, evidence: null, review_id: 'r', accepted_at: null, dismissed_at: null },
      { id: 'outside', severity: 'SUGGESTION', category: 'style', title: 'Outside patch', file: 'src/config.ts', start_line: 99, end_line: 99, rationale: 'r', suggestion: null, confidence: 1, kind: 'finding', trifecta_components: null, evidence: null, review_id: 'r', accepted_at: null, dismissed_at: null },
    ] as FindingRecord[];
    render(<NextIntlClientProvider locale="en" messages={{ shell: shellMessages }}><DiffViewer files={files} findings={findings} renderFinding={(finding) => <div>{finding.title}</div>} /></NextIntlClientProvider>);
    expect(screen.getByText('On line')).toBeInTheDocument();
    expect(screen.getByText('Findings outside this patch')).toBeInTheDocument();
    expect(screen.getByText('Outside patch')).toBeInTheDocument();
  });
});
