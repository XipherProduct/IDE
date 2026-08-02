/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaHookEvent = 'preToolUse' | 'postToolUse' | 'userPromptSubmit' | 'sessionEnd';

export interface IAlaskaHookMatcher {
	readonly tool?: string;
	readonly pathGlob?: string;
	readonly commandPattern?: string;
}

export interface IAlaskaHookEntry {
	readonly matcher: IAlaskaHookMatcher;
	readonly command: string;
	readonly timeoutMs?: number;
	readonly blocking?: boolean;
}

export interface IAlaskaHookConfig {
	readonly version: number;
	readonly hooks: {
		readonly preToolUse?: IAlaskaHookEntry[];
		readonly postToolUse?: IAlaskaHookEntry[];
		readonly userPromptSubmit?: IAlaskaHookEntry[];
		readonly sessionEnd?: IAlaskaHookEntry[];
	};
}

export interface IAlaskaHookPayload {
	readonly event: AlaskaHookEvent;
	readonly sessionId: string;
	readonly workspaceFolder: string;
	readonly tool?: { readonly name: string; readonly arguments: unknown };
	readonly userMessage?: string;
}

export interface IAlaskaHookActionContinue {
	readonly action: 'continue';
	readonly modifiedPayload?: IAlaskaHookPayload;
}

export interface IAlaskaHookActionBlock {
	readonly action: 'block';
	readonly reason: string;
}

export interface IAlaskaHookActionModify {
	readonly action: 'modify';
	readonly modifiedPayload: IAlaskaHookPayload;
}

export type IAlaskaHookActionResult =
	| IAlaskaHookActionContinue
	| IAlaskaHookActionBlock
	| IAlaskaHookActionModify;

export const IAlaskaHookService = createDecorator<IAlaskaHookService>('alaskaHookService');

export interface IAlaskaHookService {
	readonly _serviceBrand: undefined;
	dispatch(payload: IAlaskaHookPayload): Promise<IAlaskaHookActionResult>;
	reload(): Promise<void>;
}

export function matchesGlob(value: string, glob: string): boolean {
	if (!glob) { return true; }
	const re = new RegExp('^' + glob
		.replace(/[.+^$()|{}\\]/g, '\\$&')
		.replace(/\*\*/g, '.+')
		.replace(/\*/g, '[^/]*')
		.replace(/\?/g, '.') + '$');
	return re.test(value);
}
