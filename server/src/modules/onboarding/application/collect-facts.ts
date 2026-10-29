import { assembleOnboardingPrompt, estimateOnboardingPromptTokens } from '@devdigest/reviewer-core';
import { createHash } from 'node:crypto';
import { selectOnboardingFacts, buildCriticalPathFacts, type OnboardingFact } from '../domain/facts.js';
import type { OnboardingIndexPort, OnboardingSourcePort } from './ports.js';

/** The source port must already be authorized and pinned to the snapshot revision. */
export async function collectOnboardingFacts(index: OnboardingIndexPort, source: OnboardingSourcePort | null, repoId: string) {
  const snapshot = await index.getOnboardingSnapshot(repoId);
  const facts: OnboardingFact[] = [];
  const id = (kind: string, value: string) => `${kind}:${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
  for (const file of snapshot?.files ?? []) facts.push({ id: id('path', file.path), kind: 'path', value: file.path });
  for (const edge of snapshot?.edges ?? []) {
    const value = `${edge.fromFile} -> ${edge.toFile}`;
    facts.push({ id: id('dependency', value), kind: 'dependency', value });
  }
  if (snapshot?.graphAvailable) {
    for (const chain of buildCriticalPathFacts(snapshot.files, snapshot.edges)) {
      const value = chain.join(' -> ');
      facts.push({ id: id('critical', value), kind: 'critical_path', value });
    }
  }
  for (const file of snapshot?.fileFacts ?? []) {
    if (!Array.isArray(file.endpoints)) continue;
    for (const endpoint of file.endpoints) {
      if (typeof endpoint !== 'string' || endpoint.length > 500) continue;
      const value = `${endpoint} (${file.path})`;
      facts.push({ id: id('route', value), kind: 'route', value });
    }
  }
  let sourceAvailable = false;
  if (source && snapshot?.state?.lastIndexedSha && source.revision === snapshot.state.lastIndexedSha && await source.available()) {
    sourceAvailable = true;
    const eligible = (snapshot.files ?? []).filter((file) => /\.(?:ts|tsx|js|jsx|go|py|rs|java)$/.test(file.path)).slice(0, 20);
    for (const file of eligible) {
      const content = await source.read(file.path);
      if (content === null) continue;
      const lines = content.split('\n');
      for (let line = 0; line < lines.length; line++) {
        if (/\bTODO\b/.test(lines[line]!)) {
          const value = `TODO at ${file.path}:${line + 1}`;
          facts.push({ id: id('todo', value), kind: 'observation', value });
          break;
        }
      }
    }
    const makefile = await source.read('Makefile');
    if (makefile !== null) {
      const targets = new Set<string>();
      for (const line of makefile.split('\n')) {
        const match = /^([A-Za-z0-9_][A-Za-z0-9_.-]*):(?!=)/.exec(line);
        if (match?.[1] && /^(?:run|start|serve|dev|test)(?:[-_][A-Za-z0-9_-]+)?$/.test(match[1])) targets.add(match[1]);
      }
      for (const target of [...targets].sort()) facts.push({ id: `make:${target}`, kind: 'command', value: `make ${target}` });
    }
    const goModule = await source.read('go.mod');
    if (goModule !== null && /^module\s+\S+/m.test(goModule)) facts.push({ id: 'stack:go', kind: 'stack', value: 'Go (go.mod)' });
    const packageDirs = [...new Set((snapshot.files ?? []).map((file) => file.path.split('/')[0]).filter((part): part is string => !!part && /^[A-Za-z0-9_-]+$/.test(part)))].sort().slice(0, 20);
    for (const dir of ['', ...packageDirs.slice(0, 10)]) {
      const path = dir ? `${dir}/README.md` : 'README.md';
      const documentation = await source.read(path);
      if (!documentation) continue;
      if (!dir) {
        const block = /(?:^|\n)#{1,3}\s+architecture[^\n]*\n[\s\S]*?```mermaid\s*\n([\s\S]*?)```/i.exec(documentation)?.[1];
        if (block && block.length <= 16000) {
          const nodes = new Map<string, string>();
          for (const match of block.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*\[\(?"([^"\n]+)"\)?\]/g)) {
            const label = match[2]!.split(/<br\s*\/?\s*>/i)[0]!.trim();
            if (/^[A-Za-z0-9_@/ .()+-]{1,60}$/.test(label)) nodes.set(match[1]!, label);
          }
          for (const match of block.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*(?:\[\(?"[^"\n]+"\)?\])?\s*(?:-->|-\.->)\s*(?:\|"[^"\n]*"\|\s*)?([A-Za-z][A-Za-z0-9_]*)/g)) {
            const from = nodes.get(match[1]!); const to = nodes.get(match[2]!);
            if (from && to && from !== to) { const value = `${from} -> ${to}`; facts.push({ id: id('architecture', `${path}:${value}`), kind: 'architecture_edge', value }); }
          }
        }
      }
      const paragraphs = documentation.replace(/^#{1,6}\s.*$/gm, '').split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\n/g, ' ').trim());
      let count = 0;
      for (const paragraph of paragraphs) {
        if (paragraph.startsWith('#') || paragraph.startsWith('-') || paragraph.startsWith('>') || paragraph.startsWith('```')) continue;
        const sentence = paragraph.match(/^[A-Za-z][A-Za-z0-9 ,():+/-]{15,298}\./)?.[0];
        if (!sentence || /\b(?:secret|password|token|api key|credential)\b/i.test(sentence)) continue;
        facts.push({ id: id('documentation', `${path}:${sentence}`), kind: 'documentation', value: sentence });
        if (++count === 3) break;
      }
    }
    for (const dir of ['', ...packageDirs]) {
    const manifest = await source.read(dir ? `${dir}/package.json` : 'package.json');
    if (manifest !== null) {
      try {
        const parsed: unknown = JSON.parse(manifest);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const data = parsed as Record<string, unknown>;
          facts.push({ id: dir ? id('stack', dir) : 'stack:node', kind: 'stack', value: 'Node.js (package.json)' });
          for (const key of ['dependencies', 'devDependencies']) {
            const deps = data[key];
            if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
            for (const name of Object.keys(deps).sort()) {
              if (/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) facts.push({ id: id('package', name), kind: 'dependency', value: name });
            }
          }
          if (data.scripts && typeof data.scripts === 'object' && !Array.isArray(data.scripts)) {
            for (const [name, command] of Object.entries(data.scripts).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
              if (/^[a-zA-Z0-9:_-]+$/.test(name) && typeof command === 'string') facts.push({ id: dir ? id('script', `${dir}/${name}`) : `script:${name}`, kind: 'command', value: `${dir ? `cd ${dir} && ` : ''}npm run ${name}` });
            }
          }
        }
      } catch { /* malformed manifests add no facts */ }
    }
    }
  }
  const selected = selectOnboardingFacts({ files: snapshot?.files ?? [], edges: snapshot?.edges ?? [], indexedCount: snapshot?.indexedCount ?? null, graphAvailable: snapshot?.graphAvailable ?? false, estimate: (items) => estimateOnboardingPromptTokens(assembleOnboardingPrompt(items)), facts });
  const limitations: string[] = [];
  if (!sourceAvailable) limitations.push('Repository source unavailable');
  if (sourceAvailable) limitations.push('TODO scan is limited to the first match in 20 source files');
  if (!snapshot?.state || snapshot.state.status !== 'full') limitations.push('Index is unavailable or incomplete');
  if (snapshot?.edgesMayBeTruncated) limitations.push('Dependency edges may be truncated');
  if (!selected.ranked) limitations.push('Reading path is unranked');
  if (!selected.hotnessAvailable) limitations.push('File hotness is unavailable');
  if (selected.omittedFiles || selected.omittedFacts) limitations.push('Input was truncated');
  return { ...selected, sourceAvailable, sourceRevision: snapshot?.state?.lastIndexedSha || null, indexStatus: snapshot?.state?.status ?? 'unavailable', limitations };
}
