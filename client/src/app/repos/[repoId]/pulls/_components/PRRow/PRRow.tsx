/* PRRow — one clickable row in the PR list table. Ported from screen_dashboard.jsx. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Icon,
  Avatar,
  Badge,
  CategoryTag,
  CircularScore,
  SeverityBadge,
  type Category,
  type Severity,
} from "@devdigest/ui";
import { RunCostBadge } from "@/components/run-cost-badge";
import { usePrReviews } from "@/lib/hooks/reviews";
import type { PrMeta } from "@/lib/types";
import { FINDINGS_SEVERITIES, SIZE_COLOR, STATUS_META } from "../../constants";
import { latestFindingsPerAgent, relativeTime, sizeOf } from "../../helpers";
import { s } from "../../styles";

const SEVERITY_ICON = {
  CRITICAL: Icon.AlertOctagon,
  WARNING: Icon.AlertTriangle,
  SUGGESTION: Icon.Lightbulb,
} as const;

const SEVERITY_COLOR = {
  CRITICAL: "var(--crit)",
  WARNING: "var(--warn)",
  SUGGESTION: "var(--sugg)",
} as const;

export function PRRow({ pr, repoId }: { pr: PrMeta; repoId: string }) {
  const t = useTranslations("prReview");
  const router = useRouter();
  const [h, setH] = React.useState(false);
  const [previewPosition, setPreviewPosition] = React.useState<{ top: number; left: number } | null>(null);
  const st = STATUS_META[pr.status] ?? STATUS_META.needs_review!;
  const { size, lines } = sizeOf(pr);
  const reviewed = pr.score != null; // null score ⇒ PR has never been reviewed
  const hasReview = pr.findings_counts != null;
  // Fetch only while the preview is open; React Query keeps a cached result.
  const { data: reviews } = usePrReviews(previewPosition && hasReview ? pr.id : null);
  const previewFindings = React.useMemo(
    () => latestFindingsPerAgent(reviews ?? []),
    [reviews],
  );
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={() => router.push(`/repos/${repoId}/pulls/${pr.number}`)}
      style={s.row(h)}
    >
      <div style={s.rowTitleCell}>
        <Icon.GitPullRequest size={15} style={s.rowIcon(st.c)} />
        <div style={s.rowTitleWrap}>
          <div style={s.rowTitle(h)}>{pr.title}</div>
          <span className="mono" style={s.rowNumber}>
            #{pr.number}
          </span>
        </div>
      </div>
      <div style={s.authorCell}>
        <Avatar name={pr.author} size={18} />
        {pr.author}
      </div>
      <div>
        <Badge
          color={SIZE_COLOR[size]}
          bg="transparent"
          style={s.sizeBadgeBorder(SIZE_COLOR[size]!)}
        >
          {size} · {lines}
        </Badge>
      </div>
      <div style={s.scoreCell}>
        {reviewed ? (
          <CircularScore score={pr.score!} size={34} stroke={3} />
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div
        aria-label="Findings preview"
        style={s.findingsCell}
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const below = rect.bottom + 6;
          // Keep the fixed portal in the viewport when the last table rows are hovered.
          const top = below + 340 <= window.innerHeight || rect.top < 346
            ? below
            : Math.max(8, rect.top - 346);
          setPreviewPosition({
            top,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 408)),
          });
        }}
        onMouseLeave={() => setPreviewPosition(null)}
      >
        {hasReview ? (
          FINDINGS_SEVERITIES.filter((severity) => pr.findings_counts![severity] > 0).map((severity) => {
            const SeverityIcon = SEVERITY_ICON[severity];
            const color = SEVERITY_COLOR[severity];
            return (
              <span
                key={severity}
                aria-label={t("list.findingsChipLabel", { severity, count: pr.findings_counts![severity] })}
                style={{ ...s.findingChip, color }}
              >
                <SeverityIcon size={13} />
                <span className="tnum">{pr.findings_counts![severity]}</span>
              </span>
            );
          })
        ) : (
          <span style={s.muted}>—</span>
        )}
        {previewPosition && previewFindings.length > 0 && createPortal(
          <div style={s.findingsPreview(previewPosition.top, previewPosition.left)}>
            <div style={s.findingsPreviewTitle}>
              <Icon.AlertOctagon size={12} />
              {t("list.findingsPreviewTitle", { count: previewFindings.length })}
            </div>
            {previewFindings.map((finding) => (
              <div key={finding.id} style={s.findingsPreviewItem}>
                <div style={s.findingsPreviewHead}>
                  <SeverityBadge severity={finding.severity as Severity} />
                  <span style={s.findingsPreviewItemTitle}>{finding.title}</span>
                  <CategoryTag category={finding.category as Category} />
                </div>
                <div style={s.findingsPreviewMeta}>
                  <span className="mono" style={{ color: "var(--accent)" }}>
                    {finding.file}:{finding.start_line}{finding.end_line && finding.end_line !== finding.start_line ? `-${finding.end_line}` : ""}
                  </span>
                  <span style={s.findingsPreviewConf}>{Math.round(finding.confidence * 100)}% conf</span>
                </div>
                <div style={s.findingsPreviewRationale}>{finding.rationale}</div>
              </div>
            ))}
          </div>
        , document.body)}
      </div>
      <div>
        <Badge dot color={st.c} bg="transparent">
          {t(`list.status.${st.labelKey}`)}
        </Badge>
      </div>
      <div style={s.muted}>
        <RunCostBadge costUsd={pr.cost_usd} />
      </div>
      <div style={s.updatedCell}>{relativeTime(pr.updated_at)}</div>
    </div>
  );
}
