import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { createSkillsService } from './composition.js';
import { markdownFromUrl, markdownFromZip, previewMarkdown } from './import.js';

const CreateSkill = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  type: SkillType,
  body: z.string().trim().min(1).max(50_000),
});
const UpdateSkill = CreateSkill.extend({ enabled: z.boolean(), expected_version: z.number().int().positive() });
const VersionParams = IdParams.extend({ version: z.coerce.number().int().positive() });
const RestoreSkill = z.object({ expected_version: z.number().int().positive() });
const ImportFields = { name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().min(1).max(500).optional() };
const ImportPreview = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('markdown'), markdown: z.string().max(512_000) }),
  z.object({ kind: z.literal('zip'), zip_base64: z.string().max(1_400_000) }),
  z.object({ kind: z.literal('url'), url: z.string().url().max(2_000) }),
]);
const ImportSkill = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('markdown'), markdown: z.string().max(512_000), ...ImportFields }),
  z.object({ kind: z.literal('zip'), zip_base64: z.string().max(1_400_000), ...ImportFields }),
  z.object({ kind: z.literal('url'), url: z.string().url().max(2_000), ...ImportFields }),
]);

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
  app.post('/skills/import/preview', { schema: { body: ImportPreview } }, async (req) => {
    const body = req.body;
    const markdown = body.kind === 'markdown' ? body.markdown : body.kind === 'zip' ? markdownFromZip(body.zip_base64) : await markdownFromUrl(body.url);
    return previewMarkdown(markdown, body.kind === 'url' ? 'imported_url' : 'community');
  });
  app.post('/skills/import', { schema: { body: ImportSkill } }, async (req, reply) => {
    const body = req.body;
    const markdown = body.kind === 'markdown' ? body.markdown : body.kind === 'zip' ? markdownFromZip(body.zip_base64) : await markdownFromUrl(body.url);
    const preview = previewMarkdown(markdown, body.kind === 'url' ? 'imported_url' : 'community');
    const skill = await service.create((await getContext(app.container, req)).workspaceId, { ...preview, name: body.name ?? preview.name, description: body.description ?? preview.description });
    reply.status(201);
    return skill;
  });
  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkill } }, async (req) =>
    service.update((await getContext(app.container, req)).workspaceId, req.params.id, req.body),
  );
  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const versions = await service.listVersions((await getContext(app.container, req)).workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });
  app.post('/skills/:id/versions/:version/restore', { schema: { params: VersionParams, body: RestoreSkill } }, async (req) =>
    service.restore((await getContext(app.container, req)).workspaceId, req.params.id, req.params.version, req.body.expected_version),
  );
  app.delete('/skills/:id/versions/:version', { schema: { params: VersionParams } }, async (req) => ({
    ok: await service.deleteVersion((await getContext(app.container, req)).workspaceId, req.params.id, req.params.version),
  }));
  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => ({
    ok: await service.delete((await getContext(app.container, req)).workspaceId, req.params.id),
  }));
}
