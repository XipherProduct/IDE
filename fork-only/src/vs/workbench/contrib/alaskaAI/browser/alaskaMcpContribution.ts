/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntry, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { IAlaskaMcpService, IMcpServerConfig, IMcpSnapshot, IMcpServerStatus } from '../../../../platform/alaskaMcp/common/alaskaMcp.js';
import { AlaskaRemoteMcpManager } from './alaskaRemoteMcpManager.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';

const MCP_STATUS_ENTRY_ID = 'alaska.mcp.status';
const MCP_DETAILS_COMMAND = 'alaska.mcp.openDetails';
const MCP_RELOAD_COMMAND = 'alaska.mcp.reload';
const MCP_CONSENT_KEY = 'alaska.mcp.consentedServers';
const MCP_CONFIG_REL_PATH = '.alaska/mcp.json';

interface IMcpConfigFile {
	servers?: Record<string, { command?: string; args?: string[]; cwd?: string; env?: Record<string, string>; runWhere?: string }>;
}

const sharedSnapshot: { value: IMcpSnapshot | undefined; configured: number; pendingConsent: number; lastError: string | undefined } = {
	value: undefined,
	configured: 0,
	pendingConsent: 0,
	lastError: undefined,
};

let activeContribution: AlaskaMcpContribution | undefined;

export class AlaskaMcpContribution extends Disposable implements IWorkbenchContribution {

	private entryAccessor: IStatusbarEntryAccessor | undefined;
	private configWatcher: IDisposable | undefined;
	private latestConfigured: IMcpServerConfig[] = [];
	private latestActiveIds: string[] = [];

	private readonly remoteManager: AlaskaRemoteMcpManager;

	constructor(
		@IAlaskaMcpService private readonly mcpService: IAlaskaMcpService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@INotificationService private readonly notificationService: INotificationService,
		@IStorageService private readonly storageService: IStorageService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@ILogService private readonly logService: ILogService,
		@IWorkspaceTrustManagementService private readonly workspaceTrust: IWorkspaceTrustManagementService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this.remoteManager = this._register(instantiationService.createInstance(AlaskaRemoteMcpManager));
		this._register(this.remoteManager.onDidChange(() => this.updateEntry()));
		activeContribution = this;
		this._register({ dispose: () => { if (activeContribution === this) { activeContribution = undefined; } } });

		this.entryAccessor = this.statusbarService.addEntry(
			this.buildEntry(),
			MCP_STATUS_ENTRY_ID,
			StatusbarAlignment.LEFT,
			999,
		);
		this._register({ dispose: () => this.entryAccessor?.dispose() });

		this._register(this.mcpService.onDidChangeStatus((snap) => this.onSnapshot(snap)));
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => this.refreshConfigWatcher()));
		this.refreshConfigWatcher();

		const initialTimer = setTimeout(() => void this.loadAndReload('initial'), 4_000);
		this._register({ dispose: () => clearTimeout(initialTimer) });
	}

	async reload(reason: string): Promise<void> {
		await this.loadAndReload(reason);
	}

	private refreshConfigWatcher(): void {
		this.configWatcher?.dispose();
		this.configWatcher = undefined;
		const folder = this.workspaceService.getWorkspace().folders[0];
		if (!folder) {
			void this.loadAndReload('no-workspace');
			return;
		}
		const uri = joinPath(folder.uri, MCP_CONFIG_REL_PATH);
		try {
			const watcher = this.fileService.createWatcher(uri, { recursive: false, excludes: [] });
			const onChange = watcher.onDidChange(() => { void this.loadAndReload('file-change'); });
			this.configWatcher = {
				dispose: () => {
					onChange.dispose();
					watcher.dispose();
				},
			};
		} catch (err) {
			this.logService.warn('[alaska.mcp] watcher init failed', err);
		}
		void this.loadAndReload('workspace-changed');
	}

	private async loadAndReload(reason: string): Promise<void> {
		const configured = await this.readConfig();
		this.latestConfigured = configured;
		sharedSnapshot.configured = configured.length;
		sharedSnapshot.lastError = undefined;
		if (configured.length > 0 && !this.workspaceTrust.isWorkspaceTrusted()) {
			sharedSnapshot.lastError = 'workspace is not trusted — MCP servers will not start until you mark this workspace as trusted';
			sharedSnapshot.pendingConsent = 0;
			this.latestActiveIds = [];
			try {
				const snap = await this.mcpService.reload([]);
				sharedSnapshot.value = snap;
			} catch { }
			this.updateEntry();
			return;
		}
		const consented = this.readConsent();
		const fresh: IMcpServerConfig[] = [];
		const newToConsent: IMcpServerConfig[] = [];
		for (const cfg of configured) {
			const key = mcpConsentKey(cfg);
			if (consented[key]) {
				fresh.push(cfg);
			} else {
				newToConsent.push(cfg);
			}
		}
		sharedSnapshot.pendingConsent = newToConsent.length;
		this.latestActiveIds = fresh.map(c => c.id);
		const isRemoteWs = this.isRemoteWorkspace();
		const remoteFresh: IMcpServerConfig[] = [];
		const localFresh: IMcpServerConfig[] = [];
		for (const cfg of fresh) {
			if (cfg.runWhere === 'remote' && isRemoteWs) {
				remoteFresh.push(cfg);
			} else {
				localFresh.push(cfg);
			}
		}
		try {
			const localSnap = await this.mcpService.reload(localFresh);
			await this.remoteManager.reload(remoteFresh);
			sharedSnapshot.value = mergeSnapshots(localSnap, this.remoteManager.getSnapshot());
			this.updateEntry();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			sharedSnapshot.lastError = message;
			this.logService.warn(`[alaska.mcp] reload failed (${reason}): ${message}`);
			this.updateEntry();
		}
		for (const cfg of newToConsent) {
			this.promptConsent(cfg);
		}
	}

	private onSnapshot(snap: IMcpSnapshot): void {
		sharedSnapshot.value = mergeSnapshots(snap, this.remoteManager.getSnapshot());
		this.updateEntry();
	}

	private isRemoteWorkspace(): boolean {
		const folder = this.workspaceService.getWorkspace().folders[0];
		return !!folder && folder.uri.scheme === 'alaskacode-remote';
	}

	private async readConfig(): Promise<IMcpServerConfig[]> {
		const folder = this.workspaceService.getWorkspace().folders[0];
		if (!folder) {
			return [];
		}
		const uri = joinPath(folder.uri, MCP_CONFIG_REL_PATH);
		try {
			if (!(await this.fileService.exists(uri))) {
				return [];
			}
			const file = await this.fileService.readFile(uri);
			const text = file.value.toString();
			if (text.trim().length === 0) {
				return [];
			}
			const parsed = JSON.parse(text) as IMcpConfigFile;
			const out: IMcpServerConfig[] = [];
			const servers = parsed.servers ?? {};
			for (const id of Object.keys(servers)) {
				const raw = servers[id];
				if (!raw || typeof raw.command !== 'string' || raw.command.length === 0) {
					continue;
				}
				const args: string[] = Array.isArray(raw.args) ? raw.args.filter((a): a is string => typeof a === 'string') : [];
				const env: Record<string, string> = {};
				if (raw.env && typeof raw.env === 'object') {
					for (const [k, v] of Object.entries(raw.env)) {
						if (typeof v === 'string') {
							env[k] = v;
						}
					}
				}
				const runWhere = raw.runWhere === 'remote' ? 'remote' : 'local';
				if (runWhere === 'remote' && !this.isRemoteWorkspace()) {
					this.notificationService.notify({
						severity: Severity.Warning,
						message: localize('alaska.mcp.remoteFallback', 'MCP server `{0}` requested runWhere:remote but workspace is local — running on this machine instead.', id),
					});
				}
				out.push({
					id,
					command: raw.command,
					args,
					cwd: typeof raw.cwd === 'string' ? raw.cwd : folder.uri.fsPath,
					env: Object.keys(env).length > 0 ? env : undefined,
					runWhere,
				});
			}
			return out;
		} catch (err) {
			sharedSnapshot.lastError = err instanceof Error ? err.message : String(err);
			this.logService.warn(`[alaska.mcp] read config failed: ${sharedSnapshot.lastError}`);
			return [];
		}
	}

	private readConsent(): Record<string, true> {
		const raw = this.storageService.get(MCP_CONSENT_KEY, StorageScope.WORKSPACE, '{}');
		try {
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			const out: Record<string, true> = {};
			for (const k of Object.keys(parsed)) {
				if (parsed[k] === true) {
					out[k] = true;
				}
			}
			return out;
		} catch {
			return {};
		}
	}

	private writeConsent(consent: Record<string, true>): void {
		this.storageService.store(MCP_CONSENT_KEY, JSON.stringify(consent), StorageScope.WORKSPACE, StorageTarget.USER);
	}

	private promptConsent(cfg: IMcpServerConfig): void {
		const cmdPreview = `${cfg.command} ${cfg.args.join(' ')}`.trim();
		this.notificationService.prompt(
			Severity.Warning,
			localize('alaska.mcp.consent', "Allow Alaska AI to launch MCP server `{0}` ({1})? MCP servers run arbitrary code in your workspace.", cfg.id, cmdPreview),
			[
				{
					label: localize('alaska.mcp.allow', 'Allow'),
					run: () => {
						const consent = this.readConsent();
						consent[mcpConsentKey(cfg)] = true;
						this.writeConsent(consent);
						void this.loadAndReload('consent-granted');
					},
				},
				{
					label: localize('alaska.mcp.block', 'Block'),
					run: () => {
						const consent = this.readConsent();
						delete consent[mcpConsentKey(cfg)];
						this.writeConsent(consent);
					},
				},
			],
			{ sticky: true },
		);
	}

	private updateEntry(): void {
		this.entryAccessor?.update(this.buildEntry());
	}

	private buildEntry(): IStatusbarEntry {
		const snap = sharedSnapshot.value;
		const configured = sharedSnapshot.configured;
		const pending = sharedSnapshot.pendingConsent;
		const errored = (snap?.servers ?? []).filter(s => s.state === 'error').length;
		const readyServers = (snap?.servers ?? []).filter(s => s.state === 'ready');
		const totalTools = snap?.totalTools ?? 0;
		let icon: string;
		let kind: IStatusbarEntry['kind'];
		let text: string;
		if (configured === 0) {
			icon = '$(plug)';
			kind = 'offline';
			text = `${icon} MCP: not configured`;
		} else if (sharedSnapshot.lastError) {
			icon = '$(error)';
			kind = 'error';
			text = `${icon} MCP: config error`;
		} else if (errored > 0) {
			icon = '$(warning)';
			kind = 'warning';
			text = `${icon} MCP: ${readyServers.length}/${configured} · ${totalTools} tools`;
		} else if (pending > 0 || readyServers.length < configured) {
			icon = '$(loading~spin)';
			kind = 'standard';
			text = `${icon} MCP: ${readyServers.length}/${configured} · ${totalTools} tools`;
		} else {
			icon = '$(plug)';
			kind = 'standard';
			text = `${icon} MCP: ${configured} server${configured === 1 ? '' : 's'} · ${totalTools} tools`;
		}
		return {
			name: localize('alaska.mcp.name', 'Alaska AI MCP servers'),
			text,
			ariaLabel: text,
			tooltip: this.buildTooltip(),
			command: MCP_DETAILS_COMMAND,
			kind,
		};
	}

	private buildTooltip(): MarkdownString {
		const md = new MarkdownString('', true);
		md.supportThemeIcons = true;
		md.isTrusted = false;
		md.appendMarkdown('**Alaska AI MCP servers**\n\n');
		const snap = sharedSnapshot.value;
		if (sharedSnapshot.configured === 0) {
			md.appendMarkdown('No MCP servers configured. Add `.alaska/mcp.json` at the workspace root to register external tool providers.\n');
			return md;
		}
		if (sharedSnapshot.lastError) {
			md.appendMarkdown(`Last load error: \`${escapeMd(sharedSnapshot.lastError)}\`\n\n`);
		}
		if (sharedSnapshot.pendingConsent > 0) {
			md.appendMarkdown(`${sharedSnapshot.pendingConsent} server${sharedSnapshot.pendingConsent === 1 ? '' : 's'} waiting for one-time consent (see notification).\n\n`);
		}
		md.appendMarkdown('| Server | State | Tools | Last change |\n');
		md.appendMarkdown('| --- | --- | ---:| --- |\n');
		for (const server of snap?.servers ?? []) {
			const state = describeState(server);
			const changedAt = server.lastChangeAt ? new Date(server.lastChangeAt).toLocaleTimeString() : '';
			md.appendMarkdown(`| ${escapeMd(server.id)} | ${state} | ${server.toolCount} | ${escapeMd(changedAt)} |\n`);
		}
		return md;
	}
}

function describeState(server: IMcpServerStatus): string {
	switch (server.state) {
		case 'ready': return '$(pass-filled) ready';
		case 'starting': return '$(loading~spin) starting';
		case 'error': return server.error ? `$(error) ${escapeMd(server.error.slice(0, 80))}` : '$(error) error';
		case 'stopped': return '$(circle-large-outline) stopped';
		case 'idle':
		default: return 'idle';
	}
}

function escapeMd(value: string): string {
	return value.replace(/([|`*_{}\[\]<>])/g, '\\$1');
}

CommandsRegistry.registerCommand(MCP_DETAILS_COMMAND, async (accessor: ServicesAccessor) => {
	const quickInput = accessor.get(IQuickInputService);
	const snap = sharedSnapshot.value;
	type ServerItem = IQuickPickItem & { serverId: string };
	// eslint-disable-next-line local/code-no-icons-in-localized-strings
	const reloadItem: ServerItem = { label: localize('alaska.mcp.pick.reload', '$(refresh) Reload MCP config'), serverId: '__reload__' };
	const items: ServerItem[] = [];
	if (snap && snap.servers.length > 0) {
		for (const server of snap.servers) {
			items.push({
				label: `${stateIcon(server.state)} ${server.id}`,
				description: `${server.toolCount} tool${server.toolCount === 1 ? '' : 's'} · ${server.state}`,
				detail: server.error ? `${server.upstream} · ${server.error}` : server.upstream,
				serverId: server.id,
			});
		}
	}
	items.push(reloadItem);
	const placeHolder = items.length === 1
		? (sharedSnapshot.lastError
			? localize('alaska.mcp.pick.error', 'MCP config error: {0} — fix .alaska/mcp.json then reload.', sharedSnapshot.lastError)
			: localize('alaska.mcp.pick.empty', 'No MCP servers running. Add servers to .alaska/mcp.json then reload.'))
		: localize('alaska.mcp.pick.placeholder', 'MCP servers · pick to inspect or reload');
	const picked = await quickInput.pick(items, { canPickMany: false, placeHolder });
	if (picked && picked.serverId === '__reload__') {
		// eslint-disable-next-line local/code-no-accessor-after-await
		await runReload(accessor);
	}
});

CommandsRegistry.registerCommand(MCP_RELOAD_COMMAND, async (accessor: ServicesAccessor) => {
	await runReload(accessor);
});

async function runReload(accessor: ServicesAccessor): Promise<void> {
	const notif = accessor.get(INotificationService);
	if (!activeContribution) {
		notif.notify({ severity: Severity.Warning, message: localize('alaska.mcp.reload.unavailable', 'MCP contribution not initialised yet — try again in a moment.') });
		return;
	}
	try {
		await activeContribution.reload('command');
		notif.notify({ severity: Severity.Info, message: localize('alaska.mcp.reload.done', 'MCP servers reloaded.') });
	} catch (err) {
		notif.notify({ severity: Severity.Warning, message: localize('alaska.mcp.reload.error', 'MCP reload failed: {0}', err instanceof Error ? err.message : String(err)) });
	}
}

function stateIcon(state: IMcpServerStatus['state']): string {
	switch (state) {
		case 'ready': return '$(pass-filled)';
		case 'starting': return '$(loading~spin)';
		case 'error': return '$(error)';
		case 'stopped': return '$(circle-large-outline)';
		case 'idle':
		default: return '$(circle-large-outline)';
	}
}

function mergeSnapshots(local: IMcpSnapshot, remote: IMcpSnapshot): IMcpSnapshot {
	const servers = [...local.servers, ...remote.servers];
	const allTools = [...local.allTools, ...remote.allTools];
	return { servers, allTools, totalTools: allTools.length };
}

function mcpConsentKey(cfg: IMcpServerConfig): string {
	const envEntries = cfg.env ? Object.entries(cfg.env).sort(([a], [b]) => a.localeCompare(b)) : [];
	const envSerialised = envEntries.map(([k, v]) => `${k}=${v}`).join('\x1f');
	const blob = [
		cfg.id,
		cfg.command,
		(cfg.args ?? []).join('\x1e'),
		cfg.cwd ?? '',
		envSerialised,
	].join('\x1d');
	let h = 0x811c9dc5;
	for (let i = 0; i < blob.length; i++) {
		h ^= blob.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return `${cfg.id}::${h.toString(16).padStart(8, '0')}`;
}
