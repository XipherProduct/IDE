/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModel } from '../../../../editor/common/model.js';
import {
	AlaskaCompletionMode,
	IAlaskaCompletionService,
	ALASKA_COMPLETION_ENABLED,
	ALASKA_COMPLETION_MODE,
	ALASKA_COMPLETION_TIER,
	ALASKA_COMPLETION_LANGUAGES,
	ALASKA_COMPLETION_DEBOUNCE,
	ALASKA_COMPLETION_MAX_TOKENS,
	ALASKA_COMPLETION_DEFAULT_DEBOUNCE_MS,
	ALASKA_COMPLETION_DEFAULT_MAX_TOKENS,
} from '../common/alaskaCompletion.js';
import { AlaskaCompletionService } from './alaskaCompletionService.js';
import { AlaskaInlineCompletionProvider } from './alaskaInlineCompletionProvider.js';

const RECENT_EDIT_MAX_DOC_BYTES = 50_000;

registerSingleton(IAlaskaCompletionService, AlaskaCompletionService, InstantiationType.Delayed);

class AlaskaCompletionRegistrationContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.completion.register';

	private readonly provider: AlaskaInlineCompletionProvider;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ILanguageFeaturesService languageFeatures: ILanguageFeaturesService,
		@IModelService modelService: IModelService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.provider = this._register(instantiationService.createInstance(AlaskaInlineCompletionProvider));
		this._register(languageFeatures.inlineCompletionsProvider.register('*', this.provider));

		for (const model of modelService.getModels()) {
			this.wireModel(model);
		}
		this._register(modelService.onModelAdded(model => this.wireModel(model)));
		this._register(modelService.onModelRemoved(model => this.provider.invalidateFile(model.uri.toString())));
	}

	private wireModel(model: ITextModel): void {
		const uri = model.uri.toString();
		this._register(model.onDidChangeContent(() => {
			if (model.getValueLength() > RECENT_EDIT_MAX_DOC_BYTES) {
				return;
			}
			try {
				this.provider.pushRecentEdit(uri, model.getValue());
			} catch (err) {
				this.logService.trace('[alaska.completion] pushRecentEdit failed', err);
			}
		}));
		this._register(model.onWillDispose(() => this.provider.invalidateFile(uri)));
	}
}

registerWorkbenchContribution2(
	AlaskaCompletionRegistrationContribution.ID,
	AlaskaCompletionRegistrationContribution,
	WorkbenchPhase.Eventually,
);

class AlaskaCompletionStatusContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'alaska.completion.status';

	private entry: IStatusbarEntryAccessor | undefined;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IAlaskaCompletionService private readonly completionService: IAlaskaCompletionService,
	) {
		super();
		this.update();
		this._register(this.completionService.onDidChangeStatus(() => this.update()));
	}

	private update(): void {
		const mode = this.completionService.getMode();
		const enabled = this.completionService.status.enabled;
		const text = !enabled
			? '$(circle-slash) Tab off'
			: mode === 'manual'
				? '$(record-keys) Tab manual'
				: '$(sparkle) Tab auto';
		const tooltip = enabled
			? localize('alaska.completion.status.tooltip', 'Alaska AI inline completion: {0}', mode)
			: localize('alaska.completion.status.tooltipOff', 'Alaska AI inline completion is off');
		const props = {
			name: localize('alaska.completion.status.name', 'Alaska AI Inline Completion'),
			text,
			ariaLabel: tooltip,
			tooltip,
			command: AlaskaCompletionCycleModeAction.ID,
		};
		if (this.entry) {
			this.entry.update(props);
		} else {
			this.entry = this._register(this.statusbarService.addEntry(
				props,
				AlaskaCompletionStatusContribution.ID,
				StatusbarAlignment.RIGHT,
				95,
			));
		}
	}
}

registerWorkbenchContribution2(
	AlaskaCompletionStatusContribution.ID,
	AlaskaCompletionStatusContribution,
	WorkbenchPhase.Eventually,
);

class AlaskaCompletionToggleAction extends Action2 {
	static readonly ID = 'alaskaAI.toggleCompletion';
	constructor() {
		super({
			id: AlaskaCompletionToggleAction.ID,
			title: localize2('alaska.toggleCompletion', 'Alaska AI: Toggle Tab Completion'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IAlaskaCompletionService).toggleEnabled();
	}
}

class AlaskaCompletionTriggerAction extends Action2 {
	static readonly ID = 'alaskaAI.triggerCompletion';
	constructor() {
		super({
			id: AlaskaCompletionTriggerAction.ID,
			title: localize2('alaska.triggerCompletion', 'Alaska AI: Trigger Inline Completion'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.Alt | KeyCode.Backslash,
			},
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(ICommandService).executeCommand('editor.action.inlineSuggest.trigger');
	}
}

class AlaskaCompletionCycleModeAction extends Action2 {
	static readonly ID = 'alaskaAI.cycleCompletionMode';
	constructor() {
		super({
			id: AlaskaCompletionCycleModeAction.ID,
			title: localize2('alaska.cycleCompletionMode', 'Alaska AI: Pick Inline Completion Mode'),
			category: { value: 'Alaska AI', original: 'Alaska AI' },
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const completion = accessor.get(IAlaskaCompletionService);
		const quickInput = accessor.get(IQuickInputService);
		const current = completion.getMode();
		const items: Array<{ id: AlaskaCompletionMode; label: string; description?: string }> = [
			{ id: 'auto', label: localize('alaska.completion.mode.auto', 'Auto — fires on typing pause'), description: current === 'auto' ? localize('alaska.completion.mode.current', 'Current') : undefined },
			{ id: 'manual', label: localize('alaska.completion.mode.manual', 'Manual — only on Alt+\\'), description: current === 'manual' ? localize('alaska.completion.mode.current', 'Current') : undefined },
			{ id: 'off', label: localize('alaska.completion.mode.off', 'Off — disable inline completions'), description: current === 'off' ? localize('alaska.completion.mode.current', 'Current') : undefined },
		];
		const picked = await quickInput.pick(items, {
			placeHolder: localize('alaska.completion.mode.placeholder', 'Inline completion mode'),
		});
		if (!picked) { return; }
		await completion.setMode(picked.id);
	}
}

registerAction2(AlaskaCompletionToggleAction);
registerAction2(AlaskaCompletionTriggerAction);
registerAction2(AlaskaCompletionCycleModeAction);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'alaska.completion',
	order: 100,
	title: localize('alaska.completion.configTitle', 'Alaska AI Inline Completions'),
	type: 'object',
	properties: {
		[ALASKA_COMPLETION_ENABLED]: {
			type: 'boolean',
			default: true,
			description: localize('alaska.completion.enabledDesc', 'Enable Alaska AI inline tab completions.'),
		},
		[ALASKA_COMPLETION_MODE]: {
			type: 'string',
			enum: ['auto', 'manual', 'off'],
			enumDescriptions: [
				localize('alaska.completion.mode.auto.desc', 'Trigger automatically after typing pause.'),
				localize('alaska.completion.mode.manual.desc', 'Trigger only when you press Alt+\\.'),
				localize('alaska.completion.mode.off.desc', 'Disable inline completions.'),
			],
			default: 'auto',
			description: localize('alaska.completion.modeDesc', 'When inline completions are produced.'),
		},
		[ALASKA_COMPLETION_TIER]: {
			type: 'string',
			enum: ['fast', 'balanced'],
			enumDescriptions: [
				localize('alaska.completion.tier.fast.desc', 'Fastest model (GPT 5.4 Mini). Lower quality, lower latency.'),
				localize('alaska.completion.tier.balanced.desc', 'Balanced model (Claude Haiku 4.5). Higher quality, slightly higher latency.'),
			],
			default: 'fast',
			description: localize('alaska.completion.tierDesc', 'Model tier used for inline completions.'),
		},
		[ALASKA_COMPLETION_LANGUAGES]: {
			type: 'object',
			default: { 'plaintext': false, 'markdown': false, 'binary': false, 'log': false },
			description: localize('alaska.completion.languagesDesc', 'Per-language toggle. Set "<langId>": false to disable inline completions for that language.'),
			additionalProperties: { type: 'boolean' },
		},
		[ALASKA_COMPLETION_DEBOUNCE]: {
			type: 'number',
			default: ALASKA_COMPLETION_DEFAULT_DEBOUNCE_MS,
			minimum: 100,
			maximum: 1000,
			description: localize('alaska.completion.debounceDesc', 'Wait (ms) after the last keystroke before requesting a completion.'),
		},
		[ALASKA_COMPLETION_MAX_TOKENS]: {
			type: 'number',
			default: ALASKA_COMPLETION_DEFAULT_MAX_TOKENS,
			minimum: 32,
			maximum: 512,
			description: localize('alaska.completion.maxTokensDesc', 'Maximum tokens emitted by the model for a single completion.'),
		},
	},
});
