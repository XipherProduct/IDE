/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore, IDisposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { $, append, addDisposableListener, EventType, clearNode, getWindow } from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAlaskaAuthService, IAlaskaUser, ALASKA_API_BASE } from '../../../contrib/alaskaChat/browser/alaskaAuthService.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITitlebarZoneContext, ITitlebarZoneContribution, TitlebarZone, TitlebarZoneRegistry } from './titlebarZones.js';

interface IQuotaResponse {
	plan?: string;
	week_start?: string;
	budget_credits?: number;
	spent_credits?: number;
	carried_in_credits?: number;
	carryover_active?: boolean;
	next_reset_utc?: string;
}

const DASHBOARD_URL = 'https://alaska-ai.shop/dashboard';
const PRICING_URL = 'https://alaska-ai.shop/pricing';
const KEYS_URL = 'https://alaska-ai.shop/dashboard/keys';

const TOAST_HOLD_MS = 2400;
const TOAST_FADE_MS = 250;
const QUOTA_REFRESH_MS = 60_000;

export class AlaskaUserPill extends Disposable {

	private readonly root: HTMLElement;
	private readonly trigger: HTMLElement;
	private readonly menuStore = this._register(new MutableDisposable<DisposableStore>());
	private readonly toastStore = this._register(new MutableDisposable<DisposableStore>());
	private menu: HTMLElement | undefined;
	private quota: IQuotaResponse | undefined;
	private quotaTimer: ReturnType<typeof setInterval> | undefined;

	constructor(
		private readonly parent: HTMLElement,
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@ICommandService private readonly commandService: ICommandService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		this.root = append(parent, $('div.alaska-user-pill-host'));
		this.trigger = append(this.root, $('button.alaska-user-pill'));
		this.trigger.setAttribute('aria-label', localize('alaska.userPill.aria', 'Alaska AI account'));

		this._register(addDisposableListener(this.trigger, EventType.CLICK, e => {
			e.stopPropagation();
			this.toggleMenu();
		}));

		this._register(this.authService.onDidChangeState(() => {
			this.refresh();
			void this.fetchQuota();
		}));

		this.refresh();
		void this.fetchQuota();

		this.quotaTimer = setInterval(() => void this.fetchQuota(), QUOTA_REFRESH_MS);
		this._register({
			dispose: () => {
				if (this.quotaTimer) {
					clearInterval(this.quotaTimer);
					this.quotaTimer = undefined;
				}
			}
		});
	}

	private refresh(): void {
		clearNode(this.trigger);
		const state = this.authService.state;
		if (state.status === 'signed-out') {
			this.trigger.classList.add('signed-out');
			this.trigger.classList.remove('signed-in');
			const btn = append(this.trigger, $('span.alaska-user-pill-signin'));
			btn.textContent = localize('alaska.userPill.signIn', 'Sign In');
			this.closeMenu();
			return;
		}

		this.trigger.classList.add('signed-in');
		this.trigger.classList.remove('signed-out');

		const quotaChip = append(this.trigger, $('span.alaska-user-pill-quota'));
		append(quotaChip, $('span.alaska-user-pill-dot'));
		this.renderQuotaInline(quotaChip, state.user, this.quota);

		const avatar = append(this.trigger, $('span.alaska-user-pill-avatar'));
		avatar.textContent = this.deriveInitial(state.user);

		const caret = append(this.trigger, $('span.alaska-user-pill-caret'));
		// allow-any-unicode-next-line
		caret.textContent = '▾';
	}

	private renderQuotaInline(host: HTMLElement, user: IAlaskaUser | undefined, quota: IQuotaResponse | undefined): void {
		const plan = quota?.plan ?? user?.plan ?? 'Free';
		host.appendChild(document.createTextNode(plan.toUpperCase()));
		if (quota && typeof quota.spent_credits === 'number' && typeof quota.budget_credits === 'number') {
			const total = quota.budget_credits + (quota.carried_in_credits ?? 0);
			const remaining = Math.max(0, total - quota.spent_credits);
			host.appendChild(document.createTextNode(' · '));
			const bold = document.createElement('b');
			bold.textContent = this.formatCompactNumber(remaining);
			host.appendChild(bold);
			host.title = `${plan.toUpperCase()} · ${remaining.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} credits remaining`;
		}
	}

	private formatCompactNumber(n: number): string {
		if (n >= 1_000_000) {
			return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
		}
		if (n >= 10_000) {
			return `${Math.round(n / 1000)}k`;
		}
		if (n >= 1_000) {
			return `${(n / 1000).toFixed(1)}k`;
		}
		return n.toLocaleString('en-US');
	}

	private deriveInitial(user: IAlaskaUser | undefined): string {
		if (!user) {
			return '?';
		}
		const source = user.name || user.email;
		if (!source) {
			return '?';
		}
		return source.charAt(0).toUpperCase();
	}

	private formatQuotaShort(user: IAlaskaUser | undefined, quota: IQuotaResponse | undefined): string {
		const plan = quota?.plan ?? user?.plan ?? 'Free';
		if (quota && typeof quota.spent_credits === 'number' && typeof quota.budget_credits === 'number') {
			const used = quota.spent_credits;
			const total = quota.budget_credits + (quota.carried_in_credits ?? 0);
			return ` ${plan} · ${used.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} cr`;
		}
		return ` ${plan}`;
	}

	private async fetchQuota(): Promise<void> {
		if (this.authService.state.status !== 'signed-in') {
			this.quota = undefined;
			return;
		}
		const token = await this.authService.getToken();
		if (!token) {
			return;
		}
		try {
			const ctx = await this.requestService.request({
				type: 'GET',
				url: `${ALASKA_API_BASE}/api/me/quota`,
				headers: { 'Authorization': `Bearer ${token}` },
				callSite: 'alaska.userPill.quota',
			}, CancellationToken.None);
			const status = ctx.res.statusCode ?? 0;
			if (status >= 400) {
				return;
			}
			const json = await asJson<IQuotaResponse>(ctx);
			if (json) {
				this.quota = json;
				this.refresh();
				if (this.menu) {
					this.renderMenuContent();
				}
			}
		} catch (err) {
			this.logService.trace('[alaska.userPill] quota fetch failed', err);
		}
	}

	private toggleMenu(): void {
		if (this.menu) {
			this.closeMenu();
			return;
		}
		if (this.authService.state.status === 'signed-out') {
			void this.commandService.executeCommand('alaskaAI.signIn');
			return;
		}
		this.openMenu();
	}

	private openMenu(): void {
		const store = new DisposableStore();
		this.menuStore.value = store;

		const targetWindow = getWindow(this.parent);
		const doc = targetWindow.document;

		this.menu = append(doc.body, $('div.alaska-user-menu'));
		this.trigger.classList.add('open');
		this.renderMenuContent();
		this.positionMenu();
		targetWindow.requestAnimationFrame(() => this.menu?.classList.add('show'));

		store.add(addDisposableListener(doc, EventType.MOUSE_DOWN, e => {
			const target = e.target as Node | null;
			if (this.menu && target && this.menu.contains(target)) {
				return;
			}
			if (this.trigger.contains(target)) {
				return;
			}
			this.closeMenu();
		}, true));
		store.add(addDisposableListener(doc, EventType.KEY_DOWN, e => {
			if (e.key === 'Escape') {
				this.closeMenu();
			}
		}));
		store.add(addDisposableListener(targetWindow, 'resize', () => this.positionMenu()));
		store.add(addDisposableListener(targetWindow, 'scroll', () => this.positionMenu(), true));
	}

	private positionMenu(): void {
		if (!this.menu) {
			return;
		}
		const VIEWPORT_MARGIN = 8;
		const MENU_GAP = 8;
		const MENU_WIDTH = 296;
		const MIN_MENU_HEIGHT = 200;
		const WINDOW_CONTROLS_RESERVE = 144;

		const targetWindow = getWindow(this.parent);
		const triggerRect = this.trigger.getBoundingClientRect();
		const viewportW = targetWindow.innerWidth;
		const viewportH = targetWindow.innerHeight;

		const effectiveWidth = Math.min(MENU_WIDTH, viewportW - VIEWPORT_MARGIN * 2);

		let rightOffset = Math.max(WINDOW_CONTROLS_RESERVE, viewportW - triggerRect.right);
		const minRight = VIEWPORT_MARGIN;
		const maxRight = Math.max(minRight, viewportW - effectiveWidth - VIEWPORT_MARGIN);
		rightOffset = Math.min(Math.max(rightOffset, minRight), maxRight);

		const topOffset = Math.round(triggerRect.bottom + MENU_GAP);
		const availableHeight = Math.max(MIN_MENU_HEIGHT, viewportH - topOffset - VIEWPORT_MARGIN);

		this.menu.style.position = 'fixed';
		this.menu.style.top = `${topOffset}px`;
		this.menu.style.right = `${Math.round(rightOffset)}px`;
		this.menu.style.left = 'auto';
		this.menu.style.width = `${effectiveWidth}px`;
		this.menu.style.maxHeight = `${Math.round(availableHeight)}px`;
	}

	private renderMenuContent(): void {
		if (!this.menu) {
			return;
		}
		clearNode(this.menu);
		const state = this.authService.state;
		const user = state.user;

		const header = append(this.menu, $('div.alaska-um-header'));
		const avatar = append(header, $('div.alaska-um-avatar'));
		avatar.textContent = this.deriveInitial(user);
		const id = append(header, $('div.alaska-um-id'));
		const name = append(id, $('div.alaska-um-name'));
		name.textContent = user?.name ?? user?.email ?? '';
		if (user?.email && user.email !== user.name) {
			const email = append(id, $('div.alaska-um-email'));
			email.textContent = user.email;
		}

		const planBox = append(this.menu, $('div.alaska-um-plan'));
		const planRow = append(planBox, $('div.alaska-um-row'));
		planRow.appendChild(document.createTextNode(localize('alaska.userPill.plan', 'plan')));
		const planVal = append(planRow, $('span.ice'));
		planVal.textContent = this.quota?.plan ?? user?.plan ?? 'Free';

		const creditsRow = append(planBox, $('div.alaska-um-row'));
		creditsRow.appendChild(document.createTextNode(localize('alaska.userPill.credits', 'credits')));
		const creditsVal = append(creditsRow, $('span'));
		if (typeof this.quota?.spent_credits === 'number' && typeof this.quota?.budget_credits === 'number') {
			const total = this.quota.budget_credits + (this.quota.carried_in_credits ?? 0);
			const bold = append(creditsVal, $('b'));
			bold.textContent = this.quota.spent_credits.toLocaleString('en-US');
			creditsVal.appendChild(document.createTextNode(` / ${total.toLocaleString('en-US')}`));
		} else {
			creditsVal.textContent = '—';
		}

		const bar = append(planBox, $('div.alaska-um-bar'));
		const fill = append(bar, $('i'));
		if (typeof this.quota?.spent_credits === 'number' && typeof this.quota?.budget_credits === 'number') {
			const total = this.quota.budget_credits + (this.quota.carried_in_credits ?? 0);
			if (total > 0) {
				const pct = Math.min(100, Math.max(0, (this.quota.spent_credits / total) * 100));
				fill.style.width = `${pct}%`;
			} else {
				fill.style.width = '0%';
			}
		} else {
			fill.style.width = '0%';
		}

		if (this.quota?.next_reset_utc) {
			const sub = append(planBox, $('div.alaska-um-row.sub'));
			sub.appendChild(document.createTextNode(localize('alaska.userPill.reset', 'reset')));
			const subVal = append(sub, $('span'));
			subVal.textContent = this.formatPeriodEnd(this.quota.next_reset_utc);
		}

		const links = append(this.menu, $('div.alaska-um-section'));
		// allow-any-unicode-next-line
		this.addMenuItem(links, '▤', localize('alaska.userPill.openDashboard', 'Open Dashboard'), '↗', () => {
			void this.openerService.open(URI.parse(DASHBOARD_URL), { openExternal: true });
		});
		// allow-any-unicode-next-line
		this.addMenuItem(links, '⊕', localize('alaska.userPill.changePlan', 'Change plan'), '↗', () => {
			void this.openerService.open(URI.parse(PRICING_URL), { openExternal: true });
		});
		// allow-any-unicode-next-line
		this.addMenuItem(links, '⦾', localize('alaska.userPill.settings', 'IDE Settings'), '', () => {
			void this.commandService.executeCommand('workbench.action.openSettings');
		});
		// allow-any-unicode-next-line
		this.addMenuItem(links, '⊸', localize('alaska.userPill.apiKeys', 'API Keys'), '↗', () => {
			void this.openerService.open(URI.parse(KEYS_URL), { openExternal: true });
		});

		const dangerSection = append(this.menu, $('div.alaska-um-section'));
		// allow-any-unicode-next-line
		this.addMenuItem(dangerSection, '↻', localize('alaska.userPill.switchAccount', 'Switch account'), '', () => {
			void this.handleSwitchAccount();
		});
		// allow-any-unicode-next-line
		const signOutItem = this.addMenuItem(dangerSection, '⇦', localize('alaska.userPill.signOut', 'Sign out of IDE'), '⌘⇧Q', () => {
			void this.handleSignOut();
		});
		signOutItem.classList.add('danger');

		const foot = append(this.menu, $('div.alaska-um-foot'));
		foot.textContent = 'Alaska-AI';
	}

	private addMenuItem(parent: HTMLElement, glyph: string, label: string, ext: string, onClick: () => void): HTMLElement {
		const item = append(parent, $('a.alaska-um-item'));
		const glyphSpan = append(item, $('span.glyph'));
		glyphSpan.textContent = glyph;
		const labelSpan = append(item, $('span.label'));
		labelSpan.textContent = label;
		const extSpan = append(item, $('span.ext'));
		extSpan.textContent = ext;
		const store = this.menuStore.value;
		if (store) {
			store.add(addDisposableListener(item, EventType.CLICK, e => {
				e.preventDefault();
				e.stopPropagation();
				this.closeMenu();
				onClick();
			}));
		}
		return item;
	}

	private closeMenu(): void {
		this.menuStore.value = undefined;
		if (this.menu) {
			this.menu.classList.remove('show');
			const el = this.menu;
			this.menu = undefined;
			setTimeout(() => el.remove(), 180);
		}
		this.trigger.classList.remove('open');
	}

	override dispose(): void {
		if (this.menu) {
			this.menu.remove();
			this.menu = undefined;
		}
		super.dispose();
	}

	private async handleSignOut(): Promise<void> {
		this.showSignOutToast();
		try {
			await this.commandService.executeCommand('alaskaAI.signOut');
		} catch (err) {
			this.logService.warn('[alaska.userPill] signOut failed', err);
		}
	}

	private async handleSwitchAccount(): Promise<void> {
		try {
			await this.commandService.executeCommand('alaskaAI.signOut');
		} catch (err) {
			this.logService.warn('[alaska.userPill] switchAccount signOut failed', err);
		}
		try {
			await this.commandService.executeCommand('alaskaAI.signIn');
		} catch (err) {
			this.logService.warn('[alaska.userPill] switchAccount signIn failed', err);
		}
	}

	private showSignOutToast(): void {
		const store = new DisposableStore();
		this.toastStore.value = store;

		const doc = mainWindow.document;
		const toast = append(doc.body, $('div.alaska-signout-toast'));
		const title = append(toast, $('div.title'));
		title.textContent = localize('alaska.userPill.toastTitle', '✓ signed out');
		const sub = append(toast, $('div.sub'));
		sub.textContent = localize('alaska.userPill.toastSub', 'session ended on this device');

		const workbench = doc.querySelector('.monaco-workbench');
		if (workbench instanceof HTMLElement) {
			workbench.classList.add('alaska-signout-dim');
			store.add({
				dispose: () => workbench.classList.remove('alaska-signout-dim'),
			});
		}

		requestAnimationFrame(() => toast.classList.add('show'));

		const fadeTimer = setTimeout(() => {
			toast.classList.remove('show');
			const removeTimer = setTimeout(() => {
				toast.remove();
				this.toastStore.value = undefined;
			}, TOAST_FADE_MS);
			store.add({
				dispose: () => clearTimeout(removeTimer),
			});
		}, TOAST_HOLD_MS);
		store.add({
			dispose: () => {
				clearTimeout(fadeTimer);
				toast.remove();
			}
		});
	}

	private formatPeriodEnd(iso: string): string {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) {
			return iso;
		}
		const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
		return fmt.format(date);
	}
}

class AlaskaUserPillContribution implements ITitlebarZoneContribution {
	readonly id = 'alaska.userPill';
	readonly zone = TitlebarZone.Right;
	readonly order = 100;

	create(container: HTMLElement, instantiationService: IInstantiationService, _context: ITitlebarZoneContext): IDisposable {
		return instantiationService.createInstance(AlaskaUserPill, container);
	}
}

TitlebarZoneRegistry.register(new AlaskaUserPillContribution());
