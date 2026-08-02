/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

export const ALASKA_API_BASE = 'https://api.alaska-ai.shop';

const SECRET_KEY = 'alaska.accessToken';
const SECRET_USER_KEY = 'alaska.user';
const SECRET_HMAC_KEY = 'alaska.hmacSecret';
const SECRET_CLIENT_KEY = 'alaska.clientKey';
const SECRET_REFRESH_KEY = 'alaska.refreshToken';
const STORAGE_INSTALL_ID_KEY = 'alaska.installId';
const STORAGE_REFRESH_FAMILY_KEY = 'alaska.refreshFamily';
const STORAGE_ACCESS_EXPIRES_KEY = 'alaska.accessExpiresAt';
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_PREEMPT_MS = 60 * 1000;

export interface IAlaskaUser {
	readonly id: string;
	readonly email: string;
	readonly name: string | null;
	readonly plan: string;
}

export interface IAlaskaCredentials {
	readonly accessToken: string;
	readonly hmacSecret?: string;
	readonly clientKey?: string;
	readonly refreshToken?: string;
}

export interface IAlaskaAuthState {
	readonly status: 'signed-out' | 'signed-in';
	readonly user?: IAlaskaUser;
}

export interface IDeviceFlowProgress {
	readonly userCode: string;
	readonly verificationUri: string;
	readonly verificationUriComplete: string;
}

export const IAlaskaAuthService = createDecorator<IAlaskaAuthService>('alaskaAuthService');

export interface IAlaskaAuthService {
	readonly _serviceBrand: undefined;

	readonly state: IAlaskaAuthState;
	readonly onDidChangeState: Event<IAlaskaAuthState>;

	getToken(): Promise<string | undefined>;

	getCredentials(): Promise<IAlaskaCredentials | undefined>;

	signIn(onProgress?: (p: IDeviceFlowProgress) => void, token?: CancellationToken): Promise<IAlaskaUser>;

	signOut(): Promise<void>;

	getFreshAccessToken(): Promise<string | undefined>;
}

interface IDeviceInitResp {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
	expires_in: number;
	interval: number;
}

interface IDevicePollResp {
	status: 'pending' | 'approved' | 'denied' | 'expired';
	access_token?: string;
	refresh_token?: string;
	refresh_family?: string;
	expires_in?: number;
	hmac_secret?: string;
	client_key?: string;
	user?: IAlaskaUser;
}

interface IRefreshResp {
	status: 'ok' | 'reuse-detected' | 'expired' | 'invalid';
	access_token?: string;
	refresh_token?: string;
	refresh_family?: string;
	expires_in?: number;
	user?: IAlaskaUser;
}

export class AlaskaAuthService extends Disposable implements IAlaskaAuthService {
	declare readonly _serviceBrand: undefined;

	private _state: IAlaskaAuthState = { status: 'signed-out' };
	private readonly _onDidChangeState = this._register(new Emitter<IAlaskaAuthState>());
	readonly onDidChangeState: Event<IAlaskaAuthState> = this._onDidChangeState.event;

	get state(): IAlaskaAuthState { return this._state; }

	constructor(
		@ISecretStorageService private readonly secretStorage: ISecretStorageService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
		void this.hydrate();
	}

	private async hydrate(): Promise<void> {
		try {
			const token = await this.secretStorage.get(SECRET_KEY);
			if (!token) {
				return;
			}
			const userBlob = await this.secretStorage.get(SECRET_USER_KEY);
			let user: IAlaskaUser | undefined;
			if (userBlob) {
				try { user = JSON.parse(userBlob); } catch { /* ignore corrupt blob */ }
			}
			this.setState({ status: 'signed-in', user });

			const expiresAt = this.storageService.getNumber(STORAGE_ACCESS_EXPIRES_KEY, StorageScope.APPLICATION, 0);
			if (expiresAt > 0 && Date.now() >= expiresAt - REFRESH_PREEMPT_MS) {
				void this.getFreshAccessToken();
			}
		} catch (err) {
			this.logService.warn('[alaska.auth] hydrate failed', err);
		}
	}

	private setState(state: IAlaskaAuthState): void {
		this._state = state;
		this._onDidChangeState.fire(state);
	}

	async getToken(): Promise<string | undefined> {
		return this.secretStorage.get(SECRET_KEY);
	}

	async getCredentials(): Promise<IAlaskaCredentials | undefined> {
		const accessToken = await this.secretStorage.get(SECRET_KEY);
		if (!accessToken) { return undefined; }
		const [hmacSecret, clientKey, refreshToken] = await Promise.all([
			this.secretStorage.get(SECRET_HMAC_KEY),
			this.secretStorage.get(SECRET_CLIENT_KEY),
			this.secretStorage.get(SECRET_REFRESH_KEY),
		]);
		return { accessToken, hmacSecret, clientKey, refreshToken };
	}

	async getFreshAccessToken(): Promise<string | undefined> {
		const expiresAt = this.storageService.getNumber(STORAGE_ACCESS_EXPIRES_KEY, StorageScope.APPLICATION, 0);
		const now = Date.now();
		if (expiresAt > 0 && now < expiresAt - REFRESH_PREEMPT_MS) {
			return this.secretStorage.get(SECRET_KEY);
		}
		const refreshToken = await this.secretStorage.get(SECRET_REFRESH_KEY);
		if (!refreshToken) {
			return this.secretStorage.get(SECRET_KEY);
		}
		try {
			const resp = await this.postJson<IRefreshResp>(`${ALASKA_API_BASE}/api/auth/refresh`, {
				refresh_token: refreshToken,
			});
			if (resp.status === 'ok' && resp.access_token) {
				await this.persistRotation(resp);
				return resp.access_token;
			}
			if (resp.status === 'reuse-detected') {
				this.logService.warn('[alaska.auth] refresh-token reuse detected — entire family revoked, forcing sign-out');
				await this.signOut();
				return undefined;
			}
			if (resp.status === 'expired' || resp.status === 'invalid') {
				this.logService.info('[alaska.auth] refresh-token rejected as', resp.status);
				await this.signOut();
				return undefined;
			}
		} catch (err) {
			this.logService.warn('[alaska.auth] refresh exchange failed', err);
		}
		return this.secretStorage.get(SECRET_KEY);
	}

	private async persistRotation(resp: IRefreshResp | IDevicePollResp): Promise<void> {
		if (resp.access_token) {
			await this.secretStorage.set(SECRET_KEY, resp.access_token);
			const ttl = (typeof resp.expires_in === 'number' && resp.expires_in > 0)
				? resp.expires_in * 1000
				: ACCESS_TOKEN_TTL_MS;
			this.storageService.store(STORAGE_ACCESS_EXPIRES_KEY, Date.now() + ttl, StorageScope.APPLICATION, StorageTarget.MACHINE);
		}
		if (resp.refresh_token) {
			await this.secretStorage.set(SECRET_REFRESH_KEY, resp.refresh_token);
		}
		if (resp.refresh_family) {
			this.storageService.store(STORAGE_REFRESH_FAMILY_KEY, resp.refresh_family, StorageScope.APPLICATION, StorageTarget.MACHINE);
		}
		if (resp.user) {
			await this.secretStorage.set(SECRET_USER_KEY, JSON.stringify(resp.user));
			this.setState({ status: 'signed-in', user: resp.user });
		}
	}

	async signIn(onProgress?: (p: IDeviceFlowProgress) => void, token?: CancellationToken): Promise<IAlaskaUser> {
		const hwidHash = await this.computeHWIDHash().catch(err => {
			this.logService.warn('[alaska.auth] hwid_hash compute failed', err);
			return '';
		});

		const init = await this.postJson<IDeviceInitResp>(`${ALASKA_API_BASE}/api/auth/device/init`, {
			client_name: this.detectClientName(),
			hwid_hash: hwidHash,
		}, token);

		onProgress?.({
			userCode: init.user_code,
			verificationUri: init.verification_uri,
			verificationUriComplete: init.verification_uri_complete,
		});

		void this.openerService.open(URI.parse(init.verification_uri_complete), { openExternal: true });

		const intervalMs = Math.max(1, init.interval) * 1000;
		const localDeadline = Date.now() + (init.expires_in + 30) * 1000;

		while (true) {
			if (token?.isCancellationRequested) {
				throw new Error('Sign-in cancelled');
			}
			if (Date.now() > localDeadline) {
				throw new Error('Sign-in timed out, please try again');
			}

			await wait(intervalMs, token);

			const poll = await this.getJson<IDevicePollResp>(
				`${ALASKA_API_BASE}/api/auth/device/poll?device_code=${encodeURIComponent(init.device_code)}`,
				token,
[200, 202, 410, 404],
			);

			switch (poll.status) {
				case 'pending':
					continue;
				case 'denied':
					throw new Error('Authorization was denied in the browser');
				case 'expired':
					throw new Error('Code expired before approval, please try again');
				case 'approved':
					if (!poll.access_token || !poll.user) {
						throw new Error('Server returned an incomplete approval payload');
					}
					await this.persistRotation(poll);
					if (poll.hmac_secret) {
						await this.secretStorage.set(SECRET_HMAC_KEY, poll.hmac_secret);
					}
					if (poll.client_key) {
						await this.secretStorage.set(SECRET_CLIENT_KEY, poll.client_key);
					}
					return poll.user;
			}
		}
	}

	async signOut(): Promise<void> {
		const refresh = await this.secretStorage.get(SECRET_REFRESH_KEY);
		await Promise.all([
			this.secretStorage.delete(SECRET_KEY),
			this.secretStorage.delete(SECRET_USER_KEY),
			this.secretStorage.delete(SECRET_HMAC_KEY),
			this.secretStorage.delete(SECRET_CLIENT_KEY),
			this.secretStorage.delete(SECRET_REFRESH_KEY),
		]);
		this.storageService.remove(STORAGE_ACCESS_EXPIRES_KEY, StorageScope.APPLICATION);
		this.storageService.remove(STORAGE_REFRESH_FAMILY_KEY, StorageScope.APPLICATION);
		if (refresh) {
			void this.postJson<{ ok?: boolean }>(`${ALASKA_API_BASE}/api/auth/revoke`, {
				refresh_token: refresh,
			}).catch(err => this.logService.trace('[alaska.auth] revoke best-effort failed', err));
		}
		this.setState({ status: 'signed-out' });
	}

	private detectClientName(): string {
		const proc = (globalThis as unknown as { process?: { platform?: string; arch?: string } }).process;
		if (!proc?.platform) {
			return 'Alaska AI Desktop';
		}
		return `Alaska AI Desktop (${proc.platform}-${proc.arch})`;
	}

	private async computeHWIDHash(): Promise<string> {
		const proc = (globalThis as unknown as { process?: { platform?: string; arch?: string } }).process;

		const stripSentinel = (v: string | undefined): string => {
			if (!v || v.startsWith('someValue.')) {
				return '';
			}
			return v;
		};

		let installId = this.storageService.get(STORAGE_INSTALL_ID_KEY, StorageScope.APPLICATION);
		if (!installId) {
			installId = generateUuid();
			this.storageService.store(STORAGE_INSTALL_ID_KEY, installId, StorageScope.APPLICATION, StorageTarget.MACHINE);
		}

		const parts = [
			'v2',
			installId,
			stripSentinel(this.telemetryService.machineId),
			stripSentinel(this.telemetryService.devDeviceId),
			stripSentinel(this.telemetryService.sqmId),
			proc?.platform ?? '',
			proc?.arch ?? '',
		];

		const cryptoSubtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
		if (!cryptoSubtle) {
			return '';
		}
		const bytes = new TextEncoder().encode(parts.join('\x00'));
		const digest = await cryptoSubtle.digest('SHA-256', bytes);
		return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
	}

	private async postJson<T>(url: string, body: unknown, token?: CancellationToken): Promise<T> {
		const ctx = await this.requestService.request({
			type: 'POST',
			url,
			data: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json' },
			callSite: 'alaska.auth.deviceInit',
		}, token ?? CancellationToken.None);
		const json = await asJson<T>(ctx);
		if (!json) {
			throw new Error(`Empty response from ${url}`);
		}
		return json;
	}

	private async getJson<T>(url: string, token?: CancellationToken, allowedStatuses?: number[]): Promise<T> {
		const ctx = await this.requestService.request({
			type: 'GET',
			url,
			callSite: 'alaska.auth.devicePoll',
		}, token ?? CancellationToken.None);
		const status = ctx.res.statusCode ?? 0;
		if (allowedStatuses && !allowedStatuses.includes(status)) {
			throw new Error(`HTTP ${status} from ${url}`);
		}
		const json = await asJson<T>(ctx);
		if (!json) {
			throw new Error(`Empty response from ${url}`);
		}
		return json;
	}
}

function wait(ms: number, token?: CancellationToken): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const handle = setTimeout(() => resolve(), ms);
		token?.onCancellationRequested(() => {
			clearTimeout(handle);
			reject(new Error('cancelled'));
		});
	});
}
