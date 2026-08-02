"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, PlugZap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Provider } from "@/lib/providers";
import type { AccountProviderConnection } from "@/lib/account/types";

interface ProvidersPanelProps {
  providers: Array<Provider & { connection: AccountProviderConnection }>;
  onConnect: (providerId: string, rawKey: string) => boolean;
  onDisconnect: (providerId: string) => void;
  formatDate: (value: string) => string;
}

const inputClassName =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent/50";

export function ProvidersPanel({
  providers,
  onConnect,
  onDisconnect,
  formatDate,
}: ProvidersPanelProps) {
  const t = useTranslations("account");
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});

  function handleConnect(providerId: string) {
    const rawKey = draftKeys[providerId] ?? "";
    const connected = onConnect(providerId, rawKey);

    if (connected) {
      setDraftKeys((current) => ({ ...current, [providerId]: "" }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("providers.title")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
          {t("providers.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => {
          const statusKey = provider.connection.connected
            ? "connected"
            : "disconnected";

          return (
            <Card key={provider.id} className="group hover:border-accent/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${provider.color}88, ${provider.color})`,
                      }}
                    >
                      {provider.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-base group-hover:text-accent">
                        {provider.name}
                      </CardTitle>
                      <CardDescription>
                        {provider.models.length} {t("providers.models")}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      provider.connection.connected ? "default" : "outline"
                    }
                  >
                    {t(`providers.${statusKey}`)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-1.5">
                  {provider.models.map((model) => (
                    <span
                      key={model}
                      className="rounded-md bg-[var(--color-ink-700)] px-2 py-1 text-xs text-[var(--color-ice-200)]"
                    >
                      {model}
                    </span>
                  ))}
                </div>

                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted">{t("providers.maskedKey")}</p>
                    <p className="mt-1 font-mono text-foreground">
                      {provider.connection.maskedKey ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">{t("providers.updated")}</p>
                    <p className="mt-1 font-medium text-foreground">
                      {provider.connection.lastUpdatedAt
                        ? formatDate(provider.connection.lastUpdatedAt)
                        : "-"}
                    </p>
                  </div>
                </div>

                <p className="text-xs leading-5 text-muted">
                  {provider.connection.last4
                    ? t("providers.last4", { value: provider.connection.last4 })
                    : t("providers.safeStorage")}
                </p>

                <label className="block text-sm text-muted">
                  {t("providers.keyLabel")}
                  <input
                    type="password"
                    autoComplete="off"
                    value={draftKeys[provider.id] ?? ""}
                    onChange={(event) =>
                      setDraftKeys((current) => ({
                        ...current,
                        [provider.id]: event.target.value,
                      }))
                    }
                    placeholder={t("providers.keyPlaceholder")}
                    className={inputClassName}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => handleConnect(provider.id)}>
                    <PlugZap className="h-4 w-4" />
                    {t("actions.connect")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => onDisconnect(provider.id)}
                    disabled={!provider.connection.connected}
                  >
                    {t("actions.disconnect")}
                  </Button>
                  <Button variant="ghost" asChild>
                    <a
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("providers.openWebsite")}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
