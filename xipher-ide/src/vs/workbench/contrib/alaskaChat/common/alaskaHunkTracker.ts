/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Hunk tracker — LOC-attribution slice ported from grok-build's
 * `xai-hunk-tracker` (crates/codegen/xai-hunk-tracker). The Rust crate is a
 * full actor with per-hunk accept/reject; here we keep the part that carries
 * its weight in this fork: *attribution*. Every change to a file the agent has
 * touched is recorded with who authored it (agent vs human) and, for agent
 * edits, which user prompt drove it — then aggregated into a session summary.
 *
 * This is the natural consumer of the file-change signal from
 * [[alaskaReminder]]: a stale-read detected mid-session is an external (human)
 * edit on an agent file, i.e. grok's `HunkSource::ExternalEditOnAgentFile`.
 */

/** Who authored a change. Mirrors grok's `AuthorType`. */
export const enum AlaskaHunkAuthor {
	Agent = 'agent',
	Human = 'human',
}

/**
 * Attribution class of a recorded change. Mirrors grok's `HunkSource`:
 * agent edits carry a prompt index; external edits are split by whether the
 * file was previously touched by the agent.
 */
export const enum AlaskaHunkSource {
	AgentEdit = 'agentEdit',
	ExternalEditOnAgentFile = 'externalEditOnAgentFile',
	External = 'external',
}

/** A single recorded change to one file. */
export interface IAlaskaHunk {
	readonly path: string;
	readonly author: AlaskaHunkAuthor;
	readonly source: AlaskaHunkSource;
	/** 0-based index of the user prompt that drove this edit; undefined for human edits. */
	readonly promptIndex?: number;
	readonly linesAdded: number;
	readonly linesRemoved: number;
	readonly at: number;
}

/** Per-file rollup for UI display. Mirrors grok's `FileSummary`. */
export interface IAlaskaHunkFileSummary {
	readonly path: string;
	readonly hunkCount: number;
	readonly hasAgentChanges: boolean;
	readonly hasExternalChanges: boolean;
	readonly agentLinesAdded: number;
	readonly agentLinesRemoved: number;
	readonly humanLinesAdded: number;
	readonly humanLinesRemoved: number;
}

/** Whole-session rollup. Mirrors grok's `SessionSummary` LOC aggregate. */
export interface IAlaskaHunkSessionSummary {
	readonly files: readonly IAlaskaHunkFileSummary[];
	readonly agentLinesAdded: number;
	readonly agentLinesRemoved: number;
	readonly humanLinesAdded: number;
	readonly humanLinesRemoved: number;
	readonly totalHunks: number;
}

export interface IAlaskaHunkTrackerService {
	readonly _serviceBrand: undefined;

	/** Fires when hunks change (a new edit recorded, or a reset). */
	readonly onDidChange: Event<void>;

	/**
	 * Record an edit the agent just made. Computes lines added/removed by
	 * line-diffing before/after. `create`/`delete` pass one side empty.
	 */
	recordAgentEdit(resource: URI, before: string, after: string, promptIndex: number): void;

	/**
	 * Record an external (human/tool) edit to a file. `agentTouched` selects
	 * between ExternalEditOnAgentFile and External. If before/after are known
	 * the LOC delta is computed, otherwise it is recorded as an unmeasured
	 * (0/0) external hunk that still flags the file as externally changed.
	 */
	recordExternalEdit(resource: URI, agentTouched: boolean, before?: string, after?: string): void;

	/** True if the agent has ever written this file this session. */
	hasAgentTouched(resource: URI): boolean;

	/** All recorded hunks, in insertion order. */
	hunks(): readonly IAlaskaHunk[];

	/** Aggregated session summary. */
	summary(): IAlaskaHunkSessionSummary;

	/** Clear all tracking (new session / baseline reset after commit). */
	reset(): void;
}

export const IAlaskaHunkTrackerService = createDecorator<IAlaskaHunkTrackerService>('alaskaHunkTrackerService');

/**
 * Count lines added / removed between two texts using the shared LCS diff.
 * Returned counts are line granularity, matching a unified-diff hunk header.
 */
export interface ILineDelta {
	readonly added: number;
	readonly removed: number;
}
