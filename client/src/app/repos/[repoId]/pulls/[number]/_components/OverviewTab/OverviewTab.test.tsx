import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../../../../../../../messages/en/prReview.json';
import { OverviewTab } from './OverviewTab';

describe('OverviewTab intent', () => {
  it('renders the derived intent, scope, confidence, and safe source count', () => {
    const onRerunIntent = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
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
  });
});
