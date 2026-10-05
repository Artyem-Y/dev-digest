import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { createConventionsService } from './composition.js';
import { createSkillsService } from '../skills/composition.js';
import { createAgentsService } from '../agents/composition.js';
import { AppError, NotFoundError } from '../../platform/errors.js';

const RepoParams = z.object({ repoId: z.string().uuid() });
const CandidateParams = RepoParams.extend({ candidateId: z.string().uuid() });
const UpdateCandidate = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']),
  rule: z.string().trim().min(1).max(800).optional(),
});
const CreateSkill = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).max(50_000).optional(),
  agent_id: z.string().uuid().optional(),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const conventions = createConventionsService(app.container);
  const skills = createSkillsService(app.container);
  const agents = createAgentsService(app.container);

  app.get('/repos/:repoId/conventions', { schema: { params: RepoParams } }, async (req) =>
    conventions.list((await getContext(app.container, req)).workspaceId, req.params.repoId),
  );
  app.post('/repos/:repoId/conventions/extract', { schema: { params: RepoParams } }, async (req) =>
    conventions.scan((await getContext(app.container, req)).workspaceId, req.params.repoId),
  );
  /** Backward-compatible UI alias; extract is the public feature contract. */
  app.post('/repos/:repoId/conventions/scan', { schema: { params: RepoParams } }, async (req) =>
    conventions.scan((await getContext(app.container, req)).workspaceId, req.params.repoId),
  );
  app.patch('/repos/:repoId/conventions/:candidateId', { schema: { params: CandidateParams, body: UpdateCandidate } }, async (req) =>
    conventions.setStatus((await getContext(app.container, req)).workspaceId, req.params.repoId, req.params.candidateId, req.body.status, req.body.rule),
  );
  app.post('/repos/:repoId/conventions/create-skill', { schema: { params: RepoParams, body: CreateSkill } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const repo = await conventions.repo(workspaceId, req.params.repoId);
    const rows = await conventions.list(workspaceId, req.params.repoId) as Array<{
      rule: string; editedRule: string | null; status: string; evidencePath: string | null; evidenceLine: number | null;
    }>;
    const accepted = rows.filter((row) => row.status === 'accepted');
    if (accepted.length === 0) {
      throw new AppError('no_accepted_conventions', 'Accept at least one convention before creating a skill', 409);
    }
    const generatedBody = [
      `# ${req.body.name ?? 'repo-conventions'}`,
      '',
      'Flag changes that violate these verified repository conventions. Cite the offending file and line.',
      '',
      ...accepted.flatMap((row) => [
        `## ${row.editedRule ?? row.rule}`,
        row.evidencePath && row.evidenceLine ? `Evidence: \`${row.evidencePath}:${row.evidenceLine}\`.` : '',
        '',
      ]),
    ].join('\n').trim();
    const skill = await skills.create(workspaceId, {
      name: req.body.name ?? 'repo-conventions',
      description: req.body.description ?? `${accepted.length} accepted repository conventions`,
      type: 'convention',
      body: req.body.body ?? generatedBody,
      source: 'extracted',
      evidence_files: accepted.flatMap((row) => row.evidencePath ? [row.evidencePath] : []),
    });
    const agentId = req.body.agent_id ?? (await agents.list(workspaceId))[0]?.id;
    if (agentId) {
      const links = await agents.linkSkill(workspaceId, agentId, skill.id);
      if (!links) throw new NotFoundError('Selected agent not found');
    }
    reply.status(201);
    return skill;
  });
}
