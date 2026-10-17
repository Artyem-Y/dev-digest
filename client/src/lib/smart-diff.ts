import type { PrFile, SmartDiff } from '@devdigest/shared';

/** Returns paths present in only one of the current PR snapshot and Smart Diff. */
export function smartDiffPathMismatches(files: readonly Pick<PrFile, 'path'>[], smartDiff: SmartDiff | undefined): string[] {
  if (!smartDiff) return [];
  const currentPaths = new Set(files.map((file) => file.path));
  const groupedPaths = new Set(smartDiff.groups.flatMap((group) => group.files.map((file) => file.path)));
  return [
    ...[...groupedPaths].filter((path) => !currentPaths.has(path)),
    ...files.map((file) => file.path).filter((path) => !groupedPaths.has(path)),
  ];
}
