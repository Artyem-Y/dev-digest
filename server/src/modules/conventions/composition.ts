import type { Container } from '../../platform/container.js';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { RepoRepository } from '../repos/repository.js';
import { SettingsRepository } from '../settings/repository.js';
import { ConventionsRepository } from './repository.js';
import { ConventionsService } from './service.js';

export function createConventionsService(container: Container) {
  return new ConventionsService({
    repository: new ConventionsRepository(container.db),
    repos: new RepoRepository(container.db),
    repoIntel: container.repoIntel,
    settings: new SettingsRepository(container.db),
    llm: (provider) => container.llm(provider),
    configSamples: async (cloneRoot) => {
      const candidates = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', '.eslintrc', '.eslintrc.json', 'tsconfig.json', '.prettierrc', '.prettierrc.json', 'prettier.config.js'];
      const root = await realpath(cloneRoot);
      const found = await Promise.all(candidates.map(async (path) => {
        const target = resolve(root, path);
        const stat = await lstat(target).catch(() => null);
        if (!stat?.isFile() || stat.isSymbolicLink()) return null;
        return path;
      }));
      return found.filter((path): path is string => path !== null);
    },
    readSample: async (path, cloneRoot) => {
      if (!path || isAbsolute(path) || path.includes('\\')) throw new Error('Unsafe convention sample path');
      const root = await realpath(cloneRoot);
      const target = resolve(root, path);
      const relation = relative(root, target);
      if (!relation || relation.startsWith('..') || isAbsolute(relation)) throw new Error('Convention sample escaped clone');
      const stat = await lstat(target).catch(() => null);
      if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error('Convention sample must be a regular file');
      const resolvedTarget = await realpath(target);
      if (!resolvedTarget.startsWith(root + '/')) throw new Error('Convention sample escaped clone');
      return readFile(resolvedTarget, 'utf8');
    },
  });
}
