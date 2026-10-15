/* Review-agent selector. The reviewer can select one or many agents before
   kicking off a single multi-agent review request. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Checkbox } from "@devdigest/ui";
import { useAgents } from "../../../../../../../lib/hooks/agents";
import { useRunReview } from "../../../../../../../lib/hooks/reviews";
import { DROPDOWN_WIDTH } from "./constants";

export function RunReviewDropdown({
  prId,
  size = "sm",
  kind = "primary",
  warnMerged = false,
  onRunStart,
  onRunsStarted,
  onRunSettled,
}: {
  prId: string;
  size?: "sm" | "md" | "lg";
  kind?: "primary" | "secondary";
  warnMerged?: boolean;
  onRunStart?: () => void;
  onRunsStarted?: (runIds: string[]) => void;
  onRunSettled?: () => void;
}) {
  const t = useTranslations("prReview");
  const router = useRouter();
  const { data: agents } = useAgents();
  const run = useRunReview();
  const all = agents ?? [];
  const [open, setOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const initialized = React.useRef(false);
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!initialized.current && all.length > 0) {
      setSelectedIds(all.filter((agent) => agent.enabled).map((agent) => agent.id));
      initialized.current = true;
      return;
    }
    setSelectedIds((previous) => {
      const retained = previous.filter((id) => all.some((agent) => agent.id === id));
      return retained.length === previous.length ? previous : retained;
    });
  }, [agents]);

  React.useEffect(() => {
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, []);

  const selected = new Set(selectedIds);
  const allSelected = all.length > 0 && selectedIds.length === all.length;
  const toggleAgent = (agentId: string) => {
    setSelectedIds((previous) => previous.includes(agentId)
      ? previous.filter((id) => id !== agentId)
      : [...previous, agentId]);
  };
  const toggleAll = () => setSelectedIds(allSelected ? [] : all.map((agent) => agent.id));
  const kick = async () => {
    if (selectedIds.length === 0) return;
    onRunStart?.();
    try {
      const result = await run.mutateAsync({ prId, agentIds: selectedIds });
      onRunsStarted?.(result.runs.map((entry) => entry.run_id));
      setOpen(false);
    } finally {
      onRunSettled?.();
    }
  };

  return (
    <div ref={root} style={{ position: "relative", display: "inline-block" }}>
      <span title={warnMerged ? t("runReview.mergedTooltip") : undefined} style={warnMerged ? { opacity: 0.6 } : undefined}>
        <Button kind={kind} size={size} iconRight="ChevronDown" icon="Sparkles" loading={run.isPending} onClick={() => setOpen((value) => !value)}>
          {run.isPending ? t("runReview.running") : t("runReview.runReview")}
        </Button>
      </span>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, width: DROPDOWN_WIDTH,
          background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 9,
          boxShadow: "var(--shadow-modal)", padding: 10, zIndex: 40, animation: "ddpop .12s ease",
        }}>
          {warnMerged && <div style={{ color: "var(--warn)", fontSize: 12, lineHeight: 1.4, marginBottom: 10 }}>{t("runReview.mergedWarning")}</div>}
          {all.length > 0 ? (
            <>
              <div style={{ borderBottom: "1px solid var(--border)", padding: "0 2px 10px", marginBottom: 6 }}>
                <Checkbox checked={allSelected} onChange={toggleAll} label={t("runReview.selectAllAgents")} ariaLabel={t("runReview.selectAllAgents")} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, maxHeight: 260, overflowY: "auto", padding: "4px 2px 10px" }}>
                {all.map((agent) => (
                  <Checkbox
                    key={agent.id}
                    checked={selected.has(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    ariaLabel={agent.name}
                    label={<span style={{ display: "flex", minWidth: 0, flexDirection: "column" }}>
                      <span style={{ color: "var(--text-primary)" }}>{agent.name}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{agent.enabled ? agent.model : `${agent.model} · disabled`}</span>
                    </span>}
                  />
                ))}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>{t("runReview.selectedAgents", { count: selectedIds.length })}</div>
                <Button kind="primary" size="sm" icon="Play" full onClick={kick} disabled={selectedIds.length === 0}>
                  {t("runReview.runSelected")}
                </Button>
              </div>
            </>
          ) : <div style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>{t("runReview.noAgents")}</div>}
          <Button kind="tertiary" size="sm" icon="Settings" full style={{ marginTop: 8 }} onClick={() => { setOpen(false); router.push("/agents"); }}>
            {t("runReview.configureAgents")}
          </Button>
        </div>
      )}
    </div>
  );
}
