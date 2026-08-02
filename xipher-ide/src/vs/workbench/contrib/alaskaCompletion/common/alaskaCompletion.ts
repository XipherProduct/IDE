/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaCompletionMode = 'auto' | 'manual' | 'off';
export type AlaskaCompletionTier = 'fast' | 'balanced';
export type AlaskaCompletionFeedbackAction = 'accept' | 'dismiss' | 'partial_accept';

export interface IAlaskaCompletionRecentEdit {
	readonly path: string;
	readonly content: string;
	readonly ageMs: number;
}

export interface IAlaskaCompletionRepoHint {
	readonly path: string;
	readonly content: string;
	readonly score: number;
}

export interface IAlaskaCompletionRequest {
	readonly uri: URI;
	readonly language: string;
	readonly prefix: string;
	readonly suffix: string;
	readonly repoHints?: readonly IAlaskaCompletionRepoHint[];
	readonly recentEdits?: readonly IAlaskaCompletionRecentEdit[];
	readonly maxTokens?: number;
	readonly modelTier?: AlaskaCompletionTier;
}

export interface IAlaskaCompletionResult {
	readonly id: string;
	readonly suggestion: string;
	readonly cached: boolean;
	readonly modelUsed: string;
	readonly latencyMs: number;
	readonly outputTokens: number;
}

export interface IAlaskaCompletionFeedback {
	readonly completionId: string;
	readonly action: AlaskaCompletionFeedbackAction;
	readonly dwellMs: number;
	readonly acceptedChars?: number;
}

export interface IAlaskaCompletionStatus {
	readonly enabled: boolean;
	readonly mode: AlaskaCompletionMode;
	readonly tier: AlaskaCompletionTier;
}

export const IAlaskaCompletionService = createDecorator<IAlaskaCompletionService>('alaskaCompletionService');

export interface IAlaskaCompletionService {
	readonly _serviceBrand: undefined;

	readonly status: IAlaskaCompletionStatus;
	readonly onDidChangeStatus: Event<IAlaskaCompletionStatus>;

	complete(req: IAlaskaCompletionRequest, token: CancellationToken): Promise<IAlaskaCompletionResult | undefined>;
	sendFeedback(feedback: IAlaskaCompletionFeedback): void;

	isEnabledForLanguage(languageId: string): boolean;
	getMode(): AlaskaCompletionMode;
	getTier(): AlaskaCompletionTier;
	getDebounceMs(): number;
	getMaxTokens(): number;
	setMode(mode: AlaskaCompletionMode): Promise<void>;
	toggleEnabled(): Promise<void>;
}

export const ALASKA_COMPLETION_CONFIG_ROOT = 'alaska.completion';
export const ALASKA_COMPLETION_ENABLED = 'alaska.completion.enabled';
export const ALASKA_COMPLETION_MODE = 'alaska.completion.mode';
export const ALASKA_COMPLETION_TIER = 'alaska.completion.tier';
export const ALASKA_COMPLETION_LANGUAGES = 'alaska.completion.languages';
export const ALASKA_COMPLETION_DEBOUNCE = 'alaska.completion.debounceMs';
export const ALASKA_COMPLETION_MAX_TOKENS = 'alaska.completion.maxTokens';

export const ALASKA_COMPLETION_DEFAULT_DEBOUNCE_MS = 250;
export const ALASKA_COMPLETION_DEFAULT_MAX_TOKENS = 256;
export const ALASKA_COMPLETION_MIN_PREFIX_LEN = 3;
