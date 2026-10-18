import { describe, expect, it } from 'vitest';
import { FEATURE_MODELS } from './feature-models';

describe('feature model registry', () => {
  it('exposes the intent model as Standard Model with its purpose', () => {
    expect(FEATURE_MODELS).toContainEqual(expect.objectContaining({
      id: 'review_intent',
      label: 'Standard Model',
      description: 'Used for: Intent.',
    }));
  });
});
