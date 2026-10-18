"use client";

import { useQuery } from "@tanstack/react-query";
import type { BlastRadius } from "@/vendor/shared/contracts/brief";
import { api } from "../api";

export function useBlastRadius(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["blast-radius", prId],
    queryFn: () => api.get<BlastRadius>(`/pulls/${prId}/blast`),
    enabled: !!prId,
  });
}
