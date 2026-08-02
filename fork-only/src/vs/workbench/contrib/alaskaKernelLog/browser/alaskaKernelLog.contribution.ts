import './media/kernelLog.css';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { addDisposableListener, EventType } from '../../../../base/browser/dom.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from '../../../common/contributions.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IAlaskaAgentLogService, AlaskaAgentLogService, IAlaskaLogEvent } from './alaskaAgentLogService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IAlaskaAuthService } from '../../alaskaChat/browser/alaskaAuthService.js';
import { IAlaskaActivityService } from '../../alaskaChat/browser/alaskaActivityService.js';
import { IAlaskaPendingEditsService } from '../../alaskaChat/browser/alaskaPendingEdits.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService, FileChangesEvent } from '../../../../platform/files/common/files.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { ISCMService } from '../../scm/common/scm.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';

registerSingleton(IAlaskaAgentLogService, AlaskaAgentLogService, InstantiationType.Delayed);

const COLLAPSE_STORAGE_KEY = 'alaska.kernelLog.collapsed';
const MAX_ROWS_IN_DOM = 80;

class AlaskaKernelLogContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'alaska.kernelLog';

	private root: HTMLElement | undefined;
	private toggle: HTMLElement | undefined;
	private rows: HTMLElement[] = [];

	constructor(
		@IAlaskaAgentLogService private readonly logService: IAlaskaAgentLogService,
		@IStorageService private readonly storageService: IStorageService,
		@ICommandService _commandService: ICommandService,
	) {
		super();
		this._register(this.logService.onDidLogEvent(ev => this.append(ev)));
		this.ensureMounted();
	}

	private ensureMounted(): void {
		const body = mainWindow.document.body;
		if (!body) {
			setTimeout(() => this.ensureMounted(), 50);
			return;
		}
		if (this.root && body.contains(this.root)) {
			return;
		}
		this.root = mainWindow.document.createElement('section');
		this.root.className = 'alaska-kernel-log';
		this.root.setAttribute('role', 'log');
		this.root.setAttribute('aria-live', 'polite');
		body.appendChild(this.root);

		const toggleButton = mainWindow.document.createElement('button');
		toggleButton.className = 'alaska-kernel-log-toggle';
		toggleButton.type = 'button';
		toggleButton.textContent = 'hide';
		this.root.appendChild(toggleButton);
		this.toggle = toggleButton;

		const collapseStore = this._register(new DisposableStore());
		collapseStore.add(addDisposableListener(this.toggle, EventType.CLICK, () => this.toggleCollapse()));

		const collapsed = this.storageService.getBoolean(COLLAPSE_STORAGE_KEY, StorageScope.APPLICATION, false);
		if (collapsed) {
			this.root.classList.add('collapsed');
		}

		for (const ev of this.logService.buffer) {
			this.append(ev);
		}
	}

	private toggleCollapse(): void {
		if (!this.root) { return; }
		const next = !this.root.classList.contains('collapsed');
		this.root.classList.toggle('collapsed', next);
		if (this.toggle) {
			this.toggle.textContent = next ? 'show' : 'hide';
		}
		this.storageService.store(COLLAPSE_STORAGE_KEY, next, StorageScope.APPLICATION, StorageTarget.USER);
	}

	private append(event: IAlaskaLogEvent): void {
		if (!this.root) { return; }
		const row = mainWindow.document.createElement('div');
		row.className = `klog-row ${event.level}`;
		const ts = mainWindow.document.createElement('span');
		ts.className = 'klog-ts';
		ts.textContent = formatTimestamp(event.timestamp);
		const src = mainWindow.document.createElement('span');
		src.className = 'klog-src';
		src.textContent = `${event.source} ·`;
		const msg = mainWindow.document.createElement('span');
		msg.className = 'klog-msg';
		msg.textContent = event.message;
		row.appendChild(ts);
		row.appendChild(src);
		row.appendChild(msg);
		this.root.appendChild(row);
		this.rows.push(row);
		while (this.rows.length > MAX_ROWS_IN_DOM) {
			const old = this.rows.shift();
			old?.remove();
		}
		this.root.scrollTop = this.root.scrollHeight;
	}
}

function formatTimestamp(ms: number): string {
	const d = new Date(ms);
	const p = (n: number) => String(n).padStart(2, '0');
	return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

class AlaskaKernelLogBridgeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.kernelLog.bridge';
	constructor(
		@IAlaskaAgentLogService logService: IAlaskaAgentLogService,
		@IAlaskaAuthService authService: IAlaskaAuthService,
		@IAlaskaActivityService activityService: IAlaskaActivityService,
		@IAlaskaPendingEditsService pendingEdits: IAlaskaPendingEditsService,
		@IFileService fileService: IFileService,
		@ITextFileService textFileService: ITextFileService,
		@ISCMService scmService: ISCMService,
		@ILanguageService languageService: ILanguageService,
	) {
		super();
		this._register(authService.onDidChangeState(state => {
			if (state.status === 'signed-in') {
				logService.log('auth', 'ok', `signed in as ${state.user?.email ?? 'user'}`);
			} else {
				logService.log('auth', 'info', 'signed out — chat is offline');
			}
		}));
		this._register(activityService.onDidChangeReading((uris: readonly URI[]) => {
			for (const uri of uris) {
				const isReading = activityService.isReading(uri);
				logService.log('watcher', isReading ? 'info' : 'ok', `${isReading ? 'reading' : 'released'} ${uri.path.split('/').pop() ?? uri.toString()}`);
			}
		}));
		this._register(pendingEdits.onDidChange(() => {
			const count = pendingEdits.resources().length;
			if (count > 0) {
				logService.log('agent', 'info', `pending edits: ${count}`);
			}
		}));
		this._register(textFileService.files.onDidSave(e => {
			const name = e.model.resource.path.split('/').pop() ?? '';
			logService.log('watcher', 'ok', `saved ${name}`);
		}));
		this._register(fileService.onDidFilesChange((e: FileChangesEvent) => {
			const added = e.gotAdded() ? 1 : 0;
			const deleted = e.gotDeleted() ? 1 : 0;
			if (added + deleted > 0) {
				logService.log('watcher', 'info', `${added > 0 ? '+added' : ''}${deleted > 0 ? ' -deleted' : ''} fs change`.trim());
			}
		}));
		this._register(scmService.onDidAddRepository(repo => {
			logService.log('scm', 'ok', `repo attached · ${repo.provider.label}`);
		}));
		this._register(scmService.onDidRemoveRepository(repo => {
			logService.log('scm', 'info', `repo detached · ${repo.provider.label}`);
		}));
		this._register(languageService.onDidChange(() => {
			logService.log('lsp', 'info', 'language services updated');
		}));
		logService.log('agent', 'ok', 'kernel ready');
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaKernelLogContribution,
	LifecyclePhase.Restored,
);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaKernelLogBridgeContribution,
	LifecyclePhase.Restored,
);

CommandsRegistry.registerCommand('alaska.kernelLog.appendDemo', accessor => {
	const log = accessor.get(IAlaskaAgentLogService);
	log.log('agent', 'ok', 'demo log entry');
});

CommandsRegistry.registerCommand('alaska.kernelLog.clear', accessor => {
	accessor.get(IAlaskaAgentLogService).clear();
});
