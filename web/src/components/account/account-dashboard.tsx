"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock3, DatabaseZap, Layers3, ShieldCheck } from "lucide-react";
import { providers as providerCatalog } from "@/lib/providers";
import { useAccountStore } from "@/lib/account/store";
import type { AccountTab } from "@/lib/account/types";
import { AuroraBackdrop } from "@/components/shared/aurora-backdrop";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewPanel } from "./overview-panel";
import { PreferencesPanel } from "./preferences-panel";
import { ProvidersPanel } from "./providers-panel";
import { SessionDetailsDialog } from "./session-details-dialog";
import { SessionsPanel } from "./sessions-panel";

function LoadingState() {
  return (
    <Container className="relative z-10 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="h-28 animate-pulse border-border/60 bg-[var(--color-ink-900)]" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-64 animate-pulse border-border/60 bg-[var(--color-ink-900)]" />
          <Card className="h-64 animate-pulse border-border/60 bg-[var(--color-ink-900)]" />
        </div>
      </div>
    </Container>
  );
}

export function AccountDashboard() {
  const t = useTranslations("account");
  const locale = useLocale();
  const {
    state,
    hydrated,
    setActiveTab,
    connectProvider,
    disconnectProvider,
    toggleSessionPinned,
    createSessionDraft,
    savePreferences,
    resetAccount,
  } = useAccountStore();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (!hydrated || !state) {
    return (
      <section className="relative overflow-hidden">
        <AuroraBackdrop />
        <LoadingState />
      </section>
    );
  }

  const mergedProviders = providerCatalog.map((provider) => ({
    ...provider,
    connection:
      state.providers.find((connection) => connection.providerId === provider.id) ??
      {
        providerId: provider.id,
        connected: false,
        maskedKey: null,
        last4: null,
        lastUpdatedAt: null,
      },
  }));

  const selectedSession =
    state.sessions.find((session) => session.id === selectedSessionId) ?? null;
  const availableModels = providerCatalog.flatMap((provider) => provider.models);
  const connectedProviderCount = state.providers.filter(
    (provider) => provider.connected,
  ).length;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  function handleOpenSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setActiveTab("sessions");
  }

  function handleOpenTab(tab: AccountTab) {
    setActiveTab(tab);
  }

  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <AuroraBackdrop />
      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-6">{t("eyebrow")}</Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            {t("subtitle")}
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-[var(--color-ink-900)] p-4">
            <DatabaseZap className="h-4 w-4 text-accent" />
            <p className="mt-4 text-xs uppercase text-muted">
              {t("headerCard.plan")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {state.plan.workspace}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-[var(--color-ink-900)] p-4">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <p className="mt-4 text-xs uppercase text-muted">
              {t("headerCard.connected")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {connectedProviderCount}/{providerCatalog.length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-[var(--color-ink-900)] p-4">
            <Layers3 className="h-4 w-4 text-accent" />
            <p className="mt-4 text-xs uppercase text-muted">
              {t("headerCard.sessions")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {state.sessions.length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-[var(--color-ink-900)] p-4">
            <Clock3 className="h-4 w-4 text-accent" />
            <p className="mt-4 text-xs uppercase text-muted">
              {t("headerCard.lastSeen")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatDate(state.lastVisitedAt)}
            </p>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-6 text-muted">
          {t("storageNotice")}
        </p>

        <Tabs
          value={state.preferences.homeTab}
          onValueChange={(value) => handleOpenTab(value as AccountTab)}
          className="mt-12"
        >
          <TabsList className="mx-auto mb-8 flex w-fit max-w-full flex-wrap justify-center">
            <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
            <TabsTrigger value="providers">{t("tabs.providers")}</TabsTrigger>
            <TabsTrigger value="sessions">{t("tabs.sessions")}</TabsTrigger>
            <TabsTrigger value="preferences">{t("tabs.preferences")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewPanel
              state={state}
              providers={mergedProviders}
              onOpenTab={handleOpenTab}
              onCreateSession={createSessionDraft}
              onOpenSession={handleOpenSession}
              formatDate={formatDate}
            />
          </TabsContent>

          <TabsContent value="providers">
            <ProvidersPanel
              providers={mergedProviders}
              onConnect={connectProvider}
              onDisconnect={disconnectProvider}
              formatDate={formatDate}
            />
          </TabsContent>

          <TabsContent value="sessions">
            <SessionsPanel
              sessions={state.sessions}
              providers={mergedProviders}
              onTogglePinned={toggleSessionPinned}
              onCreateSession={createSessionDraft}
              onOpenSession={(sessionId) => setSelectedSessionId(sessionId)}
              formatDate={formatDate}
            />
          </TabsContent>

          <TabsContent value="preferences">
            <PreferencesPanel
              preferences={state.preferences}
              availableModels={availableModels}
              onSave={savePreferences}
              onReset={resetAccount}
            />
          </TabsContent>
        </Tabs>
      </Container>

      <SessionDetailsDialog
        open={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSessionId(null);
          }
        }}
        session={selectedSession}
        providerName={
          selectedSession
            ? mergedProviders.find(
                (provider) => provider.id === selectedSession.providerId,
              )?.name ?? null
            : null
        }
        formatDate={formatDate}
      />
    </section>
  );
}
