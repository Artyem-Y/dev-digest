import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';

describe('Project Context routes', () => {
  it('is registered in the app module registry', async () => {
    const app = await buildApp({ config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv) });
    const response = await app.inject({ method: 'GET', url: '/repos/not-a-uuid/project-context/documents' });
    // A registered route reaches Zod validation (422) instead of Fastify's 404.
    expect(response.statusCode).toBe(422);
    await app.close();
  });
});
