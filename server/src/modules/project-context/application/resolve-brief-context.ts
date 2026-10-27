import { estimateProjectDocumentTokens } from '../domain/token-estimator.js';
import type { AttachmentProvenance, ResolvedBriefContext, SkippedProjectDocument } from '../domain/types.js';
import type { ProjectContextRepository, TrackedDocumentStore } from './ports.js';
import { normalizeProjectPath } from '../domain/path-policy.js';
import { mapWithConcurrency } from './bounded-read.js';

/** Never echo an untrusted persisted path (which may be absolute or contain NUL) into Brief metadata. */
const invalidAttachmentLabel = (ordinal: number) => `[invalid project-context path #${ordinal}]`;
const DOCUMENT_READ_CONCURRENCY = 4;

export async function resolveBriefContext(input: {
  workspaceId: string;
  repoId: string;
  repository: ProjectContextRepository;
  store: TrackedDocumentStore;
}): Promise<ResolvedBriefContext> {
  const [attachments, catalog] = await Promise.all([
    input.repository.listForBrief(input.workspaceId, input.repoId),
    input.store.catalog(),
  ]);
  const eligible = new Set(catalog.map(normalizeProjectPath).filter((path): path is string => path !== null));
  const grouped = new Map<string, AttachmentProvenance[]>();
  const invalid = attachments
    .filter((attachment) => normalizeProjectPath(attachment.path) === null)
    .sort((left, right) => left.path.localeCompare(right.path));
  const skipped: SkippedProjectDocument[] = invalid.map((attachment, index) => ({
    path: invalidAttachmentLabel(index + 1),
    reason: 'no_longer_eligible',
    provenance: [attachment.provenance],
  }));
  for (const attachment of attachments) {
    const path = normalizeProjectPath(attachment.path);
    if (!path) continue;
    const current = grouped.get(path) ?? [];
    if (!current.includes(attachment.provenance)) current.push(attachment.provenance);
    grouped.set(path, current);
  }
  const readable: Array<{ path: string; provenance: AttachmentProvenance[] }> = [];
  for (const path of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
    const provenance = grouped.get(path)!;
    if (!eligible.has(path)) {
      skipped.push({ path, reason: 'no_longer_eligible', provenance });
      continue;
    }
    readable.push({ path, provenance });
  }
  const resolved = await mapWithConcurrency(readable, DOCUMENT_READ_CONCURRENCY, async ({ path, provenance }) => ({
    path,
    provenance,
    read: await input.store.read(path),
  }));
  const documents: ResolvedBriefContext['documents'] = [];
  for (const { path, provenance, read } of resolved) {
    if ('reason' in read) {
      skipped.push({ path, reason: read.reason, provenance });
      continue;
    }
    documents.push({ path, content: read.content, estimatedTokens: estimateProjectDocumentTokens(read.content), provenance });
  }
  return { documents, skipped: skipped.sort((left, right) => left.path.localeCompare(right.path)) };
}
