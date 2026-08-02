"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pin, PinOff, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Provider } from "@/lib/providers";
import type {
  AccountProviderConnection,
  AccountSession,
} from "@/lib/account/types";

interface SessionsPanelProps {
  sessions: AccountSession[];
  providers: Array<Provider & { connection: AccountProviderConnection }>;
  onTogglePinned: (sessionId: string) => void;
  onCreateSession: () => void;
  onOpenSession: (sessionId: string) => void;
  formatDate: (value: string) => string;
}

type SessionsFilter = "all" | "pinned" | "active";

export function SessionsPanel({
  sessions,
  providers,
  onTogglePinned,
  onCreateSession,
  onOpenSession,
  formatDate,
}: SessionsPanelProps) {
  const t = useTranslations("account");
  const [filter, setFilter] = useState<SessionsFilter>("all");

  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const sortedSessions = [...sessions].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  const visibleSessions = sortedSessions.filter((session) => {
    if (filter === "pinned") {
      return session.pinned;
    }

    if (filter === "active") {
      return session.status === "live";
    }

    return true;
  });

  const filters: SessionsFilter[] = ["all", "pinned", "active"];

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("sessions.title")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
          {t("sessions.subtitle")}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {filters.map((currentFilter) => (
            <Button
              key={currentFilter}
              variant={filter === currentFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(currentFilter)}
            >
              {t(`sessions.filters.${currentFilter}`)}
            </Button>
          ))}
          <Button variant="secondary" size="sm" onClick={onCreateSession}>
            <Sparkles className="h-4 w-4" />
            {t("actions.createSession")}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {visibleSessions.length > 0 ? (
          visibleSessions.map((session) => {
            const provider = providerMap.get(session.providerId);

            return (
              <Card key={session.id} className="hover:border-accent/30">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {session.title}
                      </h3>
                      <Badge>{t(`status.${session.status}`)}</Badge>
                      {session.pinned && (
                        <Badge variant="secondary">
                          {t("sessions.dialog.pinned")}
                        </Badge>
                      )}
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-muted">
                      {session.summary}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>
                        {t("sessions.provider")}:{" "}
                        {provider?.name ?? session.providerId}
                      </span>
                      <span>{session.model}</span>
                      <span>
                        {t("sessions.updated")}: {formatDate(session.updatedAt)}
                      </span>
                      <span>
                        {t("sessions.messages")}: {session.messageCount}
                      </span>
                      <span>
                        {t("sessions.tokens")}:{" "}
                        {session.tokenCount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTogglePinned(session.id)}
                    >
                      {session.pinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                      {session.pinned ? t("actions.unpin") : t("actions.pin")}
                    </Button>
                    <Button size="sm" onClick={() => onOpenSession(session.id)}>
                      {t("actions.viewDetails")}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">
            {t("sessions.noResults")}
          </p>
        )}
      </div>
    </div>
  );
}
