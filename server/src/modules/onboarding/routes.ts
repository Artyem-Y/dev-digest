import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { OnboardingTourResponse } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { createOnboardingServices } from './composition.js';

const FileQuery = z.object({
  path: z.string().min(1).max(4096).refine((path) => !path.startsWith('/') && !path.includes('\\') && !path.includes('\0') && path.split('/').every((part) => part && part !== '.' && part !== '..' && part !== '.env' && !part.startsWith('.env.'))),
  revision: z.string().regex(/^[0-9a-f]{40}([0-9a-f]{24})?$/),
});
const FileResponse = z.object({ path: z.string(), revision: z.string(), content: z.string() });
const StartResponse = z.object({ id: z.string(), status: z.literal('pending') });

export default async function onboardingRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const services = createOnboardingServices(app.container, (data) => app.log.info({ onboarding: data }, 'onboarding attempt'));
  const recover = () => { void services.recoverExpired().catch(() => app.log.error('onboarding recovery failed')); };
  recover();
  const timer = setInterval(recover, 30_000); timer.unref();
  app.addHook('onClose', async () => { clearInterval(timer); await services.generate.shutdown(); });
  app.get('/repos/:id/onboarding-tour', { schema: { params: IdParams, response: { 200: OnboardingTourResponse } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const result = await services.get.get(workspaceId, req.params.id);
    if (!result) throw new NotFoundError('Repository not found');
    return result;
  });
  app.post('/repos/:id/onboarding-tour', { schema: { params: IdParams, response: { 200: StartResponse } }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const result = await services.generate.start(workspaceId, req.params.id);
    if (!result) throw new NotFoundError('Repository or active attempt not found');
    return result;
  });
  app.get('/repos/:id/onboarding-tour/file', { schema: { params: IdParams, querystring: FileQuery, response: { 200: FileResponse } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const file = await services.readFile(workspaceId, req.params.id, req.query.path, req.query.revision);
    if (!file) throw new NotFoundError('File unavailable');
    return file;
  });
}
