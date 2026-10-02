import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { createSkillsService } from './composition.js';

const CreateSkill = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  type: SkillType,
  body: z.string().trim().min(1).max(50_000),
});
const UpdateSkill = CreateSkill.extend({ enabled: z.boolean(), expected_version: z.number().int().positive() });

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = createSkillsService(app.container);
  app.get('/skills', async (req) => service.list((await getContext(app.container, req)).workspaceId));
  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const skill = await service.get((await getContext(app.container, req)).workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });
  app.post('/skills', { schema: { body: CreateSkill } }, async (req, reply) => {
    const skill = await service.create((await getContext(app.container, req)).workspaceId, req.body);
    reply.status(201);
    return skill;
  });
  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkill } }, async (req) =>
    service.update((await getContext(app.container, req)).workspaceId, req.params.id, req.body),
  );
  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => ({
    ok: await service.delete((await getContext(app.container, req)).workspaceId, req.params.id),
  }));
}
