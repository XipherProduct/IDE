import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IWalkthroughsService } from '../../welcomeGettingStarted/browser/gettingStartedService.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { FileAccess } from '../../../../base/common/network.js';

const FIRST_RUN_STORAGE_KEY = 'alaska.onboarding.firstRun.v1';

class AlaskaOnboardingContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'alaska.onboarding';

	constructor(
		@IWalkthroughsService walkthroughService: IWalkthroughsService,
		@IStorageService storageService: IStorageService,
		@ICommandService commandService: ICommandService,
	) {
		super();

		const trueExpr = ContextKeyExpr.true();

		walkthroughService.registerWalkthrough({
			id: 'alaska.onboarding',
			title: localize('alaska.onboarding.title', 'Welcome to Xipher IDE'),
			description: localize('alaska.onboarding.description', 'Connect your account, pick a model, and try the chat — 4 quick steps.'),
			order: -1,
			source: 'Xipher IDE',
			isFeatured: true,
			when: trueExpr,
			walkthroughPageTitle: localize('alaska.onboarding.pageTitle', 'Xipher IDE Onboarding'),
			icon: { type: 'icon', icon: ThemeIcon.fromId(Codicon.sparkle.id) },
			steps: [
				{
					id: 'alaska.onboarding.connect',
					title: localize('alaska.onboarding.connect.title', 'Connect your Xipher IDE account'),
					description: localize('alaska.onboarding.connect.desc', 'Sign in through the browser to enable the chat and tools. [Connect account](command:alaskaAI.signIn)'),
					category: 'alaska.onboarding',
					when: trueExpr,
					order: 0,
					completionEvents: ['onCommand:alaskaAI.signIn'],
					media: { type: 'svg', altText: 'Xipher IDE', path: FileAccess.asFileUri('vs/workbench/contrib/welcomeGettingStarted/common/media/ai-powered-suggestions.svg') },
				},
				{
					id: 'alaska.onboarding.pickModel',
					title: localize('alaska.onboarding.pickModel.title', 'Pick a model'),
					description: localize('alaska.onboarding.pickModel.desc', 'Choose the model that fits your task: Grok 4 fast for everyday edits, Opus for tough refactors. [Open chat](command:workbench.action.alaskaAI.toggleChat)'),
					category: 'alaska.onboarding',
					when: trueExpr,
					order: 1,
					completionEvents: ['onCommand:workbench.action.alaskaAI.toggleChat'],
					media: { type: 'svg', altText: 'Xipher IDE', path: FileAccess.asFileUri('vs/workbench/contrib/welcomeGettingStarted/common/media/ai-powered-suggestions.svg') },
				},
				{
					id: 'alaska.onboarding.tryChat',
					title: localize('alaska.onboarding.tryChat.title', 'Try the chat — ask about a file'),
					description: localize('alaska.onboarding.tryChat.desc', 'Open any file, then ask the chat to explain or refactor it. The active selection is sent as code_context automatically.'),
					category: 'alaska.onboarding',
					when: trueExpr,
					order: 2,
					completionEvents: ['onCommand:alaska.chat.newThread'],
					media: { type: 'svg', altText: 'Xipher IDE', path: FileAccess.asFileUri('vs/workbench/contrib/welcomeGettingStarted/common/media/ai-powered-suggestions.svg') },
				},
				{
					id: 'alaska.onboarding.coordinates',
					title: localize('alaska.onboarding.coord.title', 'Workspace coordinates'),
					description: localize('alaska.onboarding.coord.desc', 'The Compass icon in the activity bar opens a snapshot of your workspace — files indexed, branches, runtime. [Open coordinates](command:alaska.openCoordinates)'),
					category: 'alaska.onboarding',
					when: trueExpr,
					order: 3,
					completionEvents: ['onCommand:alaska.openCoordinates'],
					media: { type: 'svg', altText: 'Xipher IDE', path: FileAccess.asFileUri('vs/workbench/contrib/welcomeGettingStarted/common/media/ai-powered-suggestions.svg') },
				},
				{
					id: 'alaska.onboarding.settings',
					title: localize('alaska.onboarding.settings.title', 'Tune Xipher IDE settings'),
					description: localize('alaska.onboarding.settings.desc', 'Permissions, plan approval mode, run-command trust — all live in the dedicated settings editor. [Open Xipher settings](command:alaska.chat.openSettings)'),
					category: 'alaska.onboarding',
					when: trueExpr,
					order: 4,
					completionEvents: ['onCommand:alaska.chat.openSettings'],
					media: { type: 'svg', altText: 'Xipher IDE', path: FileAccess.asFileUri('vs/workbench/contrib/welcomeGettingStarted/common/media/ai-powered-suggestions.svg') },
				},
			],
		});

		const firstRun = !storageService.getBoolean(FIRST_RUN_STORAGE_KEY, StorageScope.APPLICATION, false);
		if (firstRun) {
			storageService.store(FIRST_RUN_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
			void commandService.executeCommand('workbench.action.openWalkthrough', { category: 'alaska.onboarding' });
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaOnboardingContribution,
	LifecyclePhase.Eventually,
);
