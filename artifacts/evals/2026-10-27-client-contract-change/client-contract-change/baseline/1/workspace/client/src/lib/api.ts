export type PullDetail = { id: string; title: string; reviewSummary: string | null };

export async function getPull(id: string): Promise<PullDetail> {
  const response = await fetch(`/api/pulls/${id}`);
  return response.json();
}
