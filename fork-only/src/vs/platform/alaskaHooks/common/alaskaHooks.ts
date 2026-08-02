/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';

export const ALASKA_HOOK_CHANNEL = 'alaskaHooks';

export const IAlaskaHookHostService = createDecorator<IAlaskaHookHostService>('alaskaHookHostService');

export interface IAlaskaHookHostRequest {
	readonly command: string;
	readonly cwd: string;
	readonly env: Record<string, string>;
	readonly timeoutMs: number;
	readonly stdin: string;
}

export interface IAlaskaHookHostResult {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
	readonly timedOut: boolean;
}

export interface IAlaskaHookHostService {
	readonly _serviceBrand: undefined;
	runHookCommand(req: IAlaskaHookHostRequest): Promise<IAlaskaHookHostResult>;
}
