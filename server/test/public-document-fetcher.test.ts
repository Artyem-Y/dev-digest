import { describe, expect, it, vi } from 'vitest';
import { SafePublicDocumentFetcher } from '../src/modules/intents/infrastructure/public-document-fetcher.js';

describe('SafePublicDocumentFetcher', () => {
  it('pins the validated public address for the document request', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
    const request = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'text/markdown' },
      body: Buffer.from('# plan'),
    });
    const Fetcher = SafePublicDocumentFetcher as unknown as new (deps: { lookup: typeof lookup; request: typeof request }) => SafePublicDocumentFetcher;
    const fetcher = new Fetcher({ lookup, request });

    await expect(fetcher.fetchPlanOrSpec('https://plans.example/plan.md')).resolves.toEqual({ ok: true, text: '# plan' });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ address: '203.0.113.10' }));
  });

  it('validates and pins a new public address for every redirect', async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce([{ address: '203.0.113.10', family: 4 }])
      .mockResolvedValueOnce([{ address: '203.0.113.11', family: 4 }]);
    const request = vi.fn()
      .mockResolvedValueOnce({
        statusCode: 302,
        headers: { location: 'https://final.example/plan.md' },
        body: Buffer.alloc(0),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: { 'content-type': 'text/markdown' },
        body: Buffer.from('# final plan'),
      });
    const Fetcher = SafePublicDocumentFetcher as unknown as new (deps: { lookup: typeof lookup; request: typeof request }) => SafePublicDocumentFetcher;
    const fetcher = new Fetcher({ lookup, request });

    await expect(fetcher.fetchPlanOrSpec('https://plans.example/plan.md')).resolves.toEqual({ ok: true, text: '# final plan' });
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({ address: '203.0.113.10' }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ address: '203.0.113.11' }));
  });

  it.each(['::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe'])('rejects mapped private IPv4 address %s', async (address) => {
    const lookup = vi.fn().mockResolvedValue([{ address, family: 6 }]);
    const request = vi.fn();
    const Fetcher = SafePublicDocumentFetcher as unknown as new (deps: { lookup: typeof lookup; request: typeof request }) => SafePublicDocumentFetcher;

    await expect(new Fetcher({ lookup, request }).fetchPlanOrSpec('https://plans.example/plan.md'))
      .resolves.toEqual({ ok: false, reasonCode: 'url_rejected' });
    expect(request).not.toHaveBeenCalled();
  });
});
