export interface OnboardingFact { id: string; kind: 'path' | 'command' | 'route' | 'dependency' | 'critical_path' | 'stack' | 'observation' | 'documentation' | 'architecture_edge'; value: string }
export interface OnboardingFile { path: string; rank: number | null }
export interface OnboardingEdge { fromFile: string; toFile: string }
export interface FactInput { files: Array<{ path: string; rank: number }>; edges: OnboardingEdge[]; facts: OnboardingFact[]; indexedCount: number | null; graphAvailable?: boolean; estimate: (facts: OnboardingFact[]) => number }

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function selectOnboardingFacts(input: FactInput) {
  const allPaths = new Set(input.files.map((f) => f.path));
  const usable = input.edges.filter((e) => e.fromFile !== e.toFile && allPaths.has(e.fromFile) && allPaths.has(e.toFile));
  const ranked = (input.graphAvailable ?? true) && usable.length > 0;
  const ordered = [...input.files].sort((a, b) => ranked ? b.rank - a.rank || compare(a.path, b.path) : compare(a.path, b.path));
  const files: OnboardingFile[] = ordered.slice(0, 5000).map(({ path, rank }) => ({ path, rank: ranked ? rank : null }));
  const selectedPaths = new Set(files.map((f) => f.path));
  const edges = usable.filter((e) => selectedPaths.has(e.fromFile) && selectedPaths.has(e.toFile)).sort((a, b) => compare(a.fromFile, b.fromFile) || compare(a.toFile, b.toFile));
  const rankOrder = new Map(files.map((file, index) => [file.path, index]));
  const kinds: OnboardingFact['kind'][] = ['architecture_edge', 'documentation', 'stack', 'command', 'path', 'critical_path', 'route', 'observation', 'dependency'];
  const buckets = kinds.map((kind) => input.facts.filter((fact) => fact.kind === kind).sort((a, b) =>
    (kind === 'path' ? (rankOrder.get(a.value) ?? Infinity) - (rankOrder.get(b.value) ?? Infinity) : 0) || compare(a.id, b.id) || compare(a.value, b.value)));
  const orderedFacts: OnboardingFact[] = [];
  for (let i = 0; buckets.some((bucket) => i < bucket.length); i++) {
    for (const bucket of buckets) if (bucket[i]) orderedFacts.push(bucket[i]!);
  }
  let low = 0;
  let high = orderedFacts.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (input.estimate(orderedFacts.slice(0, mid)) <= 12000) low = mid;
    else high = mid - 1;
  }
  const facts = orderedFacts.slice(0, low);
  const omittedFacts = orderedFacts.length - facts.length;
  return { files, edges, facts, ranked, hotnessAvailable: false, indexedCount: input.indexedCount,
    omittedFiles: input.indexedCount === null ? null : Math.max(0, input.indexedCount - files.length),
    omittedFacts, estimatedTokens: input.estimate(facts) };
}

/** Follow highest-ranked imports with lexical tie-breaking; never fabricate a rank or edge. */
export function buildCriticalPathFacts(files: Array<{ path: string; rank: number }>, edges: OnboardingEdge[]): string[][] {
  const rank = new Map(files.map((file) => [file.path, file.rank]));
  const ordered = [...files].sort((a, b) => b.rank - a.rank || compare(a.path, b.path));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!rank.has(edge.fromFile) || !rank.has(edge.toFile) || edge.fromFile === edge.toFile) continue;
    const targets = adjacency.get(edge.fromFile) ?? [];
    targets.push(edge.toFile);
    adjacency.set(edge.fromFile, targets);
  }
  const chains: string[][] = [];
  for (const root of ordered) {
    const chain = [root.path];
    while (chain.length < 4) {
      const targets = (adjacency.get(chain[chain.length - 1]!) ?? []).filter((target) => !chain.includes(target));
      targets.sort((a, b) => (rank.get(b) ?? 0) - (rank.get(a) ?? 0) || compare(a, b));
      if (!targets[0]) break;
      chain.push(targets[0]);
    }
    if (chain.length > 1) chains.push(chain);
  }
  const contained = new Set<string>();
  for (const chain of chains) for (let start = 0; start < chain.length - 1; start++) for (let end = start + 2; end <= chain.length; end++) {
    if (start !== 0 || end !== chain.length) contained.add(JSON.stringify(chain.slice(start, end)));
  }
  return chains.filter((chain) => !contained.has(JSON.stringify(chain))).slice(0, 5);
}
