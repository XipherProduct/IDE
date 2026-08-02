
import './media/alaskaChat.css';
import { localize } from '../../../../nls.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { IEditorOpenContext, IEditorSerializer, IUntypedEditorInput } from '../../../common/editor.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IAlaskaChatService, IAlaskaModel, ALASKA_REASONING_EFFORTS, type AlaskaReasoningEffort } from './alaskaChatService.js';
import { IAlaskaAuthService } from './alaskaAuthService.js';
import { IAlaskaBYOService, ALASKA_BYO_PROVIDERS, AlaskaBYOProvider } from '../common/alaskaByo.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { Dimension, $, append, clearNode } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';

const ALASKA_SETTINGS_INPUT_TYPE_ID = 'workbench.editors.alaskaSettingsInput';
const ALASKA_SETTINGS_EDITOR_ID = 'workbench.editor.alaskaSettings';
const REASONING_EFFORT_STORAGE_KEY = 'alaska.chat.reasoningEffort';
const AUTO_CONTINUE_STORAGE_KEY = 'alaska.chat.autoContinue';

const ALASKA_PLAN_RANK: Record<string, number> = { free: 0, pro: 1, max: 2, team: 2, ultra: 3 };

function planAllows(userPlan: string, required: string): boolean {
	return (ALASKA_PLAN_RANK[userPlan] ?? -1) >= (ALASKA_PLAN_RANK[required] ?? 0);
}

export class AlaskaSettingsInput extends EditorInput {
	static readonly ID = ALASKA_SETTINGS_INPUT_TYPE_ID;
	static readonly RESOURCE = URI.from({ scheme: Schemas.walkThrough, authority: 'alaska_settings_page' });

	override get typeId(): string { return AlaskaSettingsInput.ID; }
	override get editorId(): string | undefined { return ALASKA_SETTINGS_EDITOR_ID; }
	override get resource(): URI | undefined { return AlaskaSettingsInput.RESOURCE; }

	override getName(): string {
		return localize('alaska.settings.title', 'Xipher IDE Settings');
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		return super.matches(other) || other instanceof AlaskaSettingsInput;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: AlaskaSettingsInput.RESOURCE,
			options: { override: AlaskaSettingsInput.ID, pinned: true },
		};
	}
}

export class AlaskaSettingsInputSerializer implements IEditorSerializer {
	canSerialize(): boolean { return true; }
	serialize(): string { return ''; }
	deserialize(instantiationService: IInstantiationService): AlaskaSettingsInput {
		return instantiationService.createInstance(AlaskaSettingsInput);
	}
}

export class AlaskaSettingsEditor extends EditorPane {
	static readonly ID = ALASKA_SETTINGS_EDITOR_ID;

	private container?: HTMLElement;
	private models: IAlaskaModel[] = [];
	private modelsLoading?: Promise<void>;
	private userPlan = 'free';
	private selectedEffort: AlaskaReasoningEffort = 'medium';
	private autoContinue = false;
	private selectedModelId?: string;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService private readonly _storageService: IStorageService,
		@IAlaskaChatService private readonly chatService: IAlaskaChatService,
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IAlaskaBYOService private readonly byoService: IAlaskaBYOService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super(AlaskaSettingsEditor.ID, group, telemetryService, themeService, _storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.alaska-settings-root'));
		this.container = root;
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this.loadPreferences();
		void this.ensureModels();
		this.render();
	}

	override layout(dimension: Dimension): void {
		if (this.container) {
			this.container.style.width = `${dimension.width}px`;
			this.container.style.height = `${dimension.height}px`;
		}
	}

	private loadPreferences(): void {
		const raw = this._storageService.get(REASONING_EFFORT_STORAGE_KEY, StorageScope.WORKSPACE, '');
		if ((ALASKA_REASONING_EFFORTS as readonly string[]).includes(raw)) {
			this.selectedEffort = raw as AlaskaReasoningEffort;
		}
		this.autoContinue = this._storageService.getBoolean(AUTO_CONTINUE_STORAGE_KEY, StorageScope.WORKSPACE, false);
		this.userPlan = this.authService.state.user?.plan ?? 'free';
	}

	private async ensureModels(): Promise<void> {
		if (this.models.length > 0) { return; }
		if (this.modelsLoading) { return this.modelsLoading; }
		const src = new CancellationTokenSource();
		this.modelsLoading = this.chatService.models(src.token)
			.then(resp => {
				this.models = resp.items;
				this.userPlan = resp.plan || this.userPlan;
				if (!this.selectedModelId && this.models.length > 0) {
					this.selectedModelId = this.models[0].id;
				}
				this.render();
			})
			.catch(() => { /* keep empty */ })
			.finally(() => { this.modelsLoading = undefined; src.dispose(); });
		return this.modelsLoading;
	}

	private render(): void {
		const c = this.container;
		if (!c) { return; }
		clearNode(c);

		const page = append(c, $('.alaska-settings-page'));
		const inner = append(page, $('.alaska-settings-inner'));

		const head = append(inner, $('.alaska-settings-head'));
		const title = append(head, $('h1.alaska-settings-title')) as HTMLElement;
		title.textContent = localize('alaska.settings.heading', 'Xipher IDE Settings');
		const subtitle = append(head, $('p.alaska-settings-subtitle')) as HTMLElement;
		subtitle.textContent = localize('alaska.settings.subtitle', 'Account, models, and chat preferences for this IDE install.');

		const body = append(inner, $('.alaska-settings-body'));
		body.appendChild(this.buildAccountCard());
		body.appendChild(this.buildModelsCard());
		body.appendChild(this.buildPreferencesCard());
		body.appendChild(this.buildBYOCard());
	}

	private buildBYOCard(): HTMLElement {
		const card = $('section.alaska-settings-card');
		const heading = $('h3.alaska-settings-card-heading');
		heading.textContent = localize('alaska.settings.byo.heading', 'Bring Your Own API Key');
		card.appendChild(heading);
		const hint = $('p.alaska-settings-hint');
		hint.textContent = localize('alaska.settings.byo.hint', 'Route requests directly to your provider — bypasses the Alaska gateway and quota. ULTRA plan only.');
		card.appendChild(hint);

		const isUltra = this.userPlan.toLowerCase() === 'ultra';
		if (!isUltra) {
			const lock = $('.alaska-settings-byo-lock');
			lock.textContent = localize('alaska.settings.byo.locked', 'Available on the ULTRA plan. Upgrade to enable BYO.');
			card.appendChild(lock);
			return card;
		}

		const cfg = this.byoService.getConfig();

		const enableRow = $('.alaska-settings-pref-row');
		const enableLabel = $('.alaska-settings-pref-label');
		const enableTitle = $('strong');
		enableTitle.textContent = localize('alaska.settings.byo.enable', 'Use your own API key');
		enableLabel.appendChild(enableTitle);
		const enableSub = $('span');
		enableSub.textContent = localize('alaska.settings.byo.enableHint', 'When enabled, Xipher IDE bypasses our gateway and calls the provider directly.');
		enableLabel.appendChild(enableSub);
		enableRow.appendChild(enableLabel);
		const toggle = $(`button.alaska-settings-toggle${cfg.enabled ? '.alaska-settings-toggle-on' : ''}`) as HTMLButtonElement;
		toggle.type = 'button';
		toggle.setAttribute('role', 'switch');
		toggle.setAttribute('aria-checked', cfg.enabled ? 'true' : 'false');
		toggle.appendChild($('span'));
		toggle.addEventListener('click', async () => {
			await this.byoService.setEnabled(!cfg.enabled);
			this.render();
		});
		enableRow.appendChild(toggle);
		card.appendChild(enableRow);

		const providerRow = $('.alaska-settings-pref-row');
		const providerLabel = $('.alaska-settings-pref-label');
		const providerTitle = $('strong');
		providerTitle.textContent = localize('alaska.settings.byo.provider', 'Provider');
		providerLabel.appendChild(providerTitle);
		const providerSub = $('span');
		providerSub.textContent = localize('alaska.settings.byo.providerHint', 'Anthropic uses Messages API. OpenAI/OpenRouter/Custom use OpenAI-compatible.');
		providerLabel.appendChild(providerSub);
		providerRow.appendChild(providerLabel);
		const segments = $('.alaska-settings-segmented');
		for (const p of ALASKA_BYO_PROVIDERS) {
			const seg = $(`button.alaska-settings-segment${p === cfg.provider ? '.alaska-settings-segment-active' : ''}`) as HTMLButtonElement;
			seg.type = 'button';
			seg.textContent = p;
			seg.addEventListener('click', async () => {
				await this.byoService.setProvider(p as AlaskaBYOProvider);
				this.render();
			});
			segments.appendChild(seg);
		}
		providerRow.appendChild(segments);
		card.appendChild(providerRow);

		if (cfg.provider === 'custom') {
			const urlRow = $('.alaska-settings-pref-row');
			const urlLabel = $('.alaska-settings-pref-label');
			const urlTitle = $('strong');
			urlTitle.textContent = localize('alaska.settings.byo.customUrl', 'Custom base URL');
			urlLabel.appendChild(urlTitle);
			const urlSub = $('span');
			urlSub.textContent = localize('alaska.settings.byo.customUrlHint', 'Must use HTTPS and an OpenAI-compatible /chat/completions endpoint.');
			urlLabel.appendChild(urlSub);
			urlRow.appendChild(urlLabel);
			const input = $('input.alaska-settings-input') as HTMLInputElement;
			input.type = 'url';
			input.placeholder = 'https://api.example.com/v1';
			input.value = cfg.baseUrl;
			input.addEventListener('change', async () => {
				try {
					await this.byoService.setCustomBaseUrl(input.value);
				} catch (err) {
					this.notificationService.warn(err instanceof Error ? err.message : String(err));
				}
			});
			urlRow.appendChild(input);
			card.appendChild(urlRow);
		}

		const modelRow = $('.alaska-settings-pref-row');
		const modelLabel = $('.alaska-settings-pref-label');
		const modelTitle = $('strong');
		modelTitle.textContent = localize('alaska.settings.byo.model', 'Model id (optional)');
		modelLabel.appendChild(modelTitle);
		const modelSub = $('span');
		modelSub.textContent = localize('alaska.settings.byo.modelHint', 'Override the model id sent to your provider. Leave blank to use the Alaska picker.');
		modelLabel.appendChild(modelSub);
		modelRow.appendChild(modelLabel);
		const modelInput = $('input.alaska-settings-input') as HTMLInputElement;
		modelInput.type = 'text';
		modelInput.placeholder = cfg.provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o';
		modelInput.value = cfg.model ?? '';
		modelInput.addEventListener('change', async () => {
			await this.byoService.setModel(modelInput.value);
		});
		modelRow.appendChild(modelInput);
		card.appendChild(modelRow);

		const keyRow = $('.alaska-settings-pref-row');
		const keyLabel = $('.alaska-settings-pref-label');
		const keyTitle = $('strong');
		keyTitle.textContent = localize('alaska.settings.byo.key', 'API key');
		keyLabel.appendChild(keyTitle);
		const keySub = $('span');
		keySub.textContent = cfg.hasKey
			? localize('alaska.settings.byo.keyStored', 'A key is stored in the OS keychain. Replace below or clear it.')
			: localize('alaska.settings.byo.keyHint', 'Stored encrypted in the OS keychain — never sent to Alaska servers.');
		keyLabel.appendChild(keySub);
		keyRow.appendChild(keyLabel);
		const keyControls = $('.alaska-settings-byo-key-controls');
		const keyInput = $('input.alaska-settings-input') as HTMLInputElement;
		keyInput.type = 'password';
		keyInput.placeholder = 'sk-…';
		keyControls.appendChild(keyInput);
		const saveBtn = $('button.alaska-button.alaska-button-secondary') as HTMLButtonElement;
		saveBtn.type = 'button';
		saveBtn.textContent = localize('alaska.settings.byo.save', 'Save');
		saveBtn.addEventListener('click', async () => {
			try {
				await this.byoService.setApiKey(keyInput.value);
				keyInput.value = '';
				this.notificationService.info(localize('alaska.settings.byo.saved', 'BYO API key saved.'));
				this.render();
			} catch (err) {
				this.notificationService.warn(err instanceof Error ? err.message : String(err));
			}
		});
		keyControls.appendChild(saveBtn);
		if (cfg.hasKey) {
			const clearBtn = $('button.alaska-button.alaska-button-secondary') as HTMLButtonElement;
			clearBtn.type = 'button';
			clearBtn.textContent = localize('alaska.settings.byo.clear', 'Clear');
			clearBtn.addEventListener('click', async () => {
				await this.byoService.clearApiKey();
				this.notificationService.info(localize('alaska.settings.byo.cleared', 'BYO API key cleared.'));
				this.render();
			});
			keyControls.appendChild(clearBtn);
		}
		keyRow.appendChild(keyControls);
		card.appendChild(keyRow);

		return card;
	}

	private buildAccountCard(): HTMLElement {
		const card = $('section.alaska-settings-card');
		const heading = $('h3.alaska-settings-card-heading');
		heading.textContent = 'Account';
		card.appendChild(heading);

		const row = $('.alaska-settings-account-row');
		const user = this.authService.state.user;

		const left = $('.alaska-settings-account-left');
		const name = $('.alaska-settings-account-name');
		name.textContent = user?.name || user?.email || 'Not signed in';
		left.appendChild(name);
		if (user?.email && user?.name) {
			const email = $('.alaska-settings-account-email');
			email.textContent = user.email;
			left.appendChild(email);
		}
		row.appendChild(left);

		if (user?.plan) {
			const tag = $(`span.alaska-settings-plan-tag.alaska-settings-plan-${user.plan}`);
			tag.textContent = user.plan.toUpperCase();
			row.appendChild(tag);
		}
		card.appendChild(row);

		const links = $('.alaska-settings-link-row');
		const billing = $('a.alaska-settings-link') as HTMLAnchorElement;
		billing.textContent = 'Manage plan & billing →';
		billing.href = 'https://alaska-ai.shop/dashboard/billing';
		billing.addEventListener('click', e => {
			e.preventDefault();
			void this.openerService.open(URI.parse(billing.href));
		});
		links.appendChild(billing);
		const usage = $('a.alaska-settings-link') as HTMLAnchorElement;
		usage.textContent = 'Usage dashboard →';
		usage.href = 'https://alaska-ai.shop/dashboard/usage';
		usage.addEventListener('click', e => {
			e.preventDefault();
			void this.openerService.open(URI.parse(usage.href));
		});
		links.appendChild(usage);
		card.appendChild(links);

		return card;
	}

	private buildModelsCard(): HTMLElement {
		const card = $('section.alaska-settings-card');
		const heading = $('h3.alaska-settings-card-heading');
		heading.textContent = 'Models';
		card.appendChild(heading);
		const hint = $('p.alaska-settings-hint');
		hint.textContent = 'Available models for your plan. Locked rows require a plan upgrade.';
		card.appendChild(hint);

		const list = $('.alaska-settings-model-list');
		if (this.models.length === 0) {
			const empty = $('.alaska-settings-model-empty');
			empty.textContent = this.modelsLoading ? 'Loading…' : 'No models available.';
			list.appendChild(empty);
		}
		for (const model of this.models) {
			const allowed = planAllows(this.userPlan, model.requires_plan);
			const item = $(`.alaska-settings-model-item${allowed ? '' : '.alaska-settings-model-locked'}`);

			const head = $('.alaska-settings-model-head');
			const indicator = $('span.alaska-settings-model-indicator');
			indicator.appendChild($(ThemeIcon.asCSSSelector(allowed ? Codicon.passFilled : Codicon.lock)));
			head.appendChild(indicator);

			const label = $('strong.alaska-settings-model-label');
			label.textContent = model.label;
			head.appendChild(label);

			const plan = $(`span.alaska-settings-model-plan.alaska-settings-plan-${model.requires_plan}`);
			plan.textContent = model.requires_plan.toUpperCase();
			head.appendChild(plan);

			if (model.supports_reasoning_effort) {
				const cap = $('span.alaska-settings-model-cap');
				cap.textContent = 'reasoning_effort';
				head.appendChild(cap);
			}

			item.appendChild(head);

			const desc = $('p.alaska-settings-model-desc');
			desc.textContent = model.description;
			item.appendChild(desc);

			const meta = $('.alaska-settings-model-meta');
			const ctx = $('span');
			ctx.textContent = `${Math.round(model.context_tokens / 1000)}k context`;
			meta.appendChild(ctx);
			item.appendChild(meta);

			list.appendChild(item);
		}
		card.appendChild(list);
		return card;
	}

	private buildPreferencesCard(): HTMLElement {
		const card = $('section.alaska-settings-card');
		const heading = $('h3.alaska-settings-card-heading');
		heading.textContent = 'Preferences';
		card.appendChild(heading);

		const effortRow = $('.alaska-settings-pref-row');
		const effortLabel = $('.alaska-settings-pref-label');
		const effortTitle = $('strong');
		effortTitle.textContent = 'Default reasoning effort';
		effortLabel.appendChild(effortTitle);
		const effortHint = $('span');
		effortHint.textContent = 'Applies to gpt-5.4, gpt-5.4-mini, gpt-5.5. Higher = slower, more thorough.';
		effortLabel.appendChild(effortHint);
		effortRow.appendChild(effortLabel);

		const segments = $('.alaska-settings-segmented');
		for (const v of ALASKA_REASONING_EFFORTS) {
			const seg = $(`button.alaska-settings-segment${v === this.selectedEffort ? '.alaska-settings-segment-active' : ''}`) as HTMLButtonElement;
			seg.type = 'button';
			seg.textContent = v;
			seg.addEventListener('click', () => {
				this.selectedEffort = v;
				this._storageService.store(REASONING_EFFORT_STORAGE_KEY, v, StorageScope.WORKSPACE, StorageTarget.USER);
				this.render();
			});
			segments.appendChild(seg);
		}
		effortRow.appendChild(segments);
		card.appendChild(effortRow);

		const autoRow = $('.alaska-settings-pref-row');
		const autoLabel = $('.alaska-settings-pref-label');
		const autoTitle = $('strong');
		autoTitle.textContent = 'Auto-continue on length cap';
		autoLabel.appendChild(autoTitle);
		const autoHint = $('span');
		autoHint.textContent = 'When upstream cuts the answer mid-flight, automatically resume. Stops on natural finish or 30-min wallclock.';
		autoLabel.appendChild(autoHint);
		autoRow.appendChild(autoLabel);

		const toggle = $(`button.alaska-settings-toggle${this.autoContinue ? '.alaska-settings-toggle-on' : ''}`) as HTMLButtonElement;
		toggle.type = 'button';
		toggle.setAttribute('role', 'switch');
		toggle.setAttribute('aria-checked', this.autoContinue ? 'true' : 'false');
		toggle.appendChild($('span'));
		toggle.addEventListener('click', () => {
			this.autoContinue = !this.autoContinue;
			this._storageService.store(AUTO_CONTINUE_STORAGE_KEY, this.autoContinue, StorageScope.WORKSPACE, StorageTarget.USER);
			this.render();
		});
		autoRow.appendChild(toggle);
		card.appendChild(autoRow);

		return card;
	}
}
