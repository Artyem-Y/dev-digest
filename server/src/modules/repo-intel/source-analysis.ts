import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractEndpoints } from '../../adapters/codeindex/extract.js';
import {
  langForFile,
  parseImports,
  parseInvocationHeads,
  parseSymbols,
} from '../../adapters/astgrep/index.js';
import type { RepoIntelSourceAnalysisPort } from './service.js';

/** Node/ast-grep implementation of the repo-intel source-analysis port. */
export const nodeRepoIntelSourceAnalysis: RepoIntelSourceAnalysisPort = {
  isSupported: (file) => Boolean(langForFile(file)),
  readFile: async (clonePath, file) => readFile(join(clonePath, file), 'utf8').catch(() => null),
  extractEndpoints,
  parseSymbols,
  parseImports,
  parseInvocationHeads,
};
