export type AccountTab = "overview" | "providers" | "sessions" | "preferences";
export type SessionStatus = "live" | "idle" | "review";
export type AppearancePreference = "dark" | "light";
export type DensityPreference = "cozy" | "compact";
export type PlanStatus = "alpha";

export interface AccountProviderConnection {
  providerId: string;
  connected: boolean;
  maskedKey: string | null;
  last4: string | null;
  lastUpdatedAt: string | null;
}

export interface AccountSession {
  id: string;
  title: string;
  providerId: string;
  model: string;
  updatedAt: string;
  status: SessionStatus;
  pinned: boolean;
  summary: string;
  messageCount: number;
  tokenCount: number;
}

export interface AccountPlan {
  name: string;
  workspace: string;
  status: PlanStatus;
  seatsUsed: number;
  seatsLimit: number;
}

export interface AccountUsage {
  requests30d: number;
  tokens30d: number;
  spendUsd: number;
  focusHours: number;
}

export interface AccountPreferences {
  name: string;
  email: string;
  defaultModel: string;
  appearance: AppearancePreference;
  density: DensityPreference;
  homeTab: AccountTab;
}

export interface AccountState {
  version: 1;
  plan: AccountPlan;
  usage: AccountUsage;
  providers: AccountProviderConnection[];
  sessions: AccountSession[];
  preferences: AccountPreferences;
  lastVisitedAt: string;
}
