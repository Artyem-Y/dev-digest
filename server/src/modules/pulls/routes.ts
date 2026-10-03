import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrCommentInput } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { createPullsService } from './composition.js';

/**
 * F1 — pulls module inbound adapter. It owns only Fastify/Zod concerns:
 * request validation, tenant context, HTTP registration, and observability.
 * Pull use cases live in PullsService; Drizzle is isolated in PullsRepository.
 */
export default async function pullsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = createPullsService(app.container, (error, message, meta) =>
    app.log.warn({ err: error, ...meta }, message),
  );

  app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.get('/pulls/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.detail(workspaceId, req.params.id);
  });

  // Proxied live to GitHub (no local persistence): GET reflects existing PR
  // comments; POST creates one immediately and remains pinned to the PR head.
  app.get('/pulls/:id/comments', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.listComments(workspaceId, req.params.id);
  });

  app.post(
    '/pulls/:id/comments',
    { schema: { params: IdParams, body: PrCommentInput } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.createComment(workspaceId, req.params.id, req.body);
    },
  );
}
