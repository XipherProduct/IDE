"use client";

import { useEffect, useState } from "react";
import { providers } from "@/lib/providers";
import { createDefaultAccountState } from "./defaults";
import type {
  AccountPreferences,
  AccountProviderConnection,
  AccountSession,
  AccountState,
  AccountTab,
  AppearancePreference,
  DensityPreference,
  PlanStatus,
  SessionStatus,
} from "./types";

const ACCOUNT_STORAGE_KEY = "xipher-ai.account-mvp.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAccountTab(value: unknown): value is AccountTab {
  return (
    value === "overview" ||
    value === "providers" ||
    value === "sessions" ||
    value === "preferences"
  );
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return value === "live" || value === "idle" || value === "review";
}

function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === "dark" || value === "light";
}

function isDensityPreference(value: unknown): value is DensityPreference {
  return value === "cozy" || value === "compact";
}

function isPlanStatus(value: unknown): value is PlanStatus {
  return value === "alpha";
}

function sanitizeProviderConnections(
  value: unknown,
  defaults: AccountProviderConnection[],
) {
  if (!Array.isArray(value)) {
    return defaults;
  }

  const incoming = new Map<string, AccountProviderConnection>();

  for (const item of value) {
    if (!isRecord(item) || typeof item.providerId !== "string") {
      continue;
    }

    incoming.set(item.providerId, {
      providerId: item.providerId,
      connected: item.connected === true,
      maskedKey: typeof item.maskedKey === "string" ? item.maskedKey : null,
      last4: typeof item.last4 === "string" ? item.last4 : null,
      lastUpdatedAt:
        typeof item.lastUpdatedAt === "string" ? item.lastUpdatedAt : null,
    });
  }

  return defaults.map((provider) => incoming.get(provider.providerId) ?? provider);
}

function sanitizeSessions(value: unknown, defaults: AccountSession[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return defaults;
  }

  const sessions: AccountSession[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.providerId !== "string" ||
      typeof item.model !== "string" ||
      typeof item.updatedAt !== "string" ||
      !isSessionStatus(item.status) ||
      typeof item.summary !== "string" ||
      typeof item.messageCount !== "number" ||
      typeof item.tokenCount !== "number"
    ) {
      continue;
    }

    sessions.push({
      id: item.id,
      title: item.title,
      providerId: item.providerId,
      model: item.model,
      updatedAt: item.updatedAt,
      status: item.status,
      pinned: item.pinned === true,
      summary: item.summary,
      messageCount: item.messageCount,
      tokenCount: item.tokenCount,
    });
  }

  return sessions.length > 0 ? sessions : defaults;
}

function sanitizePreferences(
  value: unknown,
  defaults: AccountPreferences,
): AccountPreferences {
  if (!isRecord(value)) {
    return defaults;
  }

  return {
    name: typeof value.name === "string" ? value.name : defaults.name,
    email: typeof value.email === "string" ? value.email : defaults.email,
    defaultModel:
      typeof value.defaultModel === "string"
        ? value.defaultModel
        : defaults.defaultModel,
    appearance: isAppearancePreference(value.appearance)
      ? value.appearance
      : defaults.appearance,
    density: isDensityPreference(value.density)
      ? value.density
      : defaults.density,
    homeTab: isAccountTab(value.homeTab) ? value.homeTab : defaults.homeTab,
  };
}

function loadAccountState(): AccountState {
  const defaults = createDefaultAccountState();

  if (typeof window === "undefined") {
    return defaults;
  }

  const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);

  if (!raw) {
    return defaults;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return defaults;
    }

    return {
      version: 1,
      plan:
        isRecord(parsed.plan) &&
        typeof parsed.plan.name === "string" &&
        typeof parsed.plan.workspace === "string" &&
        isPlanStatus(parsed.plan.status) &&
        typeof parsed.plan.seatsUsed === "number" &&
        typeof parsed.plan.seatsLimit === "number"
          ? {
              name: parsed.plan.name,
              workspace: parsed.plan.workspace,
              status: parsed.plan.status,
              seatsUsed: parsed.plan.seatsUsed,
              seatsLimit: parsed.plan.seatsLimit,
            }
          : defaults.plan,
      usage:
        isRecord(parsed.usage) &&
        typeof parsed.usage.requests30d === "number" &&
        typeof parsed.usage.tokens30d === "number" &&
        typeof parsed.usage.spendUsd === "number" &&
        typeof parsed.usage.focusHours === "number"
          ? {
              requests30d: parsed.usage.requests30d,
              tokens30d: parsed.usage.tokens30d,
              spendUsd: parsed.usage.spendUsd,
              focusHours: parsed.usage.focusHours,
            }
          : defaults.usage,
      providers: sanitizeProviderConnections(parsed.providers, defaults.providers),
      sessions: sanitizeSessions(parsed.sessions, defaults.sessions),
      preferences: sanitizePreferences(parsed.preferences, defaults.preferences),
      lastVisitedAt:
        typeof parsed.lastVisitedAt === "string"
          ? parsed.lastVisitedAt
          : defaults.lastVisitedAt,
    };
  } catch {
    return defaults;
  }
}

function saveAccountState(state: AccountState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(state));
}

function createMaskedKey(providerId: string, rawKey: string) {
  const normalized = rawKey.replace(/\s+/g, "");
  const compactId = providerId.slice(0, 2).toUpperCase();
  const last4 = normalized.slice(-4).padStart(4, "•");

  return {
    maskedKey: `${compactId}-••••-${last4}`,
    last4,
  };
}

function getProviderIdForModel(model: string) {
  const match = providers.find((provider) => provider.models.includes(model));
  return match?.id ?? providers[0]?.id ?? "openai";
}

function touchState(state: AccountState): AccountState {
  return {
    ...state,
    lastVisitedAt: new Date().toISOString(),
  };
}

export function useAccountStore() {
  const [state, setState] = useState<AccountState | null>(null);

  useEffect(() => {
    setState(loadAccountState());
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    saveAccountState(state);
  }, [state]);

  function updateState(updater: (current: AccountState) => AccountState) {
    setState((current) => {
      if (!current) {
        return current;
      }

      return touchState(updater(current));
    });
  }

  function setActiveTab(tab: AccountTab) {
    updateState((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        homeTab: tab,
      },
    }));
  }

  function connectProvider(providerId: string, rawKey: string) {
    const normalized = rawKey.trim();

    if (!normalized) {
      return false;
    }

    const { maskedKey, last4 } = createMaskedKey(providerId, normalized);

    updateState((current) => ({
      ...current,
      providers: current.providers.map((provider) =>
        provider.providerId === providerId
          ? {
              ...provider,
              connected: true,
              maskedKey,
              last4,
              lastUpdatedAt: new Date().toISOString(),
            }
          : provider,
      ),
    }));

    return true;
  }

  function disconnectProvider(providerId: string) {
    updateState((current) => ({
      ...current,
      providers: current.providers.map((provider) =>
        provider.providerId === providerId
          ? {
              ...provider,
              connected: false,
              maskedKey: null,
              last4: null,
              lastUpdatedAt: new Date().toISOString(),
            }
          : provider,
      ),
    }));
  }

  function toggleSessionPinned(sessionId: string) {
    updateState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, pinned: !session.pinned, updatedAt: new Date().toISOString() }
          : session,
      ),
    }));
  }

  function createSessionDraft() {
    updateState((current) => {
      const providerId = getProviderIdForModel(current.preferences.defaultModel);
      const draftNumber = current.sessions.length + 1;

      return {
        ...current,
        sessions: [
          {
            id:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `session-draft-${draftNumber}`,
            title: `Session draft ${draftNumber}`,
            providerId,
            model: current.preferences.defaultModel,
            updatedAt: new Date().toISOString(),
            status: "live",
            pinned: false,
            summary:
              "Fresh local draft created in the MVP dashboard. Safe to use for front-end validation and UI review.",
            messageCount: 1,
            tokenCount: 320,
          },
          ...current.sessions,
        ],
      };
    });
  }

  function savePreferences(preferences: AccountPreferences) {
    updateState((current) => ({
      ...current,
      preferences,
    }));
  }

  function resetAccount() {
    setState(createDefaultAccountState());
  }

  return {
    state,
    hydrated: state !== null,
    setActiveTab,
    connectProvider,
    disconnectProvider,
    toggleSessionPinned,
    createSessionDraft,
    savePreferences,
    resetAccount,
  };
}
