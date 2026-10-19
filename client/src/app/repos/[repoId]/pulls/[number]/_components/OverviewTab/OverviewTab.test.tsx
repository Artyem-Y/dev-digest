import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../../../../../../../messages/en/prReview.json';
import blastMessages from '../../../../../../../../messages/en/blast.json';
import { OverviewTab } from './OverviewTab';

describe('OverviewTab intent', () => {
  it('places Blast Radius beside Intent inside the overview analysis grid', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages }}>
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
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: { loading: 'Loading Blast Radius…', unavailable: 'Blast Radius is unavailable.' } }}>
        <OverviewTab prBody={null} blastLoading />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Loading Blast Radius…')).toBeInTheDocument();
  });

  it('renders the derived intent, scope, confidence, and safe source count', () => {
    const onRerunIntent = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages }}>
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
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, blast: blastMessages }}>
        <OverviewTab prBody={null} onRecalculate={onRecalculate} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(onRecalculate).toHaveBeenCalledOnce();
  });
});
