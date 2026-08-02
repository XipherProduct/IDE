/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';

export const ALASKA_UPDATE_CHANNEL = 'alaskaUpdate';

export const IAlaskaUpdateMainService = createDecorator<IAlaskaUpdateMainService>('alaskaUpdateMainService');

export type AlaskaUpdateStage = 'appimage' | 'installer';

export interface IAlaskaUpdateApplyResult {
	/** true = update downloaded and staged/applied; false = could not (see error). */
	readonly ok: boolean;
	readonly error?: string;
	/**
	 * How it was applied:
	 *  - 'appimage'  : the AppImage file was swapped in place → active on next launch.
	 *  - 'installer' : the installer was staged → runs when the app is closed.
	 */
	readonly applied?: AlaskaUpdateStage;
}

export interface IAlaskaUpdateMainService {
	readonly _serviceBrand: undefined;

	/** Whether this install can self-update (AppImage on Linux / Inno setup on Windows). */
	canAutoApply(): Promise<boolean>;

	/**
	 * Download the artifact at `url` and apply it WITHOUT disrupting the running
	 * session: Linux swaps the AppImage in place (takes effect next launch); Windows
	 * stages the installer and runs it silently when the app is next closed.
	 */
	applyUpdate(url: string, version: string): Promise<IAlaskaUpdateApplyResult>;
}
