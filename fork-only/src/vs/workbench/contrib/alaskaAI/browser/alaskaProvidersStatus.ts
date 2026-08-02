/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntry, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';

const PROVIDERS_API_BASE = 'https://api.alaska-ai.shop';
const PROVIDERS_POLL_MS = 30 * 1000;
const PROVIDERS_INITIAL_DELAY_MS = 5 * 1000;
const PROVIDERS_STATUS_ENTRY_ID = 'alaska.providers.status';
const PROVIDERS_DETAILS_COMMAND = 'alaska.providersStatus.openDetails';

type ProviderStatus = 'up' | 'degraded' | 'down';

interface IProviderHealth {
	id: string;
	label: string;
	upstream: string;
	models: string[];
	status: ProviderStatus;
	latency_ms: number;
	error: string | null;
	last_change_at: string;
}

interface IProvidersHealthResponse {
	checked_at: string;
	providers: IProviderHealth[];
}

const lastSnapshot: { value: IProvidersHealthResponse | undefined; unknown: boolean; unknownReason: string } = {
	value: undefined,
	unknown: true,
	unknownReason: 'awaiting first probe',
};

export class AlaskaProvidersStatusContribution extends Disposable implements IWorkbenchContribution {

	private entryAccessor: IStatusbarEntryAccessor | undefined;
	private readonly previousStatus = new Map<string, ProviderStatus>();
	private pollTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IRequestService private readonly requestService: IRequestService,
		@INotificationService private readonly notificationService: INotificationService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		this.entryAccessor = this.statusbarService.addEntry(
			this.buildEntry(),
			PROVIDERS_STATUS_ENTRY_ID,
			StatusbarAlignment.LEFT,
			1000,
		);
		this._register({ dispose: () => this.entryAccessor?.dispose() });

		const startTimer = setTimeout(() => this.tick(), PROVIDERS_INITIAL_DELAY_MS);
		this._register({ dispose: () => clearTimeout(startTimer) });
	}

	private async tick(): Promise<void> {
		await this.probe();
		this.pollTimer = setTimeout(() => this.tick(), PROVIDERS_POLL_MS);
		this._register({ dispose: () => { if (this.pollTimer) { clearTimeout(this.pollTimer); } } });
	}

	private async probe(): Promise<void> {
		try {
			const url = `${PROVIDERS_API_BASE}/api/ai/providers/health`;
			const ctx = await this.requestService.request({ type: 'GET', url, callSite: 'alaskaAI.providersHealth' }, CancellationToken.None);
			const status = ctx.res.statusCode ?? 0;
			if (status >= 400) {
				this.setUnknown(`HTTP ${status}`);
				return;
			}
			const body = await asJson<IProvidersHealthResponse>(ctx);
			if (!body || !Array.isArray(body.providers)) {
				this.setUnknown('bad payload');
				return;
			}
			lastSnapshot.value = body;
			lastSnapshot.unknown = false;
			lastSnapshot.unknownReason = '';
			this.applySnapshot(body);
		} catch (err) {
			this.logService.warn('[alaska.providers] probe failed', err);
			const message = err instanceof Error ? err.message : String(err);
			this.setUnknown(message);
		}
	}

	private applySnapshot(body: IProvidersHealthResponse): void {
		for (const provider of body.providers) {
			const prev = this.previousStatus.get(provider.id);
			if (prev && prev !== provider.status) {
				this.notifyTransition(provider, prev);
			}
			this.previousStatus.set(provider.id, provider.status);
		}
		this.entryAccessor?.update(this.buildEntry(body));
	}

	private setUnknown(reason: string): void {
		lastSnapshot.unknown = true;
		lastSnapshot.unknownReason = reason;
		this.entryAccessor?.update(this.buildEntry(lastSnapshot.value, reason));
	}

	private notifyTransition(provider: IProviderHealth, prev: ProviderStatus): void {
		if (provider.status === 'down') {
			this.notificationService.notify({
				severity: Severity.Warning,
				message: localize('alaska.providers.down', "{0} is unreachable — chats may time out.", provider.label),
			});
			return;
		}
		if (provider.status === 'degraded' && prev !== 'down') {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('alaska.providers.degraded', "{0} is responding slowly or with errors.", provider.label),
			});
			return;
		}
		if (provider.status === 'up' && prev !== 'up') {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('alaska.providers.recovered', "{0} is back online.", provider.label),
			});
		}
	}

	private buildEntry(body?: IProvidersHealthResponse, unknownReason?: string): IStatusbarEntry {
		const providers = body?.providers ?? [];
		const worst = aggregateStatus(providers);
		const visible = providers[0];
		const label = visible?.label ?? 'MeowAI';
		const isUnknown = !body || unknownReason;
		const icon = isUnknown ? '$(circle-large-outline)' : iconFor(worst);
		const text = `${icon} ${label}`;
		const ariaLabel = isUnknown
			? localize('alaska.providers.aria.unknown', "Provider status unknown")
			: localize('alaska.providers.aria.known', "Provider status: {0}", worst);
		const kind: IStatusbarEntry['kind'] = isUnknown
			? 'offline'
			: worst === 'down' ? 'error' : worst === 'degraded' ? 'warning' : 'standard';
		return {
			name: localize('alaska.providers.name', "Alaska AI providers"),
			text,
			ariaLabel,
			tooltip: buildTooltip(body, unknownReason ?? lastSnapshot.unknownReason),
			command: PROVIDERS_DETAILS_COMMAND,
			kind,
		};
	}
}

function aggregateStatus(list: IProviderHealth[]): ProviderStatus {
	let worst: ProviderStatus = 'up';
	for (const p of list) {
		if (p.status === 'down') {
			return 'down';
		}
		if (p.status === 'degraded') {
			worst = 'degraded';
		}
	}
	return worst;
}

function iconFor(status: ProviderStatus): string {
	switch (status) {
		case 'up': return '$(pass-filled)';
		case 'degraded': return '$(warning)';
		case 'down': return '$(error)';
	}
}

function buildTooltip(body: IProvidersHealthResponse | undefined, unknownReason: string): MarkdownString {
	const md = new MarkdownString('', true);
	md.supportThemeIcons = true;
	md.isTrusted = false;
	if (!body) {
		md.appendMarkdown(`**Alaska AI providers**\n\nStatus unknown — health endpoint unreachable (${escapeMd(unknownReason)}).\n`);
		return md;
	}
	md.appendMarkdown('**Alaska AI providers**\n\n');
	md.appendMarkdown('| Provider | Upstream | Status | Latency | Last error |\n');
	md.appendMarkdown('| --- | --- | --- | ---:| --- |\n');
	for (const p of body.providers) {
		const icon = iconFor(p.status);
		const latency = `${p.latency_ms} ms`;
		const err = p.error ? escapeMd(p.error) : '—';
		md.appendMarkdown(`| ${escapeMd(p.label)} | \`${escapeMd(p.upstream)}\` | ${icon} ${p.status} | ${latency} | ${err} |\n`);
	}
	const checked = body.checked_at ? new Date(body.checked_at).toLocaleString() : '';
	if (checked) {
		md.appendMarkdown(`\n_Checked ${escapeMd(checked)}._`);
	}
	if (unknownReason) {
		md.appendMarkdown(`\n\n_Last refresh failed: ${escapeMd(unknownReason)}_`);
	}
	return md;
}

function escapeMd(value: string): string {
	return value.replace(/([|`*_{}\[\]<>])/g, '\\$1');
}

CommandsRegistry.registerCommand(PROVIDERS_DETAILS_COMMAND, async (accessor: ServicesAccessor) => {
	const quickInput = accessor.get(IQuickInputService);
	const log = accessor.get(ILogService);
	const body = lastSnapshot.value;
	if (!body || body.providers.length === 0) {
		const items: IQuickPickItem[] = [{
			label: localize('alaska.providers.pick.unknown', "Status unavailable"),
			description: lastSnapshot.unknownReason || localize('alaska.providers.pick.unknown.detail', "health endpoint did not respond yet"),
		}];
		await quickInput.pick(items, { canPickMany: false, placeHolder: localize('alaska.providers.pick.placeholder.unknown', "Alaska AI provider status") });
		return;
	}
	const items: IQuickPickItem[] = body.providers.map((p): IQuickPickItem => ({
		label: `${iconFor(p.status)} ${p.label}`,
		description: `${p.status}${p.latency_ms ? ` · ${p.latency_ms} ms` : ''}`,
		detail: p.error ? `${p.upstream} · ${p.error}` : p.upstream,
		id: p.id,
	}));
	const picked = await quickInput.pick(items, {
		canPickMany: false,
		placeHolder: localize('alaska.providers.pick.placeholder', "Alaska AI providers · select for details"),
	});
	if (picked) {
		log.info(`[alaska.providers] details selected for ${picked.id ?? picked.label} — TODO openProviderDocs`);
	}
});

