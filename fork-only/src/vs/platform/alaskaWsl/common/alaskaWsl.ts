/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IAlaskaWslService = createDecorator<IAlaskaWslService>('alaskaWslService');

export const ALASKA_WSL_CHANNEL = 'alaskaWsl';

export type AlaskaWslDistroState = 'Running' | 'Stopped' | 'Unknown';

export type AlaskaWslDistroVersion = '1' | '2' | 'unknown';

export interface IAlaskaWslDistro {
	readonly name: string;
	readonly state: AlaskaWslDistroState;
	readonly version: AlaskaWslDistroVersion;
	readonly isDefault: boolean;
}

export interface IAlaskaWslAvailability {
	readonly available: boolean;
	readonly reason?: string;
}

export interface IAlaskaWslService {
	readonly _serviceBrand: undefined;

	isAvailable(): Promise<IAlaskaWslAvailability>;
	listDistros(): Promise<readonly IAlaskaWslDistro[]>;
}
