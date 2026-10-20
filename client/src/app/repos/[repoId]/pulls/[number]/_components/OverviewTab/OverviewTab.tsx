"use client";

import React from "react";
import { Button, Icon, SectionLabel } from "@devdigest/ui";
import { useTranslations } from "next-intl";
import type { DerivedIntent } from "@/vendor/shared/contracts/brief";
import type { BlastRadius } from "@/vendor/shared/contracts/brief";
import type { FindingRecord } from "@/vendor/shared/contracts/review-api";
import { BlastRadiusCard } from "../BlastRadiusCard/BlastRadiusCard";
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
}

export function OverviewTab({ prBody, intent = null, risks = [], onRerunIntent, intentRerunning = false, onRecalculate, recalculating = false, blast = null, repoFullName = null, headSha = null, blastLoading = false, blastError = false }: OverviewTabProps) {
  const t = useTranslations("prReview");
  const blastT = useTranslations("blast");
  const usedSources = intent?.evidence.filter((source) => source.status === "used").length ?? 0;
  const hasBlastPanel = Boolean((blast && repoFullName && headSha) || blastLoading || blastError);
  return (
    <>
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
            ) : <span style={s.intentUnavailable}>{t("intent.unavailable")}</span>}
            <div style={s.intentDivider} />
            <RiskAreas risks={risks} title={t("intent.riskAreas")} empty={t("intent.noRiskAreas")} />
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
            {blast && repoFullName && headSha && <BlastRadiusCard blast={blast} repoFullName={repoFullName} headSha={headSha} />}
            {blastLoading && <p role="status" style={s.intentUnavailable}>{blastT("loading")}</p>}
            {blastError && <p role="status" style={s.intentUnavailable}>{blastT("unavailable")}</p>}
          </div>
        )}
      </div>
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
