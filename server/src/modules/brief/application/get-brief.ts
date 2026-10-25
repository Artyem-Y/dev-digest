import type { BriefResponse, BriefReadPort } from './ports.js';
import { NotFoundError } from '../../../platform/errors.js';

export class GetBrief {
  constructor(private readonly read: BriefReadPort) {}
  async execute(workspaceId: string, prId: string): Promise<BriefResponse> {
    const snapshot = await this.read.getSnapshot(workspaceId, prId);
    if (!snapshot) throw new NotFoundError('Pull request not found');
    const cached = await this.read.getCache(workspaceId, prId);
    if (!cached) return { cache: { cache_state: 'missing' }, sources: [] };
    return { cache: { cache_state: cached.brief.head_sha === snapshot.headSha ? 'current' : 'stale', brief: cached.brief }, sources: cached.sources };
  }
}
