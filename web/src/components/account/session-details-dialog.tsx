"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AccountSession } from "@/lib/account/types";

interface SessionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AccountSession | null;
  providerName: string | null;
  formatDate: (value: string) => string;
}

export function SessionDetailsDialog({
  open,
  onOpenChange,
  session,
  providerName,
  formatDate,
}: SessionDetailsDialogProps) {
  const t = useTranslations("account");

  if (!session) {
    return null;
  }

  const details = [
    {
      label: t("sessions.provider"),
      value: providerName ?? session.providerId,
    },
    {
      label: t("preferences.defaultModel"),
      value: session.model,
    },
    {
      label: t("sessions.updated"),
      value: formatDate(session.updatedAt),
    },
    {
      label: t("sessions.dialog.metrics"),
      value: `${t("sessions.messages")}: ${session.messageCount} / ${t(
        "sessions.tokens",
      )}: ${session.tokenCount.toLocaleString()}`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t(`status.${session.status}`)}</Badge>
              {session.pinned && (
                <Badge variant="secondary">{t("sessions.dialog.pinned")}</Badge>
              )}
            </div>
            <DialogTitle className="text-2xl font-semibold text-foreground">
              {session.title}
            </DialogTitle>
            <p className="text-sm leading-6 text-muted">{session.summary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label} className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase text-muted">{detail.label}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
