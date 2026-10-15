import type { SmartDiff, SmartDiffRole } from '@devdigest/shared';
import { SMART_DIFF_ROLE_ORDER } from './constants.js';
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

/** Build a complete SmartDiff payload from persisted PR files and current findings. */
export function buildSmartDiff(files: readonly SmartDiffSourceFile[], findings: readonly SmartDiffSourceFinding[]): SmartDiff {
  const linesByPath = new Map<string, Set<number>>();
  for (const finding of findings) {
    const lines = linesByPath.get(finding.file) ?? new Set<number>();
    lines.add(finding.start_line);
    linesByPath.set(finding.file, lines);
  }
  const groups = new Map<SmartDiffRole, SmartDiff['groups'][number]>();
  for (const role of SMART_DIFF_ROLE_ORDER) groups.set(role, { role, files: [] });
  for (const file of files) {
    groups.get(classifyFile(file.path))!.files.push({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      finding_lines: [...(linesByPath.get(file.path) ?? [])].sort((a, b) => a - b),
    });
  }
  return {
    groups: SMART_DIFF_ROLE_ORDER.map((role) => groups.get(role)!),
    split_suggestion: {
      too_big: false,
      total_lines: files.reduce((sum, file) => sum + file.additions + file.deletions, 0),
      proposed_splits: [],
    },
  };
}
