/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IDecorationsService, IDecorationsProvider, IDecorationData } from '../../../services/decorations/common/decorations.js';

export const IAlaskaActivityService = createDecorator<IAlaskaActivityService>('alaskaActivityService');

export const ALASKA_READING_FOREGROUND = 'alaska.tree.readingForeground';

export interface IAlaskaActivityService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeReading: Event<readonly URI[]>;
	readonly readingUris: ReadonlySet<string>;
	markReading(resource: URI): IDisposable;
	isReading(resource: URI): boolean;
}

export class AlaskaActivityService extends Disposable implements IAlaskaActivityService {
	declare readonly _serviceBrand: undefined;

	private readonly _reading = new Map<string, number>();
	private readonly _readingKeys = new Set<string>();
	private readonly _onDidChangeReading = this._register(new Emitter<readonly URI[]>());
	readonly onDidChangeReading: Event<readonly URI[]> = this._onDidChangeReading.event;

	get readingUris(): ReadonlySet<string> {
		return this._readingKeys;
	}

	constructor(
		@IDecorationsService private readonly decorationsService: IDecorationsService,
	) {
		super();
		this._register(this.decorationsService.registerDecorationsProvider(new AlaskaReadingDecorationsProvider(this)));
	}

	markReading(resource: URI): IDisposable {
		const key = resource.toString();
		const count = (this._reading.get(key) ?? 0) + 1;
		this._reading.set(key, count);
		this._readingKeys.add(key);
		this._onDidChangeReading.fire([resource]);
		return toDisposable(() => {
			const current = this._reading.get(key) ?? 0;
			if (current <= 1) {
				this._reading.delete(key);
				this._readingKeys.delete(key);
			} else {
				this._reading.set(key, current - 1);
			}
			this._onDidChangeReading.fire([resource]);
		});
	}

	isReading(resource: URI): boolean {
		return this._readingKeys.has(resource.toString());
	}
}

class AlaskaReadingDecorationsProvider implements IDecorationsProvider {
	readonly label = 'Xipher IDE reading';
	private readonly _onDidChange = new Emitter<readonly URI[]>();
	readonly onDidChange: Event<readonly URI[]> = this._onDidChange.event;

	constructor(private readonly activity: IAlaskaActivityService) {
		this.activity.onDidChangeReading(uris => this._onDidChange.fire(uris));
	}

	provideDecorations(uri: URI): IDecorationData | undefined {
		if (!this.activity.isReading(uri)) {
			return undefined;
		}
		return {
			weight: 100,
			color: ALASKA_READING_FOREGROUND,
			tooltip: 'Xipher IDE is reading this file',
			letter: '↻',
			bubble: false,
		};
	}
}
