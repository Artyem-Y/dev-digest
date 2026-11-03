export type PullDetail = { id: string; title: string };

export async function getPull(id: string): Promise<PullDetail> {
  const response = await fetch(`/api/pulls/${id}`);
  return response.json();
}
