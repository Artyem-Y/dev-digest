import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import messages from '../../../../../../../../messages/en/prReview.json';
import { OverviewTab } from './OverviewTab';

describe('OverviewTab intent', () => {
  it('renders the derived intent, scope, confidence, and safe source count', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <OverviewTab
          prBody={null}
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
    expect(screen.getByText('Add rate limiting to public endpoints.')).toBeInTheDocument();
    expect(screen.getByText('In scope')).toBeInTheDocument();
    expect(screen.getByText('Public API')).toBeInTheDocument();
    expect(screen.getByText('Medium confidence · 1 source used')).toBeInTheDocument();
  });
});
