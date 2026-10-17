import type { SmartDiff, SmartDiffRole } from '@devdigest/shared';
import { SMART_DIFF_LARGE_PR_LINES, SMART_DIFF_ROLE_LABEL, SMART_DIFF_ROLE_ORDER } from './constants.js';
import { classifyFile } from './classify-file.js';

export interface SmartDiffSourceFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface SmartDiffSourceFinding {
  file: string;
  start_line: number;
}

/** Compare repository paths independently of unified-diff prefixes. */
function repositoryPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^(?:\.\/|[ab]\/)+/, '');
}

/** Build a complete SmartDiff payload from persisted PR files and current findings. */
export function buildSmartDiff(files: readonly SmartDiffSourceFile[], findings: readonly SmartDiffSourceFinding[]): SmartDiff {
  const linesByPath = new Map<string, Set<number>>();
  for (const finding of findings) {
    const path = repositoryPath(finding.file);
    const lines = linesByPath.get(path) ?? new Set<number>();
    lines.add(finding.start_line);
    linesByPath.set(path, lines);
  }
  const groups = new Map<SmartDiffRole, SmartDiff['groups'][number]>();
  for (const role of SMART_DIFF_ROLE_ORDER) groups.set(role, { role, files: [] });
  for (const file of files) {
    groups.get(classifyFile(file.path))!.files.push({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      finding_lines: [...(linesByPath.get(repositoryPath(file.path)) ?? [])].sort((a, b) => a - b),
    });
  }
  const orderedGroups = SMART_DIFF_ROLE_ORDER.map((role) => groups.get(role)!);
  const totalLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  const tooBig = totalLines >= SMART_DIFF_LARGE_PR_LINES;
  return {
    groups: orderedGroups,
    split_suggestion: {
      too_big: tooBig,
      total_lines: totalLines,
      // These are deterministic review slices, not model-generated plans. They
      // let a reviewer split a large PR along the same categories Smart Diff
      // already presents.
      proposed_splits: tooBig
        ? orderedGroups
          .filter((group) => group.files.length > 0)
          .map((group) => ({ name: SMART_DIFF_ROLE_LABEL[group.role], files: group.files.map((file) => file.path) }))
        : [],
    },
  };
}
