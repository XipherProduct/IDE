/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IAlaskaAuthService, ALASKA_API_BASE } from '../../alaskaChat/browser/alaskaAuthService.js';
import { abortSignalFrom, signChecksum } from '../../alaskaChat/browser/alaskaApiClient.js';
import {
	IAlaskaCompletionService,
	IAlaskaCompletionRequest,
	IAlaskaCompletionResult,
	IAlaskaCompletionFeedback,
	IAlaskaCompletionStatus,
	AlaskaCompletionMode,
	AlaskaCompletionTier,
	ALASKA_COMPLETION_CONFIG_ROOT,
	ALASKA_COMPLETION_ENABLED,
	ALASKA_COMPLETION_MODE,
	ALASKA_COMPLETION_TIER,
	ALASKA_COMPLETION_LANGUAGES,
	ALASKA_COMPLETION_DEBOUNCE,
	ALASKA_COMPLETION_MAX_TOKENS,
	ALASKA_COMPLETION_DEFAULT_DEBOUNCE_MS,
	ALASKA_COMPLETION_DEFAULT_MAX_TOKENS,
} from '../common/alaskaCompletion.js';

const COMPLETE_PATH = '/api/ai/complete';
const FEEDBACK_PATH = '/api/ai/complete/feedback';
const FEEDBACK_FLUSH_INTERVAL_MS = 5000;
const FEEDBACK_BATCH_MAX = 25;

interface ICompleteWireResponse {
	readonly id: string;
	readonly suggestion: string;
	readonly cached: boolean;
	readonly model_used: string;
	readonly latency_ms: number;
	readonly output_tokens: number;
}

interface ICompleteWireRequest {
	readonly prefix: string;
	readonly suffix: string;
	readonly language: string;
	readonly path: string;
	readonly repo_hints?: ReadonlyArray<{ readonly path: string; readonly content: string; readonly score: number }>;
	readonly recent_edits?: ReadonlyArray<{ readonly path: string; readonly content: string; readonly age_ms: number }>;
	readonly max_tokens?: number;
	readonly model_tier?: AlaskaCompletionTier;
}

export class AlaskaCompletionService extends Disposable implements IAlaskaCompletionService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeStatus = this._register(new Emitter<IAlaskaCompletionStatus>());
	readonly onDidChangeStatus: Event<IAlaskaCompletionStatus> = this._onDidChangeStatus.event;

	private readonly feedbackBatch: IAlaskaCompletionFeedback[] = [];
	private feedbackTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@IConfigurationService private readonly configService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		this._register(this.configService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(ALASKA_COMPLETION_CONFIG_ROOT)) {
				this._onDidChangeStatus.fire(this.status);
			}
		}));

		this._register(this.authService.onDidChangeState(() => {
			this._onDidChangeStatus.fire(this.status);
		}));

		this._register({
			dispose: () => {
				if (this.feedbackTimer) {
					clearTimeout(this.feedbackTimer);
					this.feedbackTimer = undefined;
				}
				if (this.feedbackBatch.length > 0) {
					void this.flushFeedback();
				}
			},
		});
	}

	get status(): IAlaskaCompletionStatus {
		return {
			enabled: this.isGloballyEnabled(),
			mode: this.getMode(),
			tier: this.getTier(),
		};
	}

	async complete(req: IAlaskaCompletionRequest, token: CancellationToken): Promise<IAlaskaCompletionResult | undefined> {
		if (!this.isGloballyEnabled()) { return undefined; }
		if (!this.isEnabledForLanguage(req.language)) { return undefined; }
		if (token.isCancellationRequested) { return undefined; }

		await this.authService.getFreshAccessToken();
		const creds = await this.authService.getCredentials();
		const userId = this.authService.state.user?.id;
		if (!creds || !userId) { return undefined; }
		if (!creds.hmacSecret || !creds.clientKey) { return undefined; }
		if (token.isCancellationRequested) { return undefined; }

		const wire: ICompleteWireRequest = {
			prefix: req.prefix,
			suffix: req.suffix,
			language: req.language,
			path: req.uri.fsPath,
			repo_hints: req.repoHints?.length
				? req.repoHints.map(h => ({ path: h.path, content: h.content, score: h.score }))
				: undefined,
			recent_edits: req.recentEdits?.length
				? req.recentEdits.map(e => ({ path: e.path, content: e.content, age_ms: e.ageMs }))
				: undefined,
			max_tokens: req.maxTokens ?? this.getMaxTokens(),
			model_tier: req.modelTier ?? this.getTier(),
		};

		const checksum = await signChecksum(creds.hmacSecret, userId, 'POST', COMPLETE_PATH);
		if (token.isCancellationRequested) { return undefined; }

		let res: Response;
		try {
			res = await fetch(`${ALASKA_API_BASE}${COMPLETE_PATH}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Authorization': `Bearer ${creds.accessToken}`,
					'X-Client-Key': creds.clientKey,
					'X-Checksum': checksum,
				},
				body: JSON.stringify(wire),
				signal: abortSignalFrom(token),
			});
		} catch (err) {
			if (token.isCancellationRequested) { return undefined; }
			this.logService.trace('[alaska.completion] network error', err);
			return undefined;
		}

		if (res.status === 401) {
			try { await this.authService.signOut(); } catch { /* best effort */ }
			return undefined;
		}
		if (res.status === 429 || res.status === 504) {
			return undefined;
		}
		if (!res.ok) {
			return undefined;
		}

		let body: ICompleteWireResponse;
		try {
			body = await res.json() as ICompleteWireResponse;
		} catch (err) {
			this.logService.trace('[alaska.completion] non-json response', err);
			return undefined;
		}
		if (!body || !body.suggestion) { return undefined; }

		return {
			id: body.id,
			suggestion: body.suggestion,
			cached: !!body.cached,
			modelUsed: body.model_used,
			latencyMs: body.latency_ms,
			outputTokens: body.output_tokens,
		};
	}

	sendFeedback(feedback: IAlaskaCompletionFeedback): void {
		if (!feedback.completionId) { return; }
		this.feedbackBatch.push(feedback);
		if (this.feedbackBatch.length >= FEEDBACK_BATCH_MAX) {
			void this.flushFeedback();
			return;
		}
		if (!this.feedbackTimer) {
			this.feedbackTimer = setTimeout(() => {
				this.feedbackTimer = undefined;
				void this.flushFeedback();
			}, FEEDBACK_FLUSH_INTERVAL_MS);
		}
	}

	private async flushFeedback(): Promise<void> {
		if (this.feedbackBatch.length === 0) { return; }
		const batch = this.feedbackBatch.splice(0);
		const creds = await this.authService.getCredentials();
		if (!creds) { return; }
		await Promise.all(batch.map(fb => this.sendFeedbackOne(fb).catch(err => {
			this.logService.trace('[alaska.completion] feedback failed', err);
		})));
	}

	private async sendFeedbackOne(fb: IAlaskaCompletionFeedback): Promise<void> {
		const creds = await this.authService.getCredentials();
		if (!creds) { return; }
		await fetch(`${ALASKA_API_BASE}${FEEDBACK_PATH}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'Authorization': `Bearer ${creds.accessToken}`,
			},
			body: JSON.stringify({
				completion_id: fb.completionId,
				action: fb.action,
				dwell_ms: fb.dwellMs,
				accepted_chars: fb.acceptedChars,
			}),
		});
	}

	isEnabledForLanguage(languageId: string): boolean {
		const langConfig = this.configService.getValue<Record<string, boolean>>(ALASKA_COMPLETION_LANGUAGES) ?? {};
		return langConfig[languageId] !== false;
	}

	getMode(): AlaskaCompletionMode {
		const raw = this.configService.getValue<AlaskaCompletionMode>(ALASKA_COMPLETION_MODE);
		if (raw === 'manual' || raw === 'off') { return raw; }
		return 'auto';
	}

	getTier(): AlaskaCompletionTier {
		const raw = this.configService.getValue<AlaskaCompletionTier>(ALASKA_COMPLETION_TIER);
		return raw === 'balanced' ? 'balanced' : 'fast';
	}

	getDebounceMs(): number {
		const raw = this.configService.getValue<number>(ALASKA_COMPLETION_DEBOUNCE);
		if (typeof raw !== 'number' || raw < 100 || raw > 1000) {
			return ALASKA_COMPLETION_DEFAULT_DEBOUNCE_MS;
		}
		return Math.round(raw);
	}

	getMaxTokens(): number {
		const raw = this.configService.getValue<number>(ALASKA_COMPLETION_MAX_TOKENS);
		if (typeof raw !== 'number' || raw < 32 || raw > 512) {
			return ALASKA_COMPLETION_DEFAULT_MAX_TOKENS;
		}
		return Math.round(raw);
	}

	async setMode(mode: AlaskaCompletionMode): Promise<void> {
		await this.configService.updateValue(ALASKA_COMPLETION_MODE, mode);
	}

	async toggleEnabled(): Promise<void> {
		const cur = this.configService.getValue<boolean>(ALASKA_COMPLETION_ENABLED);
		await this.configService.updateValue(ALASKA_COMPLETION_ENABLED, cur === false);
	}

	private isGloballyEnabled(): boolean {
		const enabled = this.configService.getValue<boolean>(ALASKA_COMPLETION_ENABLED);
		if (enabled === false) { return false; }
		if (this.getMode() === 'off') { return false; }
		if (this.authService.state.status !== 'signed-in') { return false; }
		return true;
	}
}
