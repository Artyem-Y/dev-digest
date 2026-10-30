import { access, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const IGNORED_DIRECTORIES = new Set(['.git', '.next', '.turbo', 'coverage', 'dist', 'node_modules']);
const DEPENDENCY_SECTIONS = [
  ['dependencies', 'production'],
  ['devDependencies', 'development'],
  ['optionalDependencies', 'optional'],
  ['peerDependencies', 'peer'],
];

const toPosix = (value) => value.split(path.sep).join('/');
const compareText = (left, right) => left.localeCompare(right);

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(target) {
  return JSON.parse(await readFile(target, 'utf8'));
}

async function walk(root, predicate) {
  const result = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await visit(target);
      } else if (predicate(target, entry)) {
        result.push(target);
      }
    }
  }
  await visit(root);
  return result;
}

async function packageRoots(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const manifests = [];
  if (await exists(path.join(root, 'package.json'))) manifests.push(path.join(root, 'package.json'));
  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue;
    const manifest = path.join(root, entry.name, 'package.json');
    if (await exists(manifest)) manifests.push(manifest);
  }
  return Promise.all(
    manifests.map(async (manifestPath) => {
      const directory = path.dirname(manifestPath);
      const manifest = await readJson(manifestPath);
      return { directory, manifest, workspace: path.relative(root, directory) || manifest.name || '.' };
    }),
  );
}

function packageNameFromLockPath(lockPath) {
  const parts = lockPath.split('/');
  const marker = parts.lastIndexOf('node_modules');
  if (marker === -1 || marker === parts.length - 1) return null;
  const name = parts.slice(marker + 1);
  return name[0].startsWith('@') ? name.slice(0, 2).join('/') : name[0];
}

async function lockVersions(packageRoot) {
  const target = path.join(packageRoot, 'package-lock.json');
  if (!(await exists(target))) return new Map();
  const lock = await readJson(target);
  const versions = new Map();
  for (const [lockPath, entry] of Object.entries(lock.packages || {})) {
    const packageName = packageNameFromLockPath(lockPath);
    if (!packageName || !entry.version) continue;
    const known = versions.get(packageName) || new Set();
    known.add(String(entry.version));
    versions.set(packageName, known);
  }
  return versions;
}

async function directorySize(target) {
  let total = 0;
  async function visit(current) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) return;
    if (stat.isFile()) {
      total += stat.size;
      return;
    }
    if (stat.isDirectory()) {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) await visit(path.join(current, entry.name));
    }
  }
  await visit(target);
  return total;
}

async function installedSize(packageRoot, packageName) {
  const target = path.join(packageRoot, 'node_modules', ...packageName.split('/'));
  if (!(await exists(target))) return { size_bytes: null, size_status: 'unavailable' };
  return { size_bytes: await directorySize(target), size_status: 'observed' };
}

function parseAliases(tsconfig) {
  const paths = tsconfig?.compilerOptions?.paths || {};
  return Object.entries(paths)
    .map(([pattern, destinations]) => ({ pattern, destination: destinations?.[0] }))
    .filter(({ destination }) => typeof destination === 'string')
    .sort((left, right) => compareText(left.pattern, right.pattern));
}

async function aliasesFor(packageRoot) {
  const target = path.join(packageRoot, 'tsconfig.json');
  if (!(await exists(target))) return [];
  return parseAliases(await readJson(target));
}

function importSpecifiers(source) {
  const results = [];
  const expression = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(expression)) results.push(match[1] || match[2]);
  return results;
}

async function resolveSource(base, candidate) {
  const choices = SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`);
  choices.push(...SOURCE_EXTENSIONS.map((extension) => path.join(candidate, `index${extension}`)));
  for (const target of choices) if (await exists(target)) return target;
  return null;
}

function aliasTarget(specifier, aliases, packageRoot) {
  for (const { pattern, destination } of aliases) {
    const marker = pattern.indexOf('*');
    if (marker === -1 && specifier === pattern) return path.resolve(packageRoot, destination);
    if (marker !== -1 && specifier.startsWith(pattern.slice(0, marker))) {
      return path.resolve(packageRoot, destination.replace('*', specifier.slice(marker)));
    }
  }
  return null;
}

async function internalEdges(root, workspaces) {
  const edges = [];
  for (const workspace of workspaces) {
    const aliases = await aliasesFor(workspace.directory);
    const files = await walk(workspace.directory, (target) =>
      SOURCE_EXTENSIONS.includes(path.extname(target)) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(target),
    );
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        let target = null;
        if (specifier.startsWith('.')) target = await resolveSource(path.dirname(file), path.resolve(path.dirname(file), specifier));
        else {
          const alias = aliasTarget(specifier, aliases, workspace.directory);
          if (alias) target = await resolveSource(workspace.directory, alias);
        }
        if (!target) continue;
        edges.push({
          from: toPosix(path.relative(root, file)),
          to: toPosix(path.relative(root, target)),
          via: specifier,
        });
      }
    }
  }
  return edges.sort((left, right) =>
    compareText(`${left.from}\u0000${left.to}\u0000${left.via}`, `${right.from}\u0000${right.to}\u0000${right.via}`),
  );
}

function findCycles(edges) {
  const nodes = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))].sort(compareText);
  const adjacency = new Map(nodes.map((node) => [node, []]));
  for (const edge of edges) adjacency.get(edge.from).push(edge.to);
  for (const values of adjacency.values()) values.sort(compareText);
  let index = 0;
  const stack = [];
  const indexes = new Map();
  const lows = new Map();
  const active = new Set();
  const cycles = [];
  function visit(node) {
    indexes.set(node, index);
    lows.set(node, index);
    index += 1;
    stack.push(node);
    active.add(node);
    for (const next of adjacency.get(node)) {
      if (!indexes.has(next)) {
        visit(next);
        lows.set(node, Math.min(lows.get(node), lows.get(next)));
      } else if (active.has(next)) {
        lows.set(node, Math.min(lows.get(node), indexes.get(next)));
      }
    }
    if (lows.get(node) !== indexes.get(node)) return;
    const members = [];
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      members.push(member);
    } while (member !== node);
    const hasSelfLoop = members.length === 1 && adjacency.get(node).includes(node);
    if (members.length > 1 || hasSelfLoop) {
      cycles.push({ members: members.sort(compareText), type: 'internal-import-cycle' });
    }
  }
  for (const node of nodes) if (!indexes.has(node)) visit(node);
  return cycles.sort((left, right) => compareText(left.members.join('\u0000'), right.members.join('\u0000')));
}

function recommendationsFor(cycles, duplicates, dependencies) {
  const recommendations = [];
  for (const cycle of cycles) {
    recommendations.push({
      priority: 'P0',
      kind: 'internal-import-cycle',
      evidence: cycle.members,
      impact: 'Mutually dependent modules make ownership and safe change boundaries unclear.',
      next_action: 'Extract a one-way interface or shared value module, then remove one import edge.',
    });
  }
  for (const duplicate of duplicates) {
    const directProduction = dependencies.some(
      (dependency) => dependency.package === duplicate.package && dependency.kind === 'production' && dependency.direct,
    );
    recommendations.push({
      priority: directProduction ? 'P1' : 'P2',
      kind: 'duplicate-resolution',
      evidence: [`${duplicate.package}: ${duplicate.versions.join(', ')}`],
      impact: 'Multiple resolved versions increase install surface and update coordination.',
      next_action: 'Confirm the dependency paths, then align constraints if the versions are compatible.',
    });
  }
  for (const dependency of dependencies.filter((item) => item.kind === 'development' || item.kind === 'peer')) {
    recommendations.push({
      priority: 'P3',
      kind: 'dependency-inventory',
      evidence: [`${dependency.workspace}/package.json: ${dependency.package}`],
      impact: 'Classification is recorded for future maintenance decisions.',
      next_action: 'Keep this dependency classification current when its use changes.',
    });
  }
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return recommendations.sort((left, right) =>
    order[left.priority] - order[right.priority] || compareText(left.kind, right.kind) || compareText(left.evidence.join('\u0000'), right.evidence.join('\u0000')),
  );
}

export async function analyzeRepository(root) {
  const absoluteRoot = path.resolve(root);
  const workspaces = (await packageRoots(absoluteRoot)).sort((left, right) => compareText(left.workspace, right.workspace));
  const dependencies = [];
  const allLockVersions = new Map();
  for (const workspace of workspaces) {
    const resolved = await lockVersions(workspace.directory);
    for (const [packageName, versions] of resolved) {
      const combined = allLockVersions.get(packageName) || new Set();
      for (const version of versions) combined.add(version);
      allLockVersions.set(packageName, combined);
    }
    const direct = new Set();
    for (const [section, kind] of DEPENDENCY_SECTIONS) {
      for (const [packageName, requestedVersion] of Object.entries(workspace.manifest[section] || {}).sort(([left], [right]) => compareText(left, right))) {
        direct.add(packageName);
        dependencies.push({
          workspace: workspace.workspace,
          package: packageName,
          kind,
          direct: true,
          requested_version: requestedVersion,
          resolved_versions: [...(resolved.get(packageName) || [])].sort(compareText),
          ...(await installedSize(workspace.directory, packageName)),
          usage_locations: [],
        });
      }
    }
    for (const [packageName, versions] of [...resolved.entries()].sort(([left], [right]) => compareText(left, right))) {
      if (direct.has(packageName)) continue;
      dependencies.push({
        workspace: workspace.workspace,
        package: packageName,
        kind: 'transitive',
        direct: false,
        requested_version: null,
        resolved_versions: [...versions].sort(compareText),
        ...(await installedSize(workspace.directory, packageName)),
        usage_locations: [],
      });
    }
  }
  dependencies.sort((left, right) => compareText(`${left.workspace}\u0000${left.package}\u0000${left.kind}`, `${right.workspace}\u0000${right.package}\u0000${right.kind}`));
  const directWorkspaceCounts = new Map();
  for (const dependency of dependencies.filter((item) => item.direct)) {
    directWorkspaceCounts.set(dependency.package, (directWorkspaceCounts.get(dependency.package) || 0) + 1);
  }
  for (const dependency of dependencies) {
    dependency.downstream_count = dependency.direct
      ? Math.max(0, (directWorkspaceCounts.get(dependency.package) || 1) - 1)
      : 0;
  }
  const edges = await internalEdges(absoluteRoot, workspaces);
  const cycles = findCycles(edges);
  const duplicates = [...allLockVersions.entries()]
    .filter(([, versions]) => versions.size > 1)
    .map(([packageName, versions]) => ({ package: packageName, versions: [...versions].sort(compareText) }))
    .sort((left, right) => compareText(left.package, right.package));
  const packages = workspaces.map((workspace) => ({
    workspace: workspace.workspace,
    name: workspace.manifest.name || workspace.workspace,
    manifest: toPosix(path.relative(absoluteRoot, path.join(workspace.directory, 'package.json'))),
  }));
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    root: absoluteRoot,
    source_files: [
      ...packages.map((workspace) => workspace.manifest),
      ...edges.flatMap((edge) => [edge.from, edge.to]),
    ].filter((value, index, values) => values.indexOf(value) === index).sort(compareText),
    packages,
    dependencies,
    internal_edges: edges,
    cycles,
    duplicates,
    unavailable_measurements: dependencies.filter((item) => item.size_status === 'unavailable').map((item) => `${item.workspace}: ${item.package}`),
    recommendations: recommendationsFor(cycles, duplicates, dependencies),
  };
}

function mermaidId(index) {
  return `n${index}`;
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

export function renderMarkdown(report) {
  const packageNodes = report.packages.map((item, index) => [item.workspace, mermaidId(index)]);
  const moduleNodes = [...new Set(report.internal_edges.flatMap((edge) => [edge.from, edge.to]))];
  const moduleIds = new Map(moduleNodes.map((item, index) => [item, mermaidId(index)]));
  return [
    '# Dependency report',
    '',
    '## Scope',
    '',
    `- Repository root: \`${report.root}\``,
    `- Workspaces: ${report.packages.map((item) => `\`${item.workspace}\``).join(', ') || 'none'}`,
    `- Source files consulted: ${report.source_files.length}`,
    `- Installed-size measurements unavailable: ${report.unavailable_measurements.length ? report.unavailable_measurements.join(', ') : 'none'}`,
    '',
    '## Package graph',
    '',
    '```mermaid',
    'graph LR',
    ...packageNodes.map(([workspace, id]) => `  ${id}["${workspace}"]`),
    '```',
    '',
    '## Internal module graph',
    '',
    '```mermaid',
    'graph LR',
    ...moduleNodes.map((module) => `  ${moduleIds.get(module)}["${module}"]`),
    ...report.internal_edges.map((edge) => `  ${moduleIds.get(edge.from)} --> ${moduleIds.get(edge.to)}`),
    '```',
    '',
    '## Dependency inventory',
    '',
    '| Workspace | Package | Kind | Direct | Resolved versions | Other workspace users | Installed size |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.dependencies.map((item) => `| ${markdownCell(item.workspace)} | ${markdownCell(item.package)} | ${item.kind} | ${item.direct ? 'yes' : 'no'} | ${markdownCell(item.resolved_versions.join(', ') || 'unavailable')} | ${item.downstream_count} | ${item.size_status === 'observed' ? `${item.size_bytes} B` : 'unavailable'} |`),
    '',
    '## Findings and recommendations',
    '',
    '| Priority | Evidence | Impact | Next action |',
    '| --- | --- | --- | --- |',
    ...report.recommendations.map((item) => `| ${item.priority} | ${markdownCell(item.evidence.join('; '))} | ${markdownCell(item.impact)} | ${markdownCell(item.next_action)} |`),
    '',
  ].join('\n');
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    values[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!args.root || !args.json || !args.markdown) {
    throw new Error('Usage: analyze-dependencies.mjs --root <repository> --json <report.json> --markdown <report.md>');
  }
  const report = await analyzeRepository(args.root);
  await mkdir(path.dirname(path.resolve(args.json)), { recursive: true });
  await mkdir(path.dirname(path.resolve(args.markdown)), { recursive: true });
  await writeFile(args.json, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(args.markdown, renderMarkdown(report));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
