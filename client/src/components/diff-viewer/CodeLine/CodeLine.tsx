/* CodeLine — one rendered diff line: gutter number, +/- sign, text, plus the
   hover "+" affordance, any anchored comment threads, and an inline composer. */
"use client";

import React from "react";
import { useTranslations } from 'next-intl';
import { commentTargetFor, type CommentThread, type DiffCommentApi, cs } from "../comments";
import { type Line } from "../helpers";
import { s, lineRowFor, lineSignFor } from "../styles";
import { CommentThreadView } from "../CommentThreadView";
import { InlineComposer } from "../InlineComposer";
import type { FindingRecord } from '@devdigest/shared';

export function CodeLine({
  ln,
  path,
  threads,
  commenting,
  findings = [],
  showFindings = true,
  renderFinding,
}: {
  ln: Line;
  path: string;
  threads: CommentThread[];
  commenting?: DiffCommentApi;
  findings?: FindingRecord[];
  showFindings?: boolean;
  renderFinding?: (finding: FindingRecord) => React.ReactNode;
}) {
  const t = useTranslations('shell');
  const [hover, setHover] = React.useState(false);
  const [composing, setComposing] = React.useState(false);

  if (ln.kind === "hunk") {
    return (
      <div className="mono" style={s.hunk}>
        {ln.text}
      </div>
    );
  }

  const sign = ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : "";
  const target = commenting?.canComment ? commentTargetFor(ln) : null;
  const showAdd = hover && !!target && !composing;
  const severity = findings.some((finding) => finding.severity === 'CRITICAL') ? 'CRITICAL' : findings.some((finding) => finding.severity === 'WARNING') ? 'WARNING' : findings[0]?.severity;
  const findingLabel = severity === 'CRITICAL' ? t('diffViewer.blocker') : severity === 'WARNING' ? t('diffViewer.warning') : severity === 'SUGGESTION' ? t('diffViewer.suggestion') : null;
  const findingColor = severity === 'CRITICAL' ? 'var(--crit)' : severity === 'WARNING' ? 'var(--warn)' : 'var(--sugg)';

  return (
    <div
      style={cs.rowWrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ ...lineRowFor(ln.kind), ...(findingLabel ? { borderLeft: `3px solid ${findingColor}` } : {}) }}>
        <span className="mono tnum" style={{ ...s.lineNo, position: "relative" }}>
          {showAdd && target && (
            <button
              type="button"
              title="Add a comment on this line"
              aria-label="Add a comment on this line"
              onClick={() => setComposing(true)}
              style={cs.addBtn}
            >
              +
            </button>
          )}
          {ln.newNo ?? ln.oldNo ?? ""}
        </span>
        <span className="mono" style={lineSignFor(ln.kind)}>
          {sign}
        </span>
        <span className="mono" style={s.lineText}>
          {ln.text || " "}
        </span>
        {findingLabel && <span style={{ marginLeft: 'auto', paddingRight: 8, color: findingColor, fontSize: 12, fontWeight: 600 }}>{findingLabel}</span>}
      </div>

      {commenting &&
        commenting.showComments &&
        threads.map((th) => (
          <CommentThreadView key={th.rootId} thread={th} commenting={commenting} path={path} />
        ))}

      {commenting && composing && target && (
        <InlineComposer
          commenting={commenting}
          path={path}
          line={target.line}
          side={target.side}
          onClose={() => setComposing(false)}
        />
      )}
      {showFindings && renderFinding && findings.map((finding) => (
        <React.Fragment key={finding.id}>{renderFinding(finding)}</React.Fragment>
      ))}
    </div>
  );
}
