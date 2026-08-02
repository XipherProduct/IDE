/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { LcsDiff } from '../../../../base/common/diff/diff.js';
import {
	IAlaskaHunkTrackerService,
	IAlaskaHunk,
	IAlaskaHunkFileSummary,
	IAlaskaHunkSessionSummary,
	AlaskaHunkAuthor,
	AlaskaHunkSource,
	ILineDelta,
} from '../common/alaskaHunkTracker.js';

/**
 * Ported from grok-build's `xai-hunk-tracker` (LOC-attribution slice). Holds
 * an in-memory, session-scoped log of every change to a file the agent has
 * touched, attributed to agent vs human. See alaskaHunkTracker.ts.
 */
export class AlaskaHunkTrackerService extends Disposable implements IAlaskaHunkTrackerService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly _hunks: IAlaskaHunk[] = [];
	/** Paths the agent has written to this session (grok's "agent file" set). */
	private readonly agentFiles = new Set<string>();

	recordAgentEdit(resource: URI, before: string, after: string, promptIndex: number): void {
		const path = this.key(resource);
		this.agentFiles.add(path);
		const delta = countLineDelta(before, after);
		this._hunks.push({
			path,
			author: AlaskaHunkAuthor.Agent,
			source: AlaskaHunkSource.AgentEdit,
			promptIndex,
			linesAdded: delta.added,
			linesRemoved: delta.removed,
			at: Date.now(),
		});
		this._onDidChange.fire();
	}

	recordExternalEdit(resource: URI, agentTouched: boolean, before?: string, after?: string): void {
		const path = this.key(resource);
		const delta = (before !== undefined && after !== undefined)
			? countLineDelta(before, after)
			: { added: 0, removed: 0 };
		this._hunks.push({
			path,
			author: AlaskaHunkAuthor.Human,
			source: agentTouched ? AlaskaHunkSource.ExternalEditOnAgentFile : AlaskaHunkSource.External,
			linesAdded: delta.added,
			linesRemoved: delta.removed,
			at: Date.now(),
		});
		this._onDidChange.fire();
	}

	hasAgentTouched(resource: URI): boolean {
		return this.agentFiles.has(this.key(resource));
	}

	hunks(): readonly IAlaskaHunk[] {
		return this._hunks;
	}

	summary(): IAlaskaHunkSessionSummary {
		const byPath = new Map<string, {
			count: number;
			agentAdd: number; agentRem: number;
			humanAdd: number; humanRem: number;
		}>();
		let agentLinesAdded = 0, agentLinesRemoved = 0, humanLinesAdded = 0, humanLinesRemoved = 0;

		for (const h of this._hunks) {
			let e = byPath.get(h.path);
			if (!e) {
				e = { count: 0, agentAdd: 0, agentRem: 0, humanAdd: 0, humanRem: 0 };
				byPath.set(h.path, e);
			}
			e.count++;
			if (h.author === AlaskaHunkAuthor.Agent) {
				e.agentAdd += h.linesAdded;
				e.agentRem += h.linesRemoved;
				agentLinesAdded += h.linesAdded;
				agentLinesRemoved += h.linesRemoved;
			} else {
				e.humanAdd += h.linesAdded;
				e.humanRem += h.linesRemoved;
				humanLinesAdded += h.linesAdded;
				humanLinesRemoved += h.linesRemoved;
			}
		}

		const files: IAlaskaHunkFileSummary[] = [];
		for (const [path, e] of byPath) {
			files.push({
				path,
				hunkCount: e.count,
				hasAgentChanges: e.agentAdd > 0 || e.agentRem > 0,
				hasExternalChanges: e.humanAdd > 0 || e.humanRem > 0,
				agentLinesAdded: e.agentAdd,
				agentLinesRemoved: e.agentRem,
				humanLinesAdded: e.humanAdd,
				humanLinesRemoved: e.humanRem,
			});
		}
		files.sort((a, b) => a.path.localeCompare(b.path));

		return {
			files,
			agentLinesAdded,
			agentLinesRemoved,
			humanLinesAdded,
			humanLinesRemoved,
			totalHunks: this._hunks.length,
		};
	}

	reset(): void {
		this._hunks.length = 0;
		this.agentFiles.clear();
		this._onDidChange.fire();
	}

	private key(resource: URI): string {
		return resource.toString();
	}
}

/**
 * Count lines added / removed between two texts via the shared LCS diff — the
 * same engine the inline-diff UI uses, so counts agree with what's rendered.
 */
export function countLineDelta(before: string, after: string): ILineDelta {
	if (before === after) {
		return { added: 0, removed: 0 };
	}
	// Empty side ⇒ pure create/delete; count non-trailing-empty lines directly.
	if (before.length === 0) {
		return { added: lineCount(after), removed: 0 };
	}
	if (after.length === 0) {
		return { added: 0, removed: lineCount(before) };
	}
	return lineLcsDelta(before.split('\n'), after.split('\n'));
}

function lineCount(text: string): number {
	if (text.length === 0) {
		return 0;
	}
	// A trailing newline denotes a final empty segment that isn't a real line.
	const parts = text.split('\n');
	if (parts.length > 0 && parts[parts.length - 1] === '') {
		parts.pop();
	}
	return parts.length;
}

/**
 * Line-granular added/removed counts via LCS over line arrays. Elements are
 * hashed to integers so the shared `LcsDiff` compares whole lines, not chars.
 */
function lineLcsDelta(beforeLines: string[], afterLines: string[]): ILineDelta {
	const intern = new Map<string, number>();
	const toIds = (lines: string[]): number[] => lines.map(l => {
		let id = intern.get(l);
		if (id === undefined) {
			id = intern.size;
			intern.set(l, id);
		}
		return id;
	});
	const a = toIds(beforeLines);
	const b = toIds(afterLines);
	const seqA = { getElements: () => a };
	const seqB = { getElements: () => b };
	const changes = new LcsDiff(seqA, seqB).ComputeDiff(false).changes;
	let added = 0, removed = 0;
	for (const c of changes) {
		removed += c.originalLength;
		added += c.modifiedLength;
	}
	return { added, removed };
}
