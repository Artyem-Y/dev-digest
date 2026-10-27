"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BriefGenerateResponse } from "@devdigest/shared";
import { api } from "../api";

const briefKey = (prId: string | null | undefined) => ["pr-brief", prId] as const;

/** Read the persisted Brief only while the Overview is visible; this never generates one. */
export function useBrief(prId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: briefKey(prId),
    queryFn: () => api.get<BriefGenerateResponse>(`/pulls/${prId}/brief`),
    enabled: !!prId && enabled,
  });
}

/** Generation is deliberately explicit: callers invoke mutate from the Generate action. */
export function useGenerateBrief(prId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<BriefGenerateResponse>(`/pulls/${prId}/brief`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: briefKey(prId) }),
  });
}
