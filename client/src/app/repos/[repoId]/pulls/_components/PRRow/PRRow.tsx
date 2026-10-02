/* PRRow — one clickable row in the PR list table. Ported from screen_dashboard.jsx. */
"use client";

import React from "react";
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

export function PRRow({ pr, repoId }: { pr: PrMeta; repoId: string }) {
  const t = useTranslations("prReview");
  const router = useRouter();
  const [h, setH] = React.useState(false);
  const [previewPosition, setPreviewPosition] = React.useState<{ top: number; left: number } | null>(null);
  const st = STATUS_META[pr.status] ?? STATUS_META.needs_review!;
  const { size, lines } = sizeOf(pr);
  const reviewed = pr.score != null; // null score ⇒ PR has never been reviewed
  const hasFindings = FINDINGS_SEVERITIES.some((severity) => (pr.findings_counts?.[severity] ?? 0) > 0);
  // Fetch only while the preview is open; React Query keeps a cached result.
  const { data: reviews } = usePrReviews(previewPosition && hasFindings ? pr.id : null);
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
          setPreviewPosition({
            top: rect.bottom + 6,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 408)),
          });
        }}
        onMouseLeave={() => setPreviewPosition(null)}
      >
        {hasFindings ? (
          FINDINGS_SEVERITIES.filter((severity) => pr.findings_counts![severity] > 0).map((severity) => (
            <button
              key={severity}
              type="button"
              title={t("panel.showOnlySeverity", { severity })}
              style={s.findingChipButton}
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/repos/${repoId}/pulls/${pr.number}?tab=findings&severity=${severity}`);
              }}
            >
              <SeverityBadge severity={severity as Severity} count={pr.findings_counts![severity]} compact />
            </button>
          ))
        ) : (
          <span style={s.muted}>—</span>
        )}
        {previewPosition && previewFindings.length > 0 && (
          <div
            style={s.findingsPreview(previewPosition.top, previewPosition.left)}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={s.findingsPreviewTitle}>
              <Icon.AlertOctagon size={12} />
              {t("list.findingsPreviewTitle", { count: previewFindings.length })}
            </div>
            {previewFindings.map((finding) => (
              <div key={finding.id} style={s.findingsPreviewItem}>
                <div style={s.findingsPreviewHead}>
                  <SeverityBadge severity={finding.severity as Severity} compact />
                  <span style={s.findingsPreviewItemTitle}>{finding.title}</span>
                  <CategoryTag category={finding.category as Category} />
                </div>
                <div style={s.findingsPreviewMeta}>
                  <span className="mono" style={{ color: "var(--accent)" }}>
                    {finding.file}:{finding.start_line}
                  </span>
                  <span style={s.findingsPreviewConf}>{Math.round(finding.confidence * 100)}% conf</span>
                </div>
                <div style={s.findingsPreviewRationale}>{finding.rationale}</div>
              </div>
            ))}
          </div>
        )}
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
