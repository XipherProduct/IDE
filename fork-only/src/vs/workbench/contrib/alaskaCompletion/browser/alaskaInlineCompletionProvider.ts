/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import {
	InlineCompletion,
	InlineCompletionContext,
	InlineCompletionEndOfLifeReason,
	InlineCompletionEndOfLifeReasonKind,
	InlineCompletions,
	InlineCompletionsDisposeReason,
	InlineCompletionsProvider,
	InlineCompletionTriggerKind,
} from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	IAlaskaCompletionService,
	IAlaskaCompletionRecentEdit,
	ALASKA_COMPLETION_MIN_PREFIX_LEN,
} from '../common/alaskaCompletion.js';

const PREFIX_BYTES = 6000;
const SUFFIX_BYTES = 2000;
const MAX_COMPLETION_LINES = 20;
const RECENT_EDITS_MAX_AGE_MS = 5 * 60 * 1000;
const RECENT_EDITS_BUFFER_CAP = 32;
const RECENT_EDITS_OUTGOING_MAX = 3;
const RECENT_EDIT_WINDOW = 1500;
const TRIE_CACHE_PER_FILE = 32;
const TRIE_PREFIX_TAIL = 200;
const TRIE_PREFIX_EXT_MAX = 12;

interface ITrackedCompletion {
	readonly id: string;
	readonly suggestion: string;
	readonly servedAt: number;
	accepted: boolean;
	settled: boolean;
}

interface IRecentEditEntry {
	readonly uri: string;
	readonly content: string;
	readonly ts: number;
}

interface ICompletionMeta {
	readonly id: string;
}

type AlaskaInlineCompletion = InlineCompletion & { readonly _alaskaMeta?: ICompletionMeta };

interface AlaskaInlineCompletionList extends InlineCompletions<AlaskaInlineCompletion> {
	readonly _alaskaMeta: ICompletionMeta;
}

export class AlaskaInlineCompletionProvider extends Disposable implements InlineCompletionsProvider<AlaskaInlineCompletionList> {

	readonly displayName = 'Alaska AI';
	readonly groupId = 'alaska-inline-completions';

	private inflight: CancellationTokenSource | undefined;
	private readonly trie = new AlaskaCompletionTrie();
	private readonly recentEdits: IRecentEditEntry[] = [];
	private readonly trackers = new Map<string, ITrackedCompletion>();

	constructor(
		@IAlaskaCompletionService private readonly completionService: IAlaskaCompletionService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	override dispose(): void {
		if (this.inflight) {
			this.inflight.cancel();
			this.inflight = undefined;
		}
		super.dispose();
	}

	invalidateFile(uri: string): void {
		this.trie.invalidate(uri);
	}

	pushRecentEdit(uri: string, content: string): void {
		if (!content || content.length === 0) { return; }
		const slice = content.length > RECENT_EDIT_WINDOW ? content.slice(-RECENT_EDIT_WINDOW) : content;
		this.recentEdits.push({ uri, content: slice, ts: Date.now() });
		if (this.recentEdits.length > RECENT_EDITS_BUFFER_CAP) {
			this.recentEdits.splice(0, this.recentEdits.length - RECENT_EDITS_BUFFER_CAP);
		}
	}

	async provideInlineCompletions(
		model: ITextModel,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken,
	): Promise<AlaskaInlineCompletionList | undefined> {
		if (token.isCancellationRequested) { return undefined; }
		const language = model.getLanguageId();
		if (!this.completionService.isEnabledForLanguage(language)) { return undefined; }
		const mode = this.completionService.getMode();
		if (mode === 'off') { return undefined; }
		if (context.triggerKind === InlineCompletionTriggerKind.Automatic && mode !== 'auto') { return undefined; }

		const prefix = this.capturePrefix(model, position);
		if (prefix.length < ALASKA_COMPLETION_MIN_PREFIX_LEN) { return undefined; }

		const uriStr = model.uri.toString();
		const cached = this.trie.lookup(uriStr, prefix);
		if (cached && cached.suggestion) {
			return this.buildResultList(position, cached.suggestion, cached.id);
		}

		if (context.triggerKind === InlineCompletionTriggerKind.Automatic) {
			await this.debounce(this.completionService.getDebounceMs(), token);
			if (token.isCancellationRequested) { return undefined; }
		}

		if (this.inflight) {
			this.inflight.cancel();
			this.inflight = undefined;
		}
		const src = new CancellationTokenSource();
		this.inflight = src;
		const cancelOnOuter = token.onCancellationRequested(() => src.cancel());

		try {
			const suffix = this.captureSuffix(model, position);
			const recentEdits = this.snapshotRecentEdits(uriStr);

			const result = await this.completionService.complete({
				uri: model.uri,
				language,
				prefix,
				suffix,
				recentEdits,
				modelTier: this.completionService.getTier(),
				maxTokens: this.completionService.getMaxTokens(),
			}, src.token);

			if (!result || !result.suggestion) { return undefined; }
			if (src.token.isCancellationRequested) { return undefined; }

			const trimmed = this.postProcess(result.suggestion, prefix);
			if (!trimmed) { return undefined; }

			if (result.id) {
				this.trie.insert(uriStr, prefix, trimmed, result.id);
				this.trackers.set(result.id, {
					id: result.id,
					suggestion: trimmed,
					servedAt: Date.now(),
					accepted: false,
					settled: false,
				});
			}

			return this.buildResultList(position, trimmed, result.id);
		} catch (err) {
			if (src.token.isCancellationRequested) { return undefined; }
			this.logService.trace('[alaska.completion] provider error', err);
			return undefined;
		} finally {
			cancelOnOuter.dispose();
			if (this.inflight === src) {
				this.inflight = undefined;
			}
			src.dispose();
		}
	}

	private buildResultList(position: Position, suggestion: string, id: string): AlaskaInlineCompletionList {
		const item: AlaskaInlineCompletion = {
			insertText: suggestion,
			range: Range.fromPositions(position),
			completeBracketPairs: true,
			_alaskaMeta: { id },
		};
		return {
			items: [item],
			suppressSuggestions: false,
			enableForwardStability: true,
			_alaskaMeta: { id },
		};
	}

	handleItemDidShow(_list: AlaskaInlineCompletionList, _item: AlaskaInlineCompletion): void {
		// no-op; lifetime tracked via handleEndOfLifetime
	}

	handlePartialAccept(list: AlaskaInlineCompletionList, item: AlaskaInlineCompletion, acceptedCharacters: number): void {
		const id = item._alaskaMeta?.id ?? list._alaskaMeta.id;
		if (!id) { return; }
		const tracker = this.trackers.get(id);
		if (!tracker) { return; }
		this.completionService.sendFeedback({
			completionId: id,
			action: 'partial_accept',
			dwellMs: Date.now() - tracker.servedAt,
			acceptedChars: acceptedCharacters,
		});
	}

	handleEndOfLifetime(list: AlaskaInlineCompletionList, item: AlaskaInlineCompletion, reason: InlineCompletionEndOfLifeReason<AlaskaInlineCompletion>): void {
		const id = item._alaskaMeta?.id ?? list._alaskaMeta.id;
		if (!id) { return; }
		const tracker = this.trackers.get(id);
		if (!tracker || tracker.settled) { return; }
		tracker.settled = true;
		switch (reason.kind) {
			case InlineCompletionEndOfLifeReasonKind.Accepted:
				tracker.accepted = true;
				this.completionService.sendFeedback({
					completionId: id,
					action: 'accept',
					dwellMs: Date.now() - tracker.servedAt,
				});
				break;
			case InlineCompletionEndOfLifeReasonKind.Rejected:
				this.completionService.sendFeedback({
					completionId: id,
					action: 'dismiss',
					dwellMs: Date.now() - tracker.servedAt,
				});
				break;
			default:
				break;
		}
	}

	disposeInlineCompletions(_list: AlaskaInlineCompletionList, _reason: InlineCompletionsDisposeReason): void {
		// items GC'd by V8; trackers cleaned up by handleEndOfLifetime
	}

	private capturePrefix(model: ITextModel, position: Position): string {
		const text = model.getValueInRange(new Range(1, 1, position.lineNumber, position.column));
		return text.length > PREFIX_BYTES ? text.slice(-PREFIX_BYTES) : text;
	}

	private captureSuffix(model: ITextModel, position: Position): string {
		const lineCount = model.getLineCount();
		const lastLineLen = model.getLineLength(lineCount);
		const text = model.getValueInRange(new Range(position.lineNumber, position.column, lineCount, lastLineLen + 1));
		return text.length > SUFFIX_BYTES ? text.slice(0, SUFFIX_BYTES) : text;
	}

	private snapshotRecentEdits(currentUri: string): IAlaskaCompletionRecentEdit[] {
		const now = Date.now();
		const out: IAlaskaCompletionRecentEdit[] = [];
		for (let i = this.recentEdits.length - 1; i >= 0 && out.length < RECENT_EDITS_OUTGOING_MAX; i--) {
			const e = this.recentEdits[i];
			if (e.uri === currentUri) { continue; }
			if (now - e.ts > RECENT_EDITS_MAX_AGE_MS) { continue; }
			out.push({ path: e.uri, content: e.content, ageMs: now - e.ts });
		}
		return out;
	}

	private debounce(ms: number, token: CancellationToken): Promise<void> {
		return new Promise<void>(resolve => {
			let cancelDispose: IDisposable | undefined;
			const handle = setTimeout(() => {
				if (cancelDispose) { cancelDispose.dispose(); }
				resolve();
			}, Math.max(50, ms));
			cancelDispose = token.onCancellationRequested(() => {
				clearTimeout(handle);
				if (cancelDispose) { cancelDispose.dispose(); }
				resolve();
			});
		});
	}

	private postProcess(suggestion: string, prefix: string): string {
		let out = suggestion;
		out = out.replace(/^```[a-zA-Z0-9_+.-]*\n?/, '');
		out = out.replace(/```\s*$/, '');
		out = out.replace(/<EOC>\s*$/i, '');
		const lines = out.split('\n');
		if (lines.length > MAX_COMPLETION_LINES) {
			out = lines.slice(0, MAX_COMPLETION_LINES).join('\n');
		}
		if (prefix.length > 0) {
			const last = prefix.charAt(prefix.length - 1);
			if (last === ' ' || last === '\t') {
				out = out.replace(/^[ \t]+/, '');
			}
			if (last === '\n') {
				out = out.replace(/^\n+/, '');
			}
		}
		return out.length === 0 ? '' : out;
	}
}

interface ITrieHit {
	readonly id: string;
	readonly suggestion: string;
}

interface ITrieEntry {
	readonly prefix: string;
	readonly suggestion: string;
	readonly id: string;
}

export class AlaskaCompletionTrie {
	private readonly perFile = new Map<string, ITrieEntry[]>();

	lookup(uri: string, prefix: string): ITrieHit | undefined {
		const entries = this.perFile.get(uri);
		if (!entries) { return undefined; }
		const tail = tailOf(prefix, TRIE_PREFIX_TAIL);
		for (const e of entries) {
			const eTail = tailOf(e.prefix, TRIE_PREFIX_TAIL);
			if (eTail === tail) {
				return { id: e.id, suggestion: e.suggestion };
			}
			if (tail.length > eTail.length && tail.startsWith(eTail)) {
				const consumed = tail.slice(eTail.length);
				if (consumed.length > 0 && consumed.length <= TRIE_PREFIX_EXT_MAX && e.suggestion.startsWith(consumed)) {
					return { id: e.id, suggestion: e.suggestion.slice(consumed.length) };
				}
			}
		}
		return undefined;
	}

	insert(uri: string, prefix: string, suggestion: string, id: string): void {
		let entries = this.perFile.get(uri);
		if (!entries) {
			entries = [];
			this.perFile.set(uri, entries);
		}
		entries.unshift({ prefix, suggestion, id });
		if (entries.length > TRIE_CACHE_PER_FILE) {
			entries.length = TRIE_CACHE_PER_FILE;
		}
	}

	invalidate(uri: string): void {
		this.perFile.delete(uri);
	}

	clear(): void {
		this.perFile.clear();
	}
}

function tailOf(s: string, n: number): string {
	return s.length > n ? s.slice(-n) : s;
}

export function _testDisposeHelper(): IDisposable {
	return toDisposable(() => { /* test-only stub */ });
}
