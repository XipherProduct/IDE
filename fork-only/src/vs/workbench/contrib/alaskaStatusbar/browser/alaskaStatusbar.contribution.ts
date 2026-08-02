import { localize } from '../../../../nls.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from '../../../common/contributions.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IAlaskaAuthService } from '../../alaskaChat/browser/alaskaAuthService.js';
import { IAlaskaChatService, IAlaskaUsage } from '../../alaskaChat/browser/alaskaChatService.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';

const ALASKA_STATUS_ID = 'alaska.connection.status';
const ALASKA_MODEL_ID = 'alaska.activeModel.status';
const ALASKA_TOKENS_ID = 'alaska.tokens.status';

const ACTIVE_MODEL_STORAGE_KEY = 'alaska.activeModel.id';
const ACTIVE_MODEL_LABEL_STORAGE_KEY = 'alaska.activeModel.label';
const ACTIVE_EFFORT_STORAGE_KEY = 'alaska.activeEffort';
const USAGE_REFRESH_INTERVAL_MS = 30_000;

class AlaskaStatusbarContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'alaska.statusbar';

	private statusEntry: IStatusbarEntryAccessor | undefined;
	private modelEntry: IStatusbarEntryAccessor | undefined;
	private tokensEntry: IStatusbarEntryAccessor | undefined;
	private usageTimer: ReturnType<typeof setInterval> | undefined;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@IAlaskaChatService private readonly chatService: IAlaskaChatService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		this.statusEntry = this._register(this.statusbarService.addEntry({
			name: localize('alaska.status.name', 'Alaska AI'),
			text: this.formatStatus(),
			tooltip: this.formatStatusTooltip(),
			ariaLabel: 'Alaska AI connection status',
		}, ALASKA_STATUS_ID, StatusbarAlignment.LEFT, 1000));

		this.modelEntry = this._register(this.statusbarService.addEntry({
			name: localize('alaska.model.name', 'Alaska Active Model'),
			text: this.formatModel(),
			tooltip: localize('alaska.model.tooltip', 'Active Alaska AI model + reasoning effort'),
			ariaLabel: 'Active Alaska AI model',
			command: 'workbench.action.alaskaAI.toggleChat',
		}, ALASKA_MODEL_ID, StatusbarAlignment.RIGHT, 80));

		this.tokensEntry = this._register(this.statusbarService.addEntry({
			name: localize('alaska.tokens.name', 'Alaska Credits'),
			text: this.formatCredits(0, 0),
			// allow-any-unicode-next-line
			tooltip: localize('alaska.tokens.tooltip', 'Кредиты, потраченные за текущий период тарифа.'),
			ariaLabel: 'Alaska AI credits used',
			command: 'workbench.action.alaskaAI.toggleChat',
		}, ALASKA_TOKENS_ID, StatusbarAlignment.RIGHT, 75));

		this._register(this.authService.onDidChangeState(() => this.refresh()));

		const storageListener = new DisposableStore();
		this._register(storageListener);
		storageListener.add(this.storageService.onDidChangeValue(StorageScope.APPLICATION, ACTIVE_MODEL_LABEL_STORAGE_KEY, storageListener)(() => this.refreshModel()));
		storageListener.add(this.storageService.onDidChangeValue(StorageScope.APPLICATION, ACTIVE_MODEL_STORAGE_KEY, storageListener)(() => this.refreshModel()));
		storageListener.add(this.storageService.onDidChangeValue(StorageScope.APPLICATION, ACTIVE_EFFORT_STORAGE_KEY, storageListener)(() => this.refreshModel()));

		this.usageTimer = setInterval(() => void this.fetchUsage(), USAGE_REFRESH_INTERVAL_MS);
		this._register({
			dispose: () => {
				if (this.usageTimer) {
					clearInterval(this.usageTimer);
					this.usageTimer = undefined;
				}
			}
		});

		void this.fetchUsage();
	}

	private refresh(): void {
		this.statusEntry?.update({
			name: localize('alaska.status.name', 'Alaska AI'),
			text: this.formatStatus(),
			tooltip: this.formatStatusTooltip(),
			ariaLabel: 'Alaska AI connection status',
		});
		this.refreshModel();
		void this.fetchUsage();
	}

	private refreshModel(): void {
		this.modelEntry?.update({
			name: localize('alaska.model.name', 'Alaska Active Model'),
			text: this.formatModel(),
			tooltip: localize('alaska.model.tooltip', 'Active Alaska AI model + reasoning effort'),
			ariaLabel: 'Active Alaska AI model',
			command: 'workbench.action.alaskaAI.toggleChat',
		});
	}

	private formatStatus(): string {
		const state = this.authService.state;
		if (state.status === 'signed-in') {
			return '$(circle-filled) alaska · online';
		}
		return '$(circle-outline) alaska · offline';
	}

	private formatStatusTooltip(): string {
		const state = this.authService.state;
		if (state.status === 'signed-in') {
			return state.user?.email ?? 'Signed in';
		}
		return localize('alaska.status.signedOut', 'Not signed in — run Alaska AI: Sign In');
	}

	private formatModel(): string {
		const modelLabel = this.storageService.get(ACTIVE_MODEL_LABEL_STORAGE_KEY, StorageScope.APPLICATION, '');
		const effort = this.storageService.get(ACTIVE_EFFORT_STORAGE_KEY, StorageScope.APPLICATION, '');
		if (!modelLabel) {
			return '$(sparkle) idle';
		}
		const effortGlyph = effort === 'high' || effort === 'xhigh' ? '▰' : effort === 'medium' ? '▱' : effort === 'low' ? '▪' : '·';
		const effortLabel = effort ? ` ${effortGlyph} ${effort}` : '';
		return `$(sparkle) ${modelLabel}${effortLabel}`;
	}

	private formatCredits(used: number, limit: number): string {
		if (limit <= 0 && used <= 0) {
			// allow-any-unicode-next-line
			return '$(zap) — / —';
		}
		if (limit <= 0) {
			return `$(zap) ${used}`;
		}
		const ratio = limit > 0 ? used / limit : 0;
		const warn = ratio > 0.85 ? '$(warning) ' : '';
		return `${warn}$(zap) ${used} / ${limit}`;
	}

	private async fetchUsage(): Promise<void> {
		if (this.authService.state.status !== 'signed-in') {
			this.tokensEntry?.update({
				name: localize('alaska.tokens.name', 'Alaska Token Budget'),
				text: '$(graph) signed out',
				tooltip: localize('alaska.tokens.tooltip.signedOut', 'Sign in to see token usage'),
				ariaLabel: 'Alaska AI token budget',
			});
			return;
		}
		try {
			const usage = await this.chatService.usage(CancellationToken.None);
			const creditsUsed = usage.credits_used ?? 0;
			const creditsLimit = usage.weekly_budget ?? usage.limit ?? 0;
			this.tokensEntry?.update({
				name: localize('alaska.tokens.name', 'Alaska Credits'),
				text: this.formatCredits(creditsUsed, creditsLimit),
				tooltip: this.formatUsageTooltip(usage),
				ariaLabel: 'Alaska AI credits used',
				command: 'workbench.action.alaskaAI.toggleChat',
			});
		} catch {
			this.tokensEntry?.update({
				name: localize('alaska.tokens.name', 'Alaska Credits'),
				// allow-any-unicode-next-line
				text: '$(zap) —',
				// allow-any-unicode-next-line
				tooltip: localize('alaska.tokens.tooltipFail', 'Не удалось получить использование. Проверьте подключение.'),
				ariaLabel: 'Alaska AI credits used',
				command: 'workbench.action.alaskaAI.toggleChat',
			});
		}
	}

	private formatUsageTooltip(usage: IAlaskaUsage): string {
		const creditsUsed = usage.credits_used ?? 0;
		const creditsLimit = usage.weekly_budget ?? usage.limit ?? 0;
		const tokensTotal = (usage.input ?? 0) + (usage.output ?? 0);
		const lines = [
			// allow-any-unicode-next-line
			`Тариф: ${usage.plan}`,
			// allow-any-unicode-next-line
			`Период: ${usage.period}`,
			// allow-any-unicode-next-line
			`Кредиты: ${creditsUsed} / ${creditsLimit || '∞'}`,
			// allow-any-unicode-next-line
			`Запросов: ${usage.requests}`,
			// allow-any-unicode-next-line
			`Токены за период: ${formatStatusbarTokens(tokensTotal)} (вх ${formatStatusbarTokens(usage.input ?? 0)} / вых ${formatStatusbarTokens(usage.output ?? 0)})`,
		];
		return lines.join('\n');
	}
}

function formatStatusbarTokens(n: number): string {
	if (n < 1000) { return String(n); }
	if (n < 10_000) { return `${(n / 1000).toFixed(1)}k`; }
	if (n < 1_000_000) { return `${Math.round(n / 1000)}k`; }
	return `${(n / 1_000_000).toFixed(2)}M`;
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaStatusbarContribution,
	LifecyclePhase.Restored,
);
