import { beforeEach, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const services = vi.hoisted(() => ({ get: { get: vi.fn() }, generate: { start: vi.fn(), shutdown: vi.fn() }, readFile: vi.fn(), recoverExpired: vi.fn() }));
vi.mock('../src/modules/onboarding/composition.js', () => ({ createOnboardingServices: () => services }));
import routes from '../src/modules/onboarding/routes.js';
const id = '11111111-1111-4111-8111-111111111111';
async function app() {
  const app = Fastify(); app.setValidatorCompiler(validatorCompiler); app.setSerializerCompiler(serializerCompiler);
  app.decorate('container', { auth: { currentUser: async () => ({ id: 'user' }), currentWorkspace: async () => ({ id: 'workspace' }) } });
  await app.register(routes); await app.ready(); return app;
}
beforeEach(() => { vi.clearAllMocks(); services.recoverExpired.mockResolvedValue(0); services.generate.shutdown.mockResolvedValue(undefined); });
it('GET reads only and POST explicitly starts generation within workspace', async () => {
  services.get.get.mockResolvedValue({ tour: null, attempt: null });
  services.generate.start.mockResolvedValue({ id: 'attempt', status: 'pending' });
  const a = await app();
  expect(services.recoverExpired).toHaveBeenCalledOnce();
  expect((await a.inject({ method: 'GET', url: `/repos/${id}/onboarding-tour` })).statusCode).toBe(200);
  expect(services.generate.start).not.toHaveBeenCalled();
  expect((await a.inject({ method: 'POST', url: `/repos/${id}/onboarding-tour` })).json()).toEqual({ id: 'attempt', status: 'pending' });
  expect(services.generate.start).toHaveBeenCalledWith('workspace', id);
  await a.close(); expect(services.generate.shutdown).toHaveBeenCalled();
});
it('returns unavailable for unauthorized repositories and invalid file paths', async () => {
  services.get.get.mockResolvedValue(null); services.readFile.mockResolvedValue(null);
  const a = await app();
  expect((await a.inject({ method: 'GET', url: `/repos/${id}/onboarding-tour` })).statusCode).toBe(404);
  expect((await a.inject({ method: 'GET', url: `/repos/${id}/onboarding-tour/file?path=../x&revision=${'a'.repeat(40)}` })).statusCode).toBe(400);
  expect(services.readFile).not.toHaveBeenCalled();
  await a.close();
});

it('scopes file reads and returns unavailable for a denied file', async () => {
  const a = await app(); const revision = 'a'.repeat(40);
  services.readFile.mockResolvedValueOnce({ path: 'src/a.ts', revision, content: 'source' }).mockResolvedValueOnce(null);
  const url = `/repos/${id}/onboarding-tour/file?path=src%2Fa.ts&revision=${revision}`;
  expect((await a.inject({ method: 'GET', url })).json()).toEqual({ path: 'src/a.ts', revision, content: 'source' });
  expect(services.readFile).toHaveBeenCalledWith('workspace', id, 'src/a.ts', revision);
  expect((await a.inject({ method: 'GET', url })).statusCode).toBe(404);
  await a.close();
});

it('requires an authorized saved tour and exact captured path and revision before reading a blob', async () => {
  const { readTourFile } = await vi.importActual<typeof import('../src/modules/onboarding/composition.js')>('../src/modules/onboarding/composition.js');
  const revision = 'a'.repeat(40);
  const get = { get: vi.fn() }; const projects = { clonePath: vi.fn(async () => '/checkout') }; const read = vi.fn(async () => 'content');
  const input = { get: get as never, projects, workspaceId: 'workspace', repoId: 'repo', path: 'src/a.ts', revision, read };
  get.get.mockResolvedValueOnce(null);
  expect(await readTourFile(input)).toBeNull();
  expect(projects.clonePath).not.toHaveBeenCalled();
  const tour = { source_revision: revision, sections: [{ items: [{ kind: 'path', text: 'src/a.ts' }] }] };
  get.get.mockResolvedValue({ tour });
  expect(await readTourFile({ ...input, path: 'src/other.ts' })).toBeNull();
  expect(await readTourFile({ ...input, revision: 'b'.repeat(40) })).toBeNull();
  expect(read).not.toHaveBeenCalled();
  expect(await readTourFile(input)).toEqual({ path: 'src/a.ts', revision, content: 'content' });
  expect(get.get).toHaveBeenCalledWith('workspace', 'repo');
  expect(projects.clonePath).toHaveBeenCalledWith('workspace', 'repo');
});
