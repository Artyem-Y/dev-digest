/** Deterministic scoring of independently replayed, single-anchor cases. */
export interface Anchor {
  file: string;
  startLine: number;
  endLine: number;
}

export interface ScoredCase {
  expectation: 'must_find' | 'must_not_flag';
  anchor: Anchor;
  /** Findings that survived the reviewer's grounding gate. */
  grounded: Anchor[];
  /** Number rejected by the same gate, including full-file gate behavior. */
  dropped: number;
}

export interface CaseScore {
  passed: boolean;
  matched: boolean;
  unlabeled: number;
}

export interface EvalScore {
  cases: CaseScore[];
  counts: {
    positive: number;
    truePositive: number;
    knownFalsePositive: number;
    unlabeled: number;
    grounded: number;
    dropped: number;
  };
  recall: number | null;
  precision: number | null;
  citationAccuracy: number | null;
}

/** Normalize harmless relative-path syntax without resolving traversal. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '').replace(/\/+/g, '/');
}

export function anchorsOverlap(a: Anchor, b: Anchor): boolean {
  return normalizePath(a.file) === normalizePath(b.file)
    && Math.min(a.startLine, a.endLine) <= Math.max(b.startLine, b.endLine)
    && Math.min(b.startLine, b.endLine) <= Math.max(a.startLine, a.endLine);
}

/**
 * Match at most once per case. Outside-anchor findings are unlabeled, with
 * exact duplicate locations counted once. Grounding counts retain every
 * prediction because citation accuracy measures the gate, not deduplication.
 */
export function scoreCases(inputs: readonly ScoredCase[]): EvalScore {
  const counts = { positive: 0, truePositive: 0, knownFalsePositive: 0, unlabeled: 0, grounded: 0, dropped: 0 };
  const cases = inputs.map((input): CaseScore => {
    const matched = input.grounded.some((finding) => anchorsOverlap(input.anchor, finding));
    const unlabeled = new Set(input.grounded.filter((finding) => !anchorsOverlap(input.anchor, finding))
      .map((finding) => `${normalizePath(finding.file)}:${Math.min(finding.startLine, finding.endLine)}:${Math.max(finding.startLine, finding.endLine)}`)).size;
    if (input.expectation === 'must_find') {
      counts.positive++;
      if (matched) counts.truePositive++;
    } else if (matched) counts.knownFalsePositive++;
    counts.unlabeled += unlabeled;
    counts.grounded += input.grounded.length;
    counts.dropped += input.dropped;
    return { matched, unlabeled, passed: input.expectation === 'must_find' ? matched : !matched };
  });
  const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
  return {
    cases, counts,
    recall: ratio(counts.truePositive, counts.positive),
    precision: ratio(counts.truePositive, counts.truePositive + counts.knownFalsePositive),
    citationAccuracy: ratio(counts.grounded, counts.grounded + counts.dropped),
  };
}
