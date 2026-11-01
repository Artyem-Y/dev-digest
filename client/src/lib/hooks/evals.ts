import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EvalPipelineCase, EvalPipelineRun } from "@devdigest/shared";
import { api } from "@/lib/api";

export function useEvalCases(agentId: string) {
  return useQuery({ queryKey: ["eval-cases", agentId], queryFn: () => api.get<EvalPipelineCase[]>(`/agents/${agentId}/eval-cases`) });
}
export function useEvalCase(agentId: string, caseId: string | null) {
  return useQuery({ queryKey: ["eval-case", agentId, caseId], queryFn: () => api.get<EvalPipelineCase & { diff: string }>(`/agents/${agentId}/eval-cases/${caseId}`), enabled: !!caseId });
}
export function useManageEvalCase(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ caseId, name }: { caseId: string; name?: string }) => name === undefined
    ? api.del<{ ok: true }>(`/agents/${agentId}/eval-cases/${caseId}`)
    : api.patch<{ ok: true }>(`/agents/${agentId}/eval-cases/${caseId}`, { name }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["eval-cases", agentId] }); void queryClient.invalidateQueries({ queryKey: ["eval-case", agentId] }); } });
}
export type ManualEvalInput = { name: string; diff: string; expectation: "must_find" | "must_not_flag"; anchor: { file: string; start_line: number; end_line: number } };
export function useSaveManualEvalCase(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ caseId, input }: { caseId: string | null; input: ManualEvalInput }) => caseId
    ? api.put<EvalPipelineCase>(`/agents/${agentId}/eval-cases/${caseId}`, input)
    : api.post<EvalPipelineCase>(`/agents/${agentId}/eval-cases`, input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["eval-cases", agentId] }); void queryClient.invalidateQueries({ queryKey: ["eval-case", agentId] }); } });
}
export function useEvalRuns(agentId?: string) {
  return useQuery({ queryKey: ["eval-runs", agentId ?? "all"], queryFn: () => api.get<EvalPipelineRun[]>(agentId ? `/agents/${agentId}/eval-runs` : "/eval-dashboard"),
    refetchInterval: (query) => query.state.data?.some((run) => run.status === "queued" || run.status === "running") ? 1500 : false });
}
export type PreparedEvalFixture = { id: string; anchor: { file: string; startLine: number; endLine: number }; diff: string; metadata: { title: string; description: string | null } };
export function useEvalFixtures(enabled: boolean) {
  return useQuery({ queryKey: ["eval-fixtures"], queryFn: () => api.get<PreparedEvalFixture[]>("/eval-fixtures"), enabled });
}
export function useCreateEvalCase() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ findingId }: { findingId: string }) => api.post<EvalPipelineCase>(`/findings/${findingId}/eval-cases`, {}),
    onSuccess: (item) => { void queryClient.invalidateQueries({ queryKey: ["eval-cases", item.agent_id] }); } });
}
export function useStartEval() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (agentId: string) => api.post<EvalPipelineRun>(`/agents/${agentId}/eval-runs`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["eval-runs"] }); } });
}
export function useStartEvalCase() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ agentId, caseId }: { agentId: string; caseId: string }) => api.post<EvalPipelineRun>(`/agents/${agentId}/eval-cases/${caseId}/runs`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["eval-runs"] }); } });
}
export function usePromoteEvalRun() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ agentId, runId, expectedVersion }: { agentId: string; runId: string; expectedVersion: number }) => api.post<{ version: number }>(`/agents/${agentId}/eval-runs/${runId}/promote`, { expected_version: expectedVersion }),
    onSuccess: (_result, input) => { void queryClient.invalidateQueries({ queryKey: ["agents"] }); void queryClient.invalidateQueries({ queryKey: ["agent", input.agentId] }); } });
}
