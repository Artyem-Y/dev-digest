export interface SmartDiffPull {
  id: string;
}

export interface SmartDiffFileRow {
  path: string;
  additions: number;
  deletions: number;
}

export interface SmartDiffReviewRow {
  id: string;
  agentId: string | null;
  kind: string;
  createdAt: Date;
}

export interface SmartDiffFindingRow {
  file: string;
  startLine: number;
}

export interface SmartDiffReadPort {
  getPull(workspaceId: string, prId: string): Promise<SmartDiffPull | undefined>;
  getPrFiles(prId: string): Promise<SmartDiffFileRow[]>;
  currentReviewsForPull(prId: string): Promise<{ review: SmartDiffReviewRow; findings: SmartDiffFindingRow[] }[]>;
}
