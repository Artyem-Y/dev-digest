import { describe, expect, it } from 'vitest';
import { DrizzleProjectContextRepository } from '../src/modules/project-context/infrastructure/project-context.repository.js';

describe('Project Context attachment snapshot', () => {
  it('does not combine direct attachments and skill links from different database states', async () => {
    let current = { direct: 'before-direct.md', inherited: 'before-skill.md' };
    let queryNumber = 0;
    const queries = (snapshot?: typeof current) => ({
      select: () => {
        const direct = queryNumber++ % 2 === 0;
        const query = {
          from: () => query,
          innerJoin: () => query,
          where: () => query,
          orderBy: async () => {
            const state = snapshot ?? current;
            if (direct) {
              const path = state.direct;
              current = { direct: 'after-direct.md', inherited: 'after-skill.md' };
              return [{ path }];
            }
            return [{ path: state.inherited, skillId: 'skill', body: 'safe skill' }];
          },
        };
        return query;
      },
    });
    const db = {
      ...queries(),
      transaction: async (callback: (tx: ReturnType<typeof queries>) => Promise<unknown>, options?: { isolationLevel?: string }) =>
        callback(queries(options?.isolationLevel === 'repeatable read' ? { ...current } : undefined)),
    };
    const repository = new DrizzleProjectContextRepository(db as never);

    const result = await repository.listForAgent('workspace', 'repo', 'agent');

    expect(result.map((item) => item.path)).toEqual(['before-direct.md', 'before-skill.md']);
  });
});
