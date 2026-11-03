import { z } from 'zod';

export const PullDetail = z.object({
  id: z.string(),
  title: z.string(),
  reviewSummary: z.string().nullable(),
});
