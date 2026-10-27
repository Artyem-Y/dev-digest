export type AttachmentProvenance = 'direct_agent' | 'linked_skill';
export type SkipReason = 'missing' | 'unreadable' | 'no_longer_eligible';

export interface ProjectContextAttachment {
  path: string;
  provenance: AttachmentProvenance;
  skillId?: string;
}

export interface ResolvedProjectDocument {
  path: string;
  content: string;
  estimatedTokens: number;
  provenance: AttachmentProvenance[];
}

export interface SkippedProjectDocument {
  path: string;
  reason: SkipReason;
  provenance: AttachmentProvenance[];
}

export interface ResolvedBriefContext {
  documents: ResolvedProjectDocument[];
  skipped: SkippedProjectDocument[];
}
