'use client';
import { useId } from 'react';

type Edge = { from: string; to: string; key: string };

/** Lay out directed acyclic connections left to right. Cycles remain visible. */
export function ArchitectureGraph({ edges, label }: { edges: Edge[]; label: string }) {
  const marker = `tour-arrow-${useId().replace(/:/g, '')}`;
  if (!edges.length) return null;
  const nodes = [...new Set(edges.flatMap(({ from, to }) => [from, to]))].sort();
  const indegree = new Map(nodes.map((node) => [node, 0]));
  for (const { to } of edges) indegree.set(to, indegree.get(to)! + 1);
  const depth = new Map(nodes.map((node) => [node, 0]));
  const queue = nodes.filter((node) => indegree.get(node) === 0);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]!;
    for (const edge of edges.filter((item) => item.from === node)) {
      depth.set(edge.to, Math.max(depth.get(edge.to)!, depth.get(node)! + 1));
      indegree.set(edge.to, indegree.get(edge.to)! - 1);
      if (indegree.get(edge.to) === 0) queue.push(edge.to);
    }
  }
  const columns = new Map<number, string[]>();
  for (const node of nodes) { const col = depth.get(node)!; columns.set(col, [...(columns.get(col) ?? []), node]); }
  const rows = Math.max(...[...columns.values()].map((column) => column.length));
  const positions = new Map<string, { x: number; y: number }>();
  for (const [column, items] of columns) items.forEach((node, index) => positions.set(node, { x: 24 + column * 250, y: 28 + (rows - items.length) * 42 + index * 84 }));
  const width = 220 + Math.max(...depth.values()) * 250;
  const height = Math.max(120, 56 + rows * 84);
  const description = edges.map(({ from, to }) => `${from} → ${to}`).join('; ');
  return <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)' }}><svg role="img" aria-label={`${label}: ${description}`} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', minWidth: width, width: '100%', maxHeight: 600 }}>
    <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6" fill="none" stroke="var(--text-muted)" /></marker></defs>
    {edges.map(({ from, to, key }) => { const a = positions.get(from)!; const b = positions.get(to)!; const forward = b.x > a.x; const start = forward ? a.x + 180 : a.x; const end = forward ? b.x : b.x + 180; const middle = (start + end) / 2; return <path key={key} d={`M ${start} ${a.y + 20} C ${middle} ${a.y + 20}, ${middle} ${b.y + 20}, ${end} ${b.y + 20}`} fill="none" stroke="var(--text-muted)" markerEnd={`url(#${marker})`} />; })}
    {nodes.map((node) => { const pos = positions.get(node)!; return <g key={node} transform={`translate(${pos.x},${pos.y})`}><title>{node}</title><rect width="180" height="40" rx="8" fill="var(--bg-surface)" stroke="var(--accent)" /><text x="90" y="24" textAnchor="middle" fontSize="11" fill="var(--text-primary)" fontFamily="monospace">{node.length > 25 ? `…${node.slice(-24)}` : node}</text></g>; })}
  </svg></div>;
}
