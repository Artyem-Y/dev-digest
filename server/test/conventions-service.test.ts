import { describe, expect, it } from 'vitest';
import { ConventionsService } from '../src/modules/conventions/service.js';

describe('ConventionsService', () => {
  it('persists only candidates whose evidence was verified against sampled files', async () => {
    const inserted: unknown[] = [];
    const service = new ConventionsService({
      repository: { replace: async (_workspaceId: string, _repoId: string, rows: unknown[]) => { inserted.push(...rows); return rows; } } as never,
      repos: { getById: async () => ({ clonePath: '/clone' }) } as never,
      repoIntel: { getConventionSamples: async () => ['src/api.ts'] } as never,
      configSamples: async () => [],
      settings: { list: async () => [] },
      llm: async () => ({ completeStructured: async () => ({ data: { candidates: [
        { category: 'style', rule: 'Use await', evidence_path: 'src/api.ts', evidence_line: 2, confidence: 0.9 },
        { category: 'style', rule: 'Fake', evidence_path: '../secret', evidence_line: 1, confidence: 0.9 },
      ] } }) } as never),
      readSample: async () => 'one\ntwo',
      verifyEvidence: async (_root, _sampled, path, line) => path === 'src/api.ts' && line === 2
        ? { evidencePath: path, evidenceLine: line, evidenceSnippet: 'two' } : null,
    });

    const candidates = await service.scan('workspace', 'repo');

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ rule: 'Use await', evidencePath: 'src/api.ts', evidenceLine: 2, evidenceSnippet: 'two' });
    expect(inserted).toHaveLength(1);
  });

  it('samples recognized config files before unique ranked source files', async () => {
    let prompt = '';
    const service = new ConventionsService({
      repository: { replace: async () => [] } as never,
      repos: { getById: async () => ({ clonePath: '/clone' }) } as never,
      repoIntel: { getConventionSamples: async () => ['src/a.ts', 'tsconfig.json', 'src/b.ts'] } as never,
      configSamples: async () => ['tsconfig.json', '.prettierrc'],
      settings: { list: async () => [] },
      llm: async () => ({ completeStructured: async (request: { messages: Array<{ content: string }> }) => {
        prompt = request.messages[1]!.content;
        return { data: { candidates: [] } };
      } }) as never,
      readSample: async (path) => path,
    });

    await service.scan('workspace', 'repo');

    expect(prompt.indexOf('FILE: tsconfig.json')).toBeLessThan(prompt.indexOf('FILE: .prettierrc'));
    expect(prompt.match(/FILE: tsconfig\.json/g)).toHaveLength(1);
    expect(prompt).toContain('FILE: src/a.ts');
  });
});
