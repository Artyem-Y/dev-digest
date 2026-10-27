import type { BriefCacheReadPort, BriefResponse } from './ports.js';
import { NotFoundError } from '../../../platform/errors.js';

export class GetBrief {
  constructor(private readonly read: BriefCacheReadPort) {}
  async execute(workspaceId: string, prId: string): Promise<BriefResponse> {
    const headSha = await this.read.getHeadSha(workspaceId, prId);
    if (!headSha) throw new NotFoundError('Pull request not found');
    const cached = await this.read.getCache(workspaceId, prId);
    if (!cached) return { cache: { cache_state: 'missing' }, sources: [] };
    return { cache: { cache_state: cached.brief.head_sha === headSha ? 'current' : 'stale', brief: cached.brief }, sources: cached.sources };
  }
}
