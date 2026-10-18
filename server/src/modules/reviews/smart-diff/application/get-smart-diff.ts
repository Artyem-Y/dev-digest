import type { SmartDiff } from '@devdigest/shared';
import { NotFoundError } from '../../../../platform/errors.js';
import { buildSmartDiff } from '../domain/build-smart-diff.js';
import type { SmartDiffReadPort } from './ports.js';

/** Read persisted pull metadata only; no git, GitHub, model or prompt work occurs here. */
export class GetSmartDiff {
  constructor(private readonly port: SmartDiffReadPort) {}

  async execute(workspaceId: string, prId: string): Promise<SmartDiff> {
    const pull = await this.port.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const [files, reviewRows] = await Promise.all([this.port.getPrFiles(prId), this.port.currentReviewsForPull(prId)]);
    return buildSmartDiff(
      files,
      reviewRows.flatMap(({ findings }) => findings.map((finding) => ({ file: finding.file, start_line: finding.startLine }))),
    );
  }
}
