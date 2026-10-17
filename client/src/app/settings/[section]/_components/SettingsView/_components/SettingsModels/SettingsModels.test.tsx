import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../../../../../messages/en/settings.json';

const mocks = vi.hoisted(() => ({
  useProviderModels: vi.fn((provider: string) => ({ data: [{ id: `${provider}/model`, provider }] })),
}));

vi.mock('../../../../../../../lib/hooks', () => ({
  useSettings: () => ({ data: { feature_models: {} } }),
  useUpdateSettings: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../../../../../../lib/hooks/agents', () => ({
  useProviderModels: mocks.useProviderModels,
}));

import { SettingsModels } from './SettingsModels';

afterEach(() => {
  cleanup();
  mocks.useProviderModels.mockClear();
});

describe('SettingsModels', () => {
  it('loads models for each feature row provider', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ settings: messages }}>
        <SettingsModels />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.useProviderModels).toHaveBeenCalledWith('openrouter');
      expect(mocks.useProviderModels).toHaveBeenCalledWith('openai');
    });
  });
});
