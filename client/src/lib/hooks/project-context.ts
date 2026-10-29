"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiFetch } from "../api";

export type ContextDocument = { path: string; availability: string; estimated_tokens: number };
export type ContextAttachment = { path: string; status: string; estimated_tokens: number };
type Owner = "agent" | "skill";
const base = (repoId: string) => `/repos/${repoId}/project-context`;

export function useProjectDocuments(repoId: string | null) {
  return useQuery({ queryKey: ["project-documents", repoId], enabled: !!repoId, queryFn: () => api.get<ContextDocument[]>(`${base(repoId!)}/documents`) });
}
export function useProjectDocument(repoId: string | null, path: string | null) {
  return useQuery({ queryKey: ["project-document", repoId, path], enabled: !!repoId && !!path, queryFn: () => api.get<{ path: string; content: string; used_by_agents: number }>(`${base(repoId!)}/documents/${encodeURIComponent(path!)}`) });
}
export function useResolvedProjectContext(repoId: string | null, agentId: string | null) {
  return useQuery({ queryKey: ["project-resolved", repoId, agentId], enabled: !!repoId && !!agentId, queryFn: () => api.get<{ documents: { path: string; provenance: string[] }[]; skipped: { path: string; provenance: string[] }[] }>(`${base(repoId!)}/agent/${agentId}/resolved`) });
}
export function useProjectAttachments(repoId: string | null, owner: Owner, ownerId: string) {
  const queryClient = useQueryClient();
  const key = ["project-attachments", repoId, owner, ownerId];
  const url = `${base(repoId ?? "")}/${owner}/${ownerId}/attachments`;
  const query = useQuery({ queryKey: key, enabled: !!repoId, queryFn: () => api.get<ContextAttachment[]>(url) });
  const change = useMutation({
    mutationFn: ({ path, attached }: { path: string; attached: boolean }) => apiFetch<void>(url, { method: attached ? "POST" : "DELETE", body: JSON.stringify({ path }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: key }); void queryClient.invalidateQueries({ queryKey: ["project-resolved", repoId] }); void queryClient.invalidateQueries({ queryKey: ["project-document", repoId] }); },
  });
  const reorder = useMutation({ mutationFn: (paths: string[]) => api.put<void>(`${url}/order`, { paths }), onSettled: () => queryClient.invalidateQueries({ queryKey: key }) });
  return { query, change, reorder };
}
