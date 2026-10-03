/* FindingsPanel — hide-low-confidence + j/k navigation + FindingCard list,
   wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION } from "./constants";
import { visibleFindings } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [severities, setSeverities] = React.useState<Set<string>>(() => new Set());
  const [category, setCategory] = React.useState<string>("");
  const [focusIdx, setFocusIdx] = React.useState(0);

  const categories = React.useMemo(
    () => [...new Set(findings.map((finding) => finding.category))].sort(),
    [findings],
  );
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow).filter(
      (finding) => (severities.size === 0 || severities.has(finding.severity)) && (!category || finding.category === category),
    ),
    [findings, hideLow, severities, category],
  );
  const toggleSeverity = (severity: string) => {
    setSeverities((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  };

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        <div style={s.severityFilters} aria-label={t("panel.severityFilter")}>
          {["CRITICAL", "WARNING", "SUGGESTION"].map((severity) => (
            <button
              key={severity}
              type="button"
              aria-pressed={severities.has(severity)}
              onClick={() => toggleSeverity(severity)}
              style={s.severityFilter(severities.has(severity))}
            >
              {severity}
            </button>
          ))}
        </div>
        <label style={s.categoryFilter}>
          {t("panel.category")}
          <select aria-label={t("panel.category")} value={category} onChange={(event) => setCategory(event.target.value)} style={s.categorySelect}>
            <option value="">{t("panel.allCategories")}</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} ariaLabel={t("panel.hideLowConfidence")} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
