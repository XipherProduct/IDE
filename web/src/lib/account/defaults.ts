import { providers } from "@/lib/providers";
import type {
  AccountProviderConnection,
  AccountSession,
  AccountState,
} from "./types";

function minutesAgoToIso(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function createDefaultProviders(): AccountProviderConnection[] {
  const presets = new Map<
    string,
    { maskedKey: string; last4: string; minutesAgo: number }
  >([
    ["openai", { maskedKey: "OA-••••-7F9K", last4: "7F9K", minutesAgo: 95 }],
    ["anthropic", { maskedKey: "AN-••••-Q1M4", last4: "Q1M4", minutesAgo: 240 }],
    ["deepseek", { maskedKey: "DS-••••-81XR", last4: "81XR", minutesAgo: 430 }],
  ]);

  return providers.map((provider) => {
    const preset = presets.get(provider.id);

    if (!preset) {
      return {
        providerId: provider.id,
        connected: false,
        maskedKey: null,
        last4: null,
        lastUpdatedAt: null,
      };
    }

    return {
      providerId: provider.id,
      connected: true,
      maskedKey: preset.maskedKey,
      last4: preset.last4,
      lastUpdatedAt: minutesAgoToIso(preset.minutesAgo),
    };
  });
}

function createDefaultSessions(): AccountSession[] {
  return [
    {
      id: "session-release-audit",
      title: "Release note cleanup",
      providerId: "anthropic",
      model: "Claude 4 Sonnet",
      updatedAt: minutesAgoToIso(38),
      status: "live",
      pinned: true,
      summary:
        "Final pass for release notes, command naming, and migration warnings before the next CLI drop.",
      messageCount: 24,
      tokenCount: 12840,
    },
    {
      id: "session-provider-failover",
      title: "Provider failover rehearsal",
      providerId: "openai",
      model: "GPT-4o",
      updatedAt: minutesAgoToIso(130),
      status: "review",
      pinned: false,
      summary:
        "Compared fallback answers between OpenAI and DeepSeek, then logged UX gaps for future hosted routing.",
      messageCount: 17,
      tokenCount: 9360,
    },
    {
      id: "session-install-triage",
      title: "CLI install issue triage",
      providerId: "deepseek",
      model: "DeepSeek-V3",
      updatedAt: minutesAgoToIso(420),
      status: "idle",
      pinned: false,
      summary:
        "Reviewed Linux onboarding errors, package prerequisites, and shell environment edge cases.",
      messageCount: 11,
      tokenCount: 5110,
    },
    {
      id: "session-docs-sprint",
      title: "Docs extraction sprint",
      providerId: "google",
      model: "Gemini 2.5 Pro",
      updatedAt: minutesAgoToIso(870),
      status: "review",
      pinned: true,
      summary:
        "Drafted migration snippets, checked prompt examples, and condensed the getting-started path.",
      messageCount: 31,
      tokenCount: 16420,
    },
    {
      id: "session-roadmap-pass",
      title: "Roadmap synthesis",
      providerId: "xai",
      model: "Grok-3-mini",
      updatedAt: minutesAgoToIso(1720),
      status: "idle",
      pinned: false,
      summary:
        "Clustered roadmap notes across sessions, tool calling, and future managed team controls.",
      messageCount: 9,
      tokenCount: 4020,
    },
  ];
}

export function createDefaultAccountState(): AccountState {
  return {
    version: 1,
    plan: {
      name: "Operator Preview",
      workspace: "CLI-first sandbox",
      status: "alpha",
      seatsUsed: 1,
      seatsLimit: 3,
    },
    usage: {
      requests30d: 186,
      tokens30d: 248_000,
      spendUsd: 14.2,
      focusHours: 11.5,
    },
    providers: createDefaultProviders(),
    sessions: createDefaultSessions(),
    preferences: {
      name: "Alex Xipher",
      email: "alex@local-placeholder.dev",
      defaultModel: "Claude 4 Sonnet",
      appearance: "dark",
      density: "cozy",
      homeTab: "overview",
    },
    lastVisitedAt: new Date().toISOString(),
  };
}
