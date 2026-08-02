/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * The /goal harness (ported behaviour from grok-build's ACP `/goal`): the user
 * declares a completion condition; after every assistant turn a skeptic
 * "verifier" checks the transcript against it and, until the condition holds,
 * the agent is kept working (a synthetic continuation is injected) instead of
 * being allowed to stop. Supports pause / resume / clear.
 */
export interface IAlaskaGoal {
	readonly condition: string;
	readonly paused: boolean;
	readonly iterations: number;
	readonly createdAt: number;
}

export interface IGoalVerdict {
	readonly met: boolean;
	/** What still remains / why it is not met (fed back to the agent). */
	readonly feedback: string;
}

export const MAX_GOAL_ITERATIONS = 40;

export const IAlaskaGoalService = createDecorator<IAlaskaGoalService>('alaskaGoalService');

export interface IAlaskaGoalService {
	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<IAlaskaGoal | undefined>;
	readonly active: IAlaskaGoal | undefined;

	setGoal(condition: string): void;
	pause(): void;
	resume(): void;
	clear(): void;
	/** Bump the continuation counter; returns false once the cap is hit. */
	tick(): boolean;

	/**
	 * Ask the verifier whether the goal is satisfied by the conversation so far.
	 * `transcript` is a compact rendering of the recent turns.
	 */
	verify(transcript: string, token: CancellationToken): Promise<IGoalVerdict>;
}
