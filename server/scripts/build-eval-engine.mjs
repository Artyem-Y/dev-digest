import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { createHash } from 'node:crypto';

await mkdir('dist', { recursive: true });
const result = await build({ entryPoints: ['src/modules/evals/engine-entry.ts'], outfile: 'dist/eval-engine.mjs',
  bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.json', target: 'node22',
  plugins: [{ name: 'fixed-optional-encoding', setup(build) {
    build.onResolve({ filter: /^encoding$/ }, () => ({ path: 'encoding', namespace: 'eval-stub' }));
    build.onLoad({ filter: /.*/, namespace: 'eval-stub' }, () => ({ contents: "throw new Error('Optional encoding is unavailable in eval engine');", loader: 'js' }));
  } }],
  metafile: true, banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(process.cwd() + '/eval-engine.cjs');" } });
const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (dependency.external && !builtins.has(dependency.path)) throw new Error(`Unbundled eval dependency: ${dependency.path}`);
  }
}
const bytes = await readFile('dist/eval-engine.mjs');
for (const match of bytes.toString('utf8').matchAll(/__require\(([^)]*)\)/g)) {
  const literal = /^['"]([^'"]+)['"]$/.exec(match[1].trim());
  if (!literal || !builtins.has(literal[1])) throw new Error('Dynamic or non-built-in require in eval bundle');
}
await writeFile('dist/eval-engine.manifest.json', JSON.stringify({ sha256: createHash('sha256').update(bytes).digest('hex') }) + '\n');
