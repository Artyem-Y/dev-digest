"use client";

import React from "react";
import { SectionLabel } from "@devdigest/ui";
import { useTranslations } from "next-intl";
import type { DerivedIntent } from "@/vendor/shared/contracts/brief";
import { s } from "./styles";

interface OverviewTabProps {
  prBody: string | null | undefined;
  intent?: DerivedIntent | null;
}

export function OverviewTab({ prBody, intent = null }: OverviewTabProps) {
  const t = useTranslations("prReview");
  const usedSources = intent?.evidence.filter((source) => source.status === "used").length ?? 0;
  return (
    <>
      <section>
        <SectionLabel icon="Sparkles">{t("intent.title")}</SectionLabel>
        <div style={s.intentBox}>
          {intent ? (
            <>
              <p style={s.intentSummary}>{intent.intent}</p>
              <div style={s.intentMeta}>{t("intent.confidenceSources", { confidence: t(`intent.${intent.confidence}`), count: usedSources })}</div>
              <div style={s.intentScopes}>
                <ScopeList title={t("intent.inScope")} values={intent.in_scope} />
                <ScopeList title={t("intent.outOfScope")} values={intent.out_of_scope} />
              </div>
            </>
          ) : <span style={s.intentUnavailable}>{t("intent.unavailable")}</span>}
        </div>
      </section>
      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">Description</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}
    </>
  );
}

function ScopeList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return <div><strong style={s.scopeTitle}>{title}</strong><ul style={s.scopeList}>{values.map((value) => <li key={value}>{value}</li>)}</ul></div>;
}
