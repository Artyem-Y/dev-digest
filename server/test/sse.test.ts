import { describe, expect, it, vi } from 'vitest';
import { RunBus } from '../src/platform/sse.js';

describe('RunBus', () => {
  it('replays an intent completion result to a subscriber that arrives after completion', async () => {
    const bus = new RunBus();
    const streamId = 'pull-intent:pull-1';
    bus.begin(streamId);
    bus.publish(streamId, 'result', 'PR intent derivation settled', { intentSettled: true });
    bus.complete(streamId);

    const events: unknown[] = [];
    const done = vi.fn();
    bus.subscribe(streamId, (event) => events.push(event));
    bus.onDone(streamId, done);
    await Promise.resolve();

    expect(events).toMatchObject([{ data: { intentSettled: true } }]);
    expect(done).toHaveBeenCalledOnce();
  });
});
