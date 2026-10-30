import type { FastifyInstance } from 'fastify';

export function registerPullRoutes(app: FastifyInstance) {
  app.get('/pulls/:id/summary', async (request) => {
    const row = await app.db.query('select summary from pulls where id = $1 and workspace_id = $2', [
      request.params.id,
      request.query.workspaceId,
    ]);
    return { summary: row.summary };
  });
}
