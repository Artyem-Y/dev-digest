/* DiffViewer — basic GitHub-style unified diff viewer. Renders real PrFile.patch
   (unified-diff text from the F1 API) as a list of collapsible FileCards.
   Optional inline comments (Files changed tab): hover a line → "+" → comment,
   posted live to GitHub; existing GitHub review comments render inline. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FindingRecord, PrFile } from "@/lib/types";
import { type DiffCommentApi } from "../comments";
import { s } from "../styles";
import { FileCard } from "../FileCard";

export function DiffViewer({
  files,
  commenting,
  findings = [],
  showFindings = true,
  allFilesOpen,
  renderFinding,
}: {
  files: PrFile[];
  commenting?: DiffCommentApi;
  findings?: FindingRecord[];
  showFindings?: boolean;
  /** Applies a group-level expand/collapse command to every file card. */
  allFilesOpen?: boolean;
  renderFinding?: (finding: FindingRecord) => React.ReactNode;
}) {
  const t = useTranslations("shell");
  const visibleFindings = showFindings ? findings : [];
  const findingsByFile = React.useMemo(() => {
    const grouped = new Map<string, FindingRecord[]>();
    for (const finding of visibleFindings) {
      const fileFindings = grouped.get(finding.file) ?? [];
      fileFindings.push(finding);
      grouped.set(finding.file, fileFindings);
    }
    return grouped;
  }, [visibleFindings]);
  if (!files || files.length === 0) {
    return <div style={s.empty}>{t("diffViewer.noChangedFiles")}</div>;
  }
  return (
    <div style={s.list}>
      {files.map((f) => (
        <FileCard key={f.path} file={f} commenting={commenting} findings={findingsByFile.get(f.path) ?? []} showFindings={showFindings} allFilesOpen={allFilesOpen} renderFinding={renderFinding} />
      ))}
    </div>
  );
}
