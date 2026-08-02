/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IAlaskaAuthService, ALASKA_API_BASE } from './alaskaAuthService.js';
import { IAlaskaCodeContext } from './alaskaContextService.js';
import { IAlaskaTool, IAlaskaToolCall } from './alaskaTools.js';
import { abortSignalFrom, parseAlaskaApiError, signChecksum } from './alaskaApiClient.js';
import { AlaskaAgentMode, ITaskItem } from '../common/alaskaAgentMode.js';
import { IAlaskaBYOActive, IAlaskaBYOService } from '../common/alaskaByo.js';

export const ALASKA_PRIVACY_REDACT_PII_KEY = 'alaska.privacy.redactPII';

export interface IAlaskaTextPart {
	readonly type: 'text';
	readonly text: string;
}

export interface IAlaskaImagePart {
	readonly type: 'image_url';
	readonly image_url: {
		readonly url: string;
		readonly detail?: 'auto' | 'low' | 'high';
	};
}

export type IAlaskaContentPart = IAlaskaTextPart | IAlaskaImagePart;

export interface IAlaskaChatMessage {
	readonly role: 'user' | 'assistant' | 'system' | 'tool';
	readonly content: string | readonly IAlaskaContentPart[];
	readonly tool_call_id?: string;
	readonly tool_calls?: {
		readonly id: string;
		readonly type: 'function';
		readonly function: { readonly name: string; readonly arguments: string };
	}[];
}

export type AlaskaReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export const ALASKA_REASONING_EFFORTS: readonly AlaskaReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];

const PENDING_TOOLS_HARD_CAP = 32;
const PENDING_TOOL_MAX_AGE_MS = 5 * 60 * 1000;

interface IPendingToolSlot {
	id: string;
	name: string;
	argumentsJson: string;
	createdAt: number;
}

function prunePendingTools(map: Map<number, IPendingToolSlot>, now: number): void {
	for (const [idx, slot] of map) {
		if (now - slot.createdAt > PENDING_TOOL_MAX_AGE_MS) {
			map.delete(idx);
		}
	}
}

export interface IAlaskaChatRequest {
	readonly model?: string;
	readonly messages: IAlaskaChatMessage[];
	readonly context?: IAlaskaCodeContext;
	readonly tools?: readonly IAlaskaTool[];
	readonly replyMode?: 'snippet';
	readonly reasoningEffort?: AlaskaReasoningEffort;
	readonly agentMode?: AlaskaAgentMode;
	readonly approvedTasklist?: readonly ITaskItem[];
}

export interface IAlaskaModel {
	readonly id: string;
	readonly label: string;
	readonly provider: string;
	readonly description: string;
	readonly context_tokens: number;
	readonly requires_plan: string;
	readonly supports_reasoning_effort?: boolean;
	readonly supports_vision?: boolean;
}

export interface IAlaskaModelsResponse {
	readonly items: IAlaskaModel[];
	readonly plan: string;
}

export interface IAlaskaUsage {
	readonly period: string;
	readonly plan: string;
	readonly requests: number;
	readonly limit: number;
	readonly input: number;
	readonly output: number;
	readonly max_tokens: number;
	readonly credits_used?: number;
	readonly weekly_budget?: number;
	readonly carried_in?: number;
}

export interface IAlaskaChatDelta {
	readonly kind: 'delta';
	readonly text: string;
}

export interface IAlaskaChatReasoning {
	readonly kind: 'reasoning';
	readonly text: string;
}

export interface IAlaskaChatToolCallEvent {
	readonly kind: 'tool_call';
	readonly call: IAlaskaToolCall;
}

export interface IAlaskaChatToolProgressEvent {
	readonly kind: 'tool_progress';
	readonly id: string;
	readonly name: string;
	readonly partialArguments: string;
}

export interface IAlaskaChatDone {
	readonly kind: 'done';
	readonly usage?: { input: number; output: number };
	readonly finishReason?: string;
}

export interface IAlaskaChatError {
	readonly kind: 'error';
	readonly message: string;
	readonly code?: 'truncated_tool_call';
}

export type IAlaskaChatEvent =
	| IAlaskaChatDelta
	| IAlaskaChatReasoning
	| IAlaskaChatToolCallEvent
	| IAlaskaChatToolProgressEvent
	| IAlaskaChatDone
	| IAlaskaChatError;

export interface IAlaskaPlanChangeDescriptor {
	readonly path: string;
	readonly action: 'create' | 'edit' | 'delete';
	readonly summary: string;
}

export type AlaskaPendingPlanMode = 'deciding' | 'editing';

export interface IAlaskaPendingPlan {
	readonly id: string;
	readonly rationale: string;
	readonly changes: readonly IAlaskaPlanChangeDescriptor[];
	readonly editedFromOriginal: boolean;
	readonly mode: AlaskaPendingPlanMode;
	readonly approve: () => void;
	readonly decline: () => void;
	readonly startEdit: () => void;
	readonly saveEdit: () => void;
	readonly cancelEdit: () => void;
}

export const IAlaskaChatService = createDecorator<IAlaskaChatService>('alaskaChatService');

export interface IAlaskaChatService {
	readonly _serviceBrand: undefined;

	stream(req: IAlaskaChatRequest, token: CancellationToken): AsyncIterable<IAlaskaChatEvent>;
	models(token: CancellationToken): Promise<IAlaskaModelsResponse>;
	usage(token: CancellationToken): Promise<IAlaskaUsage>;
	summarizeSession(messages: readonly IAlaskaChatMessage[], token: CancellationToken): Promise<string>;

	readonly pendingPlans: readonly IAlaskaPendingPlan[];
	readonly onDidChangePendingPlans: Event<void>;
	registerPendingPlan(plan: IAlaskaPendingPlan): void;
	updatePendingPlan(id: string, partial: { rationale?: string; changes?: readonly IAlaskaPlanChangeDescriptor[]; editedFromOriginal?: boolean; mode?: AlaskaPendingPlanMode }): void;
	clearPendingPlan(id: string): void;
}

export class AlaskaChatService extends Disposable implements IAlaskaChatService {
	declare readonly _serviceBrand: undefined;

	private readonly _pendingPlans: IAlaskaPendingPlan[] = [];
	private readonly _onDidChangePendingPlans = this._register(new Emitter<void>());
	readonly onDidChangePendingPlans: Event<void> = this._onDidChangePendingPlans.event;

	get pendingPlans(): readonly IAlaskaPendingPlan[] {
		return this._pendingPlans;
	}

	registerPendingPlan(plan: IAlaskaPendingPlan): void {
		this._pendingPlans.push(plan);
		this._onDidChangePendingPlans.fire();
	}

	updatePendingPlan(id: string, partial: { rationale?: string; changes?: readonly IAlaskaPlanChangeDescriptor[]; editedFromOriginal?: boolean; mode?: AlaskaPendingPlanMode }): void {
		const idx = this._pendingPlans.findIndex(p => p.id === id);
		if (idx < 0) {
			return;
		}
		const current = this._pendingPlans[idx];
		this._pendingPlans[idx] = {
			...current,
			rationale: partial.rationale ?? current.rationale,
			changes: partial.changes ?? current.changes,
			editedFromOriginal: partial.editedFromOriginal ?? current.editedFromOriginal,
			mode: partial.mode ?? current.mode,
		};
		this._onDidChangePendingPlans.fire();
	}

	clearPendingPlan(id: string): void {
		const idx = this._pendingPlans.findIndex(p => p.id === id);
		if (idx < 0) {
			return;
		}
		this._pendingPlans.splice(idx, 1);
		this._onDidChangePendingPlans.fire();
	}

	constructor(
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@ILogService private readonly logService: ILogService,
		@IAlaskaBYOService private readonly byoService: IAlaskaBYOService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
	}

	private shouldRedactPII(): boolean {
		return this.configurationService.getValue<boolean>(ALASKA_PRIVACY_REDACT_PII_KEY) === true;
	}

	async models(token: CancellationToken): Promise<IAlaskaModelsResponse> {
		await this.authService.getFreshAccessToken();
		const creds = await this.authService.getCredentials();
		const userId = this.authService.state.user?.id;
		if (!creds || !userId) {
			throw new Error('Not signed in.');
		}
		if (!creds.hmacSecret || !creds.clientKey) {
			throw new Error('Missing API signing keys — please sign out and sign in again.');
		}

		const path = '/api/ai/models';
		const checksum = await signChecksum(creds.hmacSecret, userId, 'GET', path);
		const res = await fetch(`${ALASKA_API_BASE}${path}`, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Authorization': `Bearer ${creds.accessToken}`,
				'X-Client-Key': creds.clientKey,
				'X-Checksum': checksum,
			},
			signal: abortSignalFrom(token),
		});
		if (res.status === 401) {
			try { await this.authService.signOut(); } catch { }
			throw new Error('Your session expired. Run `Alaska AI: Sign In` from the command palette to re-authenticate.');
		}
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(parseAlaskaApiError(res.status, text));
		}
		return res.json() as Promise<IAlaskaModelsResponse>;
	}

	async usage(token: CancellationToken): Promise<IAlaskaUsage> {
		await this.authService.getFreshAccessToken();
		const creds = await this.authService.getCredentials();
		const userId = this.authService.state.user?.id;
		if (!creds || !userId) {
			throw new Error('Not signed in.');
		}
		if (!creds.hmacSecret || !creds.clientKey) {
			throw new Error('Missing API signing keys — please sign out and sign in again.');
		}

		const path = '/api/ai/usage';
		const checksum = await signChecksum(creds.hmacSecret, userId, 'GET', path);
		const res = await fetch(`${ALASKA_API_BASE}${path}`, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Authorization': `Bearer ${creds.accessToken}`,
				'X-Client-Key': creds.clientKey,
				'X-Checksum': checksum,
			},
			signal: abortSignalFrom(token),
		});
		if (res.status === 401) {
			try { await this.authService.signOut(); } catch { }
			throw new Error('Your session expired. Run `Alaska AI: Sign In` from the command palette to re-authenticate.');
		}
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(parseAlaskaApiError(res.status, text));
		}
		return res.json() as Promise<IAlaskaUsage>;
	}

	async summarizeSession(messages: readonly IAlaskaChatMessage[], token: CancellationToken): Promise<string> {
		const stripped: IAlaskaChatMessage[] = [];
		for (const m of messages) {
			if (m.role !== 'user' && m.role !== 'assistant') { continue; }
			const text = flattenContent(m.content).slice(0, 1200);
			if (!text) { continue; }
			stripped.push({ role: m.role, content: text });
			if (stripped.length >= 4) { break; }
		}
		if (stripped.length === 0) {
			return '';
		}
		const prompt: IAlaskaChatMessage[] = [
			{
				role: 'system',
				// allow-any-unicode-next-line
				content: 'You name chat sessions. Read the user/assistant exchange and reply with a 2-5 word title in the SAME LANGUAGE the user wrote in. Reply with the title only — no quotes, no markdown, no period at the end. Examples: "null check guard", "fix login redirect", "refactor pricing model", "анализ метрик БД", "приветствие".',
			},
			...stripped,
		];
		let acc = '';
		for await (const ev of this.stream({ messages: prompt, reasoningEffort: 'low' }, token)) {
			if (ev.kind === 'delta') { acc += ev.text; }
			else if (ev.kind === 'error') { throw new Error(ev.message); }
			else if (ev.kind === 'done') { break; }
		}
		const firstLine = acc
			.replace(/<\/?thinking>[\s\S]*?(?=<\/?thinking>|$)/gi, '')
			.replace(/[`*_#~]+/g, '')
			.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? '';
		const cleaned = firstLine
			// allow-any-unicode-next-line
			.replace(/^[\s"'«»“”‹›]+|[\s"'«»“”‹›.,;:!?]+$/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		return cleaned.slice(0, 60);
	}

	async *stream(req: IAlaskaChatRequest, token: CancellationToken): AsyncIterable<IAlaskaChatEvent> {
		if (this.shouldRedactPII()) {
			req = { ...req, messages: redactUserMessages(req.messages) };
		}
		const byo = await this.byoService.getActive();
		if (byo) {
			yield* this.streamBYO(req, byo, token);
			return;
		}
		await this.authService.getFreshAccessToken();
		const creds = await this.authService.getCredentials();
		if (!creds) {
			yield { kind: 'error', message: 'Not signed in. Click Sign in to authorize with Alaska AI.' };
			return;
		}
		const userId = this.authService.state.user?.id;
		if (!userId) {
			yield { kind: 'error', message: 'Missing user identity — please sign in again.' };
			return;
		}
		if (!creds.hmacSecret || !creds.clientKey) {
			yield {
				kind: 'error',
				message: 'Missing API signing keys — please sign out and sign in again.',
			};
			return;
		}

		const payload = buildPayload(req);
		const path = '/api/ai/chat';
		const checksum = await signChecksum(creds.hmacSecret, userId, 'POST', path);

		let res: Response;
		try {
			res = await fetch(`${ALASKA_API_BASE}${path}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'text/event-stream',
					'Authorization': `Bearer ${creds.accessToken}`,
					'X-Client-Key': creds.clientKey,
					'X-Checksum': checksum,
				},
				body: JSON.stringify(payload),
				signal: abortSignalFrom(token),
			});
		} catch (err) {
			this.logService.warn('[alaska.chat] request failed', err);
			yield { kind: 'error', message: err instanceof Error ? err.message : 'Network error' };
			return;
		}

		if (res.status === 401) {
			try { await this.authService.signOut(); } catch { }
			yield { kind: 'error', message: 'Your session expired. Run `Alaska AI: Sign In` from the command palette to re-authenticate.' };
			return;
		}
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			yield { kind: 'error', message: parseAlaskaApiError(res.status, text) };
			return;
		}
		if (!res.body) {
			yield { kind: 'error', message: 'Empty response body' };
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		const pendingTools = new Map<number, IPendingToolSlot>();
		const logService = this.logService;
		const snippetMode = req.replyMode === 'snippet';
		const thinking = new ThinkingSplitter();
		const splitDelta = (text: string): IAlaskaChatEvent[] => {
			if (snippetMode) {
				return text ? [{ kind: 'delta', text }] : [];
			}
			const out: IAlaskaChatEvent[] = [];
			const { reasoning, visible } = thinking.push(text);
			if (reasoning) {
				out.push({ kind: 'reasoning', text: reasoning });
			}
			if (visible) {
				out.push({ kind: 'delta', text: visible });
			}
			return out;
		};
		const flushThinking = (): IAlaskaChatEvent[] => {
			if (snippetMode) {
				return [];
			}
			const out: IAlaskaChatEvent[] = [];
			const { reasoning, visible } = thinking.flush();
			if (reasoning) {
				out.push({ kind: 'reasoning', text: reasoning });
			}
			if (visible) {
				out.push({ kind: 'delta', text: visible });
			}
			return out;
		};
		const flushPendingTools = (): { events: IAlaskaChatEvent[]; truncated: boolean } => {
			const events: IAlaskaChatEvent[] = [];
			let truncated = false;
			const indices = Array.from(pendingTools.keys()).sort((a, b) => a - b);
			for (const idx of indices) {
				const t = pendingTools.get(idx)!;
				if (!t.id || !t.name) {
					if (t.argumentsJson.length > 0 || t.id || t.name) {
						truncated = true;
					}
					continue;
				}
				if (!isJsonComplete(t.argumentsJson)) {
					truncated = true;
				}
				events.push({
					kind: 'tool_call',
					call: { id: t.id, name: t.name, argumentsJson: t.argumentsJson },
				});
			}
			pendingTools.clear();
			return { events, truncated };
		};

		const parseLine = (line: string): IAlaskaChatEvent[] => {
			const trimmed = line.trim();
			if (!trimmed || !trimmed.startsWith('data:')) {
				return [];
			}
			const json = trimmed.slice('data:'.length).trim();
			if (!json) {
				return [];
			}
			if (json === '[DONE]') {
				const flushed = flushPendingTools();
				const out: IAlaskaChatEvent[] = [...flushed.events, ...flushThinking()];
				if (flushed.truncated) {
					out.push({ kind: 'error', message: 'Upstream stream closed mid tool call — retrying the same turn.', code: 'truncated_tool_call' });
				} else {
					out.push({ kind: 'done' });
				}
				return out;
			}

			interface ToolDeltaFrame { index: number; id?: string; name?: string; arguments?: string }
			interface Frame {
				delta?: string;
				reasoning?: string;
				tool_delta?: ToolDeltaFrame;
				done?: boolean;
				error?: string;
				usage?: { input: number; output: number };
				finish_reason?: string;
			}

			let chunk: Frame;
			try {
				chunk = JSON.parse(json);
			} catch {
				this.logService.warn('[alaska.chat] non-json frame', json);
				return [];
			}

			const events: IAlaskaChatEvent[] = [];
			if (chunk.error) {
				events.push({ kind: 'error', message: chunk.error });
				return events;
			}
			if (chunk.reasoning) {
				events.push({ kind: 'reasoning', text: chunk.reasoning });
			}
			if (chunk.delta) {
				events.push(...splitDelta(chunk.delta));
			}
			if (chunk.tool_delta) {
				const td = chunk.tool_delta;
				prunePendingTools(pendingTools, Date.now());
				if (!pendingTools.has(td.index) && pendingTools.size >= PENDING_TOOLS_HARD_CAP) {
					logService.warn(`[alaska.chat] pendingTools cap hit (${PENDING_TOOLS_HARD_CAP}); aborting stream to prevent memory bloat`);
					events.push({ kind: 'error', message: `Too many concurrent tool calls (>${PENDING_TOOLS_HARD_CAP}). Stream aborted.` });
					return events;
				}
				const slot = pendingTools.get(td.index) ?? { id: '', name: '', argumentsJson: '', createdAt: Date.now() };
				if (td.id) { slot.id = td.id; }
				if (td.name) { slot.name = td.name; }
				if (td.arguments) { slot.argumentsJson += td.arguments; }
				pendingTools.set(td.index, slot);
				if (slot.id && slot.name) {
					events.push({
						kind: 'tool_progress',
						id: slot.id,
						name: slot.name,
						partialArguments: slot.argumentsJson,
					});
				}
			}
			if (chunk.done) {
				const flushed = flushPendingTools();
				events.push(...flushed.events);
				events.push(...flushThinking());
				if (flushed.truncated) {
					events.push({ kind: 'error', message: 'Upstream stream closed mid tool call — retrying the same turn.', code: 'truncated_tool_call' });
				} else {
					events.push({ kind: 'done', usage: chunk.usage, finishReason: chunk.finish_reason });
				}
			}
			return events;
		};

		try {
			while (true) {
				if (token.isCancellationRequested) {
					yield { kind: 'error', message: 'Cancelled' };
					return;
				}
				const { value, done } = await reader.read();
				if (done) { break; }
				buffer += decoder.decode(value, { stream: true });

				let idx: number;
				while ((idx = buffer.indexOf('\n')) >= 0) {
					const line = buffer.slice(0, idx);
					buffer = buffer.slice(idx + 1);
					for (const ev of parseLine(line)) {
						yield ev;
						if (ev.kind === 'error' || ev.kind === 'done') {
							return;
						}
					}
				}
			}
		} finally {
			try { reader.releaseLock(); } catch { /* ignore */ }
		}

		for (const ev of parseLine(buffer)) {
			yield ev;
			if (ev.kind === 'error' || ev.kind === 'done') {
				return;
			}
		}
		const pendingFlush = flushPendingTools();
		for (const ev of pendingFlush.events) {
			yield ev;
		}
		for (const ev of flushThinking()) {
			yield ev;
		}
		if (pendingFlush.truncated) {
			yield { kind: 'error', message: 'Upstream stream closed mid tool call — retrying the same turn.', code: 'truncated_tool_call' };
			return;
		}
		yield { kind: 'done' };
	}

	private async *streamBYO(req: IAlaskaChatRequest, byo: IAlaskaBYOActive, token: CancellationToken): AsyncIterable<IAlaskaChatEvent> {
		const isAnthropic = byo.provider === 'anthropic';
		const url = isAnthropic ? `${byo.baseUrl}/messages` : `${byo.baseUrl}/chat/completions`;
		const payload = isAnthropic ? buildAnthropicPayload(req, byo) : buildOpenAICompatPayload(req, byo);
		const headers: Record<string, string> = isAnthropic
			? {
				'x-api-key': byo.apiKey,
				'anthropic-version': '2023-06-01',
				'content-type': 'application/json',
				'accept': 'text/event-stream',
			}
			: {
				'Authorization': `Bearer ${byo.apiKey}`,
				'content-type': 'application/json',
				'accept': 'text/event-stream',
			};

		let res: Response;
		try {
			res = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(payload),
				signal: abortSignalFrom(token),
			});
		} catch (err) {
			yield { kind: 'error', message: err instanceof Error ? `BYO request failed: ${err.message}` : 'BYO network error' };
			return;
		}
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			yield { kind: 'error', message: `BYO provider ${res.status}: ${text.slice(0, 500)}` };
			return;
		}
		if (!res.body) {
			yield { kind: 'error', message: 'Empty BYO response body' };
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		const pendingTools = new Map<number, IPendingToolSlot>();
		const logService = this.logService;
		const thinking = new ThinkingSplitter();
		const flushThinking = (): IAlaskaChatEvent[] => {
			const out: IAlaskaChatEvent[] = [];
			const { reasoning, visible } = thinking.flush();
			if (reasoning) { out.push({ kind: 'reasoning', text: reasoning }); }
			if (visible) { out.push({ kind: 'delta', text: visible }); }
			return out;
		};
		const splitDelta = (text: string): IAlaskaChatEvent[] => {
			if (!text) { return []; }
			const out: IAlaskaChatEvent[] = [];
			const { reasoning, visible } = thinking.push(text);
			if (reasoning) { out.push({ kind: 'reasoning', text: reasoning }); }
			if (visible) { out.push({ kind: 'delta', text: visible }); }
			return out;
		};
		const flushPendingTools = (): IAlaskaChatEvent[] => {
			const out: IAlaskaChatEvent[] = [];
			const indices = Array.from(pendingTools.keys()).sort((a, b) => a - b);
			for (const idx of indices) {
				const t = pendingTools.get(idx)!;
				if (!t.id || !t.name) { continue; }
				out.push({ kind: 'tool_call', call: { id: t.id, name: t.name, argumentsJson: t.argumentsJson } });
			}
			pendingTools.clear();
			return out;
		};

		const handleAnthropicEvent = (data: unknown): IAlaskaChatEvent[] => {
			if (!data || typeof data !== 'object') { return []; }
			const ev = data as { type?: string; delta?: { type?: string; text?: string; partial_json?: string; thinking?: string }; index?: number; content_block?: { type?: string; id?: string; name?: string }; usage?: { input_tokens?: number; output_tokens?: number }; message?: { usage?: { input_tokens?: number; output_tokens?: number } } };
			switch (ev.type) {
				case 'content_block_start': {
					const block = ev.content_block;
					const idx = typeof ev.index === 'number' ? ev.index : -1;
					if (block?.type === 'tool_use' && idx >= 0 && block.id && block.name) {
						prunePendingTools(pendingTools, Date.now());
						if (!pendingTools.has(idx) && pendingTools.size >= PENDING_TOOLS_HARD_CAP) {
							logService.warn(`[alaska.chat.byo.anthropic] pendingTools cap hit (${PENDING_TOOLS_HARD_CAP}); aborting stream`);
							return [{ kind: 'error', message: `Too many concurrent tool calls (>${PENDING_TOOLS_HARD_CAP}). Stream aborted.` }];
						}
						pendingTools.set(idx, { id: block.id, name: block.name, argumentsJson: '', createdAt: Date.now() });
					}
					return [];
				}
				case 'content_block_delta': {
					const delta = ev.delta;
					if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
						return splitDelta(delta.text);
					}
					if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
						return [{ kind: 'reasoning', text: delta.thinking }];
					}
					if (delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
						const idx = typeof ev.index === 'number' ? ev.index : -1;
						const slot = pendingTools.get(idx);
						if (slot) {
							slot.argumentsJson += delta.partial_json;
							return [{ kind: 'tool_progress', id: slot.id, name: slot.name, partialArguments: slot.argumentsJson }];
						}
					}
					return [];
				}
				case 'message_delta': {
					const usage = ev.usage;
					if (usage) {
						return [];
					}
					return [];
				}
				case 'message_stop': {
					const out: IAlaskaChatEvent[] = [...flushPendingTools(), ...flushThinking()];
					const usage = ev.message?.usage;
					out.push({ kind: 'done', usage: usage ? { input: usage.input_tokens ?? 0, output: usage.output_tokens ?? 0 } : undefined });
					return out;
				}
				case 'error': {
					const msg = (data as { error?: { message?: string } }).error?.message ?? 'Anthropic stream error';
					return [{ kind: 'error', message: msg }];
				}
			}
			return [];
		};

		const handleOpenAIEvent = (data: unknown): IAlaskaChatEvent[] => {
			if (!data || typeof data !== 'object') { return []; }
			const ev = data as { choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
			const out: IAlaskaChatEvent[] = [];
			const choice = ev.choices?.[0];
			if (choice?.delta?.content) {
				out.push(...splitDelta(choice.delta.content));
			}
			if (choice?.delta?.tool_calls) {
				for (const tc of choice.delta.tool_calls) {
					prunePendingTools(pendingTools, Date.now());
					if (!pendingTools.has(tc.index) && pendingTools.size >= PENDING_TOOLS_HARD_CAP) {
						logService.warn(`[alaska.chat.byo.openai] pendingTools cap hit (${PENDING_TOOLS_HARD_CAP}); aborting stream`);
						out.push({ kind: 'error', message: `Too many concurrent tool calls (>${PENDING_TOOLS_HARD_CAP}). Stream aborted.` });
						return out;
					}
					const slot = pendingTools.get(tc.index) ?? { id: '', name: '', argumentsJson: '', createdAt: Date.now() };
					if (tc.id) { slot.id = tc.id; }
					if (tc.function?.name) { slot.name = tc.function.name; }
					if (tc.function?.arguments) { slot.argumentsJson += tc.function.arguments; }
					pendingTools.set(tc.index, slot);
					if (slot.id && slot.name) {
						out.push({ kind: 'tool_progress', id: slot.id, name: slot.name, partialArguments: slot.argumentsJson });
					}
				}
			}
			if (choice?.finish_reason) {
				out.push(...flushPendingTools());
				out.push(...flushThinking());
				const usage = ev.usage;
				out.push({ kind: 'done', usage: usage ? { input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0 } : undefined, finishReason: choice.finish_reason });
			}
			return out;
		};

		const parseLine = (line: string): IAlaskaChatEvent[] => {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data:')) { return []; }
			const raw = trimmed.slice('data:'.length).trim();
			if (!raw) { return []; }
			if (raw === '[DONE]') {
				return [...flushPendingTools(), ...flushThinking(), { kind: 'done' }];
			}
			let parsed: unknown;
			try { parsed = JSON.parse(raw); } catch { return []; }
			return isAnthropic ? handleAnthropicEvent(parsed) : handleOpenAIEvent(parsed);
		};

		try {
			while (true) {
				if (token.isCancellationRequested) {
					yield { kind: 'error', message: 'Cancelled' };
					return;
				}
				const { value, done } = await reader.read();
				if (done) { break; }
				buffer += decoder.decode(value, { stream: true });
				let idx: number;
				while ((idx = buffer.indexOf('\n')) >= 0) {
					const line = buffer.slice(0, idx);
					buffer = buffer.slice(idx + 1);
					for (const ev of parseLine(line)) {
						yield ev;
						if (ev.kind === 'error' || ev.kind === 'done') { return; }
					}
				}
			}
		} finally {
			try { reader.releaseLock(); } catch { /* ignore */ }
		}

		for (const ev of parseLine(buffer)) {
			yield ev;
			if (ev.kind === 'error' || ev.kind === 'done') { return; }
		}
		for (const ev of flushPendingTools()) { yield ev; }
		for (const ev of flushThinking()) { yield ev; }
		yield { kind: 'done' };
	}
}

function buildAnthropicPayload(req: IAlaskaChatRequest, byo: IAlaskaBYOActive): Record<string, unknown> {
	const systemSegments: string[] = [];
	const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [];
	for (const m of req.messages) {
		if (m.role === 'system') {
			systemSegments.push(typeof m.content === 'string' ? m.content : flattenContent(m.content));
			continue;
		}
		if (m.role === 'tool') {
			messages.push({
				role: 'user',
				content: [{ type: 'tool_result', tool_use_id: m.tool_call_id ?? '', content: typeof m.content === 'string' ? m.content : flattenContent(m.content) }],
			});
			continue;
		}
		if (m.role === 'assistant') {
			const parts: unknown[] = [];
			const text = typeof m.content === 'string' ? m.content : flattenContent(m.content);
			if (text) { parts.push({ type: 'text', text }); }
			if (m.tool_calls) {
				for (const tc of m.tool_calls) {
					let input: unknown = {};
					try { input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { input = {}; }
					parts.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
				}
			}
			messages.push({ role: 'assistant', content: parts.length > 0 ? parts : [{ type: 'text', text: '' }] });
			continue;
		}
		if (typeof m.content === 'string') {
			messages.push({ role: 'user', content: m.content });
		} else {
			const parts = m.content.map(part => part.type === 'text'
				? { type: 'text', text: part.text }
				: { type: 'image', source: { type: 'base64', media_type: dataUrlMime(part.image_url.url), data: dataUrlBody(part.image_url.url) } });
			messages.push({ role: 'user', content: parts });
		}
	}
	const tools = req.tools?.map(t => ({
		name: t.function.name,
		description: t.function.description,
		input_schema: t.function.parameters,
	}));
	return {
		model: byo.model || req.model || 'claude-sonnet-4-6',
		system: systemSegments.length > 0 ? systemSegments.join('\n\n') : undefined,
		messages,
		max_tokens: 8192,
		stream: true,
		tools,
	};
}

function buildOpenAICompatPayload(req: IAlaskaChatRequest, byo: IAlaskaBYOActive): Record<string, unknown> {
	return {
		model: byo.model || req.model,
		messages: req.messages,
		stream: true,
		tools: req.tools,
		tool_choice: req.tools && req.tools.length > 0 ? 'auto' : undefined,
		reasoning_effort: req.reasoningEffort,
	};
}

function dataUrlMime(url: string): string {
	const m = url.match(/^data:([^;]+);base64,/);
	return m ? m[1] : 'application/octet-stream';
}

function dataUrlBody(url: string): string {
	const i = url.indexOf(',');
	return i >= 0 ? url.slice(i + 1) : '';
}

const PII_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
	{ pattern: /\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, replacement: '<email>' },
	{ pattern: /\b(?:sk|pk|tok|key|gho|github_pat)[_-][A-Za-z0-9_-]{16,}\b/g, replacement: '<api-key>' },
	{ pattern: /\b(?:\d[ -]?){13,19}\b/g, replacement: '<card>' },
	{ pattern: /\b(?:Bearer|Authorization)[\s:]+[A-Za-z0-9._-]+\b/gi, replacement: '<bearer-token>' },
];

function redactPII(text: string): string {
	let out = text;
	for (const rule of PII_PATTERNS) {
		out = out.replace(rule.pattern, rule.replacement);
	}
	return out;
}

function redactMessageContent(content: IAlaskaChatMessage['content']): string | IAlaskaContentPart[] {
	if (typeof content === 'string') {
		return redactPII(content);
	}
	return content.map(part => part.type === 'text'
		? { type: 'text', text: redactPII(part.text) }
		: part);
}

function redactUserMessages(messages: readonly IAlaskaChatMessage[]): IAlaskaChatMessage[] {
	return messages.map(m => m.role === 'user'
		? { ...m, content: redactMessageContent(m.content) }
		: { ...m });
}

function isJsonComplete(raw: string): boolean {
	if (!raw) { return true; }
	try {
		JSON.parse(raw);
		return true;
	} catch {
		return false;
	}
}

function buildPayload(req: IAlaskaChatRequest): {
	model?: string;
	messages: IAlaskaChatMessage[];
	stream: boolean;
	tools?: readonly IAlaskaTool[];
	tool_choice?: 'auto' | 'none';
	reasoning_effort?: AlaskaReasoningEffort;
} {
	const messages: IAlaskaChatMessage[] = [];
	const hasToolsAvailable = !!req.tools?.length;
	if (hasToolsAvailable && req.replyMode !== 'snippet') {
		messages.push({ role: 'system', content: TOOL_USAGE_CONTRACT });
	}
	const ctxMsg = renderContextAsSystemMessage(req.context, hasToolsAvailable, req.replyMode);
	if (ctxMsg) {
		messages.push({ role: 'system', content: ctxMsg });
	}
	const modeMsg = req.replyMode === 'snippet'
		? ''
		: buildModePrompt(req.agentMode ?? 'chat', req.approvedTasklist);
	if (modeMsg) {
		messages.push({ role: 'system', content: modeMsg });
	}
	for (const m of req.messages) {
		messages.push(m);
	}
	return {
		model: req.model,
		messages,
		stream: true,
		tools: hasToolsAvailable ? req.tools : undefined,
		tool_choice: hasToolsAvailable ? 'auto' : undefined,
		reasoning_effort: req.reasoningEffort,
	};
}

const PLAN_MODE_PROMPT = [
	'AGENT MODE: PLAN.',
	'You are exploring the codebase to produce a numbered tasklist. WRITE / PATCH / DELETE / RUN_COMMAND tools are DISABLED this turn — the backend will reject any such call with a soft-fail.',
	'',
	'How to operate in Plan mode:',
	'1. Use alaska_read_file, alaska_grep_search, and alaska_list_directory to gather the context you need.',
	'2. If the request is ambiguous, ask one clarifying question in plain text — do not invent requirements.',
	'3. When you have enough understanding, output a final message containing a numbered markdown tasklist:',
	'     1. Concrete actionable step (single sentence, one verb)',
	'     2. Next step',
	'     ...',
	'   Each step is a single small action ("Add null-check guard around moveItem call in alaskaTools.ts"). Do NOT include code blocks or implementation snippets. Just describe what will be done in plain English.',
	'4. After printing the tasklist, STOP. Do not call any more tools. The user will review the plan and click "Approve plan" to switch you to Act mode, or will type refinements in the composer.',
	'',
	'If the request is trivial and fits in one step, still produce a single-item tasklist — the UI relies on the numbered format.',
	'Never silently make code changes in Plan mode. The PLAN_GATE / alaska_announce_plan rules from the chat-mode prompt do not apply here — alaska_announce_plan is allowed but not required; producing the tasklist as your final message is the canonical Plan-mode handoff.',
].join('\n');

const ACT_MODE_BASE_PROMPT = [
	'AGENT MODE: ACT — you have an approved plan and must execute it.',
	'',
	'Rules:',
	'1. Execute the plan step by step using whichever tools are appropriate (alaska_write_file, alaska_patch_file, alaska_delete_file, alaska_run_command, alaska_read_file, alaska_grep_search, alaska_list_directory).',
	'2. AFTER completing each step, write a single line in your visible message using the EXACT format:',
	'     ✓ Step N: <one-sentence summary of what you just did>',
	'   The "✓" is a check mark (U+2713), followed by a space, the literal word "Step", a space, the step number, a colon, a space, and the summary. The IDE parses these lines to update the progress UI — do not deviate from the format or the checkmark will not be tracked.',
	'3. A single step may require multiple tool calls; perform all of them, then emit ONE ✓ Step N line for the whole step.',
	'4. If during execution you discover the plan needs to change — a step is no longer valid, a new step is required, or the approach must be reworked — STOP and explain the issue in plain text. Do not invent new steps unilaterally.',
	'5. When every step from the approved plan is complete, write a final short summary describing what changed across the codebase and any caveats. Do not add extra checkmark lines beyond what the plan contained.',
	'',
	'Workspace trust, run-command consent, and permission modes still apply as usual.',
].join('\n');

const CHAT_MODE_PROMPT = 'AGENT MODE: CHAT — freestyle conversation; all available tools are enabled subject to workspace trust and permission modes. Follow the standard tool-usage rules from the chat instructions above.';

function buildModePrompt(mode: AlaskaAgentMode, approvedTasklist: readonly ITaskItem[] | undefined): string {
	switch (mode) {
		case 'plan':
			return PLAN_MODE_PROMPT;
		case 'act': {
			const planSection = approvedTasklist && approvedTasklist.length > 0
				? '\n\nAPPROVED PLAN:\n' + approvedTasklist.map(t => `${t.index}. ${t.completed ? '✓ ' : ''}${t.description}`).join('\n')
				: '';
			return ACT_MODE_BASE_PROMPT + planSection;
		}
		case 'chat':
		default:
			return CHAT_MODE_PROMPT;
	}
}

const TOOL_USAGE_CONTRACT = [
	'CODE OUTPUT RULES — STRICT, NO EXCEPTIONS:',
	'',
	'When the user asks you to create, write, or modify a file, you MUST use the `alaska_write_file` or `alaska_patch_file` tool. NEVER output the file content as a markdown code block in your chat reply. Code in chat is INVISIBLE to the filesystem — it is wasted output.',
	'',
	'The ONLY time you may show a code block inline in chat is:',
	'1. The user explicitly asks "show me what you would write" without "create" or "save"',
	'2. You are explaining a small snippet (under 10 lines) for educational purposes',
	'3. You are quoting existing code you just read',
	'',
	// allow-any-unicode-next-line
	'In all other cases — including "make a landing page", "implement this function", "add this feature", "create a file", "напиши код" — you MUST:',
	'1. First (optionally): explain your plan in 2-3 sentences',
	'2. Immediately call alaska_write_file with the FULL final contents',
	'3. NEVER preview the content in chat first ("here\'s what I\'ll write: ```...")',
	'4. After the tool call succeeds, write a SHORT (1-3 line) confirmation summary',
	'',
	'VIOLATION EXAMPLES (do NOT do this):',
	'- "I\'ll create styles.css. Here\'s the content:\n```css\n...\n```" ← WRONG',
	'- "Let me show you the HTML first, then I\'ll save it:\n```html\n..." ← WRONG',
	'- "Here is the landing page code:\n```html\n..." (no tool call after) ← WRONG',
	'',
	'CORRECT BEHAVIOR:',
	'- "Creating styles.css with hero section, buttons, and responsive grid."',
	'  [alaska_write_file call with full CSS content]',
	'- "Done. Added 240 lines covering hero, features, pricing."',
	'',
	'REASON: Your chat reply has a max_tokens cap. Large code blocks in chat get TRUNCATED mid-stream and the user loses everything. Tool calls have a separate buffer and survive truncation via auto-retry. Always use the tool.',
].join('\n');

const THINKING_CONTRACT = 'Begin every reply with a <thinking>…</thinking> block where you reason about the user\'s request, the files you\'ve read, and the steps you plan. Keep it short and concrete. After you close the </thinking> tag, write the user-facing answer and call tools as needed. Do not nest <thinking> blocks. The IDE strips these tags from the visible message — they exist for the user to inspect, not as part of the final answer.';

const THINKING_FEW_SHOT = [
	'Example transcript (DO NOT echo this verbatim, follow its shape):',
	'User: "Add a footer to index.html"',
	'Assistant: <thinking>I\'ll need to read index.html first to see its current structure, then append a <footer> with the requested content.</thinking>I\'ll add a footer to your page.',
	'',
	'Your very first output token MUST be the literal "<" of "<thinking>". Do not greet, do not preface — open the tag immediately.',
].join('\n');

function renderContextAsSystemMessage(ctx: IAlaskaCodeContext | undefined, toolsEnabled: boolean, replyMode?: 'snippet'): string {
	if (replyMode === 'snippet') {
		return renderSnippetSystemMessage(ctx);
	}
	const lines: string[] = [];
	if (ctx?.projectRules) {
		lines.push('Project rules from .alaskarules (treat as ground truth, follow them in every reply):');
		lines.push(ctx.projectRules.trim());
		lines.push('');
	}
	lines.push(
		THINKING_CONTRACT,
		THINKING_FEW_SHOT,
		'You are Alaska AI, the user\'s in-IDE coding assistant. Be concise: write code, not exposition.',
	);
	if (toolsEnabled) {
		lines.push(
			'When the user asks you to create, edit, or delete a file, you MUST call the appropriate tool — alaska_write_file, alaska_patch_file, or alaska_delete_file. The IDE applies tool calls; plain code blocks in your reply are ignored as far as the workspace is concerned. Read existing files with alaska_read_file before patching so your `find` argument matches exactly. Workspace-relative paths only.',
			'PLAN GATE — when the request will touch two or more files, you MUST call alaska_announce_plan FIRST and wait for the result before any write/patch/delete. The tool result will be `{ ok: true, approved: true }` if the user approved, `{ ok: false, approved: false, reason }` if they declined, or `{ ok: true, approved: true, plan: {...} }` if they edited the plan.',
			'POST-APPROVAL EXECUTION — when alaska_announce_plan returns `{ approved: true }`, you MUST immediately follow with one alaska_write_file / alaska_patch_file / alaska_delete_file call for EACH change in the (possibly edited) plan, in order. Do NOT stop after a Read. Do NOT wait for more user input. Reads done after the approval are diagnostic only — the user has already greenlit every entry and expects them ALL on disk in this turn. After the last write, summarise the result in one sentence. If `approved: false`, reply with one short text question or a smaller scope proposal — never an empty turn.',
			'NEVER emit an empty assistant message. If every planned change is already on disk, or you have nothing else to do, you MUST end your turn with at least one sentence of visible text. The IDE renders empty replies as "No response from Alaska AI." and the user reads that as a crash.',
			'Argument ordering is up to you — the IDE accepts JSON fields in any order. A `path`-first emission lets the IDE start a live preview earlier, but it is not required.',
			// allow-any-unicode-next-line
			'Do not narrate the write in chat as "Сейчас создам файл" / "I will write" without immediately calling the tool — the user does NOT see the file change until the tool actually fires. Once you decide to write, the very next emitted tokens after </thinking> should be the tool call itself; reserve user-facing text for the post-write summary.',
			'After the tools have run, summarise what you changed in one or two sentences for the user. Never invent files you didn\'t write.',
			'alaska_run_command chaining: when you chain diagnostic commands that should ALL run regardless of individual failures (e.g., `node -v`, `python --version`, `python3 --version`), separate them with `;` on POSIX shells or `;` on PowerShell. Use `&&` only when the right-hand command should run ONLY if the left-hand succeeded — `&&` short-circuits on the first failure. The tool returns the merged exit code of the LAST command in the chain — interpret accordingly when reading the result.',
			'DISCOVERY TOOLS — alaska_grep_search and alaska_list_directory are read-only, instant, and require NO user approval (they work even in Read-only / Plan modes). When the user mentions a symbol, function, class, or concept and you do NOT already know which file holds it, call alaska_grep_search FIRST (regex: true for things like `function\\s+parseArgs|class\\s+Foo`, regex: false for literal substrings); THEN call alaska_read_file on the specific files it returned. When the user asks about project structure ("what is in src/", "how is the backend organized"), call alaska_list_directory before reading individual files. Prefer these tools over alaska_run_command "rg …" / "ls …" — running rg or ls via the shell requires workspace trust and per-call approval, which is annoying for the user. Reserve alaska_run_command for things that actually mutate state (npm install, git commit, build) or that grep/list cannot answer. Tips: start with max_results: 50; raise only if the first wave does not surface the right file. Use include: "src/**/*.ts" when you know the language/area to cut noise. Use context_lines: 2 when you need to see what surrounds matches.',
			'WEB TOOLS — alaska_web_search and alaska_web_fetch hit the public internet through Alaska\'s SSRF-safe backend proxy. They are read-only, require NO user approval, and work in every permission/agent mode. WHEN TO USE: (a) the user asks about something that may have changed since your training cutoff (current library version, recent issue/PR, latest changelog, today\'s news); (b) the user pastes a URL and wants you to read it; (c) you are about to recommend an API but are uncertain about the current signature. WHEN NOT TO USE: workspace questions — use alaska_grep_search / alaska_read_file. General knowledge you already have — answer directly. The same URL twice in one turn — the backend caches but you should not double-fetch. WORKFLOW: (1) alaska_web_search with a specific, narrow query (include language, library name, version); (2) pick the best 1–3 hits; (3) alaska_web_fetch each in turn; (4) integrate findings and CITE the URLs you read. COSTS: search and fetch both have daily per-user quotas (50 search / 200 fetch on FREE, more on paid plans). Soft-fail with code "quota_exhausted" means the quota is exhausted — fall back to workspace-only context and tell the user to upgrade or wait. Soft-fail with code "blocked" means the URL is on the SSRF denylist (private host, file://, etc.) — do not retry. ALWAYS prefer specific code/docs queries over generic "best practices" prompts; the latter return marketing pages.',
		);
	} else {
		lines.push(
			'When the user asks you to create or edit a file, reply with a fenced ```alaska-edit``` JSON block containing the operations. Plain markdown code blocks will NOT be written by the IDE.',
		);
	}
	if (!ctx) {
		return lines.join('\n');
	}
	lines.push('Current context:');
	if (ctx.agentAccess) {
		lines.push(`- Agent access: ${ctx.agentAccess === 'read-only'
			? 'read-only — you may use alaska_read_file, alaska_grep_search, and alaska_list_directory to inspect the workspace, but write/patch/delete and run_command tools are not available this turn. Tell the user what you would change and why, but do not promise to edit files.'
			: 'edit — write/patch/delete tools are available; applied changes are reversible via the in-editor CodeLens.'}`);
	}
	if (ctx.workspaceName) {
		lines.push(`- Workspace: ${ctx.workspaceName}`);
	}
	if (ctx.workspaceRoot) {
		lines.push(`- Workspace root: ${ctx.workspaceRoot}`);
	}
	if (ctx.hostOs) {
		lines.push(`- Host OS: ${ctx.hostOs} (${ctx.hostOs === 'windows' ? 'use PowerShell syntax' : 'use POSIX shell syntax'})`);
	}
	if (ctx.remoteAuthority) {
		lines.push(`- Remote authority: ${ctx.remoteAuthority} — files and shell commands execute on the remote host; workspace paths are remote-relative. Do NOT attempt to use local-only utilities.`);
	}
	if (ctx.filePath) {
		lines.push(`- Active file: ${ctx.filePath}${ctx.languageId ? ` (${ctx.languageId})` : ''}`);
	}
	if (ctx.openFiles?.length) {
		lines.push('- Open files:');
		for (const file of ctx.openFiles.slice(0, 30)) {
			lines.push(`  - ${file}`);
		}
	}
	if (ctx.indexHits?.length) {
		lines.push('');
		lines.push('Relevant code from your workspace (semantic search hits, ordered by similarity to the user question):');
		lines.push('PREFER these snippets over calling alaska_grep_search — they are pre-fetched by semantic match on the current user message. Only call alaska_grep_search if the answer is clearly NOT in these hits, or you need a different file. If you need a fuller view of a hit, call alaska_read_file on the listed file path.');
		for (const hit of ctx.indexHits) {
			const symbol = hit.symbolName ? ` — ${hit.symbolKind ?? 'symbol'} ${hit.symbolName}` : '';
			lines.push(`### ${hit.filePath}:${hit.startLine}-${hit.endLine}${symbol} (score ${hit.score.toFixed(3)})`);
			lines.push('```');
			lines.push(hit.content.trim());
			lines.push('```');
		}
	}
	if (ctx.workspaceFiles?.length && !ctx.indexHits?.length) {
		lines.push('- Workspace tree snapshot:');
		for (const file of ctx.workspaceFiles.slice(0, 350)) {
			lines.push(`  - ${file}`);
		}
	}
	if (ctx.selection) {
		lines.push(`- Selection (lines ${ctx.selection.startLine}-${ctx.selection.endLine}):`);
		lines.push('```');
		lines.push(ctx.selection.text);
		lines.push('```');
	}
	if (ctx.fullText) {
		lines.push('- Full file contents:');
		lines.push('```' + (ctx.languageId ?? ''));
		lines.push(ctx.fullText);
		lines.push('```');
	}
	if (ctx.diagnostics?.length) {
		lines.push('Diagnostics in the active file (LSP markers — fix these when relevant):');
		for (const d of ctx.diagnostics) {
			const src = d.source ? ` [${d.source}]` : '';
			lines.push(`  - L${d.line}:${d.column} ${d.severity}${src}: ${d.message}`);
		}
	}
	if (ctx.skillsCatalog) {
		lines.push('');
		lines.push(ctx.skillsCatalog);
	}
	if (ctx.skillsInjection) {
		lines.push('');
		lines.push(ctx.skillsInjection);
	}
	if (ctx.pinnedFiles?.length || ctx.pinnedFolders?.length || ctx.pinnedUrls?.length || ctx.pinnedDiagnostics?.length) {
		lines.push('');
		lines.push('Pinned by the user via @-mention (treat as primary source of truth, quote when relevant):');
		for (const f of ctx.pinnedFiles ?? []) {
			lines.push(`@file ${f.path}${f.truncated ? ' (truncated)' : ''}:`);
			lines.push('```');
			lines.push(f.content);
			lines.push('```');
		}
		for (const folder of ctx.pinnedFolders ?? []) {
			lines.push(`@folder ${folder.path}${folder.truncated ? ' (some files omitted)' : ''}:`);
			for (const f of folder.files) {
				lines.push(`-- ${f.path}${f.truncated ? ' (truncated)' : ''} --`);
				lines.push('```');
				lines.push(f.content);
				lines.push('```');
			}
		}
		for (const u of ctx.pinnedUrls ?? []) {
			const headline = u.title ? `${u.title} — ${u.url}` : u.url;
			lines.push(`@url ${headline}${u.truncated ? ' (truncated)' : ''}:`);
			lines.push(u.text);
		}
		if (ctx.pinnedDiagnostics?.length) {
			lines.push('@diag (pinned diagnostics):');
			for (const d of ctx.pinnedDiagnostics) {
				const src = d.source ? ` [${d.source}]` : '';
				lines.push(`  - L${d.line}:${d.column} ${d.severity}${src}: ${d.message}`);
			}
		}
	}
	return lines.join('\n');
}

function renderSnippetSystemMessage(ctx: IAlaskaCodeContext | undefined): string {
	const lines: string[] = [];
	if (ctx?.projectRules) {
		lines.push('Project rules from .alaskarules (must still be honoured):');
		lines.push(ctx.projectRules.trim());
		lines.push('');
	}
	lines.push('You are completing an inline edit inside a code editor. The user has selected a snippet and asked you to transform it.');
	lines.push('RESPONSE FORMAT — strict:');
	lines.push('- Reply with the replacement snippet only. No markdown fences. No prose. No explanation. No <thinking> block.');
	lines.push('- Your raw output is inserted verbatim in place of the user\'s selection.');
	lines.push('- Preserve indentation style and surrounding whitespace conventions from the selection.');
	lines.push('- If the request is impossible or unsafe, output the original selection unchanged.');
	if (ctx?.filePath) {
		lines.push(`File: ${ctx.filePath}${ctx.languageId ? ` (${ctx.languageId})` : ''}`);
	}
	if (ctx?.selection) {
		lines.push(`Selection (lines ${ctx.selection.startLine}-${ctx.selection.endLine}).`);
	}
	return lines.join('\n');
}

function flattenContent(content: IAlaskaChatMessage['content']): string {
	if (typeof content === 'string') {
		return content.trim();
	}
	const out: string[] = [];
	for (const part of content) {
		if (part.type === 'text' && typeof part.text === 'string') {
			out.push(part.text);
		}
	}
	return out.join(' ').trim();
}

const THINKING_OPEN = '<thinking>';
const THINKING_CLOSE = '</thinking>';

function partialPrefixHold(buffer: string, needle: string): number {
	const maxHold = Math.min(buffer.length, needle.length - 1);
	for (let h = maxHold; h > 0; h--) {
		if (needle.startsWith(buffer.slice(buffer.length - h).toLowerCase())) {
			return h;
		}
	}
	return 0;
}

class ThinkingSplitter {
	private state: 'pre' | 'inside' | 'post' = 'pre';
	private buffer = '';

	push(chunk: string): { reasoning: string; visible: string } {
		this.buffer += chunk;
		let reasoning = '';
		let visible = '';
		while (this.buffer.length > 0) {
			if (this.state === 'pre') {
				const lower = this.buffer.toLowerCase();
				const idx = lower.indexOf(THINKING_OPEN);
				if (idx >= 0) {
					visible += this.buffer.slice(0, idx);
					this.buffer = this.buffer.slice(idx + THINKING_OPEN.length);
					this.state = 'inside';
					continue;
				}
				const hold = partialPrefixHold(this.buffer, THINKING_OPEN);
				if (hold > 0) {
					visible += this.buffer.slice(0, this.buffer.length - hold);
					this.buffer = this.buffer.slice(this.buffer.length - hold);
				} else {
					visible += this.buffer;
					this.buffer = '';
				}
				return { reasoning, visible };
			}
			if (this.state === 'inside') {
				const lower = this.buffer.toLowerCase();
				const idx = lower.indexOf(THINKING_CLOSE);
				if (idx >= 0) {
					reasoning += this.buffer.slice(0, idx);
					this.buffer = this.buffer.slice(idx + THINKING_CLOSE.length);
					this.state = 'post';
					continue;
				}
				const hold = partialPrefixHold(this.buffer, THINKING_CLOSE);
				if (hold > 0) {
					reasoning += this.buffer.slice(0, this.buffer.length - hold);
					this.buffer = this.buffer.slice(this.buffer.length - hold);
				} else {
					reasoning += this.buffer;
					this.buffer = '';
				}
				return { reasoning, visible };
			}
			visible += this.buffer;
			this.buffer = '';
		}
		return { reasoning, visible };
	}

	flush(): { reasoning: string; visible: string } {
		let reasoning = '';
		let visible = '';
		if (this.state === 'inside') {
			reasoning = this.buffer;
		} else {
			visible = this.buffer;
		}
		this.buffer = '';
		this.state = 'post';
		return { reasoning, visible };
	}
}
