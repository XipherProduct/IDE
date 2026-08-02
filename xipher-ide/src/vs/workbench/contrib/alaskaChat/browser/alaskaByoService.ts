/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ALASKA_BYO_PROVIDERS, AlaskaBYOProvider, IAlaskaBYOActive, IAlaskaBYOConfig, IAlaskaBYOService, resolveBYOBaseUrl } from '../common/alaskaByo.js';
import { IAlaskaAuthService } from './alaskaAuthService.js';

const BYO_SECRET_KEY = 'alaska.byo.apiKey';
const BYO_ENABLED_KEY = 'alaska.byo.enabled';
const BYO_PROVIDER_KEY = 'alaska.byo.provider';
const BYO_CUSTOM_URL_KEY = 'alaska.byo.customBaseUrl';
const BYO_MODEL_KEY = 'alaska.byo.model';
const BYO_HAS_KEY_FLAG = 'alaska.byo.hasKey';

export class AlaskaBYOService extends Disposable implements IAlaskaBYOService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	constructor(
		@ISecretStorageService private readonly secretStorage: ISecretStorageService,
		@IStorageService private readonly storage: IStorageService,
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
	) {
		super();
		this._register(this.secretStorage.onDidChangeSecret(key => {
			if (key === BYO_SECRET_KEY) {
				this._onDidChange.fire();
			}
		}));
		this._register(this.authService.onDidChangeState(() => this._onDidChange.fire()));
	}

	getConfig(): IAlaskaBYOConfig {
		const provider = this.readProvider();
		return {
			enabled: this.storage.getBoolean(BYO_ENABLED_KEY, StorageScope.APPLICATION, false),
			provider,
			baseUrl: resolveBYOBaseUrl(provider, this.storage.get(BYO_CUSTOM_URL_KEY, StorageScope.APPLICATION, '')),
			model: this.storage.get(BYO_MODEL_KEY, StorageScope.APPLICATION, '') || undefined,
			hasKey: this.storage.getBoolean(BYO_HAS_KEY_FLAG, StorageScope.APPLICATION, false),
		};
	}

	async getActive(): Promise<IAlaskaBYOActive | undefined> {
		const config = this.getConfig();
		if (!config.enabled) { return undefined; }
		if (!this.userIsUltra()) { return undefined; }
		const apiKey = await this.secretStorage.get(BYO_SECRET_KEY);
		if (!apiKey) { return undefined; }
		if (config.provider === 'custom' && (!config.baseUrl || !config.baseUrl.startsWith('https://'))) {
			return undefined;
		}
		return { ...config, apiKey };
	}

	async setEnabled(enabled: boolean): Promise<void> {
		this.storage.store(BYO_ENABLED_KEY, enabled, StorageScope.APPLICATION, StorageTarget.MACHINE);
		this._onDidChange.fire();
	}

	async setProvider(provider: AlaskaBYOProvider): Promise<void> {
		this.storage.store(BYO_PROVIDER_KEY, provider, StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChange.fire();
	}

	async setCustomBaseUrl(url: string): Promise<void> {
		const trimmed = (url || '').trim();
		if (trimmed && !trimmed.startsWith('https://')) {
			throw new Error('BYO custom base URL must use HTTPS.');
		}
		this.storage.store(BYO_CUSTOM_URL_KEY, trimmed, StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChange.fire();
	}

	async setModel(modelId: string): Promise<void> {
		this.storage.store(BYO_MODEL_KEY, modelId.trim(), StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChange.fire();
	}

	async setApiKey(key: string): Promise<void> {
		const trimmed = (key || '').trim();
		if (!trimmed) {
			throw new Error('API key is empty.');
		}
		if (trimmed.length < 16) {
			throw new Error('API key looks too short to be valid.');
		}
		await this.secretStorage.set(BYO_SECRET_KEY, trimmed);
		this.storage.store(BYO_HAS_KEY_FLAG, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
		this._onDidChange.fire();
	}

	async clearApiKey(): Promise<void> {
		await this.secretStorage.delete(BYO_SECRET_KEY);
		this.storage.store(BYO_HAS_KEY_FLAG, false, StorageScope.APPLICATION, StorageTarget.MACHINE);
		this._onDidChange.fire();
	}

	async hasApiKey(): Promise<boolean> {
		const key = await this.secretStorage.get(BYO_SECRET_KEY);
		return !!key;
	}

	private readProvider(): AlaskaBYOProvider {
		const raw = this.storage.get(BYO_PROVIDER_KEY, StorageScope.APPLICATION, 'anthropic');
		if ((ALASKA_BYO_PROVIDERS as readonly string[]).includes(raw)) {
			return raw as AlaskaBYOProvider;
		}
		return 'anthropic';
	}

	private userIsUltra(): boolean {
		const plan = (this.authService.state.user?.plan ?? '').toLowerCase();
		return plan === 'ultra';
	}
}
