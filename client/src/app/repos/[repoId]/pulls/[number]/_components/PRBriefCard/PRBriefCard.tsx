"use client";

import React from "react";
import { Badge, Button, CircularScore, Icon, SectionLabel } from "@devdigest/ui";
import { useTranslations } from "next-intl";
import type { Brief, BriefGenerateResponse, Verdict } from "@devdigest/shared";
import { VERDICT_META } from "../VerdictBanner/constants";

type ReviewFocus = { file: string; line: number };

export interface BriefReviewPresentation {
  verdict: Verdict;
  summary: string | null;
  score: number | null;
  findingsCount: number;
  blockers: number;
}

interface PRBriefCardProps {
  data: BriefGenerateResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  errorCode?: string;
  isGenerating: boolean;
  generationSucceeded?: boolean;
  prScore?: number | null;
  review?: BriefReviewPresentation | null;
  onGenerate: () => void;
}

export function PRBriefCard({ data, isLoading, isError, errorCode, isGenerating, generationSucceeded = false, prScore = null, review = null, onGenerate }: PRBriefCardProps) {
  const t = useTranslations("brief");
  const brief = getCachedBrief(data);
  const cache = data?.cache;
  const stale = cache?.cache_state === "stale";
  const unavailableSource = data?.sources.some((source) => source.status === "unavailable" || source.status === "rejected");
  const actionLabel = brief ? t("regenerate") : t("generate");

  return (
    <section aria-label={t("title")} data-testid="brief-summary-card">
      <div data-testid="brief-section-header">
        <SectionLabel
          icon="FileText"
          right={
            <Button kind="primary" size="sm" icon="Sparkles" loading={isGenerating} disabled={isGenerating} onClick={onGenerate}>
              {isGenerating ? t("generating") : actionLabel}
            </Button>
          }
        >
          {t("title")}
        </SectionLabel>
      </div>

      <div data-testid="brief-verdict-banner" style={styles.card}>
        <VerdictSummary review={review} score={review?.score ?? prScore} />
        {brief && !stale && (
          <div data-testid="brief-generated-summary" style={styles.briefSummary}>
            <div style={styles.briefSummaryLabel}>{t("summary")}</div>
            <p style={styles.briefSummaryText}>{brief.summary}</p>
          </div>
        )}
        {(isGenerating || generationSucceeded || isError || (isLoading && !cache) || (!brief && !isLoading) || stale || unavailableSource) && <div style={styles.noticeArea}>
          {isGenerating && <p role="status" aria-live="polite" style={styles.status}>{t("generatingStatus")}</p>}
          {generationSucceeded && !isGenerating && <p role="status" aria-live="polite" style={styles.success}>{t("generationSucceeded")}</p>}
          {isError && (
            <p role={errorCode === "brief_generation_in_progress" ? "status" : "alert"} aria-live="polite" style={styles.error}>
              {errorCode === "brief_generation_in_progress" ? t("generationInProgress") : t("generationFailed")}
            </p>
          )}
          {isLoading && !cache && <p role="status" style={styles.status}>{t("unavailable")}</p>}
          {!brief && !isLoading && <p style={styles.empty}>{t("missing")}</p>}
          {stale && <p role="status" aria-live="polite" style={styles.stale}>{t("stale")}</p>}
          {unavailableSource && <p role="status" style={styles.status}>{t("sourceUnavailable")}</p>}
        </div>}
      </div>
    </section>
  );
}

export function getCachedBrief(data: BriefGenerateResponse | undefined): Brief | null {
  const cache = data?.cache;
  return cache?.cache_state === "current" || cache?.cache_state === "stale" ? cache.brief : null;
}

function VerdictSummary({ review, score }: { review: BriefReviewPresentation | null; score: number | null }) {
  const t = useTranslations("brief");
  const meta = review ? VERDICT_META[review.verdict] : null;
  const VerdictIcon = meta ? Icon[meta.icon] : Icon.Info;
  return (
    <div style={styles.verdictMain}>
      <div style={verdictIconStyle(meta?.bg ?? "var(--bg-hover)", meta?.c ?? "var(--text-muted)")}><VerdictIcon size={22} /></div>
      <div style={styles.verdictCopy}>
        <div style={styles.verdictTitleRow}>
          <span style={verdictLabelStyle(meta?.c ?? "var(--text-secondary)")}>{review ? t(`verdict.${meta!.labelKey}`) : t("reviewNotRun")}</span>
          {review && <Badge color="var(--text-secondary)">{t("findingsAndBlockers", { findingsCount: review.findingsCount, blockers: review.blockers })}</Badge>}
        </div>
        <p style={styles.verdictSummary}>{review?.summary ?? t("reviewUnavailable")}</p>
      </div>
      <PrScore score={score} label={t("prScore")} />
    </div>
  );
}

function PrScore({ score, label }: { score: number | null; label: string }) {
  return (
    <div aria-label={score == null ? "PR score unavailable" : `PR score: ${score}`} style={styles.score}>
      {score == null ? <div aria-hidden="true" style={styles.unavailableScore}>—</div> : <CircularScore score={score} size={52} stroke={5} />}
      <span style={styles.scoreLabel}>{label}</span>
    </div>
  );
}

export function BriefRiskAreas({ brief }: { brief: Brief }) {
  const t = useTranslations("brief");
  return (
    <div data-testid="brief-risk-areas">
      <div style={styles.riskTitle}><Icon.AlertTriangle size={13} />{t("risks")}</div>
      {brief.risks.risks.length === 0 ? <p style={styles.empty}>{t("noRisks")}</p> : (
        <ul style={styles.list}>
          {brief.risks.risks.map((risk, index) => (
            <RiskArea key={`${risk.kind}-${risk.title}-${index}`} risk={risk} index={index} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskArea({ risk, index }: { risk: Brief["risks"]["risks"][number]; index: number }) {
  const t = useTranslations("brief");
  const [primaryFile, ...additionalFiles] = risk.file_refs;
  return (
    <li data-testid={`brief-risk-area-${index}`} style={styles.risk}>
      <Icon.AlertTriangle size={14} style={severityStyle(risk.severity)} />
      <div style={styles.riskCopy}>
        <strong style={styles.riskName}>{risk.title}</strong>
        {primaryFile && <div style={styles.refs}>
          <span title={primaryFile} style={styles.primaryRef}>{primaryFile}</span>
          {additionalFiles.length > 0 && <span style={styles.additionalFiles}>{t("additionalFiles", { count: additionalFiles.length })}</span>}
        </div>}
      </div>
    </li>
  );
}

export function BriefReviewFocus({ brief, onReviewFocus, focusHref }: { brief: Brief | null; onReviewFocus: (target: ReviewFocus) => void; focusHref?: (target: ReviewFocus) => string }) {
  const t = useTranslations("brief");
  if (!brief) return null;

  return (
    <section data-testid="brief-review-focus">
      <SectionLabel icon="ListChecks" right={<span style={styles.focusCount}>{brief.review_focus.length}</span>}>{t("reviewFocus")}</SectionLabel>
      <div style={styles.focusCard}>
        {brief.review_focus.length === 0 ? <p style={styles.empty}>{t("noFocus")}</p> : (
          <ol style={styles.focusList}>
            {brief.review_focus.map((focus, index) => (
              <li key={`${focus.file}:${focus.line}:${index}`} style={styles.focusItem} data-testid="review-focus-item">
                {focusHref ? <a href={focusHref(focus)} style={styles.focusButton} aria-label={t("focusFile", focus)}>
                  <span aria-hidden="true" style={styles.focusIndex}>{index + 1}</span>
                  <span style={styles.focusCopy}>
                    <span className="mono" style={styles.focusPath}>{t("focusLine", focus)}</span>
                    <span style={styles.focusReason}>{focus.reason}</span>
                  </span>
                </a> : <button type="button" style={styles.focusButton} onClick={() => onReviewFocus({ file: focus.file, line: focus.line })} aria-label={t("focusFile", focus)}>
                  <span aria-hidden="true" style={styles.focusIndex}>{index + 1}</span>
                  <span style={styles.focusCopy}>
                    <span className="mono" style={styles.focusPath}>{t("focusLine", focus)}</span>
                    <span style={styles.focusReason}>{focus.reason}</span>
                  </span>
                </button>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function severityStyle(severity: "high" | "medium" | "low") {
  return { color: severity === "high" ? "var(--crit)" : severity === "medium" ? "var(--warn)" : "var(--sugg)", marginTop: 2, flex: "0 0 auto" };
}

function verdictIconStyle(background: string, color: string): React.CSSProperties {
  return { display: "grid", width: 48, height: 48, flex: "0 0 auto", placeItems: "center", borderRadius: 10, background, color };
}

function verdictLabelStyle(color: string): React.CSSProperties {
  return { color, fontSize: 18, fontWeight: 700 };
}

const styles: Record<string, React.CSSProperties> = {
  card: { border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "var(--bg-elevated)" },
  verdictMain: { display: "flex", alignItems: "flex-start", gap: 16 },
  verdictCopy: { flex: "1 1 auto", minWidth: 0 },
  verdictTitleRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 },
  verdictSummary: { margin: "8px 0 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 },
  briefSummary: { marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" },
  briefSummaryLabel: { color: "var(--text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" },
  briefSummaryText: { margin: "5px 0 0", color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5 },
  noticeArea: { marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" },
  score: { display: "flex", flex: "0 0 auto", flexDirection: "column", alignItems: "center", gap: 4, paddingLeft: 16, borderLeft: "1px solid var(--border)" },
  unavailableScore: { display: "grid", width: 52, height: 52, placeItems: "center", border: "5px solid var(--bg-hover)", borderRadius: "50%", color: "var(--text-muted)", fontSize: 16, fontWeight: 700 },
  scoreLabel: { color: "var(--text-muted)", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" },
  empty: { margin: 0, color: "var(--text-muted)", fontSize: 13 },
  status: { margin: "10px 0 0", color: "var(--text-muted)", fontSize: 13 },
  error: { margin: "10px 0 0", color: "var(--crit)", fontSize: 13 },
  success: { margin: "10px 0 0", color: "var(--good)", fontSize: 13 },
  stale: { margin: 0, color: "var(--warn)", fontSize: 13, fontWeight: 600 },
  list: { display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none" },
  riskTitle: { display: "flex", alignItems: "center", gap: 6, marginBottom: 9, color: "var(--text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" },
  risk: { display: "flex", minWidth: 0, alignItems: "flex-start", gap: 8, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 13 },
  riskCopy: { flex: "1 1 auto", minWidth: 0 },
  riskName: { display: "block", color: "var(--text-primary)", fontSize: 13, lineHeight: 1.35 },
  refs: { display: "flex", minWidth: 0, alignItems: "center", gap: 6, marginTop: 2, color: "var(--accent-text)", fontFamily: "var(--font-mono)", fontSize: 12 },
  primaryRef: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  additionalFiles: { flex: "0 0 auto", color: "var(--text-muted)" },
  focusList: { display: "flex", flexDirection: "column", gap: 7, margin: 0, padding: 0, listStyle: "none" },
  focusCard: { border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-elevated)", padding: 16 },
  focusCount: { display: "inline-grid", minWidth: 22, placeItems: "center", borderRadius: 5, background: "var(--accent-bg)", color: "var(--accent-text)", fontSize: 12, fontWeight: 700, padding: "2px 6px", fontVariantNumeric: "tabular-nums" },
  focusItem: { margin: 0 },
  focusButton: { width: "100%", display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", padding: "9px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-surface)", color: "var(--text-primary)", cursor: "pointer", font: "inherit", lineHeight: 1.35, textDecoration: "none" },
  focusIndex: { display: "grid", placeItems: "center", width: 18, height: 18, flex: "0 0 auto", borderRadius: "50%", background: "var(--accent-bg)", color: "var(--accent-text)", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  focusCopy: { display: "flex", minWidth: 0, flex: "1 1 auto", flexDirection: "column", gap: 3 },
  focusPath: { overflow: "hidden", color: "var(--accent-text)", fontSize: 12, fontWeight: 600, textOverflow: "ellipsis", whiteSpace: "nowrap" },
  focusReason: { color: "var(--text-secondary)", fontSize: 13 },
};
