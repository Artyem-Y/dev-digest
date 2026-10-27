"use client";

import React from "react";
import { Button, Icon, SectionLabel } from "@devdigest/ui";
import { useTranslations } from "next-intl";
import type { DerivedIntent } from "@/vendor/shared/contracts/brief";
import type { BlastRadius } from "@/vendor/shared/contracts/brief";
import type { FindingRecord } from "@/vendor/shared/contracts/review-api";
import { BlastRadiusCard } from "../BlastRadiusCard/BlastRadiusCard";
import { BriefReviewFocus, BriefRiskAreas, getCachedBrief, PRBriefCard, type BriefReviewPresentation } from "../PRBriefCard/PRBriefCard";
import type { BriefGenerateResponse } from "@devdigest/shared";
import { s } from "./styles";

interface OverviewTabProps {
  prBody: string | null | undefined;
  intent?: DerivedIntent | null;
  risks?: FindingRecord[];
  onRerunIntent?: () => void;
  intentRerunning?: boolean;
  onRecalculate?: () => void;
  recalculating?: boolean;
  blast?: BlastRadius | null;
  repoFullName?: string | null;
  headSha?: string | null;
  blastLoading?: boolean;
  blastError?: boolean;
  brief?: BriefGenerateResponse;
  briefLoading?: boolean;
  briefError?: boolean;
  briefErrorCode?: string;
  briefGenerating?: boolean;
  briefGenerationSucceeded?: boolean;
  prScore?: number | null;
  review?: BriefReviewPresentation | null;
  onGenerateBrief?: () => void;
  onReviewFocus?: (target: { file: string; line: number }) => void;
  reviewFocusHref?: (target: { file: string; line: number }) => string;
}

export function OverviewTab({ prBody, intent = null, risks = [], onRerunIntent, intentRerunning = false, onRecalculate, recalculating = false, blast = null, repoFullName = null, headSha = null, blastLoading = false, blastError = false, brief, briefLoading = false, briefError = false, briefErrorCode, briefGenerating = false, briefGenerationSucceeded = false, prScore = null, review = null, onGenerateBrief = () => undefined, onReviewFocus = () => undefined, reviewFocusHref }: OverviewTabProps) {
  const t = useTranslations("prReview");
  const blastT = useTranslations("blast");
  const briefT = useTranslations("brief");
  const usedSources = intent?.evidence.filter((source) => source.status === "used").length ?? 0;
  const generatedBrief = getCachedBrief(brief);
  const sourceUnavailable = (sourceKind: "intent" | "blast_radius") => brief?.sources.some((source) =>
    source.source_kind === sourceKind && (source.status === "unavailable" || source.status === "rejected"),
  ) ?? false;
  const intentUnavailable = sourceUnavailable("intent");
  const blastUnavailable = sourceUnavailable("blast_radius");
  const activeBlast = blast ?? (blastUnavailable ? null : generatedBrief?.blast ?? null);
  const hasBlastPanel = Boolean((activeBlast && repoFullName && headSha) || blastLoading || blastError || blastUnavailable);
  return (
    <>
      <PRBriefCard data={brief} isLoading={briefLoading} isError={briefError} errorCode={briefErrorCode} isGenerating={briefGenerating} generationSucceeded={briefGenerationSucceeded} prScore={prScore} review={review} onGenerate={onGenerateBrief} />
      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">Description</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}
      <div data-testid="overview-analysis-grid" style={hasBlastPanel ? s.analysisGrid : s.analysisGridSingle}>
        <section>
          <SectionLabel
            icon="Target"
            right={onRerunIntent ? (
              <Button kind="ghost" size="sm" icon="RefreshCw" loading={intentRerunning} onClick={onRerunIntent}>
                {intentRerunning ? t("intent.running") : t("intent.run")}
              </Button>
            ) : undefined}
          >
            {t("intent.title")}
          </SectionLabel>
          <div style={s.intentBox}>
            {intent ? (
              <>
                <p style={s.intentSummary}>“{intent.intent}”</p>
                <div style={s.intentScopes}>
                  <ScopeList title={t("intent.inScope")} values={intent.in_scope} kind="inScope" />
                  <ScopeList title={t("intent.outOfScope")} values={intent.out_of_scope} kind="outOfScope" />
                </div>
                <div style={s.intentMeta}>{t("intent.confidenceSources", { confidence: t(`intent.${intent.confidence}`), count: usedSources })}</div>
              </>
            ) : generatedBrief && !intentUnavailable ? (
              <>
                <p style={s.intentSummary}>“{generatedBrief.intent.intent}”</p>
                <div style={s.intentScopes}>
                  <ScopeList title={t("intent.inScope")} values={generatedBrief.intent.in_scope} kind="inScope" />
                  <ScopeList title={t("intent.outOfScope")} values={generatedBrief.intent.out_of_scope} kind="outOfScope" />
                </div>
              </>
            ) : <span role="status" style={s.intentUnavailable}>{intentUnavailable ? briefT("intentUnavailable") : t("intent.unavailable")}</span>}
            <div style={s.intentDivider} />
            {generatedBrief ? <BriefRiskAreas brief={generatedBrief} /> : <RiskAreas risks={risks} title={t("intent.riskAreas")} empty={t("intent.noRiskAreas")} />}
            {onRecalculate && (
              <div style={s.recalculateAction}>
                <Button kind="tertiary" size="sm" icon="RefreshCw" loading={recalculating} onClick={onRecalculate}>
                  {recalculating ? t("intent.recalculating") : t("intent.recalculate")}
                </Button>
              </div>
            )}
          </div>
        </section>
        {hasBlastPanel && (
          <div style={s.blastColumn}>
            {activeBlast && repoFullName && headSha && <BlastRadiusCard blast={activeBlast} repoFullName={repoFullName} headSha={headSha} />}
            {blastLoading && <p role="status" style={s.intentUnavailable}>{blastT("loading")}</p>}
            {blastError && <p role="status" style={s.intentUnavailable}>{blastT("unavailable")}</p>}
            {blastUnavailable && !blast && !blastLoading && !blastError && <p role="status" style={s.intentUnavailable}>{briefT("blastUnavailable")}</p>}
          </div>
        )}
      </div>
      <BriefReviewFocus brief={generatedBrief} onReviewFocus={onReviewFocus} focusHref={reviewFocusHref} />
    </>
  );
}

function RiskAreas({ risks, title, empty }: { risks: FindingRecord[]; title: string; empty: string }) {
  return (
    <div>
      <div style={s.riskTitle}><Icon.AlertTriangle size={13} />{title}</div>
      {risks.length === 0 ? <div style={s.riskEmpty}>{empty}</div> : (
        <div style={s.riskList}>
          {risks.map((risk) => <RiskRow key={risk.id} risk={risk} />)}
        </div>
      )}
    </div>
  );
}

function RiskRow({ risk }: { risk: FindingRecord }) {
  const tone = risk.severity === "CRITICAL" ? "critical" : risk.severity === "WARNING" ? "warning" : "suggestion";
  const RiskIcon = risk.severity === "CRITICAL" ? Icon.AlertOctagon : risk.severity === "WARNING" ? Icon.AlertTriangle : Icon.Lightbulb;
  return (
    <div style={s.riskRow}>
      <RiskIcon size={14} style={tone === "critical" ? s.riskCritical : tone === "warning" ? s.riskWarning : s.riskSuggestion} />
      <div style={s.riskBody}>
        <div style={s.riskSummary}>{risk.title}</div>
        <div style={s.riskFile}>{risk.file}</div>
      </div>
    </div>
  );
}

function ScopeList({ title, values, kind }: { title: string; values: string[]; kind: "inScope" | "outOfScope" }) {
  const inScope = kind === "inScope";
  return (
    <div style={s.scopeColumn}>
      <strong style={inScope ? s.scopeTitleIn : s.scopeTitleOut}>
        {inScope ? <Icon.Check size={13} /> : <Icon.X size={13} />}
        {title}
      </strong>
      {values.length > 0 && (
        <ul style={s.scopeList}>
          {values.map((value) => (
            <li key={value} style={inScope ? s.scopeItemIn : s.scopeItemOut}>
              <span style={inScope ? s.scopeBulletIn : s.scopeBulletOut}>·</span>
              {value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
