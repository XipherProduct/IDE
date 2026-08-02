/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewContainerExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation, ViewContainer, IViewDescriptorService } from '../../../common/views.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';

import { IAlaskaAuthService, AlaskaAuthService } from './alaskaAuthService.js';
import { IAlaskaChatService, AlaskaChatService, ALASKA_PRIVACY_REDACT_PII_KEY } from './alaskaChatService.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IAlaskaMetricsService } from '../common/alaskaMetrics.js';
import { AlaskaMetricsService } from './alaskaMetricsService.js';
import { IAlaskaContextService, AlaskaContextService } from './alaskaContextService.js';
import { IAlaskaIndexService } from './alaskaIndex.js';
import { AlaskaIndexService } from './alaskaIndexService.js';
import { IAlaskaSlashCommandService } from '../common/alaskaSlash.js';
import { AlaskaSlashCommandService } from './alaskaSlashService.js';
import { registerAlaskaSlashBuiltins } from './alaskaSlashBuiltins.js';
import { IAlaskaBYOService } from '../common/alaskaByo.js';
import { AlaskaBYOService } from './alaskaByoService.js';
import { IAlaskaHookService } from '../common/alaskaHookService.js';
import { AlaskaHookService } from './alaskaHookService.js';
import { IAlaskaSkillService } from '../common/alaskaSkill.js';
import { AlaskaSkillService } from './alaskaSkillService.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { IAlaskaActivityService, AlaskaActivityService, ALASKA_READING_FOREGROUND } from './alaskaActivityService.js';
import { IAlaskaAgentModeService } from '../common/alaskaAgentMode.js';
import { AlaskaAgentModeService } from './alaskaAgentModeService.js';
import { registerColor } from '../../../../platform/theme/common/colorUtils.js';
import { Color } from '../../../../base/common/color.js';
import { AlaskaCodeHoverProvider } from './alaskaCodeHoverProvider.js';
import { AlaskaChatViewPane, ALASKA_PLAN_AUTO_APPROVE_KEY } from './alaskaChatViewPane.js';
import { AlaskaHistoryViewPane } from './alaskaHistoryViewPane.js';
import { AlaskaReadingTreePulseContribution } from './alaskaReadingTreePulse.js';
import { RUN_COMMAND_TRUST_KEY, RunCommandTrustLevel } from './alaskaTools.js';
import './alaskaInlineEdit.js';
import './alaskaInlineDiff.js';
import { AlaskaSettingsEditor, AlaskaSettingsInput, AlaskaSettingsInputSerializer } from './alaskaSettingsEditor.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ICommandService, CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { OS, OperatingSystem } from '../../../../base/common/platform.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IAlaskaWslService, IAlaskaWslDistro } from '../../../../platform/alaskaWsl/common/alaskaWsl.js';
import {
	ACCEPT_COMMAND_ID,
	AlaskaPendingEditsService,
	IAlaskaPendingEditsService,
	REVERT_COMMAND_ID,
	registerAlaskaEditCodeLens,
} from './alaskaPendingEdits.js';
import { URI } from '../../../../base/common/uri.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { exportSessionAsJSON, exportSessionAsMarkdown, IExportableSession, slugifySessionTitle } from '../common/alaskaSessionExport.js';
// eslint-disable-next-line no-duplicate-imports
import { IWorkbenchContribution } from '../../../common/contributions.js';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'alaska.privacy',
	order: 110,
	title: localize('alaska.privacy.configTitle', 'Alaska AI Privacy'),
	type: 'object',
	properties: {
		[ALASKA_PRIVACY_REDACT_PII_KEY]: {
			type: 'boolean',
			default: false,
			description: localize('alaska.privacy.redactPII.desc', 'Redact emails, API keys, credit-card numbers, and bearer tokens from user messages before they are sent to the AI backend. Tool outputs and file contents are not modified.'),
		},
	},
});

registerSingleton(IAlaskaAuthService, AlaskaAuthService, InstantiationType.Delayed);
registerSingleton(IAlaskaChatService, AlaskaChatService, InstantiationType.Delayed);
registerSingleton(IAlaskaContextService, AlaskaContextService, InstantiationType.Delayed);
registerSingleton(IAlaskaActivityService, AlaskaActivityService, InstantiationType.Delayed);
registerSingleton(IAlaskaAgentModeService, AlaskaAgentModeService, InstantiationType.Delayed);
registerSingleton(IAlaskaPendingEditsService, AlaskaPendingEditsService, InstantiationType.Delayed);
registerSingleton(IAlaskaIndexService, AlaskaIndexService, InstantiationType.Delayed);
registerSingleton(IAlaskaSlashCommandService, AlaskaSlashCommandService, InstantiationType.Delayed);
registerSingleton(IAlaskaBYOService, AlaskaBYOService, InstantiationType.Delayed);
registerSingleton(IAlaskaHookService, AlaskaHookService, InstantiationType.Delayed);
registerSingleton(IAlaskaSkillService, AlaskaSkillService, InstantiationType.Delayed);
registerSingleton(IAlaskaMetricsService, AlaskaMetricsService, InstantiationType.Delayed);

class AlaskaSlashBuiltinsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.slash.builtins';
	constructor(@IAlaskaSlashCommandService slashService: IAlaskaSlashCommandService) {
		super();
		this._register(registerAlaskaSlashBuiltins(slashService));
	}
}
registerWorkbenchContribution2(AlaskaSlashBuiltinsContribution.ID, AlaskaSlashBuiltinsContribution, WorkbenchPhase.Eventually);

registerColor(ALASKA_READING_FOREGROUND, {
	dark: Color.fromHex('#5cd6a8'),
	light: Color.fromHex('#1f8a64'),
	hcDark: Color.fromHex('#5cd6a8'),
	hcLight: Color.fromHex('#1f8a64'),
}, localize('alaska.tree.readingForeground', 'Color of file labels that Alaska AI is currently reading.'));
registerWorkbenchContribution2(AlaskaCodeHoverProvider.ID, AlaskaCodeHoverProvider, WorkbenchPhase.Eventually);

class AlaskaPendingEditsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.pendingEdits.codeLens';
	constructor(
		@IAlaskaPendingEditsService pending: IAlaskaPendingEditsService,
		@ILanguageFeaturesService languageFeatures: ILanguageFeaturesService,
	) {
		super();
		this._register(registerAlaskaEditCodeLens(pending, languageFeatures));
	}
}
registerWorkbenchContribution2(AlaskaPendingEditsContribution.ID, AlaskaPendingEditsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(AlaskaReadingTreePulseContribution.ID, AlaskaReadingTreePulseContribution, WorkbenchPhase.Eventually);

const ALASKA_AUX_BAR_FIRST_RUN_KEY = 'alaska.auxBar.firstRun.v1';
const ALASKA_AUX_BAR_USER_MOVED_KEY = 'alaska.auxBar.userMoved.v1';
const ALASKA_AUX_BAR_DEFAULT_WIDTH = 480;
const ALASKA_SIDEBAR_DEFAULT_WIDTH = 240;
const ALASKA_VIEW_CONTAINER_ID = 'workbench.view.alaskaAI';

class AlaskaAuxBarDefaultContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.auxBar.default';
	private suppressManualDetect = false;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.ensureAlaskaInAuxBar();
		this._register(this.viewDescriptorService.onDidChangeContainerLocation(e => {
			if (e.viewContainer.id === ALASKA_VIEW_CONTAINER_ID) {
				this.handleManualMove(e.to);
			}
		}));
	}

	private ensureAlaskaInAuxBar(): void {
		const container = this.viewDescriptorService.getViewContainerById(ALASKA_VIEW_CONTAINER_ID);
		if (!container) {
			return;
		}

		const currentLocation = this.viewDescriptorService.getViewContainerLocation(container);
		const userOverride = this.storageService.getBoolean(ALASKA_AUX_BAR_USER_MOVED_KEY, StorageScope.APPLICATION, false);

		if (currentLocation !== ViewContainerLocation.AuxiliaryBar && !userOverride) {
			this.suppressManualDetect = true;
			try {
				this.viewDescriptorService.moveViewContainerToLocation(
					container,
					ViewContainerLocation.AuxiliaryBar,
					undefined,
					'alaska.auxBar.default.startup',
				);
				this.logService.info('[alaska.auxBar] relocated to AuxiliaryBar');
			} catch (err) {
				this.logService.warn('[alaska.auxBar] relocate failed', err);
			} finally {
				queueMicrotask(() => { this.suppressManualDetect = false; });
			}
		}

		if (!this.storageService.getBoolean(ALASKA_AUX_BAR_FIRST_RUN_KEY, StorageScope.APPLICATION, false)) {
			this.storageService.store(ALASKA_AUX_BAR_FIRST_RUN_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
			try {
				this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
				this.layoutService.setSize(Parts.AUXILIARYBAR_PART, { width: ALASKA_AUX_BAR_DEFAULT_WIDTH, height: 0 });
				this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
				this.layoutService.setSize(Parts.SIDEBAR_PART, { width: ALASKA_SIDEBAR_DEFAULT_WIDTH, height: 0 });
			} catch (err) {
				this.logService.warn('[alaska.auxBar] layout init failed', err);
			}
		}
	}

	private handleManualMove(to: ViewContainerLocation): void {
		if (this.suppressManualDetect) {
			return;
		}
		if (to !== ViewContainerLocation.AuxiliaryBar) {
			this.storageService.store(
				ALASKA_AUX_BAR_USER_MOVED_KEY,
				true,
				StorageScope.APPLICATION,
				StorageTarget.USER,
			);
			this.logService.info(`[alaska.auxBar] user moved Alaska AI to ${to}, respecting choice`);
		} else {
			this.storageService.remove(ALASKA_AUX_BAR_USER_MOVED_KEY, StorageScope.APPLICATION);
			this.logService.info('[alaska.auxBar] user moved Alaska AI back to AuxiliaryBar');
		}
	}
}
registerWorkbenchContribution2(AlaskaAuxBarDefaultContribution.ID, AlaskaAuxBarDefaultContribution, WorkbenchPhase.Eventually);

CommandsRegistry.registerCommand(ACCEPT_COMMAND_ID, (accessor, raw?: string) => {
	if (!raw) { return; }
	accessor.get(IAlaskaPendingEditsService).accept(URI.parse(raw));
});
CommandsRegistry.registerCommand(REVERT_COMMAND_ID, async (accessor, raw?: string) => {
	if (!raw) { return; }
	await accessor.get(IAlaskaPendingEditsService).revert(URI.parse(raw));
});

const alaskaIcon = registerIcon('alaska-ai-view-icon', Codicon.sparkle, localize('alaskaViewIcon', 'View icon for the Alaska AI sidebar.'));

const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: ALASKA_VIEW_CONTAINER_ID,
	title: localize2('alaskaAI', 'Alaska AI'),
	icon: alaskaIcon,
	hideIfEmpty: false,
	order: 5,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [ALASKA_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: ALASKA_VIEW_CONTAINER_ID,
}, ViewContainerLocation.AuxiliaryBar, { doNotRegisterOpenCommand: false });

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([
	{
		id: AlaskaChatViewPane.ID,
		name: localize2('alaskaChat', 'Chat'),
		containerIcon: alaskaIcon,
		canToggleVisibility: false,
		canMoveView: true,
		ctorDescriptor: new SyncDescriptor(AlaskaChatViewPane),
		order: 1,
		openCommandActionDescriptor: {
			id: 'workbench.action.alaskaAI.toggleChat',
			mnemonicTitle: localize({ key: 'miAlaskaAI', comment: ['&& denotes a mnemonic'] }, "&&Alaska AI"),
			order: 5,
		},
	},
	{
		id: AlaskaHistoryViewPane.ID,
		name: localize2('alaskaChatHistory', 'History'),
		containerIcon: alaskaIcon,
		canToggleVisibility: true,
		canMoveView: true,
		ctorDescriptor: new SyncDescriptor(AlaskaHistoryViewPane),
		order: 2,
		collapsed: false,
	},
], VIEW_CONTAINER);

class AlaskaSignInAction extends Action2 {
	static readonly ID = 'alaskaAI.signIn';
	constructor() {
		super({
			id: AlaskaSignInAction.ID,
			title: localize2('alaska.signIn', 'Alaska AI: Sign In'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const auth = accessor.get(IAlaskaAuthService);
		const views = accessor.get(IViewsService);
		await views.openView(AlaskaChatViewPane.ID, true);
		try {
			await auth.signIn();
		} catch {
			// Errors render in the view pane itself.
		}
	}
}

class AlaskaSignOutAction extends Action2 {
	static readonly ID = 'alaskaAI.signOut';
	constructor() {
		super({
			id: AlaskaSignOutAction.ID,
			title: localize2('alaska.signOut', 'Alaska AI: Sign Out'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
			precondition: undefined,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IAlaskaAuthService).signOut();
	}
}

class AlaskaPlanApprovalModeAction extends Action2 {
	static readonly ID = 'alaska.plan.approvalMode';
	constructor() {
		super({
			id: AlaskaPlanApprovalModeAction.ID,
			title: localize2('alaska.plan.approvalMode', 'Alaska AI: Plan Approval Mode'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const storage = accessor.get(IStorageService);
		const appOn = storage.getBoolean(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.APPLICATION, false);
		const wsOn = storage.getBoolean(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.WORKSPACE, false);
		const current: 'ask' | 'workspace' | 'everywhere' = appOn ? 'everywhere' : wsOn ? 'workspace' : 'ask';
		const items = [
			{ id: 'ask', label: 'Ask every time', description: current === 'ask' ? 'Current' : undefined },
			{ id: 'workspace', label: 'Auto-approve in this workspace', description: current === 'workspace' ? 'Current' : undefined },
			{ id: 'everywhere', label: 'Auto-approve everywhere', description: current === 'everywhere' ? 'Current' : undefined },
		];
		const picked = await quickInput.pick(items, { placeHolder: 'Plan approval mode' });
		if (!picked) { return; }
		if (picked.id === 'ask') {
			storage.remove(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.WORKSPACE);
			storage.remove(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.APPLICATION);
		} else if (picked.id === 'workspace') {
			storage.store(ALASKA_PLAN_AUTO_APPROVE_KEY, true, StorageScope.WORKSPACE, StorageTarget.USER);
			storage.remove(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.APPLICATION);
		} else if (picked.id === 'everywhere') {
			storage.store(ALASKA_PLAN_AUTO_APPROVE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
			storage.remove(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.WORKSPACE);
		}
	}
}

class AlaskaSetRunCommandTrustAction extends Action2 {
	static readonly ID = 'alaska.runCommand.trustLevel';
	constructor() {
		super({
			id: AlaskaSetRunCommandTrustAction.ID,
			title: localize2('alaska.runCommand.trustLevel', 'Alaska AI: Set Run-Command Trust Level'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const storage = accessor.get(IStorageService);
		const raw = storage.get(RUN_COMMAND_TRUST_KEY, StorageScope.WORKSPACE, '');
		const current: RunCommandTrustLevel = raw === 'auto-safe' ? raw : 'ask';
		const items = [
			{ id: 'ask', label: 'Ask every time', description: current === 'ask' ? 'Current' : 'Default — prompt for every command' },
			{ id: 'auto-safe', label: 'Auto-approve safe commands', description: current === 'auto-safe' ? 'Current' : 'Read-only commands run silently; everything else asks' },
			{ id: 'reset', label: 'Reset to ask', description: 'Clear the saved choice for this workspace' },
		];
		const picked = await quickInput.pick(items, { placeHolder: 'Alaska AI shell-command trust level' });
		if (!picked) { return; }
		if (picked.id === 'reset' || picked.id === 'ask') {
			storage.remove(RUN_COMMAND_TRUST_KEY, StorageScope.WORKSPACE);
		} else if (picked.id === 'auto-safe') {
			storage.store(RUN_COMMAND_TRUST_KEY, picked.id, StorageScope.WORKSPACE, StorageTarget.USER);
		}
	}
}

const SSH_EXTENSION_CANDIDATES = ['jeanp413.open-remote-ssh', 'ms-vscode-remote.remote-ssh'];
const WSL_EXTENSION_CANDIDATES = ['jeanp413.open-remote-wsl', 'ms-vscode-remote.remote-wsl'];
const OPEN_REMOTE_SSH_OPEN_EMPTY = 'opensshremotes.openEmptyWindow';
const MS_REMOTE_SSH_OPEN_EMPTY = 'opensshremotes.openEmptyWindow';
const MS_REMOTE_WSL_NEW = 'remote-wsl.newWindow';
const FALLBACK_REMOTE_MENU = 'workbench.action.remote.showMenu';

async function isExtensionInstalled(extensionService: IExtensionService, ids: readonly string[]): Promise<string | undefined> {
	await extensionService.whenInstalledExtensionsRegistered();
	for (const id of ids) {
		const lowered = id.toLowerCase();
		if (extensionService.extensions.some(ext => ext.identifier.value.toLowerCase() === lowered)) {
			return id;
		}
	}
	return undefined;
}

async function executeFirstAvailable(commandService: ICommandService, candidates: readonly string[]): Promise<boolean> {
	for (const id of candidates) {
		try {
			await commandService.executeCommand(id);
			return true;
		} catch {
			// try next candidate
		}
	}
	return false;
}

function offerInstallRemoteExtension(notificationService: INotificationService, openerService: IOpenerService, commandService: ICommandService, kind: 'ssh' | 'wsl'): void {
	const kindLabel = kind === 'ssh' ? 'SSH' : 'WSL';
	const extensionId = kind === 'ssh' ? 'jeanp413.open-remote-ssh' : 'jeanp413.open-remote-wsl';
	const fallbackUrl = `https://open-vsx.org/extension/${extensionId.replace('.', '/')}`;
	const retryCommand = kind === 'ssh' ? AlaskaConnectSSHAction.ID : AlaskaConnectWSLAction.ID;
	const handle = notificationService.notify({
		severity: Severity.Info,
		// allow-any-unicode-next-line
		message: localize('alaska.remote.installRequired', 'Alaska AI нужно расширение {0} для удалённых подключений. Установить сейчас?', kindLabel),
		actions: {
			primary: [
				{
					id: `alaska.remote.${kind}.install`,
					// allow-any-unicode-next-line
					label: localize('alaska.remote.installNow', 'Установить'),
					tooltip: '',
					class: undefined,
					enabled: true,
					run: async () => {
						handle.close();
						try {
							await commandService.executeCommand('workbench.extensions.installExtension', extensionId);
							notificationService.notify({
								severity: Severity.Info,
								// allow-any-unicode-next-line
								message: localize('alaska.remote.installedRetry', '{0} установлен. Запускаю подключение…', extensionId),
							});
							await commandService.executeCommand(retryCommand);
						} catch (err) {
							notificationService.notify({
								severity: Severity.Warning,
								// allow-any-unicode-next-line
								message: localize('alaska.remote.installFailed', 'Не удалось установить {0}: {1}. Открываю страницу расширения в браузере.', extensionId, err instanceof Error ? err.message : String(err)),
							});
							await openerService.open(fallbackUrl, { openExternal: true });
						}
					},
				},
				{
					id: `alaska.remote.${kind}.search`,
					// allow-any-unicode-next-line
					label: localize('alaska.remote.showInExtensions', 'Открыть в Extensions'),
					tooltip: '',
					class: undefined,
					enabled: true,
					run: async () => {
						handle.close();
						await commandService.executeCommand('workbench.extensions.search', `@id:${extensionId}`);
					},
				},
			],
		},
	});
}

class AlaskaConnectSSHAction extends Action2 {
	static readonly ID = 'alaskaAI.connectSSH';
	constructor() {
		super({
			id: AlaskaConnectSSHAction.ID,
			// allow-any-unicode-next-line
			title: localize2('alaska.connectSSH', 'Alaska AI: Подключиться по SSH'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
			menu: [{
				id: MenuId.StatusBarRemoteIndicatorMenu,
				group: 'remote_10_alaska_ssh',
				order: 1,
			}],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);
		const openerService = accessor.get(IOpenerService);
		const extensionService = accessor.get(IExtensionService);
		const installed = await isExtensionInstalled(extensionService, SSH_EXTENSION_CANDIDATES);
		if (!installed) {
			offerInstallRemoteExtension(notificationService, openerService, commandService, 'ssh');
			await executeFirstAvailable(commandService, [FALLBACK_REMOTE_MENU]);
			return;
		}
		const dispatched = await executeFirstAvailable(commandService, [
			OPEN_REMOTE_SSH_OPEN_EMPTY,
			MS_REMOTE_SSH_OPEN_EMPTY,
			FALLBACK_REMOTE_MENU,
		]);
		if (!dispatched) {
			notificationService.notify({
				severity: Severity.Warning,
				// allow-any-unicode-next-line
				message: localize('alaska.remote.sshFailed', 'Не удалось открыть SSH-сессию — откройте меню Remote вручную.'),
			});
		}
	}
}

class AlaskaConnectWSLAction extends Action2 {
	static readonly ID = 'alaskaAI.connectWSL';
	constructor() {
		super({
			id: AlaskaConnectWSLAction.ID,
			// allow-any-unicode-next-line
			title: localize2('alaska.connectWSL', 'Alaska AI: Открыть в WSL'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
			menu: [{
				id: MenuId.StatusBarRemoteIndicatorMenu,
				group: 'remote_10_alaska_wsl',
				order: 2,
				when: ContextKeyExpr.equals('isWindows', true),
			}],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);
		const openerService = accessor.get(IOpenerService);
		const extensionService = accessor.get(IExtensionService);
		const quickInputService = accessor.get(IQuickInputService);
		if (OS !== OperatingSystem.Windows) {
			notificationService.notify({
				severity: Severity.Info,
				// allow-any-unicode-next-line
				message: localize('alaska.remote.wslWindowsOnly', 'WSL доступен только на Windows.'),
			});
			return;
		}
		const wslService = accessor.get(IAlaskaWslService);
		const availability = await wslService.isAvailable();
		if (!availability.available) {
			notificationService.notify({
				severity: Severity.Info,
				// allow-any-unicode-next-line
				message: localize('alaska.remote.wslNotInstalled', 'WSL не обнаружен на этой машине. Установите Windows Subsystem for Linux из Microsoft Store, затем выполните "wsl --install" в PowerShell с правами администратора.'),
			});
			return;
		}
		const distros = await wslService.listDistros();
		if (distros.length === 0) {
			notificationService.notify({
				severity: Severity.Info,
				// allow-any-unicode-next-line
				message: localize('alaska.remote.wslNoDistros', 'Не зарегистрирован ни один дистрибутив WSL. Выполните "wsl --install <distro>" или установите дистрибутив из Microsoft Store.'),
			});
			return;
		}
		const picked = await pickWslDistro(quickInputService, distros);
		if (!picked) {
			return;
		}
		const installed = await isExtensionInstalled(extensionService, WSL_EXTENSION_CANDIDATES);
		if (!installed) {
			offerInstallRemoteExtension(notificationService, openerService, commandService, 'wsl');
			await executeFirstAvailable(commandService, [FALLBACK_REMOTE_MENU]);
			return;
		}
		const dispatched = await tryOpenWslDistro(commandService, picked.name);
		if (!dispatched) {
			notificationService.notify({
				severity: Severity.Warning,
				// allow-any-unicode-next-line
				message: localize('alaska.remote.wslFailed', 'Не удалось открыть окно WSL — откройте меню Remote вручную.'),
			});
		}
	}
}

interface IWslDistroQuickPick {
	readonly label: string;
	readonly description: string;
	readonly detail?: string;
	readonly distro: IAlaskaWslDistro;
}

async function pickWslDistro(quickInputService: IQuickInputService, distros: readonly IAlaskaWslDistro[]): Promise<IAlaskaWslDistro | undefined> {
	if (distros.length === 1) {
		return distros[0];
	}
	const ordered = [...distros].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
	const items: IWslDistroQuickPick[] = ordered.map(d => ({
		label: d.name,
		description: [
			// allow-any-unicode-next-line
			d.isDefault ? localize('alaska.wsl.default', 'По умолчанию') : '',
			d.version === 'unknown' ? '' : `WSL${d.version}`,
			// allow-any-unicode-next-line
			d.state === 'Running' ? localize('alaska.wsl.running', 'Запущен') : (d.state === 'Stopped' ? localize('alaska.wsl.stopped', 'Остановлен') : ''),
		].filter(Boolean).join(' · '),
		distro: d,
	}));
	const choice = await quickInputService.pick(items, {
		// allow-any-unicode-next-line
		placeHolder: localize('alaska.wsl.pickPlaceholder', 'Выберите дистрибутив WSL'),
		matchOnDescription: true,
	});
	return choice?.distro;
}

async function tryOpenWslDistro(commandService: ICommandService, distroName: string): Promise<boolean> {
	const attempts: ReadonlyArray<{ readonly id: string; readonly args?: ReadonlyArray<unknown> }> = [
		{ id: 'remote-wsl.newWindow', args: [{ distro: distroName }] },
		{ id: 'remote-wsl.newWindowDistro', args: [distroName] },
		{ id: 'remote-wsl.newWindow' },
		{ id: 'workbench.action.remote.showMenu' },
	];
	for (const attempt of attempts) {
		try {
			await commandService.executeCommand(attempt.id, ...(attempt.args ?? []));
			return true;
		} catch {
			// try next
		}
	}
	return false;
}

class AlaskaOpenRemoteMenuAction extends Action2 {
	static readonly ID = 'alaskaAI.openRemoteMenu';
	constructor() {
		super({
			id: AlaskaOpenRemoteMenuAction.ID,
			title: localize2('alaska.openRemoteMenu', 'Alaska AI: Open Remote Menu'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand(FALLBACK_REMOTE_MENU);
	}
}

class AlaskaAcceptAllPendingAction extends Action2 {
	static readonly ID = 'alaskaAI.acceptAllPending';
	constructor() {
		super({
			id: AlaskaAcceptAllPendingAction.ID,
			title: localize2('alaska.acceptAllPending', 'Alaska AI: Accept All Pending Edits'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter,
			},
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IAlaskaPendingEditsService).acceptAll();
	}
}

class AlaskaRevertAllPendingAction extends Action2 {
	static readonly ID = 'alaskaAI.revertAllPending';
	constructor() {
		super({
			id: AlaskaRevertAllPendingAction.ID,
			title: localize2('alaska.revertAllPending', 'Alaska AI: Revert All Pending Edits'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IAlaskaPendingEditsService).revertAll();
	}
}

class AlaskaResetChatLocationAction extends Action2 {
	static readonly ID = 'alaskaAI.resetChatLocation';
	constructor() {
		super({
			id: AlaskaResetChatLocationAction.ID,
			title: localize2('alaska.resetChatLocation', 'Alaska AI: Reset Chat to Right Sidebar'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const storage = accessor.get(IStorageService);
		const viewDescriptors = accessor.get(IViewDescriptorService);
		const layout = accessor.get(IWorkbenchLayoutService);
		const logger = accessor.get(ILogService);
		storage.remove(ALASKA_AUX_BAR_USER_MOVED_KEY, StorageScope.APPLICATION);
		const container = viewDescriptors.getViewContainerById(ALASKA_VIEW_CONTAINER_ID);
		if (!container) {
			return;
		}
		viewDescriptors.moveViewContainerToLocation(
			container,
			ViewContainerLocation.AuxiliaryBar,
			undefined,
			AlaskaResetChatLocationAction.ID,
		);
		layout.setPartHidden(false, Parts.AUXILIARYBAR_PART);
		logger.info('[alaska.auxBar] reset to AuxiliaryBar via command');
	}
}

class AlaskaSwitchToPlanModeAction extends Action2 {
	static readonly ID = 'alaskaAI.agentMode.switchToPlan';
	constructor() {
		super({
			id: AlaskaSwitchToPlanModeAction.ID,
			title: localize2('alaska.agentMode.switchToPlan', 'Alaska AI: Switch Agent to Plan Mode'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyP,
			},
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const views = accessor.get(IViewsService);
		const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, true);
		const sessionId = view?.getActiveSessionId();
		if (!sessionId) {
			return;
		}
		accessor.get(IAlaskaAgentModeService).setMode(sessionId, 'plan');
	}
}

class AlaskaSwitchToActModeAction extends Action2 {
	static readonly ID = 'alaskaAI.agentMode.switchToAct';
	constructor() {
		super({
			id: AlaskaSwitchToActModeAction.ID,
			title: localize2('alaska.agentMode.switchToAct', 'Alaska AI: Switch Agent to Act Mode'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const views = accessor.get(IViewsService);
		const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, true);
		const sessionId = view?.getActiveSessionId();
		if (!sessionId) {
			return;
		}
		accessor.get(IAlaskaAgentModeService).setMode(sessionId, 'act');
	}
}

class AlaskaApprovePlanAction extends Action2 {
	static readonly ID = 'alaskaAI.agentMode.approvePlan';
	constructor() {
		super({
			id: AlaskaApprovePlanAction.ID,
			title: localize2('alaska.agentMode.approvePlan', 'Alaska AI: Approve Plan and Switch to Act'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter,
			},
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const views = accessor.get(IViewsService);
		const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, true);
		const sessionId = view?.getActiveSessionId();
		if (!sessionId) {
			return;
		}
		const ok = accessor.get(IAlaskaAgentModeService).approveAndSwitchToAct(sessionId);
		if (!ok) {
			accessor.get(INotificationService).warn(localize('alaska.agentMode.approvePlan.empty', 'No draft tasklist to approve yet. Ask Alaska AI to propose a plan first.'));
		}
	}
}

registerAction2(AlaskaSignInAction);
registerAction2(AlaskaSignOutAction);
registerAction2(AlaskaPlanApprovalModeAction);
registerAction2(AlaskaSetRunCommandTrustAction);
registerAction2(AlaskaConnectSSHAction);
registerAction2(AlaskaConnectWSLAction);
registerAction2(AlaskaOpenRemoteMenuAction);
registerAction2(AlaskaAcceptAllPendingAction);
registerAction2(AlaskaRevertAllPendingAction);
registerAction2(AlaskaResetChatLocationAction);
registerAction2(AlaskaSwitchToPlanModeAction);
registerAction2(AlaskaSwitchToActModeAction);
registerAction2(AlaskaApprovePlanAction);

class AlaskaDumpMetricsAction extends Action2 {
	static readonly ID = 'alaskaAI.dumpMetrics';
	constructor() {
		super({
			id: AlaskaDumpMetricsAction.ID,
			title: localize2('alaska.dumpMetrics', 'Alaska AI: Dump Performance Metrics to Log'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const metrics = accessor.get(IAlaskaMetricsService);
		const notify = accessor.get(INotificationService);
		const svc = metrics as AlaskaMetricsService;
		svc.dumpToLog();
		notify.info(localize('alaska.dumpMetrics.done', 'Alaska AI metrics dumped to log — open Output → Log (Window) to inspect.'));
	}
}
registerAction2(AlaskaDumpMetricsAction);

class AlaskaRegenerateTitleAction extends Action2 {
	static readonly ID = 'alaskaAI.regenerateTitle';
	constructor() {
		super({
			id: AlaskaRegenerateTitleAction.ID,
			title: localize2('alaska.regenTitle', 'Alaska AI: Regenerate Session Title'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const views = accessor.get(IViewsService);
		const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, false);
		if (!view) { return; }
		await view.regenerateActiveTitle();
	}
}
registerAction2(AlaskaRegenerateTitleAction);

export async function saveSessionExportToFile(
	accessor: ServicesAccessor,
	content: string,
	defaultName: string,
	format: 'json' | 'markdown',
): Promise<URI | undefined> {
	const dialogService = accessor.get(IFileDialogService);
	const fileService = accessor.get(IFileService);
	const pathService = accessor.get(IPathService);
	const notificationService = accessor.get(INotificationService);
	const home = await pathService.userHome();
	const defaultUri = URI.joinPath(home, 'Downloads', defaultName);
	const filters = format === 'json'
		? [{ name: 'JSON', extensions: ['json'] }]
		: [{ name: 'Markdown', extensions: ['md'] }];
	const target = await dialogService.showSaveDialog({
		defaultUri,
		filters,
		saveLabel: localize('alaska.export.save', 'Export'),
		title: localize('alaska.export.title', 'Export Alaska AI session'),
	});
	if (!target) { return undefined; }
	try {
		await fileService.writeFile(target, VSBuffer.fromString(content));
		notificationService.info(localize('alaska.export.done', 'Exported to {0}', target.fsPath));
		return target;
	} catch (err) {
		notificationService.error(localize('alaska.export.failed', 'Export failed: {0}', err instanceof Error ? err.message : String(err)));
		return undefined;
	}
}

function defaultExportFilename(session: IExportableSession, format: 'json' | 'markdown'): string {
	const slug = slugifySessionTitle(session.title);
	return format === 'json' ? `${slug}.json` : `${slug}.md`;
}

class AlaskaExportSessionMarkdownAction extends Action2 {
	static readonly ID = 'alaskaAI.exportSessionMarkdown';
	constructor() {
		super({
			id: AlaskaExportSessionMarkdownAction.ID,
			title: localize2('alaska.exportSessionMd', 'Alaska AI: Export Session as Markdown'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const views = accessor.get(IViewsService);
		const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, false);
		const session = view?.getExportableActiveSession();
		if (!session) {
			accessor.get(INotificationService).warn(localize('alaska.export.noSession', 'No active session with messages to export.'));
			return;
		}
		const md = exportSessionAsMarkdown(session);
		await saveSessionExportToFile(accessor, md, defaultExportFilename(session, 'markdown'), 'markdown');
	}
}
registerAction2(AlaskaExportSessionMarkdownAction);

class AlaskaExportSessionJsonAction extends Action2 {
	static readonly ID = 'alaskaAI.exportSessionJson';
	constructor() {
		super({
			id: AlaskaExportSessionJsonAction.ID,
			title: localize2('alaska.exportSessionJson', 'Alaska AI: Export Session as JSON'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const views = accessor.get(IViewsService);
		const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, false);
		const session = view?.getExportableActiveSession();
		if (!session) {
			accessor.get(INotificationService).warn(localize('alaska.export.noSession', 'No active session with messages to export.'));
			return;
		}
		const json = exportSessionAsJSON(session);
		await saveSessionExportToFile(accessor, json, defaultExportFilename(session, 'json'), 'json');
	}
}
registerAction2(AlaskaExportSessionJsonAction);

const NEW_THREAD_COMMAND_ID = 'alaska.chat.newThread';
const INSERT_CODE_CONTEXT_COMMAND_ID = 'alaska.chat.insertCodeContext';

CommandsRegistry.registerCommand(NEW_THREAD_COMMAND_ID, async (accessor) => {
	const views = accessor.get(IViewsService);
	const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, true);
	await view?.startNewThread();
});

CommandsRegistry.registerCommand(INSERT_CODE_CONTEXT_COMMAND_ID, async (accessor) => {
	const views = accessor.get(IViewsService);
	const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, true);
	await view?.insertCodeContext();
});

CommandsRegistry.registerCommand('alaska.chat.openModelPicker', async (accessor) => {
	const views = accessor.get(IViewsService);
	const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, true);
	view?.openModelPicker();
});

CommandsRegistry.registerCommand('alaska.chat.forceSkill', async (accessor, name?: string) => {
	if (!name) { return; }
	const views = accessor.get(IViewsService);
	const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, true);
	view?.forceSkillForNextTurn(name);
});

CommandsRegistry.registerCommand('alaska.chat.deleteSession', async (accessor, sessionId?: string) => {
	if (!sessionId) { return; }
	const views = accessor.get(IViewsService);
	const view = await views.openView<AlaskaChatViewPane>(AlaskaChatViewPane.ID, false);
	view?.deleteSession(sessionId);
});

KeybindingsRegistry.registerKeybindingRule({
	id: NEW_THREAD_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL,
	when: undefined,
});

KeybindingsRegistry.registerKeybindingRule({
	id: 'alaska.chat.openSettings',
	weight: KeybindingWeight.WorkbenchContrib + 10,
	primary: KeyMod.CtrlCmd | KeyCode.Comma,
	when: undefined,
});

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(AlaskaSettingsInput.ID, AlaskaSettingsInputSerializer);
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(AlaskaSettingsEditor, AlaskaSettingsEditor.ID, localize('alaska.settings.paneLabel', 'Alaska AI Settings')),
	[new SyncDescriptor(AlaskaSettingsInput)]
);

const OPEN_ALASKA_SETTINGS_COMMAND_ID = 'alaska.chat.openSettings';
CommandsRegistry.registerCommand(OPEN_ALASKA_SETTINGS_COMMAND_ID, async (accessor) => {
	const editorService = accessor.get(IEditorService);
	const instantiation = accessor.get(IInstantiationService);
	await editorService.openEditor(instantiation.createInstance(AlaskaSettingsInput));
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: OPEN_ALASKA_SETTINGS_COMMAND_ID + '.action',
			title: { value: 'Alaska AI: Open Settings', original: 'Alaska AI: Open Settings' },
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiation = accessor.get(IInstantiationService);
		await editorService.openEditor(instantiation.createInstance(AlaskaSettingsInput));
	}
});

class AlaskaIndexBootstrapContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.index.bootstrap';

	private bootstrapToken: CancellationTokenSource | undefined;

	constructor(
		@IAlaskaIndexService private readonly indexService: IAlaskaIndexService,
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => this.scheduleBootstrap()));
		this._register(this.authService.onDidChangeState(state => {
			if (state.status === 'signed-in') {
				this.scheduleBootstrap();
			} else {
				this.cancel();
			}
		}));
		this._register({
			dispose: () => this.cancel(),
		});
		queueMicrotask(() => this.scheduleBootstrap());
	}

	private scheduleBootstrap(): void {
		this.cancel();
		if (this.authService.state.status !== 'signed-in') { return; }
		const folder = this.workspaceService.getWorkspace().folders[0];
		if (!folder) { return; }
		const source = new CancellationTokenSource();
		this.bootstrapToken = source;
		this.indexService.bootstrap(folder.uri, source.token).catch(err => {
			this.logService.warn('[alaska.index] bootstrap rejected', err);
		});
	}

	private cancel(): void {
		this.bootstrapToken?.dispose(true);
		this.bootstrapToken = undefined;
		void this.indexService.stop();
	}
}
registerWorkbenchContribution2(AlaskaIndexBootstrapContribution.ID, AlaskaIndexBootstrapContribution, WorkbenchPhase.Eventually);

class AlaskaIndexStatusbarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.index.statusbar';

	private entry: IStatusbarEntryAccessor | undefined;

	constructor(
		@IAlaskaIndexService private readonly indexService: IAlaskaIndexService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
	) {
		super();
		this.entry = this._register(this.statusbarService.addEntry(
			this.renderEntry(),
			'alaska.index.status',
			StatusbarAlignment.RIGHT,
			98,
		));
		this._register(this.indexService.onDidChangeProgress(() => {
			this.entry?.update(this.renderEntry());
		}));
	}

	private renderEntry(): { name: string; text: string; ariaLabel: string; tooltip: string; command?: string; showProgress?: boolean | 'loading' | 'syncing' } {
		const p = this.indexService.progress;
		let icon = '$(database)';
		let label = localize('alaska.index.statusbar.idle', 'Alaska Index');
		let showProgress: boolean | 'loading' | 'syncing' = false;
		switch (p.state) {
			case 'disabled':
				icon = '$(circle-slash)';
				label = localize('alaska.index.statusbar.disabled', 'Alaska Index off');
				break;
			case 'unauthenticated':
				icon = '$(key)';
				label = localize('alaska.index.statusbar.signedOut', 'Alaska Index: sign in');
				break;
			case 'scanning':
				icon = '$(search)';
				label = p.filesTotal > 0
					? localize('alaska.index.statusbar.scanning', 'Indexing {0}/{1}', p.filesIndexed, p.filesTotal)
					: localize('alaska.index.statusbar.scanningNoTotal', 'Indexing…');
				showProgress = 'syncing';
				break;
			case 'embedding':
				icon = '$(sparkle)';
				label = localize('alaska.index.statusbar.embedding', 'Embedding {0}/{1}', p.filesIndexed, p.filesTotal);
				showProgress = 'syncing';
				break;
			case 'uploading':
				icon = '$(cloud-upload)';
				label = localize('alaska.index.statusbar.uploading', 'Syncing index ({0} chunks)', p.chunksUpserted);
				showProgress = 'syncing';
				break;
			case 'error':
				icon = '$(warning)';
				label = localize('alaska.index.statusbar.error', 'Alaska Index error');
				break;
			case 'idle':
			default:
				icon = '$(database)';
				if (p.chunkCount > 0) {
					label = localize('alaska.index.statusbar.synced', 'Alaska Index: {0} chunks', p.chunkCount.toLocaleString());
				}
				break;
		}
		const text = `${icon} ${label}`;
		const tooltip = renderIndexTooltip(p);
		return {
			name: localize('alaska.index.statusbar.name', 'Alaska Index'),
			text,
			ariaLabel: label,
			tooltip,
			command: 'alaska.index.reindex',
			showProgress,
		};
	}
}
registerWorkbenchContribution2(AlaskaIndexStatusbarContribution.ID, AlaskaIndexStatusbarContribution, WorkbenchPhase.Eventually);

function renderIndexTooltip(p: { state: string; filesIndexed: number; filesTotal: number; chunkCount: number; bytesUsed: number; lastIndexedAt?: number; errorMessage?: string }): string {
	const lines: string[] = [];
	lines.push(localize('alaska.index.tooltip.title', 'Alaska AI — Codebase Index'));
	lines.push(localize('alaska.index.tooltip.state', 'Status: {0}', p.state));
	if (p.filesTotal > 0) {
		lines.push(localize('alaska.index.tooltip.files', 'Files: {0} / {1}', p.filesIndexed, p.filesTotal));
	}
	if (p.chunkCount > 0) {
		lines.push(localize('alaska.index.tooltip.chunks', 'Chunks stored: {0}', p.chunkCount.toLocaleString()));
	}
	if (p.bytesUsed > 0) {
		const mb = p.bytesUsed / (1024 * 1024);
		lines.push(localize('alaska.index.tooltip.bytes', 'Encrypted payload: {0} MB', mb.toFixed(2)));
	}
	if (p.lastIndexedAt) {
		const minutes = Math.floor((Date.now() - p.lastIndexedAt) / 60_000);
		if (minutes <= 1) {
			lines.push(localize('alaska.index.tooltip.lastRecent', 'Last sync: just now'));
		} else if (minutes < 60) {
			lines.push(localize('alaska.index.tooltip.lastMinutes', 'Last sync: {0} min ago', minutes));
		} else {
			lines.push(localize('alaska.index.tooltip.lastHours', 'Last sync: {0} h ago', Math.floor(minutes / 60)));
		}
	}
	if (p.errorMessage) {
		lines.push('');
		lines.push(p.errorMessage);
	}
	return lines.join('\n');
}

class AlaskaIndexReindexAction extends Action2 {
	static readonly ID = 'alaska.index.reindex';
	constructor() {
		super({
			id: AlaskaIndexReindexAction.ID,
			title: localize2('alaska.index.reindex', 'Alaska AI: Reindex Workspace'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const index = accessor.get(IAlaskaIndexService);
		const notify = accessor.get(INotificationService);
		const source = new CancellationTokenSource();
		try {
			await index.forceReindex(source.token);
			notify.info(localize('alaska.index.reindex.done', 'Alaska AI reindex finished — {0} chunks stored.', index.progress.chunkCount.toLocaleString()));
		} catch (err) {
			notify.error(localize('alaska.index.reindex.failed', 'Alaska AI reindex failed: {0}', err instanceof Error ? err.message : String(err)));
		} finally {
			source.dispose();
		}
	}
}
registerAction2(AlaskaIndexReindexAction);

class AlaskaIndexClearAction extends Action2 {
	static readonly ID = 'alaska.index.clear';
	constructor() {
		super({
			id: AlaskaIndexClearAction.ID,
			title: localize2('alaska.index.clear', 'Alaska AI: Clear Workspace Index'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const index = accessor.get(IAlaskaIndexService);
		const notify = accessor.get(INotificationService);
		try {
			await index.clearWorkspaceIndex();
			notify.info(localize('alaska.index.clear.done', 'Alaska AI workspace index cleared.'));
		} catch (err) {
			notify.error(localize('alaska.index.clear.failed', 'Alaska AI clear failed: {0}', err instanceof Error ? err.message : String(err)));
		}
	}
}
registerAction2(AlaskaIndexClearAction);

const ALASKA_INDEX_ENABLED_KEY = 'alaska.index.enabled';

class AlaskaIndexToggleAction extends Action2 {
	static readonly ID = 'alaska.index.toggle';
	constructor() {
		super({
			id: AlaskaIndexToggleAction.ID,
			title: localize2('alaska.index.toggle', 'Alaska AI: Toggle Codebase Index'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const storage = accessor.get(IStorageService);
		const notify = accessor.get(INotificationService);
		const enabled = storage.getBoolean(ALASKA_INDEX_ENABLED_KEY, StorageScope.APPLICATION, true);
		storage.store(ALASKA_INDEX_ENABLED_KEY, !enabled, StorageScope.APPLICATION, StorageTarget.MACHINE);
		notify.info(!enabled
			? localize('alaska.index.toggle.on', 'Alaska AI index enabled — reload to (re)start indexing.')
			: localize('alaska.index.toggle.off', 'Alaska AI index disabled. Chats fall back to file-tree snapshot until re-enabled.'));
	}
}
registerAction2(AlaskaIndexToggleAction);
