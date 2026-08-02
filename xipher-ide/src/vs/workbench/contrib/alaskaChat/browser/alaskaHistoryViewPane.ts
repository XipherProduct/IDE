import { localize } from '../../../../nls.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { append, $, addDisposableListener, EventType, clearNode } from '../../../../base/browser/dom.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import {
	exportSessionAsJSON,
	exportSessionAsMarkdown,
	IExportableMessage,
	IExportableSession,
	slugifySessionTitle,
} from '../common/alaskaSessionExport.js';

const SESSIONS_STORAGE_KEY = 'alaska.chat.sessions';
const ACTIVE_SESSION_KEY = 'alaska.chat.activeSession';

interface IHistoryRow {
	readonly id: string;
	readonly title: string;
	readonly updatedAt: number;
	readonly preview: string;
	readonly badge?: string;
}

export class AlaskaHistoryViewPane extends ViewPane {

	static readonly ID = 'workbench.view.alaskaAI.history';

	private listEl: HTMLElement | undefined;
	private readonly rowDisposables: IDisposable[] = [];
	private readonly menuStore = this._register(new DisposableStore());

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IStorageService private readonly storageService: IStorageService,
		@ICommandService private readonly commandService: ICommandService,
		@INotificationService private readonly notificationService: INotificationService,
		@IDialogService private readonly dialogService: IDialogService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IFileService private readonly fileService: IFileService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IPathService private readonly pathService: IPathService,
	) {
		super(options as IViewPaneOptions, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.storageService.onDidChangeValue(StorageScope.WORKSPACE, SESSIONS_STORAGE_KEY, this._store)(() => this.renderRows()));
		this._register(this.storageService.onDidChangeValue(StorageScope.WORKSPACE, ACTIVE_SESSION_KEY, this._store)(() => this.renderRows()));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('alaska-history-view');

		const head = append(container, $('div.alaska-history-head'));
		const title = append(head, $('span.alaska-history-title'));
		title.textContent = localize('alaska.history.title', 'HISTORY');
		const plus = append(head, $('button.alaska-history-plus'));
		plus.textContent = '+';
		// allow-any-unicode-next-line
		plus.title = localize('alaska.history.newChat', 'New chat (⌘⇧L)');
		this._register(addDisposableListener(plus, EventType.CLICK, () => {
			void this.commandService.executeCommand('alaska.chat.newThread');
		}));

		this.listEl = append(container, $('div.alaska-history-list'));
		this.renderRows();
	}

	private renderRows(): void {
		this.dismissMenu();
		if (!this.listEl) { return; }
		for (const d of this.rowDisposables) {
			d.dispose();
		}
		this.rowDisposables.length = 0;
		clearNode(this.listEl);

		const rows = this.loadRows();
		if (rows.length === 0) {
			const empty = append(this.listEl, $('div.alaska-history-empty'));
			// allow-any-unicode-next-line
			empty.textContent = localize('alaska.history.empty', 'No chats yet — ⌘⇧L starts one.');
			return;
		}
		const activeId = this.storageService.get(ACTIVE_SESSION_KEY, StorageScope.WORKSPACE, '');

		const buckets = this.bucket(rows);
		for (const bucket of buckets) {
			if (bucket.rows.length === 0) { continue; }
			const section = append(this.listEl, $('div.alaska-history-section'));
			section.textContent = bucket.label;
			for (const row of bucket.rows) {
				const item = append(this.listEl, $('div.alaska-history-item'));
				if (row.id === activeId) {
					item.classList.add('alaska-history-item-active');
				}
				const dateEl = append(item, $('div.alaska-history-date'));
				dateEl.textContent = this.formatRelative(row.updatedAt);
				const titleEl = append(item, $('div.alaska-history-title-row'));
				titleEl.textContent = row.title || localize('alaska.history.untitled', '(untitled)');
				const previewEl = append(item, $('div.alaska-history-preview'));
				previewEl.textContent = row.preview;
				if (row.badge) {
					const badge = append(item, $('div.alaska-history-badge'));
					badge.textContent = row.badge;
				}
				const more = append(item, $('button.alaska-history-more')) as HTMLButtonElement;
				more.type = 'button';
				more.title = localize('alaska.history.more', 'Session actions');
				more.setAttribute('aria-label', localize('alaska.history.more', 'Session actions'));
				// allow-any-unicode-next-line
				more.textContent = '⋯';
				this.rowDisposables.push(addDisposableListener(more, EventType.CLICK, e => {
					e.stopPropagation();
					e.preventDefault();
					this.showSessionMenu(row, more);
				}));
				this.rowDisposables.push(addDisposableListener(item, EventType.CLICK, () => {
					this.storageService.store(ACTIVE_SESSION_KEY, row.id, StorageScope.WORKSPACE, 0);
					void this.commandService.executeCommand('workbench.action.alaskaAI.toggleChat');
				}));
			}
		}
	}

	private showSessionMenu(row: IHistoryRow, anchor: HTMLElement): void {
		this.dismissMenu();
		const session = this.loadFullSession(row.id);
		if (!session) {
			this.notificationService.warn(localize('alaska.history.menu.missing', 'Session is no longer available.'));
			return;
		}
		const menu = append(this.listEl ?? anchor.parentElement!, $('div.alaska-history-menu'));
		const anchorRect = anchor.getBoundingClientRect();
		menu.style.position = 'fixed';
		menu.style.top = `${Math.round(anchorRect.bottom + 4)}px`;
		menu.style.right = `${Math.round(window.innerWidth - anchorRect.right)}px`;

		const exportMd = this.buildMenuItem(menu, localize('alaska.history.exportMd', 'Export as Markdown'), async () => {
			const md = exportSessionAsMarkdown(session);
			await this.saveBlob(md, `${slugifySessionTitle(session.title)}.md`, 'markdown');
		});
		const exportJson = this.buildMenuItem(menu, localize('alaska.history.exportJson', 'Export as JSON'), async () => {
			const json = exportSessionAsJSON(session);
			await this.saveBlob(json, `${slugifySessionTitle(session.title)}.json`, 'json');
		});
		const copyMd = this.buildMenuItem(menu, localize('alaska.history.copyMd', 'Copy as Markdown'), async () => {
			await this.clipboardService.writeText(exportSessionAsMarkdown(session));
			this.notificationService.info(localize('alaska.history.copied', 'Session copied to clipboard as Markdown.'));
		});
		this.appendMenuSeparator(menu);
		const del = this.buildMenuItem(menu, localize('alaska.history.delete', 'Delete session'), async () => {
			const confirmed = await this.dialogService.confirm({
				message: localize('alaska.history.deleteConfirm', 'Delete session "{0}"?', session.title || localize('alaska.history.untitled', '(untitled)')),
				type: 'warning',
				primaryButton: localize('alaska.history.delete', 'Delete session'),
			});
			if (confirmed.confirmed) {
				await this.commandService.executeCommand('alaska.chat.deleteSession', row.id);
			}
		});
		del.classList.add('alaska-history-menu-danger');

		void exportMd; void exportJson; void copyMd;

		const dismissOnClick = addDisposableListener(window, EventType.MOUSE_DOWN, e => {
			const target = e.target as Node | null;
			if (target && !menu.contains(target) && target !== anchor) {
				this.dismissMenu();
			}
		}, true);
		const dismissOnEsc = addDisposableListener(window, EventType.KEY_DOWN, e => {
			if (e.key === 'Escape') {
				this.dismissMenu();
			}
		}, true);
		this.menuStore.add(dismissOnClick);
		this.menuStore.add(dismissOnEsc);
		this.menuStore.add({ dispose: () => menu.remove() });
	}

	private buildMenuItem(menu: HTMLElement, label: string, run: () => Promise<void>): HTMLElement {
		const item = append(menu, $('button.alaska-history-menu-item')) as HTMLButtonElement;
		item.type = 'button';
		item.textContent = label;
		this.menuStore.add(addDisposableListener(item, EventType.CLICK, e => {
			e.stopPropagation();
			e.preventDefault();
			this.dismissMenu();
			void run().catch(err => this.notificationService.error(err instanceof Error ? err.message : String(err)));
		}));
		return item;
	}

	private appendMenuSeparator(menu: HTMLElement): void {
		append(menu, $('div.alaska-history-menu-sep'));
	}

	private dismissMenu(): void {
		this.menuStore.clear();
	}

	private async saveBlob(content: string, defaultName: string, format: 'json' | 'markdown'): Promise<void> {
		const home = await this.pathService.userHome();
		const defaultUri = URI.joinPath(home, 'Downloads', defaultName);
		const filters = format === 'json'
			? [{ name: 'JSON', extensions: ['json'] }]
			: [{ name: 'Markdown', extensions: ['md'] }];
		const target = await this.fileDialogService.showSaveDialog({
			defaultUri,
			filters,
			saveLabel: localize('alaska.export.save', 'Export'),
			title: localize('alaska.export.title', 'Export Xipher IDE session'),
		});
		if (!target) { return; }
		try {
			await this.fileService.writeFile(target, VSBuffer.fromString(content));
			this.notificationService.info(localize('alaska.export.done', 'Exported to {0}', target.fsPath));
		} catch (err) {
			this.notificationService.error(localize('alaska.export.failed', 'Export failed: {0}', err instanceof Error ? err.message : String(err)));
		}
	}

	private loadRows(): IHistoryRow[] {
		const raw = this.storageService.get(SESSIONS_STORAGE_KEY, StorageScope.WORKSPACE, '[]');
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (!Array.isArray(parsed)) { return []; }
			return parsed.map(s => {
				const obj = s as { id?: string; title?: string; messages?: unknown[]; updatedAt?: number };
				const preview = this.derivePreview(obj.messages);
				return {
					id: String(obj.id ?? ''),
					title: String(obj.title ?? ''),
					updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
					preview,
				};
			}).filter(r => r.id !== '').sort((a, b) => b.updatedAt - a.updatedAt);
		} catch {
			return [];
		}
	}

	private loadFullSession(id: string): IExportableSession | undefined {
		const raw = this.storageService.get(SESSIONS_STORAGE_KEY, StorageScope.WORKSPACE, '[]');
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (!Array.isArray(parsed)) { return undefined; }
			const match = parsed.find(s => {
				const obj = s as { id?: string };
				return obj?.id === id;
			}) as { id?: string; title?: string; createdAt?: number; updatedAt?: number; messages?: IExportableMessage[] } | undefined;
			if (!match || !match.id) { return undefined; }
			return {
				id: match.id,
				title: match.title ?? '',
				createdAt: typeof match.createdAt === 'number' ? match.createdAt : Date.now(),
				updatedAt: typeof match.updatedAt === 'number' ? match.updatedAt : Date.now(),
				messages: Array.isArray(match.messages) ? match.messages : [],
			};
		} catch {
			return undefined;
		}
	}

	private derivePreview(messages: unknown[] | undefined): string {
		if (!Array.isArray(messages) || messages.length === 0) { return ''; }
		const last = messages[messages.length - 1] as { content?: string; text?: string };
		const raw = (last?.content ?? last?.text ?? '').toString().trim();
		if (raw.length <= 80) { return raw; }
		// allow-any-unicode-next-line
		return raw.slice(0, 77) + '…';
	}

	private bucket(rows: IHistoryRow[]): { label: string; rows: IHistoryRow[] }[] {
		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const startOfYesterday = startOfToday - 86400_000;
		const startOfWeek = startOfToday - 7 * 86400_000;

		const today: IHistoryRow[] = [];
		const yesterday: IHistoryRow[] = [];
		const thisWeek: IHistoryRow[] = [];
		const older: IHistoryRow[] = [];
		for (const r of rows) {
			if (r.updatedAt >= startOfToday) {
				today.push(r);
			} else if (r.updatedAt >= startOfYesterday) {
				yesterday.push(r);
			} else if (r.updatedAt >= startOfWeek) {
				thisWeek.push(r);
			} else {
				older.push(r);
			}
		}
		return [
			{ label: localize('alaska.history.today', 'Today'), rows: today },
			{ label: localize('alaska.history.yesterday', 'Yesterday'), rows: yesterday },
			{ label: localize('alaska.history.thisWeek', 'This week'), rows: thisWeek },
			{ label: localize('alaska.history.older', 'Older'), rows: older },
		];
	}

	private formatRelative(ts: number): string {
		const d = new Date(ts);
		const pad = (n: number) => String(n).padStart(2, '0');
		const today = new Date();
		const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
		if (sameDay) {
			return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
		}
		// allow-any-unicode-next-line
		return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	override dispose(): void {
		this.dismissMenu();
		for (const d of this.rowDisposables) {
			d.dispose();
		}
		this.rowDisposables.length = 0;
		super.dispose();
	}
}

const _unused: Disposable | undefined = undefined;
void _unused;
