"use client";

import React from "react";
import { Button, Icon, SectionLabel } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, useFindingAction } from "@/lib/hooks/reviews";
import { useSmartDiff } from "@/lib/hooks/smart-diff";
import { findingsForFiles, latestFindingsPerAgent } from "@/lib/review-findings";
import { smartDiffPathMismatches } from "@/lib/smart-diff";
import { FindingCard } from "../FindingCard";
import { notify } from "@/lib/toast";
import { scheduleBriefFocusClear } from "./brief-focus";
import type { FindingRecord, PrFile, ReviewRecord, SmartDiffRole } from "@devdigest/shared";
import { useTranslations } from "next-intl";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  reviews?: ReviewRecord[];
  canComment?: boolean;
  detailReady: boolean;
  /** Persisted for the Files changed visit so the referenced file stays visible. */
  revealTarget?: { file: string; line: number } | null;
  /** Temporary exact-line marker, cleared after its non-disruptive duration. */
  focusTarget?: { file: string; line: number } | null;
  onFocusConsumed?: () => void;
}

const roles: SmartDiffRole[] = ['core', 'tests', 'wiring', 'docs', 'boilerplate'];
const labelKey: Record<SmartDiffRole, 'coreLabel' | 'testsLabel' | 'wiringLabel' | 'docsLabel' | 'boilerplateLabel'> = {
  core: 'coreLabel', tests: 'testsLabel', wiring: 'wiringLabel', docs: 'docsLabel', boilerplate: 'boilerplateLabel',
};
const descriptionKey: Record<SmartDiffRole, 'coreDescription' | 'testsDescription' | 'wiringDescription' | 'docsDescription' | 'boilerplateDescription'> = {
  core: 'coreDescription', tests: 'testsDescription', wiring: 'wiringDescription', docs: 'docsDescription', boilerplate: 'boilerplateDescription',
};
const roleColor: Record<SmartDiffRole, string> = {
  core: 'var(--accent)', tests: '#8b5cf6', wiring: 'var(--warn)', docs: '#14b8a6', boilerplate: 'var(--text-muted)',
};

function SmartDiffGroup({ role, files, findings, commenting, showFindings, renderFinding }: {
  role: SmartDiffRole; files: PrFile[]; findings: FindingRecord[]; commenting: DiffCommentApi; showFindings: boolean; renderFinding: (finding: FindingRecord) => React.ReactNode;
}) {
  const t = useTranslations('prReview');
  const groupFindings = findingsForFiles(files, findings);
  const findingFiles = new Set(groupFindings.map((finding) => finding.file));
  const [groupOpen, setGroupOpen] = React.useState(() => role === 'core' || role === 'tests' || role === 'wiring' || findingFiles.size > 0);
  const [allFilesOpen, setAllFilesOpen] = React.useState<boolean | undefined>(undefined);
  React.useEffect(() => {
    if ((role === 'docs' || role === 'boilerplate') && findingFiles.size > 0) setGroupOpen(true);
  }, [findingFiles.size, role]);
  return <section style={{ borderBottom: '1px solid var(--border)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0' }}>
      <button type="button" onClick={() => setGroupOpen((value) => !value)} aria-expanded={groupOpen} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '13px 2px', border: 0, background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}>
        <Icon.ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: groupOpen ? 'rotate(90deg)' : undefined, transition: 'transform .12s' }} />
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: roleColor[role], flexShrink: 0 }} />
        <strong style={{ fontSize: 13 }}>{t(`smartDiff.${labelKey[role]}`)}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{t(`smartDiff.${descriptionKey[role]}`)}</span>
      </button>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 12.5 }}>
        {findingFiles.size > 0 && <span aria-label={t('smartDiff.findingFiles', { count: findingFiles.size })} style={{ color: 'var(--crit)' }}>● {findingFiles.size}</span>}
        <span>{t('smartDiff.filesCount', { count: files.length })}</span>
        <button type="button" aria-label={allFilesOpen === true ? t('smartDiff.collapseFiles') : t('smartDiff.expandFiles')} title={allFilesOpen === true ? t('smartDiff.collapseFiles') : t('smartDiff.expandFiles')} onClick={() => { if (!groupOpen) { setGroupOpen(true); setAllFilesOpen(true); } else setAllFilesOpen((value) => value === true ? false : true); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', color: 'var(--text-muted)' }}>
          <Icon.ChevronsUpDown size={13} />
        </button>
      </span>
    </div>
    {groupOpen && (files.length ? <DiffViewer files={files} commenting={commenting} findings={groupFindings} showFindings={showFindings} allFilesOpen={allFilesOpen} renderFinding={renderFinding} /> : <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingBottom: 8 }}>{t('smartDiff.noFiles')}</div>)}
  </section>;
}

export function DiffTab({ prId, filesCount, files, reviews = [], canComment, detailReady, revealTarget = null, focusTarget = null, onFocusConsumed }: DiffTabProps) {
  const t = useTranslations('prReview');
  const { data: comments } = usePrComments(prId);
  const { data: smartDiff, isLoading: smartLoading, isError: smartError, refetch: retrySmartDiff } = useSmartDiff(prId, detailReady);
  const create = useCreatePrComment(prId);
  const findingAction = useFindingAction();
  const [showDetails, setShowDetails] = React.useState(true);
  const [originalOrder, setOriginalOrder] = React.useState(false);
  React.useEffect(() => {
    if (!focusTarget || !onFocusConsumed) return;
    return scheduleBriefFocusClear(onFocusConsumed);
  }, [focusTarget, onFocusConsumed]);
  const currentFindings = React.useMemo(() => latestFindingsPerAgent(reviews), [reviews]);
  const displayFindings = React.useMemo(() => findingsForFiles(files, currentFindings), [files, currentFindings]);
  const commentCount = comments?.length ?? 0;
  const commenting: DiffCommentApi = {
    comments: comments ?? [], canComment: !!canComment && !!prId, showComments: showDetails, posting: create.isPending,
    onSubmit: async (input) => {
      try { const result = await create.mutateAsync(input); setShowDetails(true); return result; }
      catch (error) { notify.error(error instanceof Error ? error.message : "Couldn't post the comment to GitHub."); throw error; }
    },
  };
  const renderFinding = (finding: FindingRecord) => <FindingCard f={finding} defaultExpanded pending={findingAction.isPending && findingAction.variables?.findingId === finding.id} onAction={(action) => findingAction.mutate({ findingId: finding.id, action, prId: prId ?? undefined })} />;
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const snapshotMismatches = smartDiffPathMismatches(files, smartDiff);
  const orderedGroups = smartDiff?.groups.map((group) => ({ ...group, files: group.files.map((item) => filesByPath.get(item.path)).filter((file): file is PrFile => !!file) }));
  const smartDiffReady = detailReady && !smartLoading && !smartError && !!orderedGroups && snapshotMismatches.length === 0;
  // A revealed Brief file has a precise target; original order guarantees the
  // target is visibly rendered even if Smart Diff would keep its group closed.
  const effectiveOriginalOrder = originalOrder || !smartDiffReady || !!revealTarget;
  const additions = files.reduce((total, file) => total + file.additions, 0);
  const deletions = files.reduce((total, file) => total + file.deletions, 0);

  return <section>
    <SectionLabel icon="Code" right={<div style={{ display: 'flex', gap: 6 }}>
      <Button kind={effectiveOriginalOrder ? 'ghost' : 'primary'} size="sm" onClick={() => setOriginalOrder(false)} active={!effectiveOriginalOrder} disabled={snapshotMismatches.length > 0}>{t('smartDiff.smartOrder')}</Button>
      <Button kind={effectiveOriginalOrder ? 'primary' : 'ghost'} size="sm" onClick={() => setOriginalOrder(true)} active={effectiveOriginalOrder}>{t('smartDiff.originalOrder')}</Button>
      {(commentCount > 0 || currentFindings.length > 0) && <Button kind="ghost" size="sm" icon={showDetails ? 'EyeOff' : 'Eye'} onClick={() => setShowDetails((value) => !value)}>{showDetails ? t('smartDiff.hideComments') : t('smartDiff.showComments')}</Button>}
    </div>}>{`Files changed · ${filesCount} files`}</SectionLabel>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <span>{filesCount} files</span>
      <span style={{ color: 'var(--code-add-text)' }}>+{additions}</span>
      <span style={{ color: 'var(--code-del-text)' }}>−{deletions}</span>
    </div>
    {!effectiveOriginalOrder && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12, padding: '18px 0' }}>
      <Icon.Zap size={14} style={{ color: 'var(--warn)' }} />
      {t('smartDiff.localGrouping')}
    </div>}
    {!effectiveOriginalOrder && smartDiff?.split_suggestion.too_big && <div style={{ border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)', borderRadius: 6, background: 'var(--warn-bg)', color: 'var(--warn)', padding: '7px 10px', fontSize: 12.5, marginBottom: 10 }}>
      {t('smartDiff.largeTitle', { lines: smartDiff.split_suggestion.total_lines })}
    </div>}
    {snapshotMismatches.length > 0 && <div style={{ color: 'var(--warn)', padding: '0 0 12px' }}>{t('smartDiff.refreshing')} <Button kind="ghost" size="sm" onClick={() => retrySmartDiff()}>{t('smartDiff.retry')}</Button></div>}
    {effectiveOriginalOrder ? <DiffViewer files={files} commenting={commenting} findings={displayFindings} showFindings={showDetails} renderFinding={renderFinding} focusTarget={focusTarget} revealFile={revealTarget?.file} /> : (
      <div>{orderedGroups!.sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role)).map((group) => <SmartDiffGroup key={group.role} role={group.role} files={group.files} findings={currentFindings} commenting={commenting} showFindings={showDetails} renderFinding={renderFinding} />)}</div>
    )}
    {!originalOrder && smartError && <div style={{ color: 'var(--crit)', padding: '12px 0' }}>{t('smartDiff.unavailable')} <Button kind="ghost" size="sm" onClick={() => retrySmartDiff()}>{t('smartDiff.retry')}</Button></div>}
    {!smartLoading && currentFindings.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{reviews.length ? t('smartDiff.noFindings') : t('smartDiff.noReview')}</p>}
  </section>;
}
