/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from '../../../common/contributions.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';

const CLOCK_TICK_MS = 1000;

class AlaskaClockContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'alaska.clock';
	private entry: IStatusbarEntryAccessor | undefined;
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
	) {
		super();

		const name = localize('alaska.clock.name', 'Alaska Clock');
		const ariaLabel = localize('alaska.clock.ariaLabel', 'System clock');

		this.entry = this._register(this.statusbarService.addEntry({
			name,
			text: this.formatNow(),
			ariaLabel,
			tooltip: ariaLabel,
		}, AlaskaClockContribution.ID, StatusbarAlignment.RIGHT, 100));

		this.timer = setInterval(() => this.tick(), CLOCK_TICK_MS);
		this._register({
			dispose: () => {
				if (this.timer) {
					clearInterval(this.timer);
					this.timer = undefined;
				}
			}
		});
	}

	private tick(): void {
		this.entry?.update({
			name: localize('alaska.clock.name', 'Alaska Clock'),
			text: this.formatNow(),
			ariaLabel: localize('alaska.clock.ariaLabel', 'System clock'),
		});
	}

	private formatNow(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `$(circle-filled) ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaClockContribution,
	LifecyclePhase.Restored,
);
