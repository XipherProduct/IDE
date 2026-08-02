/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAlaskaSlashCommand, IAlaskaSlashCommandService, IAlaskaSlashContext, parseSlashInvocation } from '../common/alaskaSlash.js';

export class AlaskaSlashCommandService extends Disposable implements IAlaskaSlashCommandService {
	declare readonly _serviceBrand: undefined;

	private readonly commands = new Map<string, IAlaskaSlashCommand>();
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	constructor(@ILogService private readonly logService: ILogService) {
		super();
	}

	register(command: IAlaskaSlashCommand): IDisposable {
		const key = command.trigger;
		if (!key.startsWith('/')) {
			throw new Error(`Slash command trigger must start with '/': ${key}`);
		}
		if (this.commands.has(key)) {
			this.logService.warn(`[alaska.slash] overwriting existing command ${key}`);
		}
		this.commands.set(key, command);
		this._onDidChange.fire();
		return toDisposable(() => {
			if (this.commands.get(key) === command) {
				this.commands.delete(key);
				this._onDidChange.fire();
			}
		});
	}

	list(): readonly IAlaskaSlashCommand[] {
		return Array.from(this.commands.values()).sort((a, b) => a.trigger.localeCompare(b.trigger));
	}

	match(input: string): readonly IAlaskaSlashCommand[] {
		const partial = input.trim();
		if (!partial.startsWith('/')) { return []; }
		const lower = partial.toLowerCase();
		const all = this.list();
		const startsWith = all.filter(c => c.trigger.toLowerCase().startsWith(lower));
		if (startsWith.length > 0 || lower.length > 1) {
			return startsWith;
		}
		return all;
	}

	get(trigger: string): IAlaskaSlashCommand | undefined {
		return this.commands.get(trigger);
	}

	async execute(input: string, ctx: IAlaskaSlashContext): Promise<boolean> {
		const parsed = parseSlashInvocation(input);
		if (!parsed) { return false; }
		const command = this.commands.get(parsed.trigger);
		if (!command) { return false; }
		try {
			await command.run(ctx, parsed.args);
		} catch (err) {
			this.logService.warn(`[alaska.slash] command ${parsed.trigger} failed`, err);
			throw err;
		}
		return true;
	}
}
