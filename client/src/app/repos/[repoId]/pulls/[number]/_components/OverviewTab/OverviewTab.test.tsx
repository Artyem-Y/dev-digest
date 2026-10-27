import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../../../../../../../messages/en/prReview.json';
import blastMessages from '../../../../../../../../messages/en/blast.json';
import briefMessages from '../../../../../../../../messages/en/brief.json';
import { OverviewTab } from './OverviewTab';

describe('OverviewTab intent', () => {
  it('separates Brief summary, generated risk areas, and review focus into design regions', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages, brief: briefMessages }}>
        <OverviewTab
          prBody={null}
          review={{
            verdict: 'request_changes',
            summary: 'Two blockers must be fixed before merge.',
            score: 61,
            findingsCount: 6,
            blockers: 2,
          }}
          brief={{
            cache: {
              cache_state: 'current',
              brief: {
                summary: 'Rate limiting protects public endpoints.',
                head_sha: 'a1b2c3',
                intent: { intent: 'Protect APIs', in_scope: [], out_of_scope: [] },
                blast: { changed_symbols: [], downstream: [], summary: '', degraded: false, reason: null },
                history: { history: [] },
                risks: { risks: [{ kind: 'security', title: 'Missing retry header', explanation: 'Clients need a retry window.', severity: 'high', file_refs: ['src/limit.ts'] }] },
                review_focus: [{ file: 'src/limit.ts', line: 42, reason: 'Check the limit branch.' }],
              },
            },
            sources: [],
          }}
        />
      </NextIntlClientProvider>,
    );

    const summary = screen.getByTestId('brief-summary-card');
    const analysis = screen.getByTestId('overview-analysis-grid');
    const focus = screen.getByTestId('brief-review-focus');
    expect(summary.compareDocumentPosition(analysis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(analysis.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(analysis).getByText(/Missing retry header/)).toBeInTheDocument();
    expect(within(analysis).getByTestId("brief-risk-areas")).toBeInTheDocument();
    expect(within(analysis).getByTestId("brief-risk-area-0")).toHaveAttribute("style", expect.stringContaining("border: 1px solid var(--border)"));
    expect(within(focus).getByText('src/limit.ts:42')).toBeInTheDocument();
    expect(screen.getByText('Request changes')).toBeInTheDocument();
    expect(screen.getByText('6 findings · 2 blockers')).toBeInTheDocument();
    expect(screen.getByLabelText('PR score: 61')).toBeInTheDocument();
  });

  it('places Blast Radius beside Intent inside the overview analysis grid', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages, brief: briefMessages }}>
        <OverviewTab
          prBody={null}
          repoFullName="acme/payments-api"
          headSha="a1b2c3"
          blast={{
            changed_symbols: [{ name: 'rateLimit', file: 'src/limit.ts', kind: 'function' }],
            downstream: [{ symbol: 'rateLimit', callers: [], endpoints_affected: [], crons_affected: [] }],
            summary: '1 symbol · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
          }}
        />
      </NextIntlClientProvider>,
    );

    const grid = screen.getByTestId('overview-analysis-grid');
    expect(grid).toHaveStyle({ display: 'grid' });
    expect(within(grid).getByText('Intent')).toBeInTheDocument();
    expect(within(grid).getByLabelText('Blast radius')).toBeInTheDocument();
  });

  it('keeps Blast Radius visible while its read-only map is loading', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: { loading: 'Loading Blast Radius…', unavailable: 'Blast Radius is unavailable.' }, brief: briefMessages }}>
        <OverviewTab prBody={null} blastLoading />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Loading Blast Radius…')).toBeInTheDocument();
  });

  it('names unavailable cached Intent and Blast Radius instead of rendering fallback placeholders', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages, brief: briefMessages }}>
        <OverviewTab
          prBody={null}
          repoFullName="acme/payments-api"
          headSha="a1b2c3"
          brief={{
            cache: {
              cache_state: 'current',
              brief: {
                summary: 'Uses the available PR facts.',
                head_sha: 'a1b2c3',
                intent: { intent: '', in_scope: [], out_of_scope: [] },
                blast: { changed_symbols: [], downstream: [], summary: '', degraded: true, reason: 'no_data', prior_prs: null },
                history: { history: [] },
                risks: { risks: [] },
                review_focus: [],
              },
            },
            sources: [
              { source_kind: 'intent', path: null, provenance: 'pull_request', status: 'unavailable', reason_code: 'not_derived', estimated_tokens: 0 },
              { source_kind: 'blast_radius', path: null, provenance: 'pull_request', status: 'unavailable', reason_code: 'not_available', estimated_tokens: 0 },
            ],
          }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Intent was unavailable when this brief was generated.')).toBeInTheDocument();
    expect(screen.getByText('Blast Radius was unavailable when this brief was generated.')).toBeInTheDocument();
    expect(screen.queryByText('“”')).not.toBeInTheDocument();
  });

  it('renders the derived intent, scope, confidence, and safe source count', () => {
    const onRerunIntent = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages, brief: briefMessages }}>
        <OverviewTab
          prBody={null}
          onRerunIntent={onRerunIntent}
          intent={{
            intent: 'Add rate limiting to public endpoints.',
            in_scope: ['Public API', 'Redis limiter'],
            out_of_scope: ['Authentication'],
            confidence: 'medium',
            evidence: [{ source_kind: 'pr_description', status: 'used', reason_code: null, content_fingerprint: 'a'.repeat(64) }],
            source_fingerprint: 'b'.repeat(64),
            model_provider: 'openai',
            model: 'gpt-6-luna',
            derived_at: '2026-10-14T00:00:00.000Z',
          }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Intent')).toBeInTheDocument();
    expect(screen.getByText(/Add rate limiting to public endpoints\./)).toBeInTheDocument();
    expect(screen.getByText('In scope')).toBeInTheDocument();
    expect(screen.getByText('Public API')).toBeInTheDocument();
    expect(screen.getByText('Out of scope')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Risk areas')).toBeInTheDocument();
    expect(screen.getByText('No review risks yet.')).toBeInTheDocument();
    expect(screen.getByText('Medium confidence · 1 source used')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run intent' }));
    expect(onRerunIntent).toHaveBeenCalledOnce();
    const onRecalculate = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages, brief: briefMessages }}>
        <OverviewTab prBody={null} onRecalculate={onRecalculate} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(onRecalculate).toHaveBeenCalledOnce();
  });
});
