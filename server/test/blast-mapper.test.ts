import { describe, expect, it } from 'vitest';
import { mapBlastResult } from '../src/modules/blast/application/map-blast-radius.js';

describe('mapBlastResult', () => {
  it('groups flat callers by changed symbol and attributes unique file facts', () => {
    const result = mapBlastResult({
      changedSymbols: [
        { name: 'rateLimit', file: 'src/limit.ts', kind: 'function' },
        { name: 'bucketKey', file: 'src/limit.ts', kind: 'function' },
      ],
      callers: [
        { viaSymbol: 'rateLimit', symbol: 'publicRouter', file: 'src/api/public.ts', line: 21, rank: 9 },
        { viaSymbol: 'rateLimit', symbol: 'webhookHandler', file: 'src/api/webhooks.ts', line: 44, rank: 4 },
      ],
      impactedEndpoints: ['GET /public/items', 'POST /public/webhooks'],
      factsByFile: {
        'src/api/public.ts': { endpoints: ['GET /public/items'], crons: ['reset-buckets'] },
        'src/api/webhooks.ts': { endpoints: ['POST /public/webhooks', 'GET /public/items'], crons: ['reset-buckets'] },
      },
      degraded: false,
    });

    expect(result).toEqual({
      changed_symbols: [
        { name: 'rateLimit', file: 'src/limit.ts', kind: 'function' },
        { name: 'bucketKey', file: 'src/limit.ts', kind: 'function' },
      ],
      changedSymbols: [
        { name: 'rateLimit', file: 'src/limit.ts', kind: 'function' },
        { name: 'bucketKey', file: 'src/limit.ts', kind: 'function' },
      ],
      callers: [
        { viaSymbol: 'rateLimit', symbol: 'publicRouter', file: 'src/api/public.ts', line: 21, rank: 9 },
        { viaSymbol: 'rateLimit', symbol: 'webhookHandler', file: 'src/api/webhooks.ts', line: 44, rank: 4 },
      ],
      downstream: [
        {
          symbol: 'rateLimit',
          callers: [
            { name: 'publicRouter', file: 'src/api/public.ts', line: 21 },
            { name: 'webhookHandler', file: 'src/api/webhooks.ts', line: 44 },
          ],
          endpoints_affected: ['GET /public/items', 'POST /public/webhooks'],
          crons_affected: ['reset-buckets'],
        },
        { symbol: 'bucketKey', callers: [], endpoints_affected: [], crons_affected: [] },
      ],
      summary: '2 symbols · 2 callers · 2 endpoints · 1 cron/job',
      degraded: false,
      reason: null,
    });
  });

  it('preserves an unavailable-index reason rather than presenting an empty map as complete', () => {
    expect(mapBlastResult({
      changedSymbols: [], callers: [], impactedEndpoints: [], degraded: true, reason: 'index_partial',
    })).toMatchObject({
      changed_symbols: [], changedSymbols: [], callers: [], downstream: [], degraded: true, reason: 'index_partial',
      summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs',
    });
  });
});
