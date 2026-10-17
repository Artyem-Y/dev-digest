import { describe, expect, it, vi } from 'vitest';
import { SafePublicDocumentFetcher } from '../src/modules/intents/infrastructure/public-document-fetcher.js';

describe('SafePublicDocumentFetcher', () => {
  it('pins the validated public address for the document request', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const request = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'text/markdown' },
      body: Buffer.from('# plan'),
    });
    const Fetcher = SafePublicDocumentFetcher as unknown as new (deps: { lookup: typeof lookup; request: typeof request }) => SafePublicDocumentFetcher;
    const fetcher = new Fetcher({ lookup, request });

    await expect(fetcher.fetchPlanOrSpec('https://plans.example/plan.md')).resolves.toEqual({ ok: true, text: '# plan' });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ address: '8.8.8.8' }));
  });

  it('validates and pins a new public address for every redirect', async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }])
      .mockResolvedValueOnce([{ address: '1.1.1.1', family: 4 }]);
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
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({ address: '8.8.8.8' }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ address: '1.1.1.1' }));
  });

  it.each(['::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe'])('rejects mapped private IPv4 address %s', async (address) => {
    const lookup = vi.fn().mockResolvedValue([{ address, family: 6 }]);
    const request = vi.fn();
    const Fetcher = SafePublicDocumentFetcher as unknown as new (deps: { lookup: typeof lookup; request: typeof request }) => SafePublicDocumentFetcher;

    await expect(new Fetcher({ lookup, request }).fetchPlanOrSpec('https://plans.example/plan.md'))
      .resolves.toEqual({ ok: false, reasonCode: 'url_rejected' });
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['100.64.0.1', '192.0.2.1', '192.31.196.1', '192.52.193.1', '192.88.99.1', '192.175.48.1', '198.18.0.1'])('rejects non-public IPv4 address %s', async (address) => {
    const lookup = vi.fn().mockResolvedValue([{ address, family: 4 }]);
    const request = vi.fn();
    const Fetcher = SafePublicDocumentFetcher as unknown as new (deps: { lookup: typeof lookup; request: typeof request }) => SafePublicDocumentFetcher;

    await expect(new Fetcher({ lookup, request }).fetchPlanOrSpec('https://plans.example/plan.md'))
      .resolves.toEqual({ ok: false, reasonCode: 'url_rejected' });
    expect(request).not.toHaveBeenCalled();
  });
});
