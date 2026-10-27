import type { BriefSourceStatus } from '@devdigest/shared';
import type { BriefPullSnapshot } from '../domain/types.js';

const estimate = (text: string) => Math.ceil(text.length / 4);

export interface BriefFactComponent { key: string; content: string; estimatedTokens: number }

/** Compact persisted facts only: deliberately no pr_files.patch or source body. */
export function assembleFacts(snapshot: BriefPullSnapshot): { components: BriefFactComponent[]; statuses: BriefSourceStatus[] } {
  const statuses: BriefSourceStatus[] = [
    { source_kind: 'pr_title', path: null, provenance: 'pull_request', status: 'available', reason_code: null, estimated_tokens: estimate(snapshot.title) },
    { source_kind: 'pr_description', path: null, provenance: 'pull_request', status: snapshot.body ? 'available' : 'omitted', reason_code: snapshot.body ? null : 'empty', estimated_tokens: estimate(snapshot.body ?? '') },
    ...snapshot.files.map((file) => ({ source_kind: 'changed_file' as const, path: file.path, provenance: 'changed_files' as const, status: 'available' as const, reason_code: null, estimated_tokens: estimate(file.path) })),
    { source_kind: 'intent', path: null, provenance: 'pull_request', status: snapshot.intent ? 'available' : 'unavailable', reason_code: snapshot.intent ? null : 'not_derived', estimated_tokens: 0 },
    { source_kind: 'blast_radius', path: null, provenance: 'pull_request', status: snapshot.blast ? 'available' : 'unavailable', reason_code: snapshot.blast ? null : 'not_available', estimated_tokens: 0 },
    { source_kind: 'smart_diff', path: null, provenance: 'pull_request', status: snapshot.smartDiff ? 'available' : 'unavailable', reason_code: snapshot.smartDiff ? null : 'not_available', estimated_tokens: 0 },
  ];
  const components: BriefFactComponent[] = [
    { key: 'pr_title', content: `PR #${snapshot.number}: ${snapshot.title}\nHead: ${snapshot.headSha}`, estimatedTokens: estimate(snapshot.title) },
    ...(snapshot.body ? [{ key: 'pr_description', content: `Description:\n${snapshot.body}`, estimatedTokens: estimate(snapshot.body) }] : []),
    ...(snapshot.intent ? [{ key: 'intent', content: `Intent:\n${JSON.stringify(snapshot.intent)}`, estimatedTokens: estimate(JSON.stringify(snapshot.intent)) }] : []),
    ...(snapshot.blast ? [{ key: 'blast_radius', content: `Blast Radius:\n${JSON.stringify(snapshot.blast)}`, estimatedTokens: estimate(JSON.stringify(snapshot.blast)) }] : []),
    ...snapshot.files.map((file) => ({ key: `changed_file:${file.path}`, content: `Changed file: ${file.path} (+${file.additions}/-${file.deletions})`, estimatedTokens: estimate(file.path) })),
    ...(snapshot.smartDiff ? [{ key: 'smart_diff', content: `Smart Diff:\n${JSON.stringify(snapshot.smartDiff)}`, estimatedTokens: estimate(JSON.stringify(snapshot.smartDiff)) }] : []),
  ];
  return { components, statuses };
}
