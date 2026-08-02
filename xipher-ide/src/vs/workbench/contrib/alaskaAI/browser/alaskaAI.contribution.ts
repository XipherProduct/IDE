/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { AlaskaProvidersStatusContribution } from './alaskaProvidersStatus.js';
import { AlaskaMcpContribution } from './alaskaMcpContribution.js';

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const POLL_INTERVAL_DEV_MS = 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;
const STARTUP_DELAY_DEV_MS = 5 * 1000;
const BACKOFF_STEP_1_MS = 10 * 60 * 1000;
const BACKOFF_STEP_2_MS = 30 * 60 * 1000;
const MULTI_WINDOW_GAP_MS = 5 * 60 * 1000;
const SUPPRESSED_VERSION_KEY = 'alaska.update.suppressedVersion';
const LAST_PROBE_AT_KEY = 'alaska.update.lastProbeAt';
const API_BASE = 'https://ide.xipher.pro/ide-api';
const ALASKA_CHAT_VIEW_ID = 'workbench.view.alaskaChat';

interface UpdateCheckResponse {
	update_available: boolean;
	mandatory: boolean;
	latest_version?: string;
	current_version?: string;
	download_url?: string;
	sha256?: string;
	notes?: string;
	channel: string;
	platform: string;
}

interface UpdateProbeResult {
	ok: boolean;
	at: number;
	body?: UpdateCheckResponse;
	reason?: string;
}

interface UpdateProbeDiagnostics {
	endpoint: string;
	intervalMs: number;
	startupDelayMs: number;
	lastProbeAt?: number;
	ok?: boolean;
	reason?: string;
	latestVersion?: string;
	updateAvailable?: boolean;
	nextProbeAt: number;
	backoffMs: number;
	currentVersion: string;
	isDev: boolean;
}

let activeUpdateProbe: UpdateProbeContribution | undefined;

class UpdateProbeContribution extends Disposable implements IWorkbenchContribution {

	private readonly intervalMs: number;
	private readonly startupDelayMs: number;
	private readonly isDev: boolean;

	private startTimer: ReturnType<typeof setTimeout> | undefined;
	// eslint-disable-next-line no-restricted-globals
	private intervalTimer: ReturnType<typeof setInterval> | undefined;
	private backoffTimer: ReturnType<typeof setTimeout> | undefined;

	private backoffMs = 0;
	private nextScheduledAt = 0;
	private forceProbe = false;
	private lastProbeResult: UpdateProbeResult | undefined;
	private inFlight: Promise<void> | undefined;

	constructor(
		@INotificationService private readonly notificationService: INotificationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IProductService private readonly productService: IProductService,
		@IStorageService private readonly storageService: IStorageService,
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IEnvironmentService environmentService: IEnvironmentService,
	) {
		super();

		this.isDev = !environmentService.isBuilt;
		this.intervalMs = this.isDev ? POLL_INTERVAL_DEV_MS : POLL_INTERVAL_MS;
		this.startupDelayMs = this.isDev ? STARTUP_DELAY_DEV_MS : STARTUP_DELAY_MS;

		activeUpdateProbe = this;
		this._register({ dispose: () => { if (activeUpdateProbe === this) { activeUpdateProbe = undefined; } } });

		this.logService.info('[alaska.update] probe contribution armed', {
			endpoint: API_BASE,
			version: this.productService.version,
			startupDelayMs: this.startupDelayMs,
			intervalMs: this.intervalMs,
			isDev: this.isDev,
		});

		this.startTimer = setTimeout(() => this.probe(), this.startupDelayMs);
		this._register({ dispose: () => { if (this.startTimer) { clearTimeout(this.startTimer); } } });

		// eslint-disable-next-line no-restricted-globals
		this.intervalTimer = setInterval(() => this.probe(), this.intervalMs);
		// eslint-disable-next-line no-restricted-globals
		this._register({ dispose: () => { if (this.intervalTimer) { clearInterval(this.intervalTimer); } } });

		this._register({ dispose: () => { if (this.backoffTimer) { clearTimeout(this.backoffTimer); } } });

		this.nextScheduledAt = Date.now() + this.startupDelayMs;
	}

	async probeNow(): Promise<UpdateProbeResult> {
		this.forceProbe = true;
		try {
			await this.probe();
		} finally {
			this.forceProbe = false;
		}
		return this.lastProbeResult ?? { ok: false, at: Date.now(), reason: 'no_result' };
	}

	getDiagnostics(): UpdateProbeDiagnostics {
		return {
			endpoint: `${API_BASE}/api/releases/check`,
			intervalMs: this.intervalMs,
			startupDelayMs: this.startupDelayMs,
			lastProbeAt: this.lastProbeResult?.at,
			ok: this.lastProbeResult?.ok,
			reason: this.lastProbeResult?.reason,
			latestVersion: this.lastProbeResult?.body?.latest_version,
			updateAvailable: this.lastProbeResult?.body?.update_available,
			nextProbeAt: this.nextScheduledAt,
			backoffMs: this.backoffMs,
			currentVersion: this.productService.version || '0.0.0',
			isDev: this.isDev,
		};
	}

	private probe(): Promise<void> {
		if (this.inFlight) {
			return this.inFlight;
		}
		this.inFlight = this.doProbe().finally(() => { this.inFlight = undefined; });
		return this.inFlight;
	}

	private async doProbe(): Promise<void> {
		const startedAt = Date.now();
		const platform = detectPlatform();

		if (!platform) {
			this.logService.warn('[alaska.update] platform unknown, skipping probe');
			this.lastProbeResult = { ok: false, at: startedAt, reason: 'platform_unknown' };
			return;
		}

		if (!this.forceProbe) {
			const lastAt = this.storageService.getNumber(LAST_PROBE_AT_KEY, StorageScope.APPLICATION, 0);
			const now = Date.now();
			if (lastAt > 0 && now - lastAt < MULTI_WINDOW_GAP_MS) {
				this.logService.trace(`[alaska.update] another window probed ${Math.round((now - lastAt) / 1000)}s ago, skipping`);
				return;
			}
			this.storageService.store(LAST_PROBE_AT_KEY, now, StorageScope.APPLICATION, StorageTarget.MACHINE);
		}

		const current = encodeURIComponent(this.productService.version || '0.0.0');
		const url = `${API_BASE}/api/releases/check?platform=${platform}&current=${current}&channel=stable`;

		this.logService.info('[alaska.update] probe start', { platform, current: this.productService.version, force: this.forceProbe });

		try {
			const ctx = await this.requestService.request({ type: 'GET', url, callSite: 'alaskaAI.updateCheck' }, CancellationToken.None);
			const statusCode = ctx.res.statusCode ?? 0;

			if (statusCode >= 400) {
				this.logService.warn(`[alaska.update] HTTP ${statusCode} from ${API_BASE}`);
				this.lastProbeResult = { ok: false, at: startedAt, reason: `http_${statusCode}` };
				this.scheduleBackoffRetry();
				return;
			}

			const body = await asJson<UpdateCheckResponse>(ctx);
			if (!body) {
				this.logService.warn('[alaska.update] response body empty or unparseable');
				this.lastProbeResult = { ok: false, at: startedAt, reason: 'empty_body' };
				this.scheduleBackoffRetry();
				return;
			}

			const elapsedMs = Date.now() - startedAt;
			this.logService.info(`[alaska.update] probe ok in ${elapsedMs}ms`, {
				updateAvailable: body.update_available,
				latestVersion: body.latest_version,
				mandatory: body.mandatory,
			});
			this.lastProbeResult = { ok: true, at: startedAt, body };

			if (this.backoffMs > 0) {
				this.backoffMs = 0;
				if (this.backoffTimer) { clearTimeout(this.backoffTimer); this.backoffTimer = undefined; }
			}
			this.nextScheduledAt = Date.now() + this.intervalMs;

			if (!body.update_available) {
				return;
			}

			const suppressed = this.storageService.get(SUPPRESSED_VERSION_KEY, StorageScope.APPLICATION, '');
			if (!body.mandatory && body.latest_version && suppressed === body.latest_version) {
				this.logService.info(`[alaska.update] version ${body.latest_version} suppressed by user, skipping prompt`);
				return;
			}

			this.showUpdatePrompt(body);
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			this.logService.warn(`[alaska.update] probe failed: ${reason}`);
			this.lastProbeResult = { ok: false, at: startedAt, reason };
			this.scheduleBackoffRetry();
		}
	}

	private scheduleBackoffRetry(): void {
		if (this.backoffMs === 0) {
			this.backoffMs = BACKOFF_STEP_1_MS;
		} else if (this.backoffMs < BACKOFF_STEP_2_MS) {
			this.backoffMs = BACKOFF_STEP_2_MS;
		} else {
			this.backoffMs = this.intervalMs;
		}

		this.nextScheduledAt = Date.now() + this.backoffMs;
		if (this.backoffTimer) { clearTimeout(this.backoffTimer); }
		this.backoffTimer = setTimeout(() => {
			this.backoffTimer = undefined;
			this.probe();
		}, this.backoffMs);
		this.logService.info(`[alaska.update] backoff retry scheduled in ${Math.round(this.backoffMs / 1000)}s`);
	}

	private showUpdatePrompt(body: UpdateCheckResponse): void {
		const shaSuffix = body.sha256 ? ` · sha256:${body.sha256.slice(0, 16)}…` : '';
		const message = body.mandatory
			? localize('alaska.update.mandatory', "Alaska AI {0} is available — please update.{1}", body.latest_version ?? '', shaSuffix)
			: localize('alaska.update.available', "Alaska AI {0} is available.{1}", body.latest_version ?? '', shaSuffix);

		this.notificationService.prompt(
			body.mandatory ? Severity.Warning : Severity.Info,
			message,
			[
				{
					label: localize('alaska.update.download', "Download"),
					run: () => this.openDownload(body.download_url),
				},
				{
					label: localize('alaska.update.releaseNotes', "Release Notes"),
					run: () => this.openReleaseNotes(),
					isSecondary: true,
				},
				{
					label: body.mandatory
						? localize('alaska.update.later', "Remind Me Later")
						: localize('alaska.update.skip', "Skip This Version"),
					run: () => {
						if (!body.mandatory && body.latest_version) {
							this.storageService.store(
								SUPPRESSED_VERSION_KEY, body.latest_version,
								StorageScope.APPLICATION, StorageTarget.USER,
							);
						}
					},
					isSecondary: true,
				},
			],
			{
				sticky: body.mandatory,
			},
		);
	}

	private openDownload(url: string | undefined): void {
		const target = url ?? `${API_BASE.replace('api.', '')}/download`;
		this.openerService.open(URI.parse(target), { openExternal: true });
	}

	private openReleaseNotes(): void {
		this.openerService.open(URI.parse('https://alaska-ai.shop/docs#release-notes'), { openExternal: true });
	}
}

function detectPlatform(): string | undefined {
	const proc = (globalThis as unknown as { process?: { platform?: string; arch?: string } }).process;
	if (!proc?.platform) {
		return undefined;
	}
	const archSegment = proc.arch === 'arm64' ? 'arm64' : 'x64';
	switch (proc.platform) {
		case 'linux': return `linux-${archSegment}`;
		case 'darwin': return `darwin-${archSegment}`;
		case 'win32': return `win32-${archSegment}`;
		default: return undefined;
	}
}

function formatTimestamp(at: number | undefined): string {
	if (!at) {
		return 'never';
	}
	return new Date(at).toLocaleString();
}

function formatDuration(ms: number): string {
	if (ms < 1000) { return `${ms}ms`; }
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) { return `${seconds}s`; }
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) { return `${minutes}m`; }
	const hours = Math.round(minutes / 6) / 10;
	return `${hours}h`;
}

class OpenAlaskaChatAction extends Action2 {
	static readonly ID = 'alaskaAI.openChat';

	constructor() {
		super({
			id: OpenAlaskaChatAction.ID,
			title: localize2('alaska.openChat', "Alaska AI: Open Chat"),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const views = accessor.get(IViewsService);
		await views.openView(ALASKA_CHAT_VIEW_ID, true);
	}
}

class AlaskaCheckForUpdatesAction extends Action2 {
	static readonly ID = 'alaskaAI.checkForUpdates';

	constructor() {
		super({
			id: AlaskaCheckForUpdatesAction.ID,
			title: localize2('alaska.checkForUpdates', "Alaska AI: Check for Updates"),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notification = accessor.get(INotificationService);
		const product = accessor.get(IProductService);
		const probe = activeUpdateProbe;
		if (!probe) {
			notification.warn(localize('alaska.update.notReady', "Alaska AI update service is not initialized yet — try again in a moment."));
			return;
		}

		const result = await probe.probeNow();
		if (!result.ok) {
			notification.error(localize('alaska.update.checkFailed', "Alaska AI update check failed: {0}", result.reason ?? 'unknown'));
			return;
		}
		if (!result.body?.update_available) {
			notification.info(localize('alaska.update.upToDate', "Alaska AI is up to date ({0}).", product.version || 'unknown'));
		}
	}
}

class AlaskaUpdateDiagnosticsAction extends Action2 {
	static readonly ID = 'alaskaAI.showUpdateDiagnostics';

	constructor() {
		super({
			id: AlaskaUpdateDiagnosticsAction.ID,
			title: localize2('alaska.showUpdateDiagnostics', "Alaska AI: Show Update Diagnostics"),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notification = accessor.get(INotificationService);
		const probe = activeUpdateProbe;
		if (!probe) {
			notification.warn(localize('alaska.update.notReady', "Alaska AI update service is not initialized yet — try again in a moment."));
			return;
		}
		const d = probe.getDiagnostics();
		const lines = [
			localize('alaska.update.diag.current', "Current: {0}{1}", d.currentVersion, d.isDev ? ' (dev)' : ''),
			localize('alaska.update.diag.endpoint', "Endpoint: {0}", d.endpoint),
			localize('alaska.update.diag.interval', "Interval: {0}", formatDuration(d.intervalMs)),
			localize('alaska.update.diag.lastProbe', "Last probe: {0}", formatTimestamp(d.lastProbeAt)),
			localize('alaska.update.diag.result', "Result: {0}", d.ok ? 'ok' : (d.reason ?? 'pending')),
			localize('alaska.update.diag.latest', "Latest seen: {0}", d.latestVersion ?? 'unknown'),
			localize('alaska.update.diag.next', "Next probe: ~{0}", formatTimestamp(d.nextProbeAt)),
		];
		if (d.backoffMs > 0) {
			lines.push(localize('alaska.update.diag.backoff', "Backoff: {0}", formatDuration(d.backoffMs)));
		}
		notification.info(lines.join('\n'));
	}
}

registerAction2(OpenAlaskaChatAction);
registerAction2(AlaskaCheckForUpdatesAction);
registerAction2(AlaskaUpdateDiagnosticsAction);

const workbench = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbench.registerWorkbenchContribution(UpdateProbeContribution, LifecyclePhase.Eventually);
// Provider-health status-bar badge (the "MeowAI" pill) removed per design — it was noisy and
// showed a placeholder label. Re-register AlaskaProvidersStatusContribution here to bring it back.
workbench.registerWorkbenchContribution(AlaskaMcpContribution, LifecyclePhase.Eventually);
