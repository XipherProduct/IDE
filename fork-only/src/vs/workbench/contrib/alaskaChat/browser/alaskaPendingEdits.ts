/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { CodeLens, CodeLensList, CodeLensProvider } from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';

export interface IAlaskaPendingEdit {
	readonly resource: URI;
	readonly action: 'create' | 'replace' | 'patch' | 'delete';
	readonly before?: string;
	readonly after?: string;
	readonly at: number;
}

export interface IAlaskaPendingEditsService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<URI | undefined>;
	register(edit: IAlaskaPendingEdit): void;
	get(resource: URI): IAlaskaPendingEdit | undefined;
	has(resource: URI): boolean;
	resources(): URI[];
	accept(resource: URI): void;
	revert(resource: URI): Promise<void>;
	acceptAll(): void;
	revertAll(): Promise<void>;
	discardAll(): void;
}

export const IAlaskaPendingEditsService = createDecorator<IAlaskaPendingEditsService>('alaskaPendingEditsService');

export class AlaskaPendingEditsService extends Disposable implements IAlaskaPendingEditsService {
	declare readonly _serviceBrand: undefined;

	private readonly _pending = new ResourceMap<IAlaskaPendingEdit>();
	private readonly _onDidChange = this._register(new Emitter<URI | undefined>());
	readonly onDidChange: Event<URI | undefined> = this._onDidChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ITextFileService private readonly textFileService: ITextFileService,
	) {
		super();
	}

	register(edit: IAlaskaPendingEdit): void {
		this._pending.set(edit.resource, edit);
		this._onDidChange.fire(edit.resource);
	}

	get(resource: URI): IAlaskaPendingEdit | undefined {
		return this._pending.get(resource);
	}

	has(resource: URI): boolean {
		return this._pending.has(resource);
	}

	resources(): URI[] {
		return Array.from(this._pending.keys());
	}

	accept(resource: URI): void {
		if (this._pending.delete(resource)) {
			this._onDidChange.fire(resource);
		}
	}

	acceptAll(): void {
		if (this._pending.size === 0) { return; }
		this._pending.clear();
		this._onDidChange.fire(undefined);
	}

	discardAll(): void {
		if (this._pending.size === 0) { return; }
		this._pending.clear();
		this._onDidChange.fire(undefined);
	}

	async revert(resource: URI): Promise<void> {
		const edit = this._pending.get(resource);
		if (!edit) { return; }
		try {
			if (edit.action === 'delete') {
				if (typeof edit.before === 'string') {
					await this.textFileService.create([{ resource, value: edit.before, options: { overwrite: true } }]);
				}
			} else if (edit.action === 'create') {
				if (await this.fileService.exists(resource)) {
					await this.fileService.del(resource, { useTrash: false });
				}
			} else {
				if (typeof edit.before === 'string') {
					await this.textFileService.write(resource, edit.before);
				}
			}
		} finally {
			this._pending.delete(resource);
			this._onDidChange.fire(resource);
		}
	}

	async revertAll(): Promise<void> {
		const targets = this.resources();
		for (const r of targets) {
			await this.revert(r);
		}
	}
}

export class AlaskaEditCodeLensProvider implements CodeLensProvider {
	private readonly _onDidChange = new Emitter<this>();
	readonly onDidChange: Event<this> = this._onDidChange.event;

	constructor(private readonly tracker: IAlaskaPendingEditsService) {
		this.tracker.onDidChange(() => this._onDidChange.fire(this));
	}

	provideCodeLenses(model: ITextModel, _token: CancellationToken): CodeLensList | undefined {
		if (!this.tracker.has(model.uri)) {
			return undefined;
		}
		const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
		const resourceArg = model.uri.toString();
		return {
			lenses: [
				{ range, command: { id: ACCEPT_COMMAND_ID, title: '$(check) Accept change', arguments: [resourceArg] } },
				{ range, command: { id: REVERT_COMMAND_ID, title: '$(close) Revert', arguments: [resourceArg] } },
			],
		};
	}
}

export const ACCEPT_COMMAND_ID = 'alaska.acceptPendingEdit';
export const REVERT_COMMAND_ID = 'alaska.revertPendingEdit';

export function registerAlaskaEditCodeLens(
	tracker: IAlaskaPendingEditsService,
	languageFeatures: ILanguageFeaturesService,
): IDisposable {
	const provider = new AlaskaEditCodeLensProvider(tracker);
	return languageFeatures.codeLensProvider.register('*', provider);
}
