/** Keep the newest completed review for each agent without mutating caller data. */
export interface ReviewIdentity {
  id: string;
  agent_id: string | null;
  kind: string;
  created_at: string;
}

export function selectLatestReviewsPerAgent<T extends ReviewIdentity>(rows: readonly T[]): T[] {
  const seen = new Set<string | null>();
  return [...rows]
    .filter((row) => row.kind === 'review')
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .filter((row) => {
      if (seen.has(row.agent_id)) return false;
      seen.add(row.agent_id);
      return true;
    });
}
