/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { basename } from '../../../../base/common/resources.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IAlaskaActivityService } from './alaskaActivityService.js';

const READING_CLASS = 'alaska-reading';

export class AlaskaReadingTreePulseContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'alaska.readingTreePulse';

	private readonly _markedRows = new Set<HTMLElement>();
	private _pendingHandle: number | undefined;

	constructor(
		@IAlaskaActivityService private readonly activityService: IAlaskaActivityService,
	) {
		super();
		this._register(this.activityService.onDidChangeReading(() => this.scheduleUpdate()));
		this._register(toDisposable(() => {
			if (this._pendingHandle !== undefined) {
				cancelAnimationFrame(this._pendingHandle);
				this._pendingHandle = undefined;
			}
			this.clearMarked();
		}));
	}

	private scheduleUpdate(): void {
		if (this._pendingHandle !== undefined) { return; }
		this._pendingHandle = requestAnimationFrame(() => {
			this._pendingHandle = undefined;
			this.update();
		});
	}

	private update(): void {
		const root = document.body;
		const sidebar = root.querySelector<HTMLElement>('.part.sidebar');
		if (!sidebar) {
			this.clearMarked();
			return;
		}

		const readingNames = new Set<string>();
		for (const uri of this.activityService.readingUris) {
			try {
				readingNames.add(basename(URI.parse(uri)));
			} catch {
			}
		}

		this.clearMarked();
		if (readingNames.size === 0) { return; }

		const rows = sidebar.querySelectorAll<HTMLElement>('.monaco-list-row');
		rows.forEach(row => {
			const label = row.querySelector<HTMLElement>('.label-name')?.textContent?.trim();
			const ariaName = row.getAttribute('aria-label')?.split(',')[0]?.trim();
			const name = label || ariaName;
			if (name && readingNames.has(name)) {
				row.classList.add(READING_CLASS);
				this._markedRows.add(row);
			}
		});
	}

	private clearMarked(): void {
		for (const row of this._markedRows) {
			row.classList.remove(READING_CLASS);
		}
		this._markedRows.clear();
	}
}
