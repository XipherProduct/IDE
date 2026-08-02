/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaBYOProvider = 'anthropic' | 'openai' | 'openrouter' | 'custom';

export const ALASKA_BYO_PROVIDERS: readonly AlaskaBYOProvider[] = ['anthropic', 'openai', 'openrouter', 'custom'];

export interface IAlaskaBYOConfig {
	readonly enabled: boolean;
	readonly provider: AlaskaBYOProvider;
	readonly baseUrl: string;
	readonly model?: string;
	readonly hasKey: boolean;
}

export interface IAlaskaBYOActive extends IAlaskaBYOConfig {
	readonly apiKey: string;
}

export const IAlaskaBYOService = createDecorator<IAlaskaBYOService>('alaskaByoService');

export interface IAlaskaBYOService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;

	getConfig(): IAlaskaBYOConfig;
	getActive(): Promise<IAlaskaBYOActive | undefined>;

	setEnabled(enabled: boolean): Promise<void>;
	setProvider(provider: AlaskaBYOProvider): Promise<void>;
	setCustomBaseUrl(url: string): Promise<void>;
	setModel(modelId: string): Promise<void>;
	setApiKey(key: string): Promise<void>;
	clearApiKey(): Promise<void>;
	hasApiKey(): Promise<boolean>;
}

export function resolveBYOBaseUrl(provider: AlaskaBYOProvider, customBaseUrl: string): string {
	switch (provider) {
		case 'anthropic': return 'https://api.anthropic.com/v1';
		case 'openai': return 'https://api.openai.com/v1';
		case 'openrouter': return 'https://openrouter.ai/api/v1';
		case 'custom': return customBaseUrl;
	}
}
