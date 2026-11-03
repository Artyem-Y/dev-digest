import { z } from 'zod';

import { PullDetail as PullDetailSchema } from '../vendor/shared/pulls';

export type PullDetail = z.infer<typeof PullDetailSchema>;

export async function getPull(id: string): Promise<PullDetail> {
  const response = await fetch(`/api/pulls/${id}`);
  return PullDetailSchema.parse(await response.json());
}
