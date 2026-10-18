import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../../../../../messages/en/settings.json';

const mocks = vi.hoisted(() => ({
  useProviderModels: vi.fn((provider: string) => ({ data: [{ id: `${provider}/model`, provider }] })),
  mutate: vi.fn(),
}));

vi.mock('../../../../../../../lib/hooks', () => ({
  useSettings: () => ({ data: { feature_models: {} } }),
  useUpdateSettings: () => ({ mutate: mocks.mutate }),
}));
vi.mock('../../../../../../../lib/hooks/agents', () => ({
  useProviderModels: mocks.useProviderModels,
}));

import { SettingsModels } from './SettingsModels';

afterEach(() => {
  cleanup();
  mocks.useProviderModels.mockClear();
  mocks.mutate.mockClear();
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

  it('replaces the model when the provider changes', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ settings: messages }}>
        <SettingsModels />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getAllByText('openai')[0]!);
    fireEvent.click((await screen.findAllByText('anthropic')).at(-1)!);

    expect(mocks.mutate).toHaveBeenCalledWith({
      feature_models: {
        review_intent: { provider: 'anthropic', model: 'anthropic/model' },
      },
    });
  });
});
