"use client";

import { useTranslations } from "next-intl";
import { FormField, SearchableSelect, Icon } from "@devdigest/ui";
import { useSettings, useUpdateSettings } from "../../../../../../../lib/hooks";
import { useProviderModels } from "../../../../../../../lib/hooks/agents";
import { toModelOptions } from "../../../../../../../lib/model-label";
import { FEATURE_MODELS } from "../../../../../../../lib/feature-models";
import type { FeatureModelChoice, FeatureModelId, Provider } from "../../../../../../../lib/types";
import { SectionTitle } from "../SectionTitle";
import { s } from "./styles";

type FeatureModelRowProps = {
  feature: (typeof FEATURE_MODELS)[number];
  choice: FeatureModelChoice;
  isDefault: boolean;
  onChange: (provider: Provider, model: string) => void;
};

function FeatureModelRow({ feature, choice, isDefault, onChange }: FeatureModelRowProps) {
  const t = useTranslations("settings");
  const { data: openaiModels } = useProviderModels('openai');
  const { data: anthropicModels } = useProviderModels('anthropic');
  const { data: openrouterModels } = useProviderModels('openrouter');
  const modelsByProvider: Record<Provider, typeof openaiModels> = {
    openai: openaiModels,
    anthropic: anthropicModels,
    openrouter: openrouterModels,
  };
  const models = modelsByProvider[choice.provider];
  const baseOptions = toModelOptions(models);
  const current = choice.model;
  const options = baseOptions.some((option) => (typeof option === "string" ? option : option.value) === current)
    ? baseOptions
    : [current, ...baseOptions];

  return (
    <div style={s.row}>
      <FormField
        label={
          <>
            {feature.label}
            {isDefault && <span style={s.defaultTag}>{t("models.usingDefault")}</span>}
          </>
        }
        hint={feature.description}
      >
        <SearchableSelect
          value={choice.provider}
          onChange={(next) => {
            const provider = next as Provider;
            const providerModels = modelsByProvider[provider] ?? [];
            const model = providerModels.some(({ id }) => id === current)
              ? current
              : providerModels[0]?.id ?? (provider === feature.defaultProvider ? feature.defaultModel : undefined);
            if (model) onChange(provider, model);
          }}
          options={["openai", "anthropic", "openrouter"]}
          placeholder={t("models.provider")}
        />
        <SearchableSelect
          value={current}
          onChange={(model) => onChange(choice.provider, model)}
          options={options}
          placeholder={t("models.search")}
        />
      </FormField>
    </div>
  );
}

/**
 * Settings → Feature Models. One picker per system LLM feature; the model list +
 * prices come LIVE from OpenRouter (useProviderModels), and the choice persists
 * to `settings.feature_models`. Each feature falls back to its registry default
 * when unset.
 */
export function SettingsModels() {
  const t = useTranslations("settings");
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const chosen = (settings?.feature_models ?? {}) as Partial<Record<FeatureModelId, FeatureModelChoice>>;

  const setModel = (id: FeatureModelId, provider: Provider, model: string) =>
    update.mutate({
      feature_models: { ...chosen, [id]: { provider, model } },
    });

  return (
    <div style={s.wrap}>
      <SectionTitle title={t("models.title")} body={t("models.body")} />

      {FEATURE_MODELS.map((f) => {
        const choice = chosen[f.id] ?? { provider: f.defaultProvider, model: f.defaultModel };
        const isDefault = !chosen[f.id];
        return (
          <FeatureModelRow
            key={f.id}
            feature={f}
            choice={choice}
            isDefault={isDefault}
            onChange={(provider, model) => setModel(f.id, provider, model)}
          />
        );
      })}

      <div style={s.note}><Icon.Info size={15} style={s.noteIcon} /><span>{t("models.liveNote")}</span></div>
    </div>
  );
}
