"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { AgentSkillLink, Skill, SkillType, SkillVersion } from "@devdigest/shared";

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

export interface UpdateSkillInput extends CreateSkillInput {
  id: string;
  expected_version: number;
  enabled: boolean;
}

export type SkillImportInput = { kind: "markdown"; markdown: string } | { kind: "zip"; zip_base64: string } | { kind: "url"; url: string };
export function useImportSkillPreview() {
  return useMutation({ mutationFn: (input: SkillImportInput) => api.post<Omit<Skill, "id" | "enabled" | "version" | "agent_count" | "evidence_files">>("/skills/import/preview", input) });
}
export function useImportSkill() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: SkillImportInput & { name?: string; description?: string }) => api.post<Skill>("/skills/import", input), onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }) });
}

export function useSkills() {
  return useQuery({ queryKey: ["skills"], queryFn: () => api.get<Skill[]>("/skills") });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({ queryKey: ["skill", id], queryFn: () => api.get<Skill>(`/skills/${id}`), enabled: Boolean(id) });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({ queryKey: ["skill-versions", id], queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`), enabled: Boolean(id) });
}

export function useRestoreSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, expectedVersion }: { id: string; version: number; expectedVersion: number }) => api.post<Skill>(`/skills/${id}/versions/${version}/restore`, { expected_version: expectedVersion }),
    onSuccess: (skill) => {
      qc.setQueryData(["skill", skill.id], skill);
      qc.setQueryData(["skills"], (skills: Skill[] | undefined) =>
        skills?.map((item) => item.id === skill.id ? skill : item),
      );
      qc.invalidateQueries({ queryKey: ["skill-versions", skill.id] });
    },
  });
}

export function useDeleteSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => api.del<{ ok: boolean }>(`/skills/${id}/versions/${version}`),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ["skill-versions", id] }),
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, input),
    onSuccess: (skill) => {
      qc.setQueryData(["skills"], (skills: Skill[] | undefined) =>
        skills?.map((item) => item.id === skill.id ? skill : item),
      );
      qc.setQueryData(["skill", skill.id], skill);
      qc.invalidateQueries({ queryKey: ["skill-versions", skill.id] });
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: Boolean(agentId),
  });
}

export function useReplaceAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillIds }: { agentId: string; skillIds: string[] }) =>
      api.post<AgentSkillLink[]>(`/agents/${agentId}/skills`, { skill_ids: skillIds }),
    onSuccess: (links, { agentId }) => qc.setQueryData(["agent-skills", agentId], links),
  });
}

export function useSetAgentSkillEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillId, enabled }: { agentId: string; skillId: string; enabled: boolean }) => api.patch<AgentSkillLink[]>(`/agents/${agentId}/skills/${skillId}`, { enabled }),
    onSuccess: (links, input) => qc.setQueryData(["agent-skills", input.agentId], links),
  });
}
