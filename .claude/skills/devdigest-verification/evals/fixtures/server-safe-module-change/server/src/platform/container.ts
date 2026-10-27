export type Container = {
  pulls: { getSummary(workspaceId: string, pullId: string): Promise<string | null> };
};
