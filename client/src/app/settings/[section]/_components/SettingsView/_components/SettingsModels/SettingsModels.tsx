"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, SearchableSelect, Icon } from "@devdigest/ui";
import { useSettings, useUpdateSettings } from "../../../../../../../lib/hooks";
import { useProviderModels } from "../../../../../../../lib/hooks/agents";
import { toModelOptions } from "../../../../../../../lib/model-label";
import { FEATURE_MODELS } from "../../../../../../../lib/feature-models";
import type { FeatureModelChoice, FeatureModelId, Provider } from "../../../../../../../lib/types";
import { SectionTitle } from "../SectionTitle";
import { s } from "./styles";

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
  const [activeProvider, setActiveProvider] = React.useState<Provider>("openrouter");
  const { data: models } = useProviderModels(activeProvider);
  const baseOptions = toModelOptions(models);
  const noModels = models !== undefined && models.length === 0;

  const setModel = (id: FeatureModelId, provider: Provider, model: string) =>
    update.mutate({
      feature_models: { ...chosen, [id]: { provider, model } },
    });

  return (
    <div style={s.wrap}>
      <SectionTitle title={t("models.title")} body={t("models.body")} />

      {FEATURE_MODELS.map((f) => {
        const choice = chosen[f.id] ?? { provider: f.defaultProvider, model: f.defaultModel };
        const current = choice.model;
        const provider = choice.provider;
        const isDefault = !chosen[f.id];
        // Ensure the current value is selectable even if it isn't in the live
        // OpenRouter list (e.g. an OpenAI registry default, or an empty list).
        const options = baseOptions.some((o) => (typeof o === "string" ? o : o.value) === current)
          ? baseOptions
          : [current, ...baseOptions];
        return (
          <div key={f.id} style={s.row}>
            <FormField
              label={
                <>
                  {f.label}
                  {isDefault && <span style={s.defaultTag}>{t("models.usingDefault")}</span>}
                </>
              }
              hint={f.description}
            >
              <SearchableSelect
                value={provider}
                onChange={(next) => {
                  const nextProvider = next as Provider;
                  setActiveProvider(nextProvider);
                  update.mutate({ feature_models: { ...chosen, [f.id]: { provider: nextProvider, model: current } } });
                }}
                options={["openai", "anthropic", "openrouter"]}
                placeholder={t("models.provider")}
              />
              <SearchableSelect
                value={current}
                onChange={(m) => setModel(f.id, provider, m)}
                options={options}
                placeholder={t("models.search")}
              />
            </FormField>
          </div>
        );
      })}

      <div style={s.note}>
        <Icon.Info size={15} style={s.noteIcon} />
        <span>{noModels ? t("models.noKeyNote") : t("models.liveNote")}</span>
      </div>
    </div>
  );
}
