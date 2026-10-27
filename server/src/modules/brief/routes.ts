import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BriefGenerateResponse } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { createBriefServices } from './composition.js';

/** Read-only cache GET; explicit rate-limited POST is the only model trigger. */
export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const services = createBriefServices(app.container);
  app.get('/pulls/:id/brief', { schema: { params: IdParams, response: { 200: BriefGenerateResponse } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return services.get.execute(workspaceId, req.params.id);
  });
  app.post('/pulls/:id/brief', {
    schema: { params: IdParams, response: { 200: BriefGenerateResponse } },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return services.generate.execute(workspaceId, req.params.id);
  });
}
