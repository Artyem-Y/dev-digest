"use client";

import React from "react";
import { Button, SectionLabel } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, useFindingAction } from "@/lib/hooks/reviews";
import { useSmartDiff } from "@/lib/hooks/smart-diff";
import { latestFindingsPerAgent } from "@/lib/review-findings";
import { FindingCard } from "../FindingCard";
import { notify } from "@/lib/toast";
import type { FindingRecord, PrFile, ReviewRecord, SmartDiffRole } from "@devdigest/shared";
import { useTranslations } from "next-intl";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  reviews?: ReviewRecord[];
  canComment?: boolean;
}

const roles: SmartDiffRole[] = ['core', 'tests', 'wiring', 'docs', 'boilerplate'];
const labelKey: Record<SmartDiffRole, 'coreLabel' | 'testsLabel' | 'wiringLabel' | 'docsLabel' | 'boilerplateLabel'> = {
  core: 'coreLabel', tests: 'testsLabel', wiring: 'wiringLabel', docs: 'docsLabel', boilerplate: 'boilerplateLabel',
};

function SmartDiffGroup({ role, files, findings, commenting, showFindings, renderFinding }: {
  role: SmartDiffRole; files: PrFile[]; findings: FindingRecord[]; commenting: DiffCommentApi; showFindings: boolean; renderFinding: (finding: FindingRecord) => React.ReactNode;
}) {
  const t = useTranslations('prReview');
  const [open, setOpen] = React.useState(role !== 'docs' && role !== 'boilerplate');
  const findingFiles = new Set(findings.filter((finding) => files.some((file) => file.path === finding.file)).map((finding) => finding.file));
  return <section style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', border: 0, background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}>
      <span aria-hidden="true">{open ? '⌄' : '›'}</span><strong>{t(`smartDiff.${labelKey[role]}`)}</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('smartDiff.filesCount', { count: files.length })}</span>
      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{findingFiles.size > 0 && <span aria-label={t('smartDiff.findingFiles', { count: findingFiles.size })} style={{ color: 'var(--crit)' }}>● {findingFiles.size}</span>}</span>
    </button>
    {open && (files.length ? <DiffViewer files={files} commenting={commenting} findings={findings} showFindings={showFindings} renderFinding={renderFinding} /> : <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingBottom: 8 }}>{t('smartDiff.noFiles')}</div>)}
  </section>;
}

export function DiffTab({ prId, filesCount, files, reviews = [], canComment }: DiffTabProps) {
  const t = useTranslations('prReview');
  const { data: comments } = usePrComments(prId);
  const { data: smartDiff, isLoading: smartLoading, isError: smartError, refetch: retrySmartDiff } = useSmartDiff(prId);
  const create = useCreatePrComment(prId);
  const findingAction = useFindingAction();
  const [showDetails, setShowDetails] = React.useState(true);
  const [originalOrder, setOriginalOrder] = React.useState(false);
  const currentFindings = React.useMemo(() => latestFindingsPerAgent(reviews), [reviews]);
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
  const missingPaths = smartDiff?.groups.flatMap((group) => group.files).filter((file) => !filesByPath.has(file.path)).map((file) => file.path) ?? [];
  const orderedGroups = smartDiff?.groups.map((group) => ({ ...group, files: group.files.map((item) => filesByPath.get(item.path)).filter((file): file is PrFile => !!file) }));
  const effectiveOriginalOrder = originalOrder || missingPaths.length > 0;

  return <section>
    <SectionLabel icon="Code" right={<div style={{ display: 'flex', gap: 6 }}>
      <Button kind={effectiveOriginalOrder ? 'ghost' : 'secondary'} size="sm" onClick={() => setOriginalOrder(false)} active={!effectiveOriginalOrder} disabled={missingPaths.length > 0}>{t('smartDiff.smartOrder')}</Button>
      <Button kind={effectiveOriginalOrder ? 'secondary' : 'ghost'} size="sm" onClick={() => setOriginalOrder(true)} active={effectiveOriginalOrder}>{t('smartDiff.originalOrder')}</Button>
      {(commentCount > 0 || currentFindings.length > 0) && <Button kind="ghost" size="sm" icon={showDetails ? 'EyeOff' : 'Eye'} onClick={() => setShowDetails((value) => !value)}>{showDetails ? t('smartDiff.hideComments') : t('smartDiff.showComments')}</Button>}
    </div>}>{effectiveOriginalOrder ? `Files changed · ${filesCount} files` : t('smartDiff.groupedByRole')}</SectionLabel>
    {missingPaths.length > 0 && <div style={{ color: 'var(--warn)', padding: '0 0 12px' }}>{t('smartDiff.refreshing')} <Button kind="ghost" size="sm" onClick={() => retrySmartDiff()}>{t('smartDiff.retry')}</Button></div>}
    {effectiveOriginalOrder ? <DiffViewer files={files} commenting={commenting} findings={currentFindings} showFindings={showDetails} renderFinding={renderFinding} /> : (
      smartLoading ? <div style={{ color: 'var(--text-muted)', padding: 16 }}>{t('smartDiff.loading')}</div> :
      smartError || !orderedGroups ? <div style={{ color: 'var(--crit)', padding: 16 }}>{t('smartDiff.unavailable')} <Button kind="ghost" size="sm" onClick={() => retrySmartDiff()}>{t('smartDiff.retry')}</Button></div> :
      <div>{orderedGroups.sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role)).map((group) => <SmartDiffGroup key={group.role} role={group.role} files={group.files} findings={currentFindings} commenting={commenting} showFindings={showDetails} renderFinding={renderFinding} />)}</div>
    )}
    {!smartLoading && currentFindings.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{reviews.length ? t('smartDiff.noFindings') : t('smartDiff.noReview')}</p>}
  </section>;
}
