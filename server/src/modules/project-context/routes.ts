import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { catalogProjectDocuments } from './application/catalog-project-documents.js';
import { createProjectContextRepository, createTrackedDocumentStore } from './composition.js';
import { normalizeProjectPath } from './domain/path-policy.js';

const RepoParams = z.object({ repoId: z.string().uuid() });
const OwnerParams = RepoParams.extend({ owner: z.enum(['agent', 'skill']), ownerId: z.string().uuid() });
const AttachmentBody = z.object({ path: z.string().min(1).max(1024) });

/** Read/catalog plus attachment configuration; never writes repository files. */
export default async function projectContextRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const repository = createProjectContextRepository(app.container);
  async function store(workspaceId: string, repoId: string) {
    const clonePath = await repository.clonePath(workspaceId, repoId);
    if (!clonePath) throw new NotFoundError('Repository checkout not found');
    return createTrackedDocumentStore(clonePath);
  }

  app.get('/repos/:repoId/project-context/documents', { schema: { params: RepoParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return catalogProjectDocuments(await store(workspaceId, req.params.repoId));
  });
  app.get('/repos/:repoId/project-context/documents/:path', { schema: { params: RepoParams.extend({ path: z.string() }) } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const read = await (await store(workspaceId, req.params.repoId)).read(req.params.path);
    if ('reason' in read) throw new NotFoundError('Project document is unavailable', { reason: read.reason });
    return read;
  });
  app.get('/repos/:repoId/project-context/:owner/:ownerId/attachments', { schema: { params: OwnerParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const documentStore = await store(workspaceId, req.params.repoId);
    const catalog = new Set(await documentStore.catalog());
    const paths = await repository.listOwnerAttachments({ workspaceId, repoId: req.params.repoId, owner: req.params.owner, ownerId: req.params.ownerId });
    return Promise.all(paths.map(async (path) => {
      if (!catalog.has(path)) return { path, status: 'no_longer_eligible' as const, estimated_tokens: 0 };
      const read = await documentStore.read(path);
      return 'reason' in read
        ? { path, status: read.reason, estimated_tokens: 0 }
        : { path, status: 'attached' as const, estimated_tokens: Math.ceil(read.content.length / 4) };
    }));
  });
  app.post('/repos/:repoId/project-context/:owner/:ownerId/attachments', { schema: { params: OwnerParams, body: AttachmentBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const path = normalizeProjectPath(req.body.path);
    if (!path || !(await (await store(workspaceId, req.params.repoId)).catalog()).includes(path)) throw new ValidationError('Document must be a tracked Markdown file');
    await repository.attach({ workspaceId, repoId: req.params.repoId, owner: req.params.owner, ownerId: req.params.ownerId, path });
    reply.status(204).send();
  });
  app.delete('/repos/:repoId/project-context/:owner/:ownerId/attachments', { schema: { params: OwnerParams, body: AttachmentBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const path = normalizeProjectPath(req.body.path);
    if (!path) throw new ValidationError('Invalid document path');
    await repository.detach({ workspaceId, repoId: req.params.repoId, owner: req.params.owner, ownerId: req.params.ownerId, path });
    reply.status(204).send();
  });
}
