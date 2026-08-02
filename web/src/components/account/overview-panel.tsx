"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Layers3, PanelTop, PlugZap, Sparkles } from "lucide-react";
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
import type {
  AccountProviderConnection,
  AccountState,
  AccountTab,
} from "@/lib/account/types";

interface OverviewProvider extends Provider {
  connection: AccountProviderConnection;
}

interface OverviewPanelProps {
  state: AccountState;
  providers: OverviewProvider[];
  onOpenTab: (tab: AccountTab) => void;
  onCreateSession: () => void;
  onOpenSession: (sessionId: string) => void;
  formatDate: (value: string) => string;
}

export function OverviewPanel({
  state,
  providers,
  onOpenTab,
  onCreateSession,
  onOpenSession,
  formatDate,
}: OverviewPanelProps) {
  const t = useTranslations("account");
  const locale = useLocale();
  const formatter = new Intl.NumberFormat(locale);
  const compactFormatter = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const connectedProviders = providers.filter(
    (provider) => provider.connection.connected,
  );
  const recentSessions = [...state.sessions]
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )
    .slice(0, 4);

  const stats = [
    {
      label: t("overview.cards.models"),
      value: "75+",
      icon: Layers3,
    },
    {
      label: t("overview.cards.requests"),
      value: formatter.format(state.usage.requests30d),
      icon: PanelTop,
    },
    {
      label: t("overview.cards.tokens"),
      value: compactFormatter.format(state.usage.tokens30d),
      icon: Sparkles,
    },
    {
      label: t("overview.cards.spend"),
      value: `$${state.usage.spendUsd.toFixed(2)}`,
      icon: ArrowUpRight,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="hover:border-accent/30">
            <item.icon className="h-5 w-5 text-accent" />
            <p className="mt-5 text-2xl font-semibold text-foreground">
              {item.value}
            </p>
            <p className="mt-1 text-sm text-muted">{item.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t("overview.localOnly")}</Badge>
              <Badge variant="secondary">{state.plan.name}</Badge>
            </div>
            <CardTitle className="pt-3">
              {t("overview.welcome", { name: state.preferences.name })}
            </CardTitle>
            <CardDescription>{t("overview.welcomeSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted">{t("overview.planFields.workspace")}</p>
                <p className="mt-1 font-medium text-foreground">
                  {state.plan.workspace}
                </p>
              </div>
              <div>
                <p className="text-muted">{t("overview.planFields.seats")}</p>
                <p className="mt-1 font-medium text-foreground">
                  {state.plan.seatsUsed}/{state.plan.seatsLimit}
                </p>
              </div>
              <div>
                <p className="text-muted">{t("overview.planFields.mode")}</p>
                <p className="mt-1 font-medium text-foreground">
                  {t(`status.${state.plan.status}`)}
                </p>
              </div>
              <div>
                <p className="text-muted">{t("preferences.defaultModel")}</p>
                <p className="mt-1 font-medium text-foreground">
                  {state.preferences.defaultModel}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => onOpenTab("providers")}>
                <PlugZap className="h-4 w-4" />
                {t("actions.openProviders")}
              </Button>
              <Button variant="secondary" onClick={onCreateSession}>
                <Sparkles className="h-4 w-4" />
                {t("actions.createSession")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{t("overview.activityTitle")}</CardTitle>
                <CardDescription>
                  {t("overview.activityDescription")}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpenTab("sessions")}>
                {t("actions.openSessions")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onOpenSession(session.id)}
                  className="flex w-full items-start justify-between gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-[var(--color-ink-900)]"
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {session.title}
                      {session.pinned && (
                        <Badge variant="secondary">
                          {t("sessions.dialog.pinned")}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {session.model} / {formatDate(session.updatedAt)}
                    </span>
                  </span>
                  <Badge>{t(`status.${session.status}`)}</Badge>
                </button>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
                {t("overview.emptySessions")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t("overview.providersTitle")}</CardTitle>
              <CardDescription>{t("overview.providersDescription")}</CardDescription>
            </div>
            <Badge variant="secondary">
              {t("common.connectedProviders", {
                count: connectedProviders.length,
                total: providers.length,
              })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {connectedProviders.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {connectedProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-lg border border-border bg-[var(--color-ink-900)] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: provider.color }}
                    />
                    <p className="font-medium text-foreground">{provider.name}</p>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted">
                    {provider.connection.maskedKey}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
              {t("overview.emptyProviders")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
