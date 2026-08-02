"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AccountPreferences } from "@/lib/account/types";

interface PreferencesPanelProps {
  preferences: AccountPreferences;
  availableModels: string[];
  onSave: (preferences: AccountPreferences) => void;
  onReset: () => void;
}

const fieldClassName =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent/50";

export function PreferencesPanel({
  preferences,
  availableModels,
  onSave,
  onReset,
}: PreferencesPanelProps) {
  const t = useTranslations("account");
  const { setTheme } = useTheme();
  const [draft, setDraft] = useState(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  const hasChanges =
    draft.name !== preferences.name ||
    draft.email !== preferences.email ||
    draft.defaultModel !== preferences.defaultModel ||
    draft.appearance !== preferences.appearance ||
    draft.density !== preferences.density ||
    draft.homeTab !== preferences.homeTab;

  function updateField<K extends keyof AccountPreferences>(
    key: K,
    value: AccountPreferences[K],
  ) {
    setSaved(false);
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft);
    setTheme(draft.appearance);
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("preferences.title")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
          {t("preferences.subtitle")}
        </p>
      </div>

      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle>{t("preferences.profileTitle")}</CardTitle>
          <CardDescription>{t("preferences.profileSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-sm text-muted">
                {t("preferences.name")}
                <input
                  value={draft.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldClassName}
                />
              </label>

              <label className="text-sm text-muted">
                {t("preferences.email")}
                <input
                  value={draft.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className={fieldClassName}
                />
                <span className="mt-2 block text-xs leading-5 text-muted">
                  {t("preferences.emailHint")}
                </span>
              </label>

              <label className="text-sm text-muted">
                {t("preferences.defaultModel")}
                <select
                  value={draft.defaultModel}
                  onChange={(event) =>
                    updateField("defaultModel", event.target.value)
                  }
                  className={fieldClassName}
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-muted">
                {t("preferences.homeTab")}
                <select
                  value={draft.homeTab}
                  onChange={(event) =>
                    updateField(
                      "homeTab",
                      event.target.value as AccountPreferences["homeTab"],
                    )
                  }
                  className={fieldClassName}
                >
                  <option value="overview">{t("tabs.overview")}</option>
                  <option value="providers">{t("tabs.providers")}</option>
                  <option value="sessions">{t("tabs.sessions")}</option>
                  <option value="preferences">{t("tabs.preferences")}</option>
                </select>
              </label>

              <label className="text-sm text-muted">
                {t("preferences.appearance")}
                <select
                  value={draft.appearance}
                  onChange={(event) =>
                    updateField(
                      "appearance",
                      event.target
                        .value as AccountPreferences["appearance"],
                    )
                  }
                  className={fieldClassName}
                >
                  <option value="dark">
                    {t("preferences.appearanceOptions.dark")}
                  </option>
                  <option value="light">
                    {t("preferences.appearanceOptions.light")}
                  </option>
                </select>
              </label>

              <label className="text-sm text-muted">
                {t("preferences.density")}
                <select
                  value={draft.density}
                  onChange={(event) =>
                    updateField(
                      "density",
                      event.target.value as AccountPreferences["density"],
                    )
                  }
                  className={fieldClassName}
                >
                  <option value="cozy">
                    {t("preferences.densityOptions.cozy")}
                  </option>
                  <option value="compact">
                    {t("preferences.densityOptions.compact")}
                  </option>
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                {saved ? t("preferences.saved") : t("preferences.saveHint")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!hasChanges}>
                  {t("actions.save")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onReset();
                    setTheme("dark");
                    setSaved(false);
                  }}
                >
                  {t("actions.reset")}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
