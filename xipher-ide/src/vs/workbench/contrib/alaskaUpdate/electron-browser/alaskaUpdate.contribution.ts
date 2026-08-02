/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { INotificationService, Severity, NotificationPriority } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { localize } from '../../../../nls.js';
import { IAlaskaAuthService, ALASKA_API_BASE } from '../../alaskaChat/browser/alaskaAuthService.js';
import { signChecksum } from '../../alaskaChat/browser/alaskaApiClient.js';
import { IAlaskaUpdateMainService } from '../../../../platform/alaskaUpdate/common/alaskaUpdate.js';

interface IUpdateCheck {
	readonly version: string | null;
	readonly windows: string | null;
	readonly linux: string | null;
	readonly download_page: string;
	readonly mode: 'off' | 'notify' | 'silent';
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const FIRST_CHECK_DELAY_MS = 25 * 1000;       // let startup settle

// Compare dotted numeric versions (1.119.32 vs 1.120.0). True if `latest` > `current`.
function isNewer(latest: string, current: string): boolean {
	const a = latest.split(/[.\-+]/).map(n => parseInt(n, 10) || 0);
	const b = current.split(/[.\-+]/).map(n => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const x = a[i] ?? 0, y = b[i] ?? 0;
		if (x !== y) { return x > y; }
	}
	return false;
}

/**
 * Xipher IDE updater. Polls the backend for the published version + the user's
 * chosen mode (set on the account page):
 *   off    — never check.
 *   notify — notification with a "Download" button.
 *   silent — download in the background and apply in place WITHOUT interrupting
 *            the session: Linux swaps the AppImage (active next launch), Windows
 *            runs the installer silently when the app is closed. Falls back to
 *            "download + open" if the install can't self-update (e.g. dev run).
 */
export class AlaskaUpdateContribution extends Disposable implements IWorkbenchContribution {
	private timer?: ReturnType<typeof setInterval>;
	private lastHandledVersion?: string;
	private busy = false;

	constructor(
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@INotificationService private readonly notificationService: INotificationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IProductService private readonly productService: IProductService,
		@IHostService private readonly hostService: IHostService,
		@IAlaskaUpdateMainService private readonly updateService: IAlaskaUpdateMainService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		const first = setTimeout(() => void this.check(), FIRST_CHECK_DELAY_MS);
		this._register({ dispose: () => clearTimeout(first) });
		this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
		this._register({ dispose: () => { if (this.timer) { clearInterval(this.timer); } } });
	}

	private async check(): Promise<void> {
		if (this.busy) { return; }
		let info: IUpdateCheck;
		try {
			info = await this.fetchCheck();
		} catch (e) {
			this.logService.trace('[alaska.update] check skipped', e);
			return;
		}
		const current = this.productService.version || '0.0.0';
		if (!info.version || info.mode === 'off' || !isNewer(info.version, current)) { return; }
		if (this.lastHandledVersion === info.version) { return; }
		this.lastHandledVersion = info.version;

		const url = this.platformUrl(info);
		if (info.mode === 'silent' && url) {
			await this.silentApply(info, url);
		} else {
			this.notifyDownload(info, url);
		}
	}

	private async silentApply(info: IUpdateCheck, url: string): Promise<void> {
		this.busy = true;
		let progress: { close(): void } | undefined;
		try {
			if (!(await this.updateService.canAutoApply())) {
				// dev run / not a self-updating install → open the download instead
				void this.openerService.open(URI.parse(url));
				this.notifyDownload(info, url);
				return;
			}
			progress = this.notificationService.notify({
				severity: Severity.Info,
				message: localize('alaska.update.installing', 'Xipher IDE {0}: скачиваю обновление в фоне…', info.version!),
				priority: NotificationPriority.SILENT,
			});
			const r = await this.updateService.applyUpdate(url, info.version!);
			progress.close(); progress = undefined;
			if (!r.ok) {
				this.logService.warn('[alaska.update] silent apply failed, falling back', r.error);
				this.notifyDownload(info, url);
				return;
			}
			if (r.applied === 'appimage') {
				this.notificationService.prompt(
					Severity.Info,
					localize('alaska.update.appliedLinux', 'Xipher IDE {0} установлен — применится при следующем запуске.', info.version!),
					[{ label: localize('alaska.update.restartNow', 'Перезапустить сейчас'), run: () => void this.hostService.restart() },
					{ label: localize('alaska.update.later', 'Позже'), isSecondary: true, run: () => { } }],
					{ priority: NotificationPriority.OPTIONAL },
				);
			} else {
				this.notificationService.notify({
					severity: Severity.Info,
					message: localize('alaska.update.appliedWin', 'Обновление Xipher IDE {0} скачано — установится при закрытии IDE.', info.version!),
					priority: NotificationPriority.OPTIONAL,
				});
			}
		} catch (e) {
			progress?.close();
			this.logService.warn('[alaska.update] silent apply error', e);
			this.notifyDownload(info, url);
		} finally {
			this.busy = false;
		}
	}

	private notifyDownload(info: IUpdateCheck, url: string | null): void {
		this.notificationService.prompt(
			Severity.Info,
			localize('alaska.update.available', 'Доступна новая версия Xipher IDE {0}.', info.version!),
			[
				{ label: localize('alaska.update.download', 'Скачать'), run: () => void this.openerService.open(URI.parse(url || info.download_page)) },
				{ label: localize('alaska.update.later', 'Позже'), isSecondary: true, run: () => { } },
			],
			{ priority: NotificationPriority.OPTIONAL },
		);
	}

	private platformUrl(info: IUpdateCheck): string | null {
		const p = navigator.platform.toLowerCase();
		if (/win/.test(p)) { return info.windows; }
		if (/linux|x11/.test(p)) { return info.linux; }
		return null;
	}

	private async fetchCheck(): Promise<IUpdateCheck> {
		await this.authService.getFreshAccessToken();
		const creds = await this.authService.getCredentials();
		const userId = this.authService.state.user?.id;
		if (!creds || !userId || !creds.hmacSecret || !creds.clientKey) { throw new Error('not signed in'); }
		const path = '/api/update/check';
		const checksum = await signChecksum(creds.hmacSecret, userId, 'GET', path);
		const res = await fetch(`${ALASKA_API_BASE}${path}`, {
			headers: {
				'Accept': 'application/json',
				'Authorization': `Bearer ${creds.accessToken}`,
				'X-Client-Key': creds.clientKey,
				'X-Checksum': checksum,
			},
		});
		if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
		return await res.json() as IUpdateCheck;
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaUpdateContribution,
	LifecyclePhase.Eventually,
);
