import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { BlastRadius } from '@/vendor/shared/contracts/brief';
import messages from '../../../../../../../../messages/en/blast.json';
import { BlastRadiusCard } from './BlastRadiusCard';

function renderCard(blast: BlastRadius) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ blast: messages }}>
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

  it('opens the aggregate graph in a modal with symbol, caller, endpoint, and cron columns', () => {
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
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('group', { name: 'Blast radius graph' })).toBeInTheDocument();
    expect(within(modal).getAllByTestId('blast-radius-graph-column')).toHaveLength(4);
    expect(within(modal).getByText('rateLimit')).toBeInTheDocument();
    expect(within(modal).getByText('publicRouter')).toBeInTheDocument();
    expect(within(modal).getByText('src/api/public.ts:21')).toBeInTheDocument();
    expect(within(modal).getByText('GET /api/public/items')).toBeInTheDocument();
    expect(within(modal).getByText('reset-buckets')).toBeInTheDocument();

    fireEvent.click(within(modal).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('highlights a hovered graph chain and dims nodes outside it', () => {
    renderCard({
      changed_symbols: [
        { name: 'rateLimit', file: 'src/limit.ts', kind: 'function' },
        { name: 'internalHelper', file: 'src/helper.ts', kind: 'function' },
      ],
      downstream: [
        {
          symbol: 'rateLimit',
          callers: [{ name: 'publicRouter', file: 'src/api/public.ts', line: 21 }],
          endpoints_affected: ['GET /api/public/items'],
          crons_affected: ['reset-buckets'],
        },
        {
          symbol: 'internalHelper',
          callers: [{ name: 'adminRouter', file: 'src/api/admin.ts', line: 12 }],
          endpoints_affected: ['GET /api/admin/items'],
          crons_affected: [],
        },
      ],
      summary: '2 symbols · 2 callers · 2 endpoints · 1 cron/job', degraded: false, reason: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'graph' }));
    const modal = screen.getByRole('dialog');
    const symbol = within(modal).getByRole('group', { name: 'Changed symbol: rateLimit' });
    const caller = within(modal).getByRole('group', { name: 'Caller: publicRouter' });
    const unrelatedCaller = within(modal).getByRole('group', { name: 'Caller: adminRouter' });

    fireEvent.mouseEnter(symbol);
    expect(symbol).toHaveAttribute('data-active', 'true');
    expect(caller).toHaveAttribute('data-active', 'true');
    expect(within(modal).getByRole('group', { name: 'Endpoint: GET /api/public/items' })).toHaveAttribute('data-active', 'true');
    expect(within(modal).getByRole('group', { name: 'Cron / job: reset-buckets' })).toHaveAttribute('data-active', 'true');
    expect(unrelatedCaller).toHaveAttribute('data-dimmed', 'true');

    fireEvent.mouseLeave(symbol);
    expect(caller).toHaveAttribute('data-active', 'false');
    expect(unrelatedCaller).toHaveAttribute('data-dimmed', 'false');
  });

  it('explains why Graph has no edges when callers are absent', () => {
    renderCard({
      changed_symbols: [{ name: 'localHelper', file: 'src/helper.ts', kind: 'function' }],
      downstream: [{ symbol: 'localHelper', callers: [], endpoints_affected: [], crons_affected: [] }],
      summary: '1 symbol · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'graph' }));
    expect(within(screen.getByRole('dialog')).getByText('No downstream callers to graph.')).toBeInTheDocument();
  });

  it('groups changed symbols without callers in a closed section below impacted symbols', () => {
    renderCard({
      changed_symbols: [
        { name: 'rateLimit', file: 'src/limit.ts', kind: 'function' },
        { name: 'localHelper', file: 'src/helper.ts', kind: 'function' },
      ],
      downstream: [
        { symbol: 'rateLimit', callers: [{ name: 'publicRouter', file: 'src/api/public.ts', line: 21 }], endpoints_affected: [], crons_affected: [] },
        { symbol: 'localHelper', callers: [], endpoints_affected: [], crons_affected: [] },
      ],
      summary: '2 symbols · 1 caller · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
    });

    expect(screen.getByRole('button', { name: 'rateLimit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'localHelper' })).not.toBeInTheDocument();
    const summary = screen.getByText('No downstream callers (1)');
    const section = summary.closest('details');
    expect(section).not.toHaveAttribute('open');

    fireEvent.click(summary);
    expect(section).toHaveAttribute('open');
    expect(screen.getByText('localHelper')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'localHelper' })).not.toBeInTheDocument();
  });

  it('renders matching merged PRs in a closed history section with repository-scoped links', () => {
    renderCard({
      changed_symbols: [], downstream: [], summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
      prior_prs: {
        history: [{
          pr_number: 17, title: 'Harden public limiter', author: 'marisa', merged_at: '2026-10-19T10:00:00Z',
          files_overlap: ['src/limit.ts'], notes: '',
        }],
      },
    });

    const summary = screen.getByText('Prior PRs touching these files');
    const section = summary.closest('details');
    expect(section).not.toHaveAttribute('open');

    fireEvent.click(summary);
    expect(section).toHaveAttribute('open');
    expect(screen.getByRole('link', { name: '#17 Harden public limiter' })).toHaveAttribute(
      'href', 'https://github.com/acme/payments-api/pull/17',
    );
    expect(screen.getByText('1 overlapping file(s)')).toBeInTheDocument();
    expect(screen.getByText('2026-10-19')).toBeInTheDocument();
  });

  it('labels an incomplete index instead of treating it as an empty result', () => {
    renderCard({ changed_symbols: [], downstream: [], summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs', degraded: true, reason: 'index_partial' });

    expect(screen.getByText('Repository index is incomplete: index_partial')).toBeInTheDocument();
  });
});
