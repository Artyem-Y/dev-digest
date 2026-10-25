"use client";

import React from "react";
import { Button, Icon, SectionLabel } from "@devdigest/ui";
import { useTranslations } from "next-intl";
import type { BriefGenerateResponse } from "@devdigest/shared";

type ReviewFocus = { file: string; line: number };

interface PRBriefCardProps {
  data: BriefGenerateResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  errorCode?: string;
  isGenerating: boolean;
  generationSucceeded?: boolean;
  onGenerate: () => void;
  onReviewFocus: (target: ReviewFocus) => void;
}

export function PRBriefCard({ data, isLoading, isError, errorCode, isGenerating, generationSucceeded = false, onGenerate, onReviewFocus }: PRBriefCardProps) {
  const t = useTranslations("brief");
  const cache = data?.cache;
  const brief = cache?.cache_state === "current" || cache?.cache_state === "stale" ? cache.brief : null;
  const stale = cache?.cache_state === "stale";
  const unavailableSource = data?.sources.some((source) => source.status === "unavailable" || source.status === "rejected");
  const actionLabel = brief ? t("regenerate") : t("generate");

  return (
    <section aria-label={t("title")} style={styles.card}>
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

      {isGenerating && <p role="status" aria-live="polite" style={styles.status}>{t("generatingStatus")}</p>}
      {generationSucceeded && !isGenerating && <p role="status" aria-live="polite" style={styles.success}>{t("generationSucceeded")}</p>}
      {isError && (
        <p role={errorCode === "brief_generation_in_progress" ? "status" : "alert"} aria-live="polite" style={styles.error}>
          {errorCode === "brief_generation_in_progress" ? t("generationInProgress") : t("generationFailed")}
        </p>
      )}
      {isLoading && !cache && <p role="status" style={styles.status}>{t("unavailable")}</p>}
      {!brief && !isLoading && <p style={styles.empty}>{t("missing")}</p>}

      {brief && (
        <div style={styles.content}>
          {stale && <p role="status" aria-live="polite" style={styles.stale}>{t("stale")}</p>}
          <BriefSection title={t("summary")}><p style={styles.summary}>{brief.summary}</p></BriefSection>
          <BriefSection title={t("risks")}>
            {brief.risks.risks.length === 0 ? <p style={styles.empty}>{t("noRisks")}</p> : (
              <ul style={styles.list}>
                {brief.risks.risks.map((risk, index) => (
                  <li key={`${risk.kind}-${risk.title}-${index}`} style={styles.risk}>
                    <Icon.AlertTriangle size={14} style={severityStyle(risk.severity)} />
                    <div>
                      <strong>{t(`severity.${risk.severity}`)} · {risk.title}</strong>
                      <p style={styles.explanation}>{risk.explanation}</p>
                      <div style={styles.refs}>{risk.file_refs.join(", ")}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </BriefSection>
          <BriefSection title={t("reviewFocus")}>
            {brief.review_focus.length === 0 ? <p style={styles.empty}>{t("noFocus")}</p> : (
              <ol style={styles.focusList}>
                {brief.review_focus.map((focus, index) => (
                  <li key={`${focus.file}:${focus.line}:${index}`}>
                    <button type="button" style={styles.focusButton} onClick={() => onReviewFocus({ file: focus.file, line: focus.line })} aria-label={t("focusFile", focus)}>
                      <span className="mono">{t("focusLine", focus)}</span>
                      <span>{focus.reason}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </BriefSection>
          {unavailableSource && <p role="status" style={styles.status}>{t("sourceUnavailable")}</p>}
        </div>
      )}
    </section>
  );
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 style={styles.heading}>{title}</h3>{children}</section>;
}

function severityStyle(severity: "high" | "medium" | "low") {
  return { color: severity === "high" ? "var(--crit)" : severity === "medium" ? "var(--warn)" : "var(--sugg)", marginTop: 2, flex: "0 0 auto" };
}

const styles: Record<string, React.CSSProperties> = {
  card: { border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "var(--bg-elevated)" },
  content: { display: "flex", flexDirection: "column", gap: 16 },
  heading: { margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)", letterSpacing: ".06em", textTransform: "uppercase" },
  summary: { margin: 0, lineHeight: 1.55 },
  empty: { margin: 0, color: "var(--text-muted)", fontSize: 13 },
  status: { margin: "10px 0 0", color: "var(--text-muted)", fontSize: 13 },
  error: { margin: "10px 0 0", color: "var(--crit)", fontSize: 13 },
  success: { margin: "10px 0 0", color: "var(--good)", fontSize: 13 },
  stale: { margin: 0, color: "var(--warn)", fontSize: 13, fontWeight: 600 },
  list: { display: "flex", flexDirection: "column", gap: 9, margin: 0, padding: 0, listStyle: "none" },
  risk: { display: "flex", gap: 8, fontSize: 13 },
  explanation: { margin: "3px 0", color: "var(--text-muted)", lineHeight: 1.4 },
  refs: { color: "var(--accent-text)", fontFamily: "var(--font-mono)", fontSize: 12 },
  focusList: { display: "flex", flexDirection: "column", gap: 6, margin: 0, paddingLeft: 20 },
  focusButton: { width: "100%", display: "flex", gap: 10, alignItems: "baseline", textAlign: "left", padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 5, background: "transparent", color: "var(--text-primary)", cursor: "pointer" },
};
