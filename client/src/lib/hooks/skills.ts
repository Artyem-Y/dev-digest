"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { AgentSkillLink, Skill, SkillType } from "@devdigest/shared";

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

export function useSkills() {
  return useQuery({ queryKey: ["skills"], queryFn: () => api.get<Skill[]>("/skills") });
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
    onSuccess: (skill) => qc.setQueryData(["skills"], (skills: Skill[] | undefined) =>
      skills?.map((item) => item.id === skill.id ? skill : item),
    ),
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
