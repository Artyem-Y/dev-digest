import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { BlastRadius } from '@/vendor/shared/contracts/brief';
import { BlastRadiusCard } from './BlastRadiusCard';

const messages = {
  blast: {
    title: 'Blast radius',
    stat: { symbols: 'symbols', callers: 'callers', endpoints: 'endpoints', crons: 'cron/jobs' },
    view: { tree: 'tree', graph: 'graph' },
    graph: { ariaLabel: 'Blast radius graph', empty: 'No downstream callers to graph.' },
    callerCount: '{count} callers', noDownstream: '{count} changed symbol(s), no downstream callers found.',
    indexDegraded: 'Repository index is incomplete: {reason}', endpointsAffected: 'Endpoints affected', cronsAffected: 'Cron/jobs affected',
  },
};

function renderCard(blast: BlastRadius) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BlastRadiusCard blast={blast} repoFullName="acme/payments-api" headSha="a1b2c3" />
    </NextIntlClientProvider>,
  );
}

describe('BlastRadiusCard', () => {
  it('groups the title and view controls in the compact card header', () => {
    renderCard({ changed_symbols: [], downstream: [], summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null });

    const header = screen.getByTestId('blast-radius-header');
    expect(within(header).getByRole('heading', { name: 'Blast radius' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'tree' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'graph' })).toBeInTheDocument();
  });

  it('defaults to an expandable Tree view without losing the summary', () => {
    renderCard({
      changed_symbols: [{ name: 'rateLimit', file: 'src/limit.ts', kind: 'function' }],
      downstream: [{
        symbol: 'rateLimit',
        callers: [{ name: 'publicRouter', file: 'src/api/public.ts', line: 21 }],
        endpoints_affected: ['GET /api/public/items'],
        crons_affected: [],
      }],
      summary: '1 symbol · 1 caller · 1 endpoint · 0 cron/jobs', degraded: false, reason: null,
    });

    expect(screen.getByRole('button', { name: 'tree' })).toHaveAttribute('aria-pressed', 'true');
    const symbol = screen.getByRole('button', { name: 'rateLimit' });
    expect(symbol).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(symbol);
    expect(symbol).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'src/api/public.ts:21' })).not.toBeInTheDocument();
    expect(screen.getByText('symbols')).toBeInTheDocument();
  });

  it('renders callers and pins each source link to the PR head line', () => {
    renderCard({
      changed_symbols: [{ name: 'rateLimit', file: 'src/limit.ts', kind: 'function' }],
      downstream: [{
        symbol: 'rateLimit',
        callers: [{ name: 'publicRouter', file: 'src/api/public.ts', line: 21 }],
        endpoints_affected: ['GET /api/public/items'],
        crons_affected: ['reset-buckets'],
      }],
      summary: '1 symbol · 1 caller · 1 endpoint · 1 cron/job', degraded: false, reason: null,
    });

    expect(screen.getByText('Blast radius')).toBeInTheDocument();
    expect(screen.getByText('rateLimit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'src/api/public.ts:21' })).toHaveAttribute(
      'href', 'https://github.com/acme/payments-api/blob/a1b2c3/src/api/public.ts#L21',
    );
    expect(screen.getByRole('link', { name: 'src/api/public.ts:21' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('GET /api/public/items')).toBeInTheDocument();
  });

  it('switches to a labeled graph built from the same changed symbol and caller', () => {
    renderCard({
      changed_symbols: [{ name: 'rateLimit', file: 'src/limit.ts', kind: 'function' }],
      downstream: [{
        symbol: 'rateLimit',
        callers: [{ name: 'publicRouter', file: 'src/api/public.ts', line: 21 }],
        endpoints_affected: ['GET /api/public/items'],
        crons_affected: ['reset-buckets'],
      }],
      summary: '1 symbol · 1 caller · 1 endpoint · 1 cron/job', degraded: false, reason: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'graph' }));
    expect(screen.getByRole('button', { name: 'graph' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: 'Blast radius graph' })).toBeInTheDocument();
    expect(screen.getByText('rateLimit')).toBeInTheDocument();
    expect(screen.getByText('publicRouter · src/api/public.ts:21')).toBeInTheDocument();
    expect(screen.getByText('GET /api/public/items')).toBeInTheDocument();
    expect(screen.getByText('reset-buckets')).toBeInTheDocument();
  });

  it('explains why Graph has no edges when callers are absent', () => {
    renderCard({
      changed_symbols: [{ name: 'localHelper', file: 'src/helper.ts', kind: 'function' }],
      downstream: [{ symbol: 'localHelper', callers: [], endpoints_affected: [], crons_affected: [] }],
      summary: '1 symbol · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'graph' }));
    expect(screen.getByText('No downstream callers to graph.')).toBeInTheDocument();
  });

  it('explains a complete map with no downstream callers', () => {
    renderCard({
      changed_symbols: [{ name: 'localHelper', file: 'src/helper.ts', kind: 'function' }],
      downstream: [{ symbol: 'localHelper', callers: [], endpoints_affected: [], crons_affected: [] }],
      summary: '1 symbol · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
    });

    expect(screen.getByText('1 changed symbol(s), no downstream callers found.')).toBeInTheDocument();
  });

  it('labels an incomplete index instead of treating it as an empty result', () => {
    renderCard({ changed_symbols: [], downstream: [], summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs', degraded: true, reason: 'index_partial' });

    expect(screen.getByText('Repository index is incomplete: index_partial')).toBeInTheDocument();
  });
});
