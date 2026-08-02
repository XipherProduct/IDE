/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';

export const enum TitlebarZone {
	Left = 'left',
	Right = 'right',
}

export interface ITitlebarZoneContext {
	readonly isNarrow: boolean;
}

export interface ITitlebarZoneContribution {
	readonly id: string;
	readonly zone: TitlebarZone;
	readonly order: number;
	create(container: HTMLElement, instantiationService: IInstantiationService, context: ITitlebarZoneContext): IDisposable;
}

class TitlebarZoneRegistryImpl {
	private readonly contributions: ITitlebarZoneContribution[] = [];

	register(contribution: ITitlebarZoneContribution): void {
		if (this.contributions.some(c => c.id === contribution.id)) {
			throw new Error(`Titlebar zone contribution "${contribution.id}" already registered`);
		}
		this.contributions.push(contribution);
	}

	for(zone: TitlebarZone): readonly ITitlebarZoneContribution[] {
		return this.contributions
			.filter(c => c.zone === zone)
			.slice()
			.sort((a, b) => a.order - b.order);
	}
}

export const TitlebarZoneRegistry = new TitlebarZoneRegistryImpl();
