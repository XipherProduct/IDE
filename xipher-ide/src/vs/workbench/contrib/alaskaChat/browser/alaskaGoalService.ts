/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAlaskaGoal, IAlaskaGoalService, IGoalVerdict, MAX_GOAL_ITERATIONS } from '../common/alaskaGoal.js';
import { IAlaskaChatService, IAlaskaChatMessage } from './alaskaChatService.js';
import { IAlaskaSlashCommandService, IAlaskaSlashContext } from '../common/alaskaSlash.js';

const VERIFIER_SYSTEM =
	'You are a STRICT goal verifier for a coding agent. Decide whether the GOAL is FULLY and verifiably satisfied by the work shown so far. ' +
	'Be skeptical: partial progress, promises, or "I will do it" are NOT met. Only concrete, completed results count. ' +
	'A plan, a to-do list, an outline, or "here is what I will do next" is NOT met — the work it describes must have actually been carried out. ' +
	'Respond with ONLY a single JSON object, no prose: {"met": boolean, "feedback": string}. ' +
	'If not met, feedback = one concise sentence naming exactly what still remains. If met, feedback = "".';

export class AlaskaGoalService extends Disposable implements IAlaskaGoalService {
	declare readonly _serviceBrand: undefined;

	private _goal: IAlaskaGoal | undefined;
	private readonly _onDidChange = this._register(new Emitter<IAlaskaGoal | undefined>());
	readonly onDidChange: Event<IAlaskaGoal | undefined> = this._onDidChange.event;

	constructor(
		@IAlaskaChatService private readonly chatService: IAlaskaChatService,
		@ILogService private readonly logService: ILogService,
		@IAlaskaSlashCommandService slashService: IAlaskaSlashCommandService,
	) {
		super();
		// Register the /goal command here, capturing `this` — avoids relying on
		// the slash context's ServicesAccessor (only valid synchronously).
		this._register(slashService.register({
			id: 'alaska.slash.goal',
			trigger: '/goal',
			label: 'Set a goal',
			description: 'Keep the agent working until a condition is verified met (pause | resume | clear)',
			category: 'workflow',
			iconId: 'target',
			args: [{ name: 'condition', description: 'Completion condition, or: pause | resume | clear', required: false }],
			run: async (ctx: IAlaskaSlashContext, rawArgs: string): Promise<void> => {
				const arg = (rawArgs || '').trim();
				const sub = arg.toLowerCase();
				if (sub === 'pause') { this.pause(); ctx.injectAssistantMessage('⏸️ **Goal paused** — `/goal resume` to re-arm.'); return; }
				if (sub === 'resume') { this.resume(); ctx.injectAssistantMessage('▶️ **Goal resumed.**'); return; }
				if (sub === 'clear' || sub === 'stop' || sub === 'done') { this.clear(); ctx.injectAssistantMessage('🎯 **Goal cleared.**'); return; }
				if (!arg) {
					const g = this.active;
					ctx.injectAssistantMessage(g
						? `🎯 **Active goal**${g.paused ? ' (paused)' : ''}: ${g.condition}\n\n_(\`/goal pause | resume | clear\`)_`
						: 'No active goal. Use `/goal <condition>` to set one.');
					return;
				}
				this.setGoal(arg);
				ctx.injectAssistantMessage(`🎯 **Goal set:** ${arg}\n\n_A verifier checks each turn; I keep working until it is fully met. \`/goal pause\` / \`/goal clear\`._`);
				await ctx.submitUserMessage(arg);
			},
		}));
	}

	get active(): IAlaskaGoal | undefined { return this._goal; }

	private set(next: IAlaskaGoal | undefined): void {
		this._goal = next;
		this._onDidChange.fire(next);
	}

	setGoal(condition: string): void {
		this.set({ condition: condition.trim(), paused: false, iterations: 0, createdAt: Date.now() });
	}
	pause(): void { if (this._goal) { this.set({ ...this._goal, paused: true }); } }
	resume(): void { if (this._goal) { this.set({ ...this._goal, paused: false }); } }
	clear(): void { this.set(undefined); }

	tick(): boolean {
		if (!this._goal) { return false; }
		const iterations = this._goal.iterations + 1;
		this.set({ ...this._goal, iterations });
		return iterations < MAX_GOAL_ITERATIONS;
	}

	async verify(transcript: string, token: CancellationToken): Promise<IGoalVerdict> {
		const goal = this._goal;
		if (!goal) { return { met: true, feedback: '' }; }
		const messages: IAlaskaChatMessage[] = [
			{ role: 'system', content: VERIFIER_SYSTEM },
			{ role: 'user', content: `GOAL:\n${goal.condition}\n\nWORK / CONVERSATION SO FAR:\n${transcript}\n\nReturn the JSON verdict.` },
		];
		let acc = '';
		try {
			for await (const ev of this.chatService.stream({ messages, reasoningEffort: 'low' }, token)) {
				if (ev.kind === 'delta') { acc += ev.text; }
				else if (ev.kind === 'error') { throw new Error(ev.message); }
			}
		} catch (err) {
			this.logService.warn('[alaska.goal] verifier call failed; treating as not-met', err);
			return { met: false, feedback: 'Verifier could not run; continue toward the goal.' };
		}
		return parseVerdict(acc);
	}
}

function parseVerdict(text: string): IGoalVerdict {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start >= 0 && end > start) {
		try {
			const obj = JSON.parse(text.slice(start, end + 1));
			return { met: obj.met === true, feedback: typeof obj.feedback === 'string' ? obj.feedback : '' };
		} catch { /* fall through */ }
	}
	// couldn't parse → conservative: not met unless it clearly says met
	const met = /\bmet\b\s*[:=]?\s*true/i.test(text) || /\bgoal (is )?(fully )?met\b/i.test(text);
	return { met, feedback: met ? '' : 'Verifier returned no structured verdict; continue toward the goal.' };
}
