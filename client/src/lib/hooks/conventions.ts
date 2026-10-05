"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ConventionCandidate, Skill } from "@devdigest/shared";

export function useConventions(repoId: string | undefined) {
  return useQuery({ queryKey: ["conventions", repoId], queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`), enabled: Boolean(repoId) });
}

export function useScanConventions() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (repoId: string) => api.post<ConventionCandidate[]>(`/repos/${repoId}/conventions/extract`), onSuccess: (_data, repoId) => qc.invalidateQueries({ queryKey: ["conventions", repoId] }) });
}

export function useUpdateConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, id, ...body }: { repoId: string; id: string; status: ConventionCandidate["status"]; rule?: string }) => api.patch<ConventionCandidate>(`/repos/${repoId}/conventions/${id}`, body),
    onSuccess: (_data, input) => qc.invalidateQueries({ queryKey: ["conventions", input.repoId] }),
  });
}

export function useCreateConventionsSkill() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ repoId, name, description, body, agentId }: { repoId: string; name?: string; description?: string; body?: string; agentId?: string }) => api.post<Skill>(`/repos/${repoId}/conventions/create-skill`, { name, description, body, agent_id: agentId }), onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }) });
}
