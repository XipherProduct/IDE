/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/alaskaChat.css';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { renderMarkdown } from '../../../../base/browser/markdownRenderer.js';
import { mainWindow } from '../../../../base/browser/window.js';
import * as DOM from '../../../../base/browser/dom.js';
import { safeIntl } from '../../../../base/common/date.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IFileDialogService, IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { encodeBase64, VSBuffer } from '../../../../base/common/buffer.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { Schemas } from '../../../../base/common/network.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { DocumentSymbol, SymbolKind } from '../../../../editor/common/languages.js';
import { IRange, Range } from '../../../../editor/common/core/range.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { getWorkspaceSymbols } from '../../search/common/search.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ITerminalService, ITerminalInstance } from '../../../contrib/terminal/browser/terminal.js';
import { ITerminalProfileService } from '../../../contrib/terminal/common/terminal.js';
import { TerminalLocation, TerminalExitReason } from '../../../../platform/terminal/common/terminal.js';
import { OperatingSystem, OS } from '../../../../base/common/platform.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IRequestService, asText } from '../../../../platform/request/common/request.js';
// eslint-disable-next-line no-duplicate-imports
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IAlaskaMcpService, IMcpToolInfo } from '../../../../platform/alaskaMcp/common/alaskaMcp.js';
import { IAlaskaTool } from './alaskaTools.js';
import { IAlaskaAuthService, IAlaskaAuthState, IDeviceFlowProgress } from './alaskaAuthService.js';
import { IAlaskaChatService, IAlaskaChatMessage, IAlaskaContentPart, IAlaskaModel, IAlaskaUsage, ALASKA_REASONING_EFFORTS, type AlaskaReasoningEffort } from './alaskaChatService.js';
import { AlaskaSettingsInput } from './alaskaSettingsEditor.js';
import { IAlaskaContextService } from './alaskaContextService.js';
import { IAlaskaActivityService } from './alaskaActivityService.js';
import { IAlaskaIndexService } from './alaskaIndex.js';
// eslint-disable-next-line no-duplicate-imports
import { AlaskaToolExecutor, IAlaskaToolCall, IAlaskaToolResult, TOOL_DEFINITIONS, tryStablePath, tryPartialContent, tryPartialReplace, partialArgsMissingPath, evaluateRunCommandDenial, isReadOnlyRunCommand, buildRunCommandShellPlan, detectMojibake, stripAnsi as stripAnsiSeq, RUN_COMMAND_TRUST_KEY, RunCommandTrustLevel, ALASKA_PERMISSION_MODE_KEY, AlaskaPermissionMode, ALASKA_PERMISSION_MODES, isReadOnlyToolName } from './alaskaTools.js';
import { ISearchService } from '../../../services/search/common/search.js';
// eslint-disable-next-line no-duplicate-imports
import { IAlaskaPinnedFile, IAlaskaPinnedFolder, IAlaskaPinnedUrl, IAlaskaCodeDiagnostic, IAlaskaIndexContextHit } from './alaskaContextService.js';
import { IAlaskaPendingEditsService, IAlaskaPendingEdit } from './alaskaPendingEdits.js';
import { IAlaskaAgentModeService } from '../common/alaskaAgentMode.js';
import { AlaskaAgentMode, ALASKA_AGENT_MODES, ITaskItem, parseTasklist, parseCompletedSteps } from '../common/alaskaAgentMode.js';
import { IAlaskaSlashCommand, IAlaskaSlashCommandService, IAlaskaSlashContext } from '../common/alaskaSlash.js';
import { IAlaskaGoalService } from '../common/alaskaGoal.js';
import { IAlaskaReminderService, IReadRecord } from '../common/alaskaReminder.js';
import { IAlaskaHunkTrackerService } from '../common/alaskaHunkTracker.js';
import { exportSessionAsMarkdown, IExportableSession } from '../common/alaskaSessionExport.js';
import { enhanceMarkdownContainer } from './alaskaMarkdownEnhance.js';
import { IAlaskaBYOService } from '../common/alaskaByo.js';
import { IAlaskaHookService, IAlaskaHookPayload, AlaskaHookEvent } from '../common/alaskaHookService.js';
import { makeHookPayload } from './alaskaHookService.js';
import { IAlaskaSkillService } from '../common/alaskaSkill.js';
import { renderSkillCatalog, renderSkillsInjection } from './alaskaSkillService.js';
import { IAlaskaMetricsService } from '../common/alaskaMetrics.js';
import { dispatchSubAgent, groupSubAgentsByParallelGroup } from './alaskaSubAgentService.js';

interface IThreadToolActivity {
	id: string;
	name: string;
	target?: string;
	status: 'running' | 'ok' | 'err' | 'skipped';
	summary?: string;
	progress?: string;
	plan?: IPlanActivity;
	runCommand?: IRunCommandActivity;
}

type RunCommandStatus = 'queued' | 'awaiting-consent' | 'running' | 'ok' | 'err' | 'cancelled' | 'timed-out' | 'blocked';

interface IRunCommandActivity {
	command: string;
	displayCommand: string;
	cwd?: string;
	shell?: string;
	displayShellName?: string;
	status: RunCommandStatus;
	queuePosition?: number;
	startedAt?: number;
	endedAt?: number;
	exitCode?: number | null;
	output: string;
	droppedBytes: number;
	encoding: 'utf-8' | 'cp866';
	error?: string;
	reason?: string;
	terminalInstanceId?: number;
	terminalDisposed?: boolean;
}

interface IPlanChange {
	path: string;
	action: 'create' | 'edit' | 'delete';
	summary: string;
}

interface IPlanActivity {
	rationale: string;
	changes: IPlanChange[];
	outcome?: 'approved' | 'declined' | 'edited-approved';
	outcomeReason?: string;
	editedChanges?: IPlanChange[];
	editedRationale?: string;
}

interface IThreadStage {
	label: string;
	state: 'running' | 'done';
}

interface IAlaskaImageAttachment {
	readonly id: string;
	readonly name: string;
	readonly mime: string;
	readonly base64: string;
	readonly bytes: number;
}

interface IThreadMessage {
	id?: string;
	parentId?: string | null;
	childIds?: string[];
	role: 'user' | 'assistant' | 'error';
	content: string;
	createdAt?: number;
	reasoning?: string;
	toolActivities?: IThreadToolActivity[];
	stage?: IThreadStage;
	edited?: boolean;
	truncated?: boolean;
	images?: IAlaskaImageAttachment[];
	retryReason?: 'tool_truncation';
	/** Model that produced this assistant turn (label), for the message footer. */
	model?: string;
	/** Token usage reported for this assistant turn. */
	usage?: { input: number; output: number };
	/** Credits charged for this assistant turn (model multiplier). */
	credits?: number;
}

interface IAlaskaEditOperation {
	readonly action: 'replace' | 'create' | 'patch' | 'delete';
	readonly path: string;
	readonly content?: string;
	readonly find?: string;
	readonly replace?: string;
}

interface IOrphanCodeBlock {
	readonly inferredPath: string;
	readonly language: string;
	readonly content: string;
	readonly byteCount: number;
	readonly position: number;
}

const ORPHAN_MIN_LINES = 8;
const ORPHAN_ALLOWED_EXTENSIONS = new Set<string>([
	'html', 'htm', 'css', 'scss', 'sass', 'less',
	'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx',
	'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml', 'md', 'markdown',
	'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cc', 'cpp', 'h', 'hpp',
	'cs', 'php', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'sql', 'svelte', 'vue', 'astro',
	'env', 'ini', 'cfg', 'conf', 'gitignore', 'dockerfile',
]);
const MAX_CHAT_TRUNCATION_RETRY = 2;
// Flaky upstreams (esp. agentrouter Claude) occasionally return an empty turn —
// no text, no tool calls, no error. Auto-retry a couple of times before giving up.
const MAX_CHAT_EMPTY_RETRY = 2;

type AlaskaAgentAccess = 'edit' | 'read-only';
type AlaskaEditStatus = 'pending' | 'applied' | 'rejected' | 'failed';

interface IPreparedEditOperation extends IAlaskaEditOperation {
	readonly resource: URI;
	before?: string;
	after?: string;
	status: AlaskaEditStatus;
	error?: string;
}

interface IAlaskaUsageWithPlanDates extends IAlaskaUsage {
	readonly reset_at?: string;
	readonly resetAt?: string;
	readonly period_end?: string;
	readonly periodEnd?: string;
	readonly plan_ends_at?: string;
	readonly planEndsAt?: string;
	readonly current_period_end?: string;
	readonly currentPeriodEnd?: string;
}

interface IChatSession {
	readonly id: string;
	title: string;
	titleAuto?: boolean;
	titleUserSet?: boolean;
	titleSummarizeAttempted?: boolean;
	messages: IThreadMessage[];
	version?: 1 | 2;
	activeLeafId?: string | null;
	createdAt: number;
	updatedAt: number;
	runningSummary?: string;
	summarizedThroughIndex?: number;
	lastInputTokens?: number;
	lastOutputTokens?: number;
	lastFinishReason?: string;
	turnStartedAt?: number;
}

const TITLE_SUMMARIZE_MIN_USER_TURNS = 2;
const TITLE_SUMMARIZE_MAX_USER_TURNS = 4;

const ALASKA_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const ALASKA_IMAGE_SUPPORTED_MIMES = new Set<string>(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const CHAT_SESSIONS_KEY = 'alaska.chat.sessions';
const ACTIVE_CHAT_SESSION_KEY = 'alaska.chat.activeSession';
const REASONING_EFFORT_STORAGE_KEY = 'alaska.chat.reasoningEffort';
const ACTIVE_MODEL_ID_STORAGE_KEY = 'alaska.activeModel.id';
const ACTIVE_MODEL_LABEL_STORAGE_KEY = 'alaska.activeModel.label';
const ACTIVE_EFFORT_STATUSBAR_KEY = 'alaska.activeEffort';
const AUTO_CONTINUE_STORAGE_KEY = 'alaska.chat.autoContinue';
const KEEP_LAST_MESSAGES = 10;
const COMPRESS_AT_RATIO = 0.95;
const WARN_AT_RATIO = 0.85;
const AUTO_CONTINUE_WALLCLOCK_MS = 30 * 60 * 1000;
const ALASKA_LIVE_SCHEME = 'alaska-live';

export const ALASKA_PLAN_AUTO_APPROVE_KEY = 'alaska.plan.autoApprove';
const ALASKA_PLAN_UNDO_WINDOW_MS = 1500;
const ALASKA_PLAN_DOCK_FADE_MS = 150;

type AlaskaMentionKind = 'file' | 'folder' | 'url' | 'diag' | 'selection' | 'code';

interface IPendingMention {
	kind: AlaskaMentionKind;
	target: string;
	label: string;
	selection?: { startLine: number; endLine: number; text: string };
	codeSymbol?: { uri: URI; startLine: number; endLine: number; symbolName: string; symbolKindLabel: string };
}

interface IAlaskaMentionCandidate {
	readonly id: string;
	readonly kind: 'special' | 'file' | 'folder' | 'symbol';
	readonly icon: string;
	readonly label: string;
	readonly detail?: string;
	readonly apply: () => void;
}

const MENTION_TOTAL_BUDGET_BYTES = 256 * 1024;
const MENTION_FILE_BYTES = 200 * 1024;
const MENTION_FOLDER_FILE_CAP = 50;
const MENTION_URL_BYTES = 64 * 1024;

interface ILiveWriteSession {
	readonly callId: string;
	readonly path: string;
	readonly targetUri: URI;
	readonly liveUri: URI;
	readonly originalUri: URI;
	readonly originalContent: string;
	readonly expectedLines?: number;
	model?: ITextModel;
	lastContent: string;
	lastFlushAt: number;
	pendingFlush?: number;
	closed: boolean;
}

interface IAlaskaSamplePrompt {
	readonly id: string;
	readonly icon: ThemeIcon;
	readonly title: string;
	readonly description: string;
	readonly prompt: string;
	readonly requires?: 'active_editor' | 'git_repo' | 'workspace';
}

const ALASKA_SAMPLE_PROMPTS: readonly IAlaskaSamplePrompt[] = [
	{
		id: 'explain_codebase',
		icon: Codicon.book,
		title: 'Explain this codebase',
		description: 'High-level overview of the project structure',
		prompt: 'Walk me through this codebase: what does it do, what are the main modules, where is the entry point, and what is the architecture style?',
		requires: 'workspace',
	},
	{
		id: 'explain_file',
		icon: Codicon.fileCode,
		title: 'Explain current file',
		description: 'Summary of the file in the active editor',
		prompt: 'Read the file currently open in the editor and explain what it does, its key abstractions, and how other files use it.',
		requires: 'active_editor',
	},
	{
		id: 'find_bug',
		icon: Codicon.bug,
		title: 'Review uncommitted changes',
		description: 'Critique current git diff for issues',
		prompt: 'Run `git diff HEAD` via alaska_run_command and critique the uncommitted changes: correctness, security, performance, edge cases. Group by severity.',
		requires: 'git_repo',
	},
	{
		id: 'write_tests',
		icon: Codicon.beaker,
		title: 'Write tests',
		description: 'Generate unit tests for current file',
		prompt: 'Read the current file and write unit tests for it using the project\'s existing test framework. Place tests next to the source.',
		requires: 'active_editor',
	},
	{
		id: 'refactor',
		icon: Codicon.symbolMethod,
		title: 'Refactor largest function',
		description: 'Suggest improvements to current file',
		prompt: 'Read the current file, pick the largest function and propose a refactor: split into smaller functions, extract types, reduce nesting. Show before/after.',
		requires: 'active_editor',
	},
	{
		id: 'document',
		icon: Codicon.bookmark,
		title: 'Add documentation',
		description: 'Generate JSDoc/docstrings for current file',
		prompt: 'Read the current file and add documentation comments to public functions, classes, and exported types. Match the project\'s existing comment style.',
		requires: 'active_editor',
	},
	{
		id: 'commit_message',
		icon: Codicon.gitCommit,
		title: 'Write commit message',
		description: 'Conventional commit from current diff',
		prompt: 'Run `git diff HEAD --stat` and `git diff HEAD` via alaska_run_command. Then write a conventional commit message (type: scope: summary, blank line, body explaining what and why).',
		requires: 'git_repo',
	},
	{
		id: 'add_logging',
		icon: Codicon.output,
		title: 'Add logging',
		description: 'Instrument current file with structured logging',
		prompt: 'Read the current file and add structured logging using the existing logger. Cover function entry, errors, and key branches.',
		requires: 'active_editor',
	},
];

export class AlaskaChatViewPane extends ViewPane {

	static readonly ID = 'workbench.view.alaskaChat';

	private rootEl?: HTMLElement;
	private signedOutEl?: HTMLElement;
	private signedInEl?: HTMLElement;
	private messagesEl?: HTMLElement;
	private composerEl?: HTMLTextAreaElement;
	private signInButton?: HTMLButtonElement;
	private progressEl?: HTMLElement;
	private contextLabelEl?: HTMLElement;
	private userEl?: HTMLElement;
	private sendButton?: HTMLButtonElement;
	private stopButton?: HTMLButtonElement;
	private sendKbdEl?: HTMLElement;
	private sendLabelEl?: HTMLElement;
	private statusEl?: HTMLElement;
	private streamStartMs = 0;
	private elapsedTimer?: ReturnType<typeof setInterval>;
	private modelButton?: HTMLButtonElement;
	private modelMenuEl?: HTMLElement;
	private modelPlanEl?: HTMLElement;
	private effortPickerEl?: HTMLElement;
	private effortValueEl?: HTMLElement;
	private effortMenuEl?: HTMLElement;
	private selectedEffort: AlaskaReasoningEffort = 'medium';
	private threadTitleEl?: HTMLElement;
	private permissionMenuEl?: HTMLElement;
	private permissionButton?: HTMLButtonElement;
	private autoContinueBtn?: HTMLButtonElement;
	private selectedAutoContinue = false;
	private modeButton?: HTMLButtonElement;
	private modeMenuEl?: HTMLElement;
	private modeBannerEl?: HTMLElement;
	private contextRibbonEl?: HTMLElement;
	private contextRibbonTextEl?: HTMLElement;
	private contextRibbonActionEl?: HTMLButtonElement;
	private compressInFlight?: Promise<void>;
	private settingsOverlayEl?: HTMLElement;
	private settingsOpen = false;
	private usageEl?: HTMLElement;
	private sessionsMenuEl?: HTMLElement;
	private activeContextMetaEl?: HTMLElement;

	private readonly thread: IThreadMessage[] = [];
	private sessions: IChatSession[] = [];
	private activeSessionId?: string;
	private models: IAlaskaModel[] = [];
	private selectedModelId?: string;
	private modelsLoading?: Promise<void>;
	private usageLoading?: Promise<void>;
	private agentAccess: AlaskaAgentAccess = 'edit';
	private isStreaming = false;
	private streamCancel?: CancellationTokenSource;
	private chatTruncationRetryCount = 0;
	private chatEmptyRetryCount = 0;
	private readonly liveWriteSessions = new Map<string, ILiveWriteSession>();
	private readonly expectedLinesByPath = new Map<string, number>();
	private readonly toolPreviewState = new Map<string, IToolPreviewState>();
	private pendingEditsEl?: HTMLElement;
	private pendingMentions: IPendingMention[] = [];
	private pendingImages: IAlaskaImageAttachment[] = [];
	private readonly objectUrlsByMessage = new Map<IThreadMessage, string[]>();
	private chipsEl?: HTMLElement;
	private imageChipsEl?: HTMLElement;
	private planDockEl?: HTMLElement;
	private planDockHideTimer?: ReturnType<typeof setTimeout>;
	private readonly undoTimers = this._register(new DisposableStore());
	private readonly runCardRefs = new Map<string, IRunCardRefs>();
	private runCommandQueue: Promise<void> = Promise.resolve();
	private runCommandPending = 0;
	private osCache?: OperatingSystem;
	private readonly titleSummarizing = new Set<string>();
	private readonly titleCancelSources = new Map<string, CancellationTokenSource>();
	private hasGitRepo?: boolean;
	private gitCheckInFlight = false;
	private slashMenuEl?: HTMLElement;
	private slashMenuMatches: IAlaskaSlashCommand[] = [];
	private slashMenuActiveIdx = 0;
	private slashMenuOpen = false;
	private mentionDropdownEl?: HTMLDivElement;
	private mentionItems: IAlaskaMentionCandidate[] = [];
	private mentionActiveIdx = 0;
	private mentionFetchCts?: CancellationTokenSource;
	private mentionAtStart = 0;
	private mentionAtCaret = 0;
	private tokenCounterEl?: HTMLElement;
	private tokenCounterRaf = 0;
	private byoBadgeEl?: HTMLElement;
	private forcedSkillNames: string[] = [];

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
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@IAlaskaChatService private readonly chatService: IAlaskaChatService,
		@IAlaskaContextService private readonly contextSvc: IAlaskaContextService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IEditorService private readonly editorService: IEditorService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IFileService private readonly fileService: IFileService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IStorageService private readonly storageService: IStorageService,
		@IAlaskaPendingEditsService private readonly pendingEdits: IAlaskaPendingEditsService,
		@IModelService private readonly modelService: IModelService,
		@ITextModelService private readonly textModelService: ITextModelService,
		@ILanguageService private readonly languageService: ILanguageService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@ITerminalProfileService private readonly terminalProfileService: ITerminalProfileService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IWorkspaceTrustManagementService private readonly workspaceTrust: IWorkspaceTrustManagementService,
		@IRequestService private readonly requestService: IRequestService,
		@IAlaskaMcpService private readonly mcpService: IAlaskaMcpService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@ILogService private readonly logService: ILogService,
		@IAlaskaActivityService private readonly activityService: IAlaskaActivityService,
		@ICommandService private readonly commandService: ICommandService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IDialogService private readonly dialogService: IDialogService,
		@ISearchService private readonly searchService: ISearchService,
		@IAlaskaAgentModeService private readonly agentModeService: IAlaskaAgentModeService,
		@IAlaskaIndexService private readonly indexService: IAlaskaIndexService,
		@IAlaskaSlashCommandService private readonly slashService: IAlaskaSlashCommandService,
		@IAlaskaGoalService private readonly goalService: IAlaskaGoalService,
		@IAlaskaReminderService private readonly reminderService: IAlaskaReminderService,
		@IAlaskaHunkTrackerService private readonly hunkTracker: IAlaskaHunkTrackerService,
		@IAlaskaBYOService private readonly byoService: IAlaskaBYOService,
		@IAlaskaHookService private readonly hookService: IAlaskaHookService,
		@IAlaskaSkillService private readonly skillService: IAlaskaSkillService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
		@IAlaskaMetricsService private readonly metricsService: IAlaskaMetricsService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register({ dispose: () => this.releaseAllThreadObjectUrls() });
		this._register({ dispose: () => this.cancelAllToolPreviewRafs() });
		this._register(this.pendingEdits.onDidChange(() => this.refreshPendingEditsPanel()));
		this._register({
			dispose: () => {
				for (const cts of this.titleCancelSources.values()) {
					try { cts.dispose(true); } catch { /* ignore */ }
				}
				this.titleCancelSources.clear();
				this.titleSummarizing.clear();
			},
		});
		this._register(this.textModelService.registerTextModelContentProvider(ALASKA_LIVE_SCHEME, {
			provideTextContent: async (uri) => {
				const existing = this.modelService.getModel(uri);
				if (existing) {
					return existing;
				}
				const langSel = this.languageService.createByFilepathOrFirstLine(uri, '');
				return this.modelService.createModel('', langSel, uri);
			},
		}));
		this._register(this.agentModeService.onDidChange(snap => {
			if (this.activeSessionId === snap.sessionId) {
				this.updateModePicker();
				this.refreshModeBanner();
			}
		}));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('alaska-pane');
		this.rootEl = container;
		this.registerMenuAutoDismiss(container);
		this.loadSessions();

		this.signedOutEl = this.buildSignedOut(container);
		this.signedInEl = this.buildSignedIn(container);
		this.openSession(this.activeSessionId, false);

		this.applyState(this.authService.state);
		this._register(this.authService.onDidChangeState(s => this.applyState(s)));
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		// CSS handles flex; nothing to compute here.
	}

	private buildSignedOut(parent: HTMLElement): HTMLElement {
		const root = document.createElement('div');
		root.className = 'alaska-signed-out';

		const heading = document.createElement('h2');
		heading.textContent = 'Welcome to Xipher IDE';
		root.appendChild(heading);

		const blurb = document.createElement('p');
		blurb.textContent = 'Sign in with your Xipher IDE account to chat with the assistant about the code you have open.';
		root.appendChild(blurb);

		const btn = document.createElement('button');
		btn.className = 'alaska-button';
		btn.textContent = 'Sign in to Xipher IDE';
		btn.addEventListener('click', () => void this.startSignIn());
		this.signInButton = btn;
		root.appendChild(btn);

		const progress = document.createElement('div');
		progress.className = 'alaska-progress';
		progress.style.display = 'none';
		this.progressEl = progress;
		root.appendChild(progress);

		parent.appendChild(root);
		return root;
	}

	private async startSignIn(): Promise<void> {
		if (!this.signInButton || !this.progressEl) { return; }
		this.signInButton.disabled = true;
		this.signInButton.textContent = 'Opening browser…';
		try {
			await this.authService.signIn(p => this.renderProgress(p));
			// applyState will fire via onDidChangeState — nothing to do here.
		} catch (err) {
			this.progressEl.style.display = 'block';
			this.progressEl.textContent = err instanceof Error ? err.message : 'Sign-in failed';
		} finally {
			this.signInButton.disabled = false;
			this.signInButton.textContent = 'Sign in to Xipher IDE';
		}
	}

	private renderProgress(p: IDeviceFlowProgress): void {
		if (!this.progressEl) { return; }
		this.progressEl.style.display = 'flex';
		this.progressEl.replaceChildren();

		const codeEl = document.createElement('div');
		codeEl.className = 'alaska-progress-code';
		codeEl.textContent = p.userCode;
		this.progressEl.appendChild(codeEl);

		const small = document.createElement('small');
		small.textContent = 'We opened the approval page in your browser. Sign in and click "Authorize".';
		this.progressEl.appendChild(small);

		const linkBtn = document.createElement('button');
		linkBtn.className = 'alaska-button-link';
		linkBtn.textContent = 'Reopen approval page';
		linkBtn.addEventListener('click', () => {
			void this.openerService.open(URI.parse(p.verificationUriComplete), { openExternal: true });
		});
		this.progressEl.appendChild(linkBtn);
	}

	private buildSignedIn(parent: HTMLElement): HTMLElement {
		const root = document.createElement('div');
		root.className = 'alaska-chat-shell';
		root.style.display = 'none';
		root.style.flex = '1';

		const header = document.createElement('div');
		header.className = 'alaska-chat-head';

		const title = document.createElement('div');
		title.className = 'alaska-chat-title';
		title.appendChild(buildAuroraMark('alaska-aurora-mark'));
		const titleText = document.createElement('span');
		titleText.className = 'alaska-chat-title-text';
		titleText.textContent = localize('alaska.chat.newThread', 'New chat');
		titleText.title = localize('alaska.chat.titleRename', 'Double-click to rename');
		titleText.addEventListener('dblclick', () => this.beginRenameSession(titleText));
		this.threadTitleEl = titleText;
		title.appendChild(titleText);
		header.appendChild(title);

		const actions = document.createElement('div');
		actions.className = 'alaska-chat-actions';
		actions.appendChild(buildChatHeadAction(
			'M8 3v10M3 8h10',
			localize('alaska.chat.newThread', 'New chat'),
			() => void this.startNewThread(),
		));
		actions.appendChild(this.buildHistoryAction());
		actions.appendChild(this.buildMoreMenuAction());
		header.appendChild(actions);

		this.userEl = document.createElement('span');
		this.userEl.style.display = 'none';

		root.appendChild(header);

		const banner = document.createElement('div');
		banner.className = 'alaska-mode-banner alaska-mode-banner-hidden';
		this.modeBannerEl = banner;
		root.appendChild(banner);

		const messages = document.createElement('div');
		messages.className = 'alaska-messages';
		messages.setAttribute('tabindex', '0');
		messages.setAttribute('role', 'log');
		messages.setAttribute('aria-live', 'polite');
		this.messagesEl = messages;
		this._register(DOM.addDisposableListener(messages, 'keydown', (e: KeyboardEvent) => {
			if (!this.messagesEl) { return; }
			if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.messagesEl.scrollTop = 0;
			} else if (e.key === 'End' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
			} else if (e.key === 'PageUp') {
				e.preventDefault();
				this.messagesEl.scrollTop -= this.messagesEl.clientHeight * 0.9;
			} else if (e.key === 'PageDown') {
				e.preventDefault();
				this.messagesEl.scrollTop += this.messagesEl.clientHeight * 0.9;
			}
		}));
		root.appendChild(messages);
		this.renderEmpty();

		const planDock = document.createElement('div');
		planDock.className = 'alaska-plan-dock';
		this.planDockEl = planDock;
		root.appendChild(planDock);
		this._register(this.chatService.onDidChangePendingPlans(() => this.refreshPlanDock()));

		root.addEventListener('keydown', ev => this.handlePlanDockKey(ev));

		const composer = document.createElement('div');
		composer.className = 'alaska-composer';

		const ctxLabel = document.createElement('div');
		ctxLabel.className = 'alaska-composer-context';
		this.contextLabelEl = ctxLabel;
		this.refreshContextLabel();
		composer.appendChild(ctxLabel);

		const ribbon = document.createElement('div');
		ribbon.className = 'alaska-context-ribbon alaska-context-ribbon-hidden';
		const ribbonText = document.createElement('span');
		ribbonText.className = 'alaska-context-ribbon-text';
		ribbon.appendChild(ribbonText);
		const ribbonAct = document.createElement('button');
		ribbonAct.type = 'button';
		ribbonAct.className = 'alaska-context-ribbon-action';
		ribbon.appendChild(ribbonAct);
		this.contextRibbonEl = ribbon;
		this.contextRibbonTextEl = ribbonText;
		this.contextRibbonActionEl = ribbonAct;
		composer.appendChild(ribbon);

		const chipsRow = document.createElement('div');
		chipsRow.className = 'alaska-attach-chips';
		chipsRow.style.display = 'none';
		this.chipsEl = chipsRow;
		composer.appendChild(chipsRow);

		const imageChipsRow = document.createElement('div');
		imageChipsRow.className = 'alaska-attach-image-chips';
		imageChipsRow.style.display = 'none';
		this.imageChipsEl = imageChipsRow;
		composer.appendChild(imageChipsRow);

		// One unified composer card: input on top, slash-autocomplete + control bar below.
		const field = document.createElement('div');
		field.className = 'alaska-composer-field';

		const textarea = document.createElement('textarea');
		textarea.className = 'alaska-composer-input';
		// allow-any-unicode-next-line
		textarea.placeholder = localize('alaska.composer.placeholder', 'попроси изменить, найти, объяснить…');
		textarea.rows = 3;
		textarea.addEventListener('keydown', ev => {
			if (this.handleMentionKeydown(ev)) {
				return;
			}
			if (this.slashMenuOpen) {
				if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
					ev.preventDefault();
					this.moveSlashHighlight(ev.key === 'ArrowDown' ? 1 : -1);
					return;
				}
				if (ev.key === 'Escape') {
					ev.preventDefault();
					this.hideSlashMenu();
					return;
				}
				if ((ev.key === 'Tab' || ev.key === 'Enter') && !ev.shiftKey) {
					const choice = this.slashMenuMatches[this.slashMenuActiveIdx];
					if (choice) {
						ev.preventDefault();
						this.applySlashChoice(choice);
						return;
					}
				}
			}
			if (ev.key === 'Enter' && !ev.shiftKey) {
				ev.preventDefault();
				void this.submit();
			}
		});
		textarea.addEventListener('input', () => {
			this.autosizeComposer();
			void this.updateMentionDropdown();
			this.updateSlashMenu();
			this.scheduleTokenCounterUpdate();
		});
		textarea.addEventListener('focus', () => this.refreshContextLabel());
		textarea.addEventListener('blur', () => setTimeout(() => {
			this.hideSlashMenu();
			this.hideMentionDropdown();
		}, 100));
		this.composerEl = textarea;
		field.appendChild(textarea);

		const slashMenu = document.createElement('div');
		slashMenu.className = 'alaska-slash-menu';
		slashMenu.style.display = 'none';
		slashMenu.setAttribute('role', 'listbox');
		this.slashMenuEl = slashMenu;
		field.appendChild(slashMenu);
		this._register(this.slashService.onDidChange(() => this.updateSlashMenu()));

		const bar = document.createElement('div');
		bar.className = 'alaska-composer-bar';

		// Row 1 — controls (attach · context · permissions · mode · model · effort).
		// Kept together so they wrap as one tidy group instead of splitting left/right.
		const controlsRow = document.createElement('div');
		controlsRow.className = 'alaska-composer-controls';
		controlsRow.appendChild(this.buildAttachMenu());
		controlsRow.appendChild(this.buildActiveContextToggle());
		controlsRow.appendChild(this.buildPermissionsMenu());
		controlsRow.appendChild(this.buildAgentModePicker());
		controlsRow.appendChild(this.buildModelPicker());
		controlsRow.appendChild(this.buildEffortPicker());
		controlsRow.appendChild(this.buildAutoContinueToggle());
		bar.appendChild(controlsRow);

		// Row 2 — send row: usage/cost on the left (muted), Send anchored right.
		const sendRow = document.createElement('div');
		sendRow.className = 'alaska-composer-send-row';
		sendRow.appendChild(this.buildTokenCounter());

		const sendActions = document.createElement('div');
		sendActions.className = 'alaska-composer-send-actions';

		// A hidden a11y-only live region for stream status (visual status lives in the
		// thread's pending/activity rows, not crammed into the narrow send row).
		const status = document.createElement('span');
		status.className = 'alaska-stream-status alaska-visually-hidden';
		status.setAttribute('aria-live', 'polite');
		status.setAttribute('aria-atomic', 'true');
		this.statusEl = status;
		sendActions.appendChild(status);

		// Single Send↔Stop button (like Cursor): while streaming it becomes a Stop
		// button; otherwise it sends. No separate cramped ■ button.
		const sendBtn = document.createElement('button');
		sendBtn.type = 'button';
		sendBtn.className = 'alaska-cbtn alaska-cbtn-send';
		const sendKbd = document.createElement('kbd');
		sendKbd.className = 'alaska-cbtn-send-kbd';
		// allow-any-unicode-next-line
		sendKbd.textContent = '⌘↵';
		sendBtn.appendChild(sendKbd);
		const sendLabel = document.createElement('span');
		sendLabel.className = 'alaska-cbtn-send-label';
		sendLabel.textContent = localize('alaska.composer.send.label', 'Send');
		sendBtn.appendChild(sendLabel);
		this.sendKbdEl = sendKbd;
		this.sendLabelEl = sendLabel;
		// allow-any-unicode-next-line
		sendBtn.title = localize('alaska.composer.send', 'Send (⌘↵)');
		sendBtn.addEventListener('click', () => { if (this.isStreaming) { this.stopStreaming(); } else { void this.submit(); } });
		this.sendButton = sendBtn;
		this.stopButton = sendBtn; // same element now; setStreaming morphs it
		sendActions.appendChild(sendBtn);

		sendRow.appendChild(sendActions);
		bar.appendChild(sendRow);
		field.appendChild(bar);
		composer.appendChild(field);

		const usage = document.createElement('div');
		usage.className = 'alaska-usage';
		usage.style.display = 'none';
		this.usageEl = usage;
		composer.appendChild(usage);

		const pendingPanel = document.createElement('div');
		pendingPanel.className = 'alaska-pending-edits-panel';
		pendingPanel.style.display = 'none';
		this.pendingEditsEl = pendingPanel;
		root.appendChild(pendingPanel);

		root.appendChild(composer);
		this.setupComposerDropZone(composer);
		this.refreshPendingEditsPanel();

		const settingsOverlay = document.createElement('div');
		settingsOverlay.className = 'alaska-settings-overlay alaska-settings-overlay-hidden';
		this.settingsOverlayEl = settingsOverlay;
		root.appendChild(settingsOverlay);

		parent.appendChild(root);
		return root;
	}

	private buildModelPicker(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'alaska-model-picker';

		const btn = document.createElement('button');
		btn.className = 'alaska-model-button';
		btn.type = 'button';
		btn.addEventListener('click', ev => {
			ev.stopPropagation();
			this.toggleModelMenu();
		});
		this.modelButton = btn;
		wrap.appendChild(btn);

		const menu = document.createElement('div');
		menu.className = 'alaska-model-menu';
		menu.style.display = 'none';
		this.modelMenuEl = menu;
		wrap.appendChild(menu);
		this.updateModelPicker();

		const byoBadge = document.createElement('span');
		byoBadge.className = 'alaska-byo-badge';
		byoBadge.textContent = 'BYO';
		byoBadge.title = localize('alaska.byo.badge.tooltip', 'Routing through your own API key');
		byoBadge.style.display = 'none';
		wrap.appendChild(byoBadge);
		this.byoBadgeEl = byoBadge;
		this._register(this.byoService.onDidChange(() => this.refreshByoBadge()));
		this.refreshByoBadge();

		return wrap;
	}

	private refreshByoBadge(): void {
		if (!this.byoBadgeEl) { return; }
		const cfg = this.byoService.getConfig();
		const isUltra = (this.authService.state.user?.plan ?? '').toLowerCase() === 'ultra';
		const active = cfg.enabled && cfg.hasKey && isUltra;
		this.byoBadgeEl.style.display = active ? '' : 'none';
		this.scheduleTokenCounterUpdate();
	}

	private async runHook(
		event: AlaskaHookEvent,
		tool: { name: string; arguments: unknown } | undefined,
		userMessage: string | undefined,
	): Promise<ReturnType<IAlaskaHookService['dispatch']> extends Promise<infer R> ? R : never> {
		const sessionId = this.activeSessionId ?? '';
		const workspaceFolder = this.workspaceService.getWorkspace().folders[0]?.uri;
		const payload: IAlaskaHookPayload = makeHookPayload(event, sessionId, workspaceFolder, tool, userMessage);
		try {
			return await this.hookService.dispatch(payload);
		} catch (err) {
			this.logService.warn('[alaska.hooks] dispatch failed', err);
			return { action: 'continue' };
		}
	}

	private toggleSessionsMenu(): void {
		if (!this.sessionsMenuEl) { return; }
		const visible = this.sessionsMenuEl.style.display !== 'none';
		this.sessionsMenuEl.style.display = visible ? 'none' : '';
		if (!visible) {
			this.renderSessionsMenu();
			fitFloatingMenu(this.sessionsMenuEl, this.signedInEl ?? this.rootEl);
		}
	}

	private renderSessionsMenu(): void {
		if (!this.sessionsMenuEl) { return; }
		this.sessionsMenuEl.replaceChildren();
		const header = document.createElement('div');
		header.className = 'alaska-sessions-header';
		header.textContent = 'Sessions';
		this.sessionsMenuEl.appendChild(header);
		for (const session of this.sessions) {
			const item = document.createElement('button');
			item.className = 'alaska-session-item';
			item.type = 'button';
			item.classList.toggle('alaska-session-item-active', session.id === this.activeSessionId);
			const title = document.createElement('strong');
			title.textContent = session.title || 'New chat';
			item.appendChild(title);
			const meta = document.createElement('span');
			meta.textContent = `${session.messages.length} messages · ${formatSessionTime(session.updatedAt)}`;
			item.appendChild(meta);
			item.addEventListener('click', () => {
				this.openSession(session.id);
				if (this.sessionsMenuEl) {
					this.sessionsMenuEl.style.display = 'none';
				}
			});
			this.sessionsMenuEl.appendChild(item);
		}
		if (this.sessions.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'alaska-session-empty';
			empty.textContent = 'No sessions yet.';
			this.sessionsMenuEl.appendChild(empty);
		}
	}

	private async ensureModels(): Promise<void> {
		if (this.models.length > 0) {
			return;
		}
		if (this.modelsLoading) {
			return this.modelsLoading;
		}
		const source = new CancellationTokenSource();
		this.modelsLoading = this.chatService.models(source.token)
			.then(resp => {
				this.models = resp.items;
				if (!this.selectedModelId && this.models.length > 0) {
					this.setActiveModelInStorage(this.models[0].id, this.models[0].label);
				}
				if (this.modelPlanEl) {
					this.modelPlanEl.textContent = resp.plan;
				}
				this.updateModelPicker();
				this.updateEffortPicker();
			})
			.catch(err => {
				if (this.modelButton) {
					this.modelButton.textContent = err instanceof Error ? err.message : 'Models unavailable';
				}
			})
			.finally(() => {
				this.modelsLoading = undefined;
				source.dispose();
			});
		this.updateModelPicker();
		return this.modelsLoading;
	}

	private async ensureUsage(force = false): Promise<void> {
		if (this.usageLoading && !force) {
			return this.usageLoading;
		}
		if (this.usageLoading && force) {
			await this.usageLoading.catch(() => undefined);
		}
		const source = new CancellationTokenSource();
		this.usageLoading = this.chatService.usage(source.token)
			.then(usage => this.renderUsage(usage))
			.catch(err => {
				if (this.usageEl) {
					this.usageEl.textContent = err instanceof Error ? err.message : 'Usage unavailable';
				}
			})
			.finally(() => {
				this.usageLoading = undefined;
				source.dispose();
			});
		return this.usageLoading;
	}

	private renderUsage(usage: IAlaskaUsage): void {
		if (!this.usageEl) { return; }
		const richUsage = usage as IAlaskaUsageWithPlanDates;
		const plan = usage.plan || 'free';
		const isFree = plan.toLowerCase() === 'free';
		const totalTokens = usage.input + usage.output;
		const resetDate = usageResetDate(richUsage);
		const planEndsAt = usagePlanEndsAt(richUsage);
		this.usageEl.replaceChildren();
		const button = document.createElement('button');
		button.className = 'alaska-plan-button';
		button.type = 'button';
		button.textContent = plan.toUpperCase();
		const details = document.createElement('div');
		details.className = 'alaska-plan-menu';
		details.style.display = 'none';
		details.appendChild(planDetailRow('Email', this.authService.state.user?.email ?? 'Unknown'));
		details.appendChild(planDetailRow('Usage', `${usage.requests}/${usage.limit} requests`));
		details.appendChild(planDetailRow('Tokens', `${formatCompactNumber(totalTokens)} used`));
		details.appendChild(planDetailRow('Resets', formatPlanDate(resetDate)));
		if (!isFree && planEndsAt) {
			details.appendChild(planDetailRow('Plan ends', formatPlanDate(planEndsAt)));
		}
		button.addEventListener('click', ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const visible = details.style.display !== 'none';
			details.style.display = visible ? 'none' : '';
			if (!visible) {
				fitFloatingMenu(details, this.signedInEl ?? this.rootEl);
			}
		});
		this.usageEl.appendChild(button);
		this.usageEl.appendChild(details);
		this.usageEl.title = `${plan.toUpperCase()} · ${usage.requests}/${usage.limit} requests · resets ${formatPlanDate(resetDate)}`;
	}

	// Close any open composer dropdown when the user clicks outside it. Clicks on a
	// menu (its items) or on a trigger button are left alone — the trigger keeps its
	// own toggle behaviour — so this only adds "click anywhere else to dismiss".
	private registerMenuAutoDismiss(container: HTMLElement): void {
		const MENU_SEL = '.alaska-model-menu,.alaska-effort-menu,.alaska-sessions-menu,.alaska-chat-more-menu,.alaska-attach-menu,.alaska-permission-menu,.alaska-mode-menu';
		const TRIGGER_SEL = '.alaska-model-button,.alaska-effort-button,.alaska-mode-button,.alaska-composer-permissions,.alaska-session-picker,.alaska-chat-actions-btn,.alaska-icon-button,.alaska-plan-button';
		this._register(DOM.addDisposableListener(container.ownerDocument, DOM.EventType.MOUSE_DOWN, (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target || !this.rootEl) { return; }
			if (target.closest(MENU_SEL) || target.closest(TRIGGER_SEL)) { return; }
			for (const menu of Array.from(this.rootEl.querySelectorAll<HTMLElement>(MENU_SEL))) {
				if (menu.style.display !== 'none') { menu.style.display = 'none'; }
			}
		}, true));
	}

	private toggleModelMenu(): void {
		if (!this.modelMenuEl) { return; }
		if (this.models.length === 0) {
			void this.ensureModels();
			return;
		}
		const visible = this.modelMenuEl.style.display !== 'none';
		this.modelMenuEl.style.display = visible ? 'none' : 'block';
		if (!visible) {
			fitFloatingMenu(this.modelMenuEl, this.signedInEl ?? this.rootEl);
		}
	}

	private updateModelPicker(): void {
		if (!this.modelButton) { return; }
		const selected = this.models.find(m => m.id === this.selectedModelId) ?? this.models[0];
		this.modelButton.replaceChildren();
		if (!selected) {
			this.modelButton.appendChild(buildCodicon(Codicon.sparkle));
			this.modelButton.appendChild(document.createTextNode(this.modelsLoading ? 'Loading models' : 'Select model'));
			return;
		}

		const dot = document.createElement('span');
		dot.className = 'alaska-model-dot';
		this.modelButton.appendChild(dot);
		const label = document.createElement('span');
		label.textContent = selected.label;
		this.modelButton.appendChild(label);
		this.modelButton.appendChild(buildCodicon(Codicon.chevronDown));

		if (!this.modelMenuEl) { return; }
		this.modelMenuEl.replaceChildren();
		for (const model of this.models) {
			const item = document.createElement('button');
			item.className = `alaska-model-item${model.id === selected.id ? ' alaska-model-item-active' : ''}${model.locked ? ' alaska-model-item-locked' : ''}`;
			item.type = 'button';
			item.addEventListener('click', ev => {
				ev.stopPropagation();
				if (model.locked) { return; } // locked models require a higher plan
				this.setActiveModelInStorage(model.id, model.label);
				if (this.modelMenuEl) {
					this.modelMenuEl.style.display = 'none';
				}
				this.updateModelPicker();
				this.updateEffortPicker();
			});
			const row = document.createElement('div');
			row.className = 'alaska-model-item-row';
			const name = document.createElement('strong');
			name.textContent = model.label;
			row.appendChild(name);
			if (model.supports_vision) {
				const visionBadge = document.createElement('span');
				visionBadge.className = 'alaska-model-cap-badge alaska-model-cap-vision';
				visionBadge.textContent = localize('alaska.model.cap.vision.badge', 'vision');
				visionBadge.title = localize('alaska.model.cap.vision.tooltip', 'Can read attached images');
				row.appendChild(visionBadge);
			}
			const meta = document.createElement('span');
			meta.className = 'alaska-model-item-meta';
			if (model.locked) {
				const lock = document.createElement('span');
				lock.className = 'alaska-model-lock';
				lock.textContent = `🔒 ${model.requires_plan}`;
				lock.title = localize('alaska.model.locked.tooltip', 'Requires the {0} plan', model.requires_plan);
				meta.appendChild(lock);
			} else if (typeof model.credit_multiplier === 'number') {
				const mult = document.createElement('span');
				mult.className = 'alaska-model-credit';
				mult.textContent = `${model.credit_multiplier}× Credit`;
				meta.appendChild(mult);
			}
			row.appendChild(meta);
			item.appendChild(row);
			if (model.description) {
				const desc = document.createElement('small');
				desc.textContent = model.description;
				item.appendChild(desc);
			}
			this.modelMenuEl.appendChild(item);
		}
	}

	private selectedModel(): string | undefined {
		return this.selectedModelId ?? this.models[0]?.id;
	}

	private setActiveModelInStorage(modelId: string, label: string): void {
		this.selectedModelId = modelId;
		this.storageService.store(ACTIVE_MODEL_ID_STORAGE_KEY, modelId, StorageScope.APPLICATION, StorageTarget.USER);
		this.storageService.store(ACTIVE_MODEL_LABEL_STORAGE_KEY, label, StorageScope.APPLICATION, StorageTarget.USER);
		this.scheduleTokenCounterUpdate();
	}

	private setActiveEffortInStorage(effort: AlaskaReasoningEffort): void {
		this.selectedEffort = effort;
		this.storageService.store(REASONING_EFFORT_STORAGE_KEY, effort, StorageScope.WORKSPACE, StorageTarget.USER);
		this.storageService.store(ACTIVE_EFFORT_STATUSBAR_KEY, effort, StorageScope.APPLICATION, StorageTarget.USER);
	}

	private currentModelSupportsEffort(): boolean {
		const id = this.selectedModel();
		if (!id) { return false; }
		const m = this.models.find(mm => mm.id === id);
		return !!m?.supports_reasoning_effort;
	}

	private loadPersistedEffort(): void {
		const raw = this.storageService.get(REASONING_EFFORT_STORAGE_KEY, StorageScope.WORKSPACE, '');
		if ((ALASKA_REASONING_EFFORTS as readonly string[]).includes(raw)) {
			this.selectedEffort = raw as AlaskaReasoningEffort;
		}
	}

	private buildEffortPicker(): HTMLElement {
		this.loadPersistedEffort();
		const wrap = document.createElement('div');
		wrap.className = 'alaska-effort-picker';
		this.effortPickerEl = wrap;

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-effort-button';
		btn.title = 'Higher reasoning effort = slower responses, more thorough. Only applies to models that support it.';
		btn.addEventListener('click', ev => {
			ev.stopPropagation();
			this.toggleEffortMenu();
		});

		const tag = document.createElement('span');
		tag.className = 'alaska-effort-tag';
		tag.textContent = 'Effort';
		btn.appendChild(tag);

		const value = document.createElement('span');
		value.className = 'alaska-effort-value';
		btn.appendChild(value);
		this.effortValueEl = value;

		btn.appendChild(buildCodicon(Codicon.chevronDown));
		wrap.appendChild(btn);

		const menu = document.createElement('div');
		menu.className = 'alaska-effort-menu';
		menu.style.display = 'none';
		this.effortMenuEl = menu;
		wrap.appendChild(menu);

		this.updateEffortPicker();
		return wrap;
	}

	private toggleEffortMenu(): void {
		if (!this.effortMenuEl) { return; }
		const visible = this.effortMenuEl.style.display !== 'none';
		this.effortMenuEl.style.display = visible ? 'none' : 'block';
		if (!visible) {
			fitFloatingMenu(this.effortMenuEl, this.signedInEl ?? this.rootEl);
		}
	}

	private updateEffortPicker(): void {
		if (!this.effortPickerEl) { return; }
		const supported = this.currentModelSupportsEffort();
		this.effortPickerEl.classList.toggle('alaska-effort-picker-hidden', !supported);
		if (!supported && this.effortMenuEl) {
			this.effortMenuEl.style.display = 'none';
		}
		if (this.effortValueEl) {
			this.effortValueEl.textContent = this.selectedEffort;
		}
		if (!this.effortMenuEl) { return; }
		this.effortMenuEl.replaceChildren();
		for (const value of ALASKA_REASONING_EFFORTS) {
			const item = document.createElement('button');
			item.type = 'button';
			item.className = 'alaska-effort-item';
			item.classList.toggle('alaska-effort-item-active', value === this.selectedEffort);
			item.textContent = value;
			item.addEventListener('click', ev => {
				ev.stopPropagation();
				this.setActiveEffortInStorage(value);
				if (this.effortMenuEl) {
					this.effortMenuEl.style.display = 'none';
				}
				this.updateEffortPicker();
			});
			this.effortMenuEl.appendChild(item);
		}
	}

	private buildActiveContextToggle(): HTMLElement {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-cbtn alaska-cbtn-toggle alaska-composer-active-toggle';
		btn.title = localize('alaska.composer.activeToggle', 'Include the active editor selection as code_context');
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 16 16');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '1.6');
		const p = document.createElementNS(NS, 'path');
		p.setAttribute('d', 'M5 4l-4 4 4 4M11 4l4 4-4 4M9 3l-2 10');
		svg.appendChild(p);
		btn.appendChild(svg);
		const labelEl = document.createElement('span');
		labelEl.textContent = localize('alaska.composer.activeLabel', 'Active');
		btn.appendChild(labelEl);
		const metaEl = document.createElement('span');
		metaEl.className = 'alaska-cbtn-ctx-meta';
		btn.appendChild(metaEl);
		this.activeContextMetaEl = metaEl;

		const storageKey = 'alaska.chat.includeActiveCode';
		const initiallyOn = this.storageService.getBoolean(storageKey, StorageScope.WORKSPACE, true);
		btn.classList.toggle('alaska-cbtn-toggle-on', initiallyOn);
		btn.classList.toggle('alaska-composer-active-on', initiallyOn);
		btn.addEventListener('click', () => {
			const next = !btn.classList.contains('alaska-cbtn-toggle-on');
			btn.classList.toggle('alaska-cbtn-toggle-on', next);
			btn.classList.toggle('alaska-composer-active-on', next);
			this.storageService.store(storageKey, next, StorageScope.WORKSPACE, StorageTarget.USER);
			this.refreshContextLabel();
		});
		this.refreshActiveContextMeta();
		return btn;
	}

	private refreshActiveContextMeta(): void {
		if (!this.activeContextMetaEl) { return; }
		const ctx = this.contextSvc.captureCurrent();
		if (ctx.filePath) {
			const base = ctx.filePath.split('/').pop() ?? ctx.filePath;
			const range = ctx.selection ? `:${ctx.selection.startLine}-${ctx.selection.endLine}` : '';
			this.activeContextMetaEl.textContent = base + range;
		} else {
			this.activeContextMetaEl.textContent = '';
		}
	}

	private buildHistoryAction(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'alaska-session-picker';
		wrap.style.position = 'relative';

		const btn = buildChatHeadAction(
			'M8 3a5 5 0 1 0 5 5M8 3v5l3 2M8 3V1',
			localize('alaska.chat.history', 'History'),
			() => this.toggleSessionsMenu(),
		);
		wrap.appendChild(btn);

		const menu = document.createElement('div');
		menu.className = 'alaska-sessions-menu';
		menu.style.display = 'none';
		this.sessionsMenuEl = menu;
		wrap.appendChild(menu);
		this.renderSessionsMenu();
		return wrap;
	}

	private buildMoreMenuAction(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.style.position = 'relative';

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-chat-actions-btn';
		btn.title = localize('alaska.chat.more', 'More');
		btn.setAttribute('aria-label', localize('alaska.chat.more', 'More'));
		btn.appendChild(buildChatHeadMoreIcon());
		wrap.appendChild(btn);

		const menu = document.createElement('div');
		menu.className = 'alaska-chat-more-menu alaska-floating-menu alaska-floating-menu-right alaska-floating-menu-below';
		menu.style.display = 'none';
		wrap.appendChild(menu);

		const buildItem = (glyph: string, label: string, sub: string, run: () => void): HTMLButtonElement => {
			const row = document.createElement('button');
			row.type = 'button';
			row.className = 'alaska-menu-item';
			const g = document.createElement('span');
			g.className = 'alaska-menu-item-glyph';
			g.textContent = glyph;
			row.appendChild(g);
			const body = document.createElement('span');
			body.className = 'alaska-menu-item-body';
			const lab = document.createElement('span');
			lab.textContent = label;
			body.appendChild(lab);
			if (sub) {
				const s = document.createElement('small');
				s.textContent = sub;
				body.appendChild(s);
			}
			row.appendChild(body);
			const meta = document.createElement('span');
			meta.className = 'alaska-menu-item-meta';
			row.appendChild(meta);
			row.addEventListener('click', ev => {
				ev.stopPropagation();
				menu.style.display = 'none';
				run();
			});
			return row;
		};

		const populate = (): void => {
			menu.replaceChildren();
			const group = document.createElement('div');
			group.className = 'alaska-menu-group-title';
			group.textContent = localize('alaska.chat.more.heading', 'Xipher IDE');
			menu.appendChild(group);
			menu.appendChild(buildItem('+', localize('alaska.chat.codeContext', 'Add code context'), localize('alaska.chat.codeContext.sub', 'pin selection or file'), () => void this.insertCodeContext()));
			// allow-any-unicode-next-line
			menu.appendChild(buildItem('⚙', localize('alaska.chat.openSettings', 'Settings'), localize('alaska.chat.openSettings.sub', 'models · effort · auto-continue'), () => this.openSettingsTab()));
			const agentLabel = this.agentAccess === 'edit'
				? localize('alaska.chat.agentReadonly', 'Switch agent to read-only')
				: localize('alaska.chat.agentEdit', 'Switch agent to edit');
			const agentSub = this.agentAccess === 'edit'
				? localize('alaska.chat.agentReadonly.sub', 'block write_file / patch_file / delete_file')
				: localize('alaska.chat.agentEdit.sub', 'expose full toolbox');
			// allow-any-unicode-next-line
			menu.appendChild(buildItem(this.agentAccess === 'edit' ? '⊙' : '✎', agentLabel, agentSub, () => {
				this.agentAccess = this.agentAccess === 'edit' ? 'read-only' : 'edit';
			}));
			// allow-any-unicode-next-line
			menu.appendChild(buildItem('⇦', localize('alaska.chat.signOut', 'Sign out'), '', () => void this.authService.signOut()));
		};

		btn.addEventListener('click', ev => {
			ev.stopPropagation();
			const visible = menu.style.display !== 'none';
			if (visible) {
				menu.style.display = 'none';
				return;
			}
			populate();
			menu.style.display = 'block';
			fitFloatingMenu(menu, this.signedInEl ?? this.rootEl);
		});

		return wrap;
	}

	private buildAttachMenu(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.style.position = 'relative';

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-icon-button';
		btn.title = localize('alaska.composer.attach', 'Attach context: file, folder, URL, image, or clipboard');
		btn.setAttribute('aria-label', localize('alaska.composer.attach', 'Attach context: file, folder, URL, image, or clipboard'));
		btn.appendChild(buildCodicon(Codicon.add));

		const menu = document.createElement('div');
		menu.className = 'alaska-attach-menu';
		menu.style.display = 'none';

		const items: Array<{ glyph: string; label: string; sub: string; run: () => Promise<void> | void }> = [
			// allow-any-unicode-next-line
			{ glyph: '‹›', label: localize('alaska.attach.file', 'File'), sub: localize('alaska.attach.file.sub', 'pick a file from the workspace'), run: () => this.pickFileMention() },
			// allow-any-unicode-next-line
			{ glyph: '▣', label: localize('alaska.attach.folder', 'Folder'), sub: localize('alaska.attach.folder.sub', 'recursive contents'), run: () => this.pickFolderMention() },
			// allow-any-unicode-next-line
			{ glyph: '▤', label: localize('alaska.attach.image', 'Image'), sub: localize('alaska.attach.image.sub', 'send a picture to the model'), run: () => this.pickImageAttachment() },
			{ glyph: '@', label: localize('alaska.attach.url', 'URL'), sub: localize('alaska.attach.url.sub', 'fetched once'), run: () => this.pickUrlMention() },
			// allow-any-unicode-next-line
			{ glyph: '⏎', label: localize('alaska.attach.clipboard', 'Clipboard'), sub: localize('alaska.attach.clipboard.sub', 'paste current clipboard'), run: () => this.pickClipboardMention() },
		];

		const group = document.createElement('div');
		group.className = 'alaska-menu-group-title';
		group.textContent = localize('alaska.attach.heading', 'Attach context');
		menu.appendChild(group);

		for (const it of items) {
			const row = document.createElement('button');
			row.type = 'button';
			row.className = 'alaska-menu-item';
			const glyph = document.createElement('span');
			glyph.className = 'alaska-menu-item-glyph';
			glyph.textContent = it.glyph;
			row.appendChild(glyph);
			const body = document.createElement('span');
			body.className = 'alaska-menu-item-body';
			const labelSpan = document.createElement('span');
			labelSpan.textContent = it.label;
			body.appendChild(labelSpan);
			const sub = document.createElement('small');
			sub.textContent = it.sub;
			body.appendChild(sub);
			row.appendChild(body);
			const meta = document.createElement('span');
			meta.className = 'alaska-menu-item-meta';
			row.appendChild(meta);
			row.addEventListener('click', async ev => {
				ev.stopPropagation();
				menu.style.display = 'none';
				try {
					await it.run();
				} catch (err) {
					this.logService.warn('[alaska.attach] action failed', err);
				}
			});
			menu.appendChild(row);
		}

		btn.addEventListener('click', ev => {
			ev.stopPropagation();
			const visible = menu.style.display !== 'none';
			menu.style.display = visible ? 'none' : 'block';
			if (!visible) {
				fitFloatingMenu(menu, this.signedInEl ?? this.rootEl);
			}
		});

		wrap.appendChild(btn);
		wrap.appendChild(menu);
		return wrap;
	}

	private async pickClipboardMention(): Promise<void> {
		let text = '';
		try {
			text = await navigator.clipboard.readText();
		} catch {
			text = '';
		}
		if (!text || !this.composerEl) {
			return;
		}
		const ta = this.composerEl;
		const start = ta.selectionStart ?? ta.value.length;
		const end = ta.selectionEnd ?? ta.value.length;
		ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
		ta.focus();
		const next = start + text.length;
		ta.setSelectionRange(next, next);
		this.autosizeComposer();
	}

	private readPermissionMode(): AlaskaPermissionMode {
		const raw = this.storageService.get(ALASKA_PERMISSION_MODE_KEY, StorageScope.WORKSPACE, 'ask');
		return (ALASKA_PERMISSION_MODES as readonly string[]).includes(raw) ? (raw as AlaskaPermissionMode) : 'ask';
	}

	private writePermissionMode(mode: AlaskaPermissionMode): void {
		this.storageService.store(ALASKA_PERMISSION_MODE_KEY, mode, StorageScope.WORKSPACE, StorageTarget.USER);
		if (mode === 'auto') {
			this.storageService.store(ALASKA_PLAN_AUTO_APPROVE_KEY, true, StorageScope.WORKSPACE, StorageTarget.USER);
		} else {
			this.storageService.remove(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.WORKSPACE);
		}
	}

	private buildPermissionsMenu(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.style.position = 'relative';

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-composer-permissions';
		// allow-any-unicode-next-line
		btn.title = localize('alaska.composer.permissions', 'Разрешения инструментов: Ask · Auto-apply · Read-only · Dry-run. Не путать с Agent Mode справа.');
		this.permissionButton = btn;

		const menu = document.createElement('div');
		menu.className = 'alaska-permission-menu';
		menu.style.display = 'none';
		this.permissionMenuEl = menu;

		this.updatePermissionLabel();
		this.populatePermissionMenu();

		btn.addEventListener('click', ev => {
			ev.stopPropagation();
			const visible = menu.style.display !== 'none';
			menu.style.display = visible ? 'none' : 'block';
			if (!visible) {
				this.populatePermissionMenu();
				fitFloatingMenu(menu, this.signedInEl ?? this.rootEl);
			}
		});

		wrap.appendChild(btn);
		wrap.appendChild(menu);
		return wrap;
	}

	private updatePermissionLabel(): void {
		if (!this.permissionButton) { return; }
		const mode = this.readPermissionMode();
		const config: Record<AlaskaPermissionMode, { icon: string; label: string }> = {
			// allow-any-unicode-next-line
			ask: { icon: '🔒', label: localize('alaska.perm.ask', 'Ask') },
			// allow-any-unicode-next-line
			auto: { icon: '⚡', label: localize('alaska.perm.auto', 'Auto') },
			// allow-any-unicode-next-line
			readonly: { icon: '👁', label: localize('alaska.perm.readonly', 'Read-only') },
			// allow-any-unicode-next-line
			plan: { icon: '📝', label: localize('alaska.perm.plan', 'Dry-run') },
		};
		const cfg = config[mode];
		this.permissionButton.replaceChildren();
		const iconEl = document.createElement('span');
		iconEl.className = 'alaska-permission-trigger-icon';
		iconEl.textContent = cfg.icon;
		this.permissionButton.appendChild(iconEl);
		const textEl = document.createElement('span');
		textEl.textContent = cfg.label;
		this.permissionButton.appendChild(textEl);
		const caret = document.createElement('small');
		// allow-any-unicode-next-line
		caret.textContent = '▾';
		this.permissionButton.appendChild(caret);
	}

	private populatePermissionMenu(): void {
		const menu = this.permissionMenuEl;
		if (!menu) { return; }
		menu.replaceChildren();
		const group = document.createElement('div');
		group.className = 'alaska-menu-group-title';
		group.textContent = localize('alaska.perm.heading', 'Permissions');
		menu.appendChild(group);

		const current = this.readPermissionMode();
		const items: Array<{ mode: AlaskaPermissionMode; glyph: string; label: string; sub: string }> = [
			// allow-any-unicode-next-line
			{ mode: 'ask', glyph: '?', label: localize('alaska.perm.ask', 'Ask'), sub: localize('alaska.perm.ask.sub', 'Инструменты: запрашивают подтверждение перед каждой правкой') },
			// allow-any-unicode-next-line
			{ mode: 'auto', glyph: '⚡', label: localize('alaska.perm.auto.long', 'Auto-apply'), sub: localize('alaska.perm.auto.sub', 'Инструменты: применяются молча, 1.5с показывается Undo') },
			// allow-any-unicode-next-line
			{ mode: 'readonly', glyph: '⊙', label: localize('alaska.perm.readonly', 'Read-only'), sub: localize('alaska.perm.readonly.sub', 'Инструменты: блокируются write_file / patch_file / delete_file / run_command') },
			// allow-any-unicode-next-line
			{ mode: 'plan', glyph: '▤', label: localize('alaska.perm.plan', 'Dry-run'), sub: localize('alaska.perm.plan.sub', 'Инструменты: то же что Read-only, плюс пометка в чате что планирование идёт') },
		];
		for (const it of items) {
			const isOn = it.mode === current;
			const row = document.createElement('button');
			row.type = 'button';
			row.className = 'alaska-menu-item' + (isOn ? ' alaska-menu-item-on' : '');
			const glyph = document.createElement('span');
			glyph.className = 'alaska-menu-item-glyph';
			glyph.textContent = it.glyph;
			row.appendChild(glyph);
			const body = document.createElement('span');
			body.className = 'alaska-menu-item-body';
			const labelSpan = document.createElement('span');
			labelSpan.textContent = it.label;
			body.appendChild(labelSpan);
			const sub = document.createElement('small');
			sub.textContent = it.sub;
			body.appendChild(sub);
			row.appendChild(body);
			const meta = document.createElement('span');
			meta.className = 'alaska-menu-item-meta';
			if (isOn) {
				// allow-any-unicode-next-line
				meta.textContent = '✓';
				meta.classList.add('alaska-menu-item-meta-on');
			}
			row.appendChild(meta);
			row.addEventListener('click', ev => {
				ev.stopPropagation();
				this.writePermissionMode(it.mode);
				this.updatePermissionLabel();
				if (this.permissionMenuEl) {
					this.permissionMenuEl.style.display = 'none';
				}
			});
			menu.appendChild(row);
		}
	}

	private buildAutoContinueToggle(): HTMLElement {
		this.selectedAutoContinue = this.storageService.getBoolean(AUTO_CONTINUE_STORAGE_KEY, StorageScope.WORKSPACE, false);
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-autocontinue';
		// allow-any-unicode-next-line
		btn.title = 'Авто-Продолжить: после finish_reason: length модель сама запросит продолжение, пока не дойдёт до stop или 30 мин не пройдёт.';
		this.autoContinueBtn = btn;
		btn.addEventListener('click', () => {
			this.selectedAutoContinue = !this.selectedAutoContinue;
			this.storageService.store(AUTO_CONTINUE_STORAGE_KEY, this.selectedAutoContinue, StorageScope.WORKSPACE, StorageTarget.USER);
			this.updateAutoContinueButton();
		});
		this.updateAutoContinueButton();
		return btn;
	}

	private updateAutoContinueButton(): void {
		if (!this.autoContinueBtn) { return; }
		// allow-any-unicode-next-line
		this.autoContinueBtn.textContent = this.selectedAutoContinue ? 'Auto ▸' : 'Auto ▫';
		this.autoContinueBtn.classList.toggle('alaska-autocontinue-on', this.selectedAutoContinue);
	}

	private buildAgentModePicker(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'alaska-mode-picker';

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-mode-button';
		// allow-any-unicode-next-line
		btn.title = localize('alaska.mode.pickerTooltip', 'Поведение AI: Chat · Plan (исследовать + написать тасклист) · Act (выполнить утверждённый план). Не путать с Permissions слева.');
		btn.addEventListener('click', ev => {
			ev.stopPropagation();
			this.toggleAgentModeMenu();
		});
		this.modeButton = btn;
		wrap.appendChild(btn);

		const menu = document.createElement('div');
		menu.className = 'alaska-mode-menu alaska-floating-menu';
		menu.style.display = 'none';
		this.modeMenuEl = menu;
		wrap.appendChild(menu);

		this.updateModePicker();
		return wrap;
	}

	private toggleAgentModeMenu(): void {
		if (!this.modeMenuEl) { return; }
		const visible = this.modeMenuEl.style.display !== 'none';
		this.modeMenuEl.style.display = visible ? 'none' : 'block';
		if (!visible) {
			this.populateAgentModeMenu();
			fitFloatingMenu(this.modeMenuEl, this.signedInEl ?? this.rootEl);
		}
	}

	private populateAgentModeMenu(): void {
		const menu = this.modeMenuEl;
		if (!menu) { return; }
		menu.replaceChildren();
		const group = document.createElement('div');
		group.className = 'alaska-menu-group-title';
		group.textContent = localize('alaska.mode.heading', 'Agent mode');
		menu.appendChild(group);
		const sessionId = this.activeSessionId ?? '';
		const current = sessionId ? this.agentModeService.getMode(sessionId) : 'chat';
		for (const m of ALASKA_AGENT_MODES) {
			const isOn = m === current;
			const row = document.createElement('button');
			row.type = 'button';
			row.className = 'alaska-menu-item alaska-mode-item' + (isOn ? ' alaska-mode-item-on alaska-menu-item-on' : '');
			const glyph = document.createElement('span');
			glyph.className = 'alaska-menu-item-glyph alaska-mode-dot';
			glyph.classList.add(`alaska-mode-dot-${m}`);
			row.appendChild(glyph);
			const body = document.createElement('span');
			body.className = 'alaska-menu-item-body';
			const label = document.createElement('span');
			label.textContent = this.labelForAgentMode(m);
			body.appendChild(label);
			const sub = document.createElement('small');
			sub.textContent = this.descriptionForAgentMode(m);
			body.appendChild(sub);
			row.appendChild(body);
			const meta = document.createElement('span');
			meta.className = 'alaska-menu-item-meta';
			if (isOn) {
				// allow-any-unicode-next-line
				meta.textContent = '✓';
				meta.classList.add('alaska-menu-item-meta-on');
			}
			row.appendChild(meta);
			row.addEventListener('click', ev => {
				ev.stopPropagation();
				if (sessionId) {
					this.agentModeService.setMode(sessionId, m);
				}
				if (this.modeMenuEl) {
					this.modeMenuEl.style.display = 'none';
				}
			});
			menu.appendChild(row);
		}
	}

	private updateModePicker(): void {
		if (!this.modeButton) { return; }
		const sessionId = this.activeSessionId ?? '';
		const mode = sessionId ? this.agentModeService.getMode(sessionId) : 'chat';
		this.modeButton.replaceChildren();
		const dot = document.createElement('span');
		dot.className = 'alaska-mode-dot';
		dot.classList.add(`alaska-mode-dot-${mode}`);
		this.modeButton.appendChild(dot);
		const tag = document.createElement('span');
		tag.className = 'alaska-mode-tag';
		tag.textContent = localize('alaska.mode.tag', 'Mode');
		this.modeButton.appendChild(tag);
		const value = document.createElement('span');
		value.className = 'alaska-mode-value';
		value.textContent = this.labelForAgentMode(mode);
		this.modeButton.appendChild(value);
		const caret = document.createElement('small');
		// allow-any-unicode-next-line
		caret.textContent = '▾';
		this.modeButton.appendChild(caret);
		this.modeButton.dataset.mode = mode;
	}

	private labelForAgentMode(mode: AlaskaAgentMode): string {
		switch (mode) {
			case 'plan': return localize('alaska.mode.plan.label', 'Plan');
			case 'act': return localize('alaska.mode.act.label', 'Act');
			case 'chat':
			default: return localize('alaska.mode.chat.label', 'Chat');
		}
	}

	private descriptionForAgentMode(mode: AlaskaAgentMode): string {
		switch (mode) {
			// allow-any-unicode-next-line
			case 'plan': return localize('alaska.mode.plan.sub', 'Поведение AI: исследует код и пишет тасклист, write/run отключены');
			// allow-any-unicode-next-line
			case 'act': return localize('alaska.mode.act.sub', 'Поведение AI: пошагово выполняет утверждённый план');
			case 'chat':
			default:
				// allow-any-unicode-next-line
				return localize('alaska.mode.chat.sub', 'Поведение AI: свободный диалог, все инструменты включены');
		}
	}

	private refreshModeBanner(): void {
		const banner = this.modeBannerEl;
		if (!banner) { return; }
		banner.replaceChildren();
		const sessionId = this.activeSessionId ?? '';
		if (!sessionId) {
			banner.classList.add('alaska-mode-banner-hidden');
			banner.removeAttribute('data-mode');
			return;
		}
		const mode = this.agentModeService.getMode(sessionId);
		if (mode === 'chat') {
			banner.classList.add('alaska-mode-banner-hidden');
			banner.removeAttribute('data-mode');
			return;
		}
		banner.classList.remove('alaska-mode-banner-hidden');
		banner.dataset.mode = mode;

		const header = document.createElement('div');
		header.className = 'alaska-mode-banner-header';
		const titleWrap = document.createElement('div');
		titleWrap.className = 'alaska-mode-banner-title-wrap';
		const dot = document.createElement('span');
		dot.className = 'alaska-mode-dot';
		dot.classList.add(`alaska-mode-dot-${mode}`);
		titleWrap.appendChild(dot);
		const title = document.createElement('span');
		title.className = 'alaska-mode-banner-title';
		title.textContent = mode === 'plan'
			? localize('alaska.mode.banner.plan', 'PLAN MODE — exploring; write tools disabled')
			: localize('alaska.mode.banner.act', 'ACT MODE — executing approved plan');
		titleWrap.appendChild(title);
		header.appendChild(titleWrap);

		const exitBtn = document.createElement('button');
		exitBtn.type = 'button';
		exitBtn.className = 'alaska-mode-banner-exit';
		exitBtn.textContent = mode === 'plan'
			// allow-any-unicode-next-line
			? localize('alaska.mode.banner.exitPlan', '→ Chat')
			// allow-any-unicode-next-line
			: localize('alaska.mode.banner.backToPlan', '← Plan');
		exitBtn.addEventListener('click', () => {
			if (mode === 'plan') {
				this.agentModeService.setMode(sessionId, 'chat');
			} else {
				this.agentModeService.backToPlan(sessionId);
			}
		});
		header.appendChild(exitBtn);
		banner.appendChild(header);

		if (mode === 'plan') {
			const draft = this.agentModeService.getDraftTasklist(sessionId);
			if (draft && draft.trim()) {
				this.renderPlanApprovalCard(banner, sessionId, draft);
			} else {
				const hint = document.createElement('p');
				hint.className = 'alaska-mode-banner-hint';
				hint.textContent = localize('alaska.mode.banner.planHint', 'Ask Xipher IDE to explore the codebase. When it finishes, it will propose a numbered tasklist for your approval.');
				banner.appendChild(hint);
			}
			return;
		}

		const approved = this.agentModeService.getApprovedTasklist(sessionId);
		if (approved && approved.length > 0) {
			this.renderActProgressCard(banner, approved);
		} else {
			const hint = document.createElement('p');
			hint.className = 'alaska-mode-banner-hint';
			hint.textContent = localize('alaska.mode.banner.actHint', 'No approved plan attached to this session. Switch to Plan mode to draft one.');
			banner.appendChild(hint);
		}
	}

	private renderPlanApprovalCard(parent: HTMLElement, sessionId: string, draftMarkdown: string): void {
		const card = document.createElement('div');
		card.className = 'alaska-plan-card';

		const heading = document.createElement('div');
		heading.className = 'alaska-plan-card-heading';
		const headingText = document.createElement('span');
		headingText.textContent = localize('alaska.plan.cardTitle', 'Proposed plan');
		heading.appendChild(headingText);
		const tasks = parseTasklist(draftMarkdown);
		if (tasks.length > 0) {
			const count = document.createElement('span');
			count.className = 'alaska-plan-card-count';
			count.textContent = localize('alaska.plan.cardCount', '{0} step{1}', tasks.length, tasks.length === 1 ? '' : 's');
			heading.appendChild(count);
		}
		card.appendChild(heading);

		const preview = document.createElement('div');
		preview.className = 'alaska-plan-card-preview';
		this.renderMessageContent(preview, draftMarkdown, true);
		card.appendChild(preview);

		const actions = document.createElement('div');
		actions.className = 'alaska-plan-card-actions';
		const approveBtn = document.createElement('button');
		approveBtn.type = 'button';
		approveBtn.className = 'alaska-pending-btn alaska-pending-btn-primary alaska-plan-card-approve';
		// allow-any-unicode-next-line
		approveBtn.textContent = localize('alaska.plan.approve', 'Approve plan → Act');
		approveBtn.disabled = tasks.length === 0;
		approveBtn.addEventListener('click', () => {
			const ok = this.agentModeService.approveAndSwitchToAct(sessionId);
			if (!ok) {
				this.notificationService.warn(localize('alaska.plan.parseFailed', 'Could not parse a numbered tasklist from the response. Ask Xipher IDE to format the steps as a numbered list (1., 2., ...).'));
			}
		});
		actions.appendChild(approveBtn);

		const refineBtn = document.createElement('button');
		refineBtn.type = 'button';
		refineBtn.className = 'alaska-pending-btn alaska-pending-btn-secondary';
		refineBtn.textContent = localize('alaska.plan.refine', 'Refine plan');
		refineBtn.addEventListener('click', () => {
			this.composerEl?.focus();
		});
		actions.appendChild(refineBtn);

		const discardBtn = document.createElement('button');
		discardBtn.type = 'button';
		discardBtn.className = 'alaska-pending-btn alaska-pending-btn-secondary';
		discardBtn.textContent = localize('alaska.plan.discard', 'Discard');
		discardBtn.addEventListener('click', () => {
			this.agentModeService.setDraftTasklist(sessionId, undefined);
		});
		actions.appendChild(discardBtn);
		card.appendChild(actions);

		parent.appendChild(card);
	}

	private renderActProgressCard(parent: HTMLElement, tasks: readonly ITaskItem[]): void {
		const card = document.createElement('div');
		card.className = 'alaska-act-card';

		const heading = document.createElement('div');
		heading.className = 'alaska-act-card-heading';
		const done = tasks.filter(t => t.completed).length;
		const headingText = document.createElement('span');
		headingText.textContent = localize('alaska.act.heading', 'Progress {0} / {1}', done, tasks.length);
		heading.appendChild(headingText);
		card.appendChild(heading);

		const bar = document.createElement('div');
		bar.className = 'alaska-act-progress-bar';
		const fill = document.createElement('i');
		const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
		fill.style.width = `${pct}%`;
		bar.appendChild(fill);
		card.appendChild(bar);

		const list = document.createElement('ol');
		list.className = 'alaska-act-tasklist';
		for (const t of tasks) {
			const li = document.createElement('li');
			li.className = 'alaska-act-task';
			li.dataset.completed = String(t.completed);
			const check = document.createElement('span');
			check.className = 'alaska-act-task-check';
			// allow-any-unicode-next-line
			check.textContent = t.completed ? '✓' : `${t.index}.`;
			li.appendChild(check);
			const desc = document.createElement('span');
			desc.className = 'alaska-act-task-desc';
			desc.textContent = t.description;
			li.appendChild(desc);
			list.appendChild(li);
		}
		card.appendChild(list);
		parent.appendChild(card);
	}

	private currentSession(): IChatSession | undefined {
		if (!this.activeSessionId) { return undefined; }
		return this.sessions.find(s => s.id === this.activeSessionId);
	}

	private contextWindowForCurrentModel(): number | undefined {
		const id = this.selectedModel();
		const m = this.models.find(mm => mm.id === id);
		return m?.context_tokens && m.context_tokens > 0 ? m.context_tokens : undefined;
	}

	private currentContextRatio(): number | undefined {
		const ctx = this.contextWindowForCurrentModel();
		const used = this.currentSession()?.lastInputTokens;
		if (!ctx || !used) { return undefined; }
		return used / ctx;
	}

	private updateContextRibbon(): void {
		if (!this.contextRibbonEl || !this.contextRibbonTextEl || !this.contextRibbonActionEl) { return; }
		const session = this.currentSession();
		const lastTruncated = this.thread.length > 0 && this.thread[this.thread.length - 1].role === 'assistant' && !!this.thread[this.thread.length - 1].truncated;
		const ratio = this.currentContextRatio();
		const cap = this.contextWindowForCurrentModel() ?? 0;
		const used = session?.lastInputTokens ?? 0;

		const ribbon = this.contextRibbonEl;
		const text = this.contextRibbonTextEl;
		const action = this.contextRibbonActionEl;
		ribbon.classList.remove('alaska-context-ribbon-critical', 'alaska-context-ribbon-continue');

		const newAction = action.cloneNode(false) as HTMLButtonElement;
		newAction.className = 'alaska-context-ribbon-action';
		action.replaceWith(newAction);
		this.contextRibbonActionEl = newAction;

		if (lastTruncated && !this.isStreaming) {
			ribbon.classList.remove('alaska-context-ribbon-hidden');
			ribbon.classList.add('alaska-context-ribbon-continue');
			// allow-any-unicode-next-line
			text.textContent = 'Ответ обрезан по лимиту токенов вывода.';
			// allow-any-unicode-next-line
			newAction.textContent = 'Продолжить';
			newAction.addEventListener('click', () => { void this.submit(true); });
			return;
		}

		if (ratio === undefined || ratio < WARN_AT_RATIO) {
			ribbon.classList.add('alaska-context-ribbon-hidden');
			return;
		}
		const pct = Math.round(ratio * 100);
		ribbon.classList.remove('alaska-context-ribbon-hidden');
		ribbon.classList.toggle('alaska-context-ribbon-critical', ratio >= COMPRESS_AT_RATIO);
		const usedFmt = formatTokenCount(used);
		const capFmt = formatTokenCount(cap);
		text.textContent = ratio >= COMPRESS_AT_RATIO
			// allow-any-unicode-next-line
			? `Контекст ${pct}% (${usedFmt} / ${capFmt}) — будет сжат при следующей отправке.`
			// allow-any-unicode-next-line
			: `Контекст ${pct}% (${usedFmt} / ${capFmt}) — сожму автоматически на 95%.`;
		// allow-any-unicode-next-line
		newAction.textContent = 'Сжать сейчас';
		newAction.addEventListener('click', () => { void this.compressOlderMessages(true); });
	}

	private async compressOlderMessages(force = false): Promise<void> {
		if (this.compressInFlight) { return this.compressInFlight; }
		const session = this.currentSession();
		if (!session) { return; }
		const fromIdx = session.summarizedThroughIndex ?? 0;
		const targetIdx = Math.max(fromIdx, this.thread.length - KEEP_LAST_MESSAGES);
		if (targetIdx <= fromIdx) { return; }
		const slice = this.thread.slice(fromIdx, targetIdx);
		if (slice.length === 0) { return; }
		const work = (async () => {
			const prior = session.runningSummary ?? '';
			const renderedOld = slice.map((m, i) => {
				const role = m.role === 'assistant' ? 'Assistant' : m.role === 'user' ? 'User' : 'Error';
				return `[#${fromIdx + i + 1} ${role}]\n${m.content}`;
			}).join('\n\n');
			// allow-any-unicode-next-line
			const sys = 'Ты сжимаешь историю чата для сохранения контекста. Выдай один плотный параграф (до 1500 токенов), сохрани все ключевые решения, имена файлов, состояние правок, договорённости. Никакого markdown, никаких списков. Только проза. Никакого вступления.';
			const user = (prior
				// allow-any-unicode-next-line
				? `Текущая сводка:\n${prior}\n\nДобавь к ней следующие сообщения:\n${renderedOld}`
				// allow-any-unicode-next-line
				: `Сожми эти сообщения в сводку:\n${renderedOld}`);
			const wire: IAlaskaChatMessage[] = [
				{ role: 'system', content: sys },
				{ role: 'user', content: user },
			];
			const src = new CancellationTokenSource();
			try {
				let acc = '';
				const stream = this.chatService.stream({
					model: this.selectedModel(),
					messages: wire,
					replyMode: 'snippet',
					reasoningEffort: this.currentModelSupportsEffort() ? 'low' : undefined,
				}, src.token);
				for await (const ev of stream) {
					if (ev.kind === 'delta') { acc += ev.text; }
					else if (ev.kind === 'done') { break; }
					else if (ev.kind === 'error') { throw new Error(ev.message); }
				}
				session.runningSummary = acc.trim() || prior;
				session.summarizedThroughIndex = targetIdx;
				this.saveActiveSession();
				this.updateContextRibbon();
			} catch (err) {
				this.logService.warn('[alaska.chat] compress failed', err);
				if (force) {
					throw err;
				}
			} finally {
				src.dispose();
			}
		})();
		this.compressInFlight = work;
		try { await work; } finally { this.compressInFlight = undefined; }
	}

	private shouldAutoContinue(session: IChatSession | undefined, finishReason: string | undefined): boolean {
		if (!session || !this.selectedAutoContinue) { return false; }
		if (finishReason !== 'length') { return false; }
		const started = session.turnStartedAt ?? 0;
		return Date.now() - started < AUTO_CONTINUE_WALLCLOCK_MS;
	}

	private openSettingsTab(): void {
		void this.editorService.openEditor(this.instantiationService.createInstance(AlaskaSettingsInput));
	}

	private toggleSettingsOverlay(): void {
		if (!this.settingsOverlayEl) { return; }
		this.settingsOpen = !this.settingsOpen;
		this.settingsOverlayEl.classList.toggle('alaska-settings-overlay-hidden', !this.settingsOpen);
		if (this.settingsOpen) {
			void this.ensureModels();
			this.renderSettingsOverlay();
		}
	}

	private renderSettingsOverlay(): void {
		const overlay = this.settingsOverlayEl;
		if (!overlay) { return; }
		overlay.replaceChildren();

		const head = document.createElement('div');
		head.className = 'alaska-settings-head';
		const title = document.createElement('h2');
		title.className = 'alaska-settings-title';
		title.textContent = 'Xipher IDE Settings';
		head.appendChild(title);
		const closeBtn = document.createElement('button');
		closeBtn.type = 'button';
		closeBtn.className = 'alaska-settings-close';
		closeBtn.setAttribute('aria-label', 'Close settings');
		closeBtn.appendChild(buildCodicon(Codicon.close));
		closeBtn.addEventListener('click', () => this.toggleSettingsOverlay());
		head.appendChild(closeBtn);
		overlay.appendChild(head);

		const body = document.createElement('div');
		body.className = 'alaska-settings-body';
		overlay.appendChild(body);

		body.appendChild(this.buildAccountCard());
		body.appendChild(this.buildModelsCard());
		body.appendChild(this.buildPreferencesCard());
	}

	private buildAccountCard(): HTMLElement {
		const card = document.createElement('section');
		card.className = 'alaska-settings-card';
		const heading = document.createElement('h3');
		heading.className = 'alaska-settings-card-heading';
		heading.textContent = 'Account';
		card.appendChild(heading);

		const user = this.authService.state.user;
		const row = document.createElement('div');
		row.className = 'alaska-settings-account-row';

		const left = document.createElement('div');
		left.className = 'alaska-settings-account-left';
		const name = document.createElement('div');
		name.className = 'alaska-settings-account-name';
		name.textContent = user?.name || user?.email || 'Not signed in';
		left.appendChild(name);
		if (user?.email && user.name) {
			const email = document.createElement('div');
			email.className = 'alaska-settings-account-email';
			email.textContent = user.email;
			left.appendChild(email);
		}
		row.appendChild(left);

		if (user?.plan) {
			const planTag = document.createElement('span');
			planTag.className = `alaska-settings-plan-tag alaska-settings-plan-${user.plan}`;
			planTag.textContent = user.plan.toUpperCase();
			row.appendChild(planTag);
		}
		card.appendChild(row);

		const linkRow = document.createElement('div');
		linkRow.className = 'alaska-settings-link-row';
		const manageBtn = document.createElement('a');
		manageBtn.className = 'alaska-settings-link';
		manageBtn.href = 'https://alaska-ai.shop/dashboard/billing';
		manageBtn.target = '_blank';
		manageBtn.rel = 'noopener noreferrer';
		manageBtn.textContent = 'Manage plan & billing →';
		linkRow.appendChild(manageBtn);
		const usageBtn = document.createElement('a');
		usageBtn.className = 'alaska-settings-link';
		usageBtn.href = 'https://alaska-ai.shop/dashboard/usage';
		usageBtn.target = '_blank';
		usageBtn.rel = 'noopener noreferrer';
		usageBtn.textContent = 'Usage dashboard →';
		linkRow.appendChild(usageBtn);
		card.appendChild(linkRow);

		return card;
	}

	private buildModelsCard(): HTMLElement {
		const card = document.createElement('section');
		card.className = 'alaska-settings-card';
		const heading = document.createElement('h3');
		heading.className = 'alaska-settings-card-heading';
		heading.textContent = 'Models';
		card.appendChild(heading);

		const hint = document.createElement('p');
		hint.className = 'alaska-settings-hint';
		hint.textContent = 'Available models for your plan. Locked rows require a plan upgrade.';
		card.appendChild(hint);

		const list = document.createElement('div');
		list.className = 'alaska-settings-model-list';
		const userPlan = this.authService.state.user?.plan ?? 'free';
		if (this.models.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'alaska-settings-model-empty';
			empty.textContent = this.modelsLoading ? 'Loading…' : 'No models available.';
			list.appendChild(empty);
		}
		for (const model of this.models) {
			const item = document.createElement('div');
			const allowed = planAllows(userPlan, model.requires_plan);
			const isSelected = model.id === this.selectedModelId;
			item.className = `alaska-settings-model-item${allowed ? '' : ' alaska-settings-model-locked'}${isSelected ? ' alaska-settings-model-selected' : ''}`;
			if (allowed) {
				item.addEventListener('click', () => {
					this.setActiveModelInStorage(model.id, model.label);
					this.updateModelPicker();
					this.updateEffortPicker();
					this.renderSettingsOverlay();
				});
			}

			const head = document.createElement('div');
			head.className = 'alaska-settings-model-head';
			const indicator = document.createElement('span');
			indicator.className = 'alaska-settings-model-indicator';
			indicator.appendChild(buildCodicon(allowed ? (isSelected ? Codicon.passFilled : Codicon.circleOutline) : Codicon.lock));
			head.appendChild(indicator);
			const label = document.createElement('strong');
			label.className = 'alaska-settings-model-label';
			label.textContent = model.label;
			head.appendChild(label);
			const planTag = document.createElement('span');
			planTag.className = `alaska-settings-model-plan alaska-settings-plan-${model.requires_plan}`;
			planTag.textContent = model.requires_plan.toUpperCase();
			head.appendChild(planTag);
			if (model.supports_reasoning_effort) {
				const effort = document.createElement('span');
				effort.className = 'alaska-settings-model-cap';
				effort.textContent = 'reasoning_effort';
				head.appendChild(effort);
			}
			if (model.supports_vision) {
				const vision = document.createElement('span');
				vision.className = 'alaska-settings-model-cap alaska-settings-model-cap-vision';
				vision.textContent = 'vision';
				head.appendChild(vision);
			}
			item.appendChild(head);

			const desc = document.createElement('p');
			desc.className = 'alaska-settings-model-desc';
			desc.textContent = model.description;
			item.appendChild(desc);

			const meta = document.createElement('div');
			meta.className = 'alaska-settings-model-meta';
			const ctx = document.createElement('span');
			ctx.textContent = `${Math.round(model.context_tokens / 1000)}k context`;
			meta.appendChild(ctx);
			item.appendChild(meta);

			list.appendChild(item);
		}
		card.appendChild(list);
		return card;
	}

	private buildPreferencesCard(): HTMLElement {
		const card = document.createElement('section');
		card.className = 'alaska-settings-card';
		const heading = document.createElement('h3');
		heading.className = 'alaska-settings-card-heading';
		heading.textContent = 'Preferences';
		card.appendChild(heading);

		const effortRow = document.createElement('div');
		effortRow.className = 'alaska-settings-pref-row';
		const effortLabel = document.createElement('div');
		effortLabel.className = 'alaska-settings-pref-label';
		const effortTitle = document.createElement('strong');
		effortTitle.textContent = 'Default reasoning effort';
		effortLabel.appendChild(effortTitle);
		const effortHint = document.createElement('span');
		effortHint.textContent = 'Applies to gpt-5.4, gpt-5.4-mini, gpt-5.5. Higher = slower, more thorough.';
		effortLabel.appendChild(effortHint);
		effortRow.appendChild(effortLabel);
		const effortGroup = document.createElement('div');
		effortGroup.className = 'alaska-settings-segmented';
		for (const v of ALASKA_REASONING_EFFORTS) {
			const opt = document.createElement('button');
			opt.type = 'button';
			opt.className = `alaska-settings-segment${v === this.selectedEffort ? ' alaska-settings-segment-active' : ''}`;
			opt.textContent = v;
			opt.addEventListener('click', () => {
				this.setActiveEffortInStorage(v);
				this.updateEffortPicker();
				this.renderSettingsOverlay();
			});
			effortGroup.appendChild(opt);
		}
		effortRow.appendChild(effortGroup);
		card.appendChild(effortRow);

		const autoRow = document.createElement('div');
		autoRow.className = 'alaska-settings-pref-row';
		const autoLabel = document.createElement('div');
		autoLabel.className = 'alaska-settings-pref-label';
		const autoTitle = document.createElement('strong');
		autoTitle.textContent = 'Auto-continue on length cap';
		autoLabel.appendChild(autoTitle);
		const autoHint = document.createElement('span');
		autoHint.textContent = 'When upstream cuts the answer mid-flight, automatically resume. Stops on natural finish or 30-min wallclock.';
		autoLabel.appendChild(autoHint);
		autoRow.appendChild(autoLabel);
		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = `alaska-settings-toggle${this.selectedAutoContinue ? ' alaska-settings-toggle-on' : ''}`;
		toggle.setAttribute('role', 'switch');
		toggle.setAttribute('aria-checked', this.selectedAutoContinue ? 'true' : 'false');
		toggle.appendChild(document.createElement('span'));
		toggle.addEventListener('click', () => {
			this.selectedAutoContinue = !this.selectedAutoContinue;
			this.storageService.store(AUTO_CONTINUE_STORAGE_KEY, this.selectedAutoContinue, StorageScope.WORKSPACE, StorageTarget.USER);
			this.updateAutoContinueButton();
			this.renderSettingsOverlay();
		});
		autoRow.appendChild(toggle);
		card.appendChild(autoRow);

		return card;
	}

	private buildUserLine(): HTMLElement {
		const wrap = document.createElement('span');
		const user = this.authService.state.user;
		if (user) {
			const name = document.createElement('span');
			name.className = 'alaska-user-name';
			name.textContent = user.name || user.email;
			wrap.appendChild(name);
			const tail = document.createElement('span');
			tail.textContent = ` · ${user.plan}`;
			this.modelPlanEl = tail;
			wrap.appendChild(tail);
		} else {
			wrap.textContent = 'Signed in';
		}
		return wrap;
	}

	private refreshContextLabel(): void {
		this.refreshActiveContextMeta();
		if (!this.contextLabelEl) { return; }
		const ctx = this.contextSvc.captureCurrent();
		if (!ctx.filePath) {
			const open = ctx.openFiles?.length ? ` · ${ctx.openFiles.length} open file${ctx.openFiles.length === 1 ? '' : 's'}` : '';
			this.contextLabelEl.textContent = ctx.workspaceName
				? `Workspace: ${ctx.workspaceName}${open} · folder tree attached on send`
				: 'No active file context';
			this.contextLabelEl.title = this.contextLabelEl.textContent;
			return;
		}
		const language = ctx.languageId ? ` · ${ctx.languageId}` : '';
		const sel = ctx.selection ? ` · L${ctx.selection.startLine}-${ctx.selection.endLine}` : '';
		const size = ctx.fullText ? ` · ${formatBytes(ctx.fullText.length)}` : '';
		this.contextLabelEl.textContent = `${ctx.filePath}${language}${sel}${size}`;
		this.contextLabelEl.title = this.contextLabelEl.textContent;
	}

	private renderEmpty(): void {
		if (!this.messagesEl) { return; }
		this.clearMessagesContainer();
		const empty = document.createElement('div');
		empty.className = 'alaska-empty';
		empty.appendChild(buildAlaskaLogo('alaska-empty-logo'));
		const title = document.createElement('div');
		title.className = 'alaska-empty-title';
		title.textContent = localize('alaska.empty.heading', 'How can I help?');
		empty.appendChild(title);
		const subtitle = document.createElement('div');
		subtitle.className = 'alaska-empty-subtitle';
		subtitle.textContent = localize('alaska.empty.subtitle', 'Ask anything, or pick a starter prompt below. Shift+Enter for a new line.');
		empty.appendChild(subtitle);
		if (this.contextSvc.hasProjectRules()) {
			const badge = document.createElement('div');
			badge.className = 'alaska-empty-badge';
			// allow-any-unicode-next-line
			badge.textContent = '📜 Project rules loaded';
			empty.appendChild(badge);
		}
		const remoteAuthority = this.workspaceService.getWorkspace().folders[0]?.uri.scheme === Schemas.alaskacodeRemote
			? this.workspaceService.getWorkspace().folders[0]?.uri.authority
			: undefined;
		if (remoteAuthority) {
			const remoteBadge = document.createElement('div');
			remoteBadge.className = 'alaska-empty-badge alaska-empty-badge-remote';
			remoteBadge.textContent = `Remote workspace · ${remoteAuthority} · tools run on the remote host`;
			empty.appendChild(remoteBadge);
		} else {
			empty.appendChild(this.buildRemoteCta());
		}
		empty.appendChild(this.buildSamplePromptCards());
		this.messagesEl.appendChild(empty);
		void this.refreshGitRepoFlag();
	}

	private buildSamplePromptCards(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'alaska-empty-cards';
		const available = this.filterAvailablePrompts(ALASKA_SAMPLE_PROMPTS);
		for (const p of available) {
			const card = document.createElement('button');
			card.type = 'button';
			card.className = 'alaska-empty-card';
			card.setAttribute('aria-label', p.title);
			const iconEl = document.createElement('span');
			iconEl.className = 'alaska-empty-card-icon';
			iconEl.appendChild(buildCodicon(p.icon));
			card.appendChild(iconEl);
			const text = document.createElement('span');
			text.className = 'alaska-empty-card-text';
			const titleEl = document.createElement('span');
			titleEl.className = 'alaska-empty-card-title';
			titleEl.textContent = p.title;
			text.appendChild(titleEl);
			const descEl = document.createElement('span');
			descEl.className = 'alaska-empty-card-desc';
			descEl.textContent = p.description;
			text.appendChild(descEl);
			card.appendChild(text);
			card.addEventListener('click', () => this.applySamplePrompt(p));
			wrap.appendChild(card);
		}
		return wrap;
	}

	private filterAvailablePrompts(prompts: readonly IAlaskaSamplePrompt[]): IAlaskaSamplePrompt[] {
		const hasWorkspace = this.workspaceService.getWorkspace().folders.length > 0;
		const hasEditor = !!this.editorService.activeEditor?.resource;
		const hasGit = this.hasGitRepo === true;
		const filtered: IAlaskaSamplePrompt[] = [];
		for (const p of prompts) {
			if (p.requires === 'workspace' && !hasWorkspace) { continue; }
			if (p.requires === 'active_editor' && !hasEditor) { continue; }
			if (p.requires === 'git_repo' && !hasGit) { continue; }
			filtered.push(p);
			if (filtered.length >= 6) { break; }
		}
		return filtered;
	}

	private applySamplePrompt(p: IAlaskaSamplePrompt): void {
		if (!this.composerEl) { return; }
		this.composerEl.value = p.prompt;
		this.composerEl.focus();
		this.composerEl.setSelectionRange(p.prompt.length, p.prompt.length);
		this.autosizeComposer();
	}

	private async refreshGitRepoFlag(): Promise<void> {
		if (this.gitCheckInFlight) { return; }
		const folder = this.workspaceService.getWorkspace().folders[0];
		if (!folder) {
			if (this.hasGitRepo !== false) {
				this.hasGitRepo = false;
			}
			return;
		}
		this.gitCheckInFlight = true;
		try {
			const gitDir = joinPath(folder.uri, '.git');
			const exists = await this.fileService.exists(gitDir);
			const changed = this.hasGitRepo !== exists;
			this.hasGitRepo = exists;
			if (changed && this.thread.length === 0 && this.messagesEl) {
				this.renderEmptyCardsOnly();
			}
		} catch {
			this.hasGitRepo = false;
		} finally {
			this.gitCheckInFlight = false;
		}
	}

	private renderEmptyCardsOnly(): void {
		if (!this.messagesEl) { return; }
		const host = this.messagesEl.querySelector('.alaska-empty');
		if (!host) { return; }
		const existing = host.querySelector('.alaska-empty-cards');
		const cards = this.buildSamplePromptCards();
		if (existing) {
			existing.replaceWith(cards);
		} else {
			host.appendChild(cards);
		}
	}

	private updateSlashMenu(): void {
		if (!this.composerEl || !this.slashMenuEl) { return; }
		const value = this.composerEl.value;
		const trimmedStart = value.trimStart();
		if (!trimmedStart.startsWith('/')) {
			this.hideSlashMenu();
			return;
		}
		if (/\s/.test(trimmedStart)) {
			this.hideSlashMenu();
			return;
		}
		const matches = this.slashService.match(trimmedStart);
		if (matches.length === 0) {
			this.hideSlashMenu();
			return;
		}
		this.slashMenuMatches = matches.slice(0, 8);
		this.slashMenuActiveIdx = 0;
		this.renderSlashMenu();
	}

	private renderSlashMenu(): void {
		if (!this.slashMenuEl) { return; }
		this.slashMenuEl.replaceChildren();
		for (let i = 0; i < this.slashMenuMatches.length; i++) {
			const cmd = this.slashMenuMatches[i];
			const item = document.createElement('button');
			item.type = 'button';
			item.className = i === this.slashMenuActiveIdx ? 'alaska-slash-item alaska-slash-item-active' : 'alaska-slash-item';
			item.setAttribute('role', 'option');
			item.dataset.trigger = cmd.trigger;
			const label = document.createElement('div');
			label.className = 'alaska-slash-item-label';
			const trig = document.createElement('code');
			trig.className = 'alaska-slash-trigger';
			trig.textContent = cmd.trigger;
			label.appendChild(trig);
			const name = document.createElement('span');
			name.className = 'alaska-slash-name';
			name.textContent = cmd.label;
			label.appendChild(name);
			item.appendChild(label);
			const desc = document.createElement('small');
			desc.className = 'alaska-slash-item-desc';
			desc.textContent = cmd.description;
			item.appendChild(desc);
			item.addEventListener('mousedown', e => {
				e.preventDefault();
				this.applySlashChoice(cmd);
			});
			item.addEventListener('mouseenter', () => {
				this.slashMenuActiveIdx = i;
				this.refreshSlashHighlight();
			});
			this.slashMenuEl.appendChild(item);
		}
		this.slashMenuEl.style.display = 'block';
		this.slashMenuOpen = true;
	}

	private refreshSlashHighlight(): void {
		if (!this.slashMenuEl) { return; }
		const children = this.slashMenuEl.children;
		for (let i = 0; i < children.length; i++) {
			const el = children[i] as HTMLElement;
			el.classList.toggle('alaska-slash-item-active', i === this.slashMenuActiveIdx);
		}
	}

	private moveSlashHighlight(delta: number): void {
		if (this.slashMenuMatches.length === 0) { return; }
		const next = (this.slashMenuActiveIdx + delta + this.slashMenuMatches.length) % this.slashMenuMatches.length;
		this.slashMenuActiveIdx = next;
		this.refreshSlashHighlight();
	}

	private hideSlashMenu(): void {
		if (!this.slashMenuOpen) { return; }
		if (this.slashMenuEl) {
			this.slashMenuEl.style.display = 'none';
		}
		this.slashMenuMatches = [];
		this.slashMenuActiveIdx = 0;
		this.slashMenuOpen = false;
	}

	private applySlashChoice(cmd: IAlaskaSlashCommand): void {
		if (!this.composerEl) { return; }
		if (cmd.args && cmd.args.length > 0) {
			this.composerEl.value = cmd.trigger + ' ';
			this.composerEl.focus();
			this.composerEl.setSelectionRange(this.composerEl.value.length, this.composerEl.value.length);
			this.autosizeComposer();
			this.hideSlashMenu();
			return;
		}
		this.composerEl.value = '';
		this.autosizeComposer();
		this.hideSlashMenu();
		void this.executeSlashTrigger(cmd.trigger);
	}

	private async executeSlashTrigger(input: string): Promise<void> {
		if (this.isStreaming) {
			this.notificationService.warn(localize('alaska.slash.busyStream', 'Wait for the current response to finish before running a slash command.'));
			return;
		}
		const ctx = this.buildSlashContext();
		try {
			const handled = await this.slashService.execute(input, ctx);
			if (!handled) {
				this.notificationService.warn(localize('alaska.slash.unknown', 'Unknown command: {0}', input.trim().split(/\s+/)[0]));
			}
		} catch (err) {
			this.notificationService.error(err instanceof Error ? err.message : String(err));
		}
	}

	private buildSlashContext(): IAlaskaSlashContext {
		// A stable services accessor: resolve each service lazily through a fresh
		// invokeFunction so it stays valid after this method returns. Capturing the
		// transient `a` and using it later throws "service accessor is only valid
		// during the invocation of its target method".
		const services: ServicesAccessor = {
			get: (id) => this.instantiationService.invokeFunction(a => a.get(id)),
		};
		return {
			services,
			newSession: () => this.startNewThread(),
			submitUserMessage: async (text: string) => {
				if (!this.composerEl) { return; }
				this.composerEl.value = text;
				this.autosizeComposer();
				await this.submit();
			},
			injectAssistantMessage: (markdown: string) => {
				this.appendMessage({ role: 'assistant', content: markdown, createdAt: Date.now() });
			},
			exportActiveSessionAsMarkdown: () => this.buildSessionMarkdownExport(),
			insertIntoComposer: (text: string, focus = true) => {
				if (!this.composerEl) { return; }
				this.composerEl.value = text;
				this.autosizeComposer();
				if (focus) { this.composerEl.focus(); }
			},
			compactHistory: async () => {
				const session = this.currentSession();
				const foldedBefore = session?.summarizedThroughIndex ?? 0;
				const ratioBefore = this.currentContextRatio();
				await this.compressOlderMessages(true);
				const foldedAfter = this.currentSession()?.summarizedThroughIndex ?? 0;
				return {
					compacted: foldedAfter > foldedBefore,
					messagesFolded: Math.max(0, foldedAfter - foldedBefore),
					ratioBefore,
					ratioAfter: this.currentContextRatio(),
				};
			},
		};
	}

	private buildSessionMarkdownExport(): string {
		const session = this.currentSession();
		if (!session || session.messages.length === 0) { return ''; }
		return exportSessionAsMarkdown({
			id: session.id,
			title: session.title,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			messages: session.messages,
		});
	}

	public forceSkillForNextTurn(name: string): boolean {
		const skill = this.skillService.get(name);
		if (!skill) { return false; }
		if (!this.forcedSkillNames.includes(name)) {
			this.forcedSkillNames.push(name);
		}
		return true;
	}

	private takeForcedSkills(): readonly import('../common/alaskaSkill.js').IAlaskaSkill[] {
		if (this.forcedSkillNames.length === 0) { return []; }
		const names = this.forcedSkillNames.slice();
		this.forcedSkillNames = [];
		const out: import('../common/alaskaSkill.js').IAlaskaSkill[] = [];
		for (const n of names) {
			const s = this.skillService.get(n);
			if (s) { out.push(s); }
		}
		return out;
	}

	public openModelPicker(): void {
		if (!this.modelMenuEl) { return; }
		if (this.modelMenuEl.style.display === 'none') {
			this.toggleModelMenu();
		}
	}

	private buildTokenCounter(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'alaska-token-counter';
		wrap.title = localize('alaska.tokenCounter.tooltip', 'Approximate context size for the next turn. Cost estimate is rough (±20%).');
		const bar = document.createElement('div');
		bar.className = 'alaska-token-bar';
		const fill = document.createElement('i');
		bar.appendChild(fill);
		wrap.appendChild(bar);
		const label = document.createElement('span');
		label.className = 'alaska-token-label';
		wrap.appendChild(label);
		const cost = document.createElement('span');
		cost.className = 'alaska-token-cost';
		cost.style.display = 'none';
		wrap.appendChild(cost);
		this.tokenCounterEl = wrap;
		this.refreshTokenCounter();
		return wrap;
	}

	private scheduleTokenCounterUpdate(): void {
		if (this.tokenCounterRaf) { return; }
		this.tokenCounterRaf = mainWindow.requestAnimationFrame(() => {
			this.tokenCounterRaf = 0;
			this.refreshTokenCounter();
		});
	}

	private refreshTokenCounter(): void {
		if (!this.tokenCounterEl) { return; }
		const composerText = this.composerEl?.value ?? '';
		const newImages = this.pendingImages.length;
		const newTokens = estimateAlaskaTokens(composerText, newImages);
		const contextTokens = this.estimateContextTokens();
		const total = newTokens + contextTokens;
		const limit = this.currentModelContextLimit();
		const pct = Math.min(100, (total / limit) * 100);
		const fill = this.tokenCounterEl.querySelector<HTMLElement>('.alaska-token-bar i');
		if (fill) {
			fill.style.width = `${pct.toFixed(1)}%`;
			fill.classList.toggle('alaska-token-bar-warn', pct > 90 && pct <= 100);
			fill.classList.toggle('alaska-token-bar-over', pct > 100);
		}
		const label = this.tokenCounterEl.querySelector<HTMLElement>('.alaska-token-label');
		if (label) {
			let text = `${formatTokenCount(total)} / ${formatTokenCount(limit)}`;
			if (newTokens > 0) {
				text += ` (+${formatTokenCount(newTokens)})`;
			}
			label.textContent = text;
		}
		const costEl = this.tokenCounterEl.querySelector<HTMLElement>('.alaska-token-cost');
		if (costEl) {
			if (this.isBYOActive()) {
				costEl.style.display = 'none';
			} else {
				const cost = this.estimateTurnCost(contextTokens + newTokens);
				if (cost > 0) {
					costEl.style.display = '';
					costEl.textContent = `~$${cost.toFixed(cost < 0.01 ? 4 : 2)}`;
					costEl.title = localize('alaska.token.costTooltip', 'Rough estimate. Includes a 500-token output budget at the model\'s current pricing.');
				} else {
					costEl.style.display = 'none';
				}
			}
		}
	}

	private estimateContextTokens(): number {
		let total = 0;
		for (const m of this.thread) {
			total += estimateAlaskaTokens(m.content || '', m.images?.length ?? 0);
			if (m.reasoning) { total += estimateAlaskaTokens(m.reasoning, 0); }
		}
		const ctx = this.contextSvc.captureCurrent();
		if (ctx.fullText) { total += estimateAlaskaTokens(ctx.fullText, 0); }
		if (ctx.selection?.text) { total += estimateAlaskaTokens(ctx.selection.text, 0); }
		for (const pin of this.pendingMentions) {
			total += estimateAlaskaTokens(pin.label, 0);
		}
		total += 1200;
		return total;
	}

	private currentModelContextLimit(): number {
		const id = this.selectedModel();
		const model = this.models.find(mm => mm.id === id);
		return model?.context_tokens ?? 200_000;
	}

	private estimateTurnCost(totalTokens: number): number {
		const id = this.selectedModel() ?? '';
		const rate = ALASKA_PRICE_TABLE[id] ?? ALASKA_PRICE_TABLE_DEFAULT;
		const inputCost = (totalTokens / 1_000_000) * rate.input;
		const outputCost = (500 / 1_000_000) * rate.output;
		return inputCost + outputCost;
	}

	private isBYOActive(): boolean {
		const cfg = this.byoService.getConfig();
		const isUltra = (this.authService.state.user?.plan ?? '').toLowerCase() === 'ultra';
		return cfg.enabled && cfg.hasKey && isUltra;
	}

	private buildRemoteCta(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'alaska-empty-remote-cta';
		const heading = document.createElement('div');
		heading.className = 'alaska-empty-remote-cta-heading';
		// allow-any-unicode-next-line
		heading.textContent = localize('alaska.chat.remote.heading', 'Работа на удалённом хосте');
		wrap.appendChild(heading);

		const row = document.createElement('div');
		row.className = 'alaska-empty-remote-cta-row';

		const sshBtn = document.createElement('button');
		sshBtn.type = 'button';
		sshBtn.className = 'alaska-empty-remote-cta-btn';
		const sshGlyph = document.createElement('span');
		sshGlyph.className = 'alaska-empty-remote-cta-glyph';
		// allow-any-unicode-next-line
		sshGlyph.textContent = '↗';
		sshBtn.appendChild(sshGlyph);
		const sshLabel = document.createElement('span');
		// allow-any-unicode-next-line
		sshLabel.textContent = localize('alaska.chat.remote.ssh', 'Подключиться по SSH…');
		sshBtn.appendChild(sshLabel);
		sshBtn.addEventListener('click', () => {
			void this.commandService.executeCommand('alaskaAI.connectSSH');
		});
		row.appendChild(sshBtn);

		if (OS === OperatingSystem.Windows) {
			const wslBtn = document.createElement('button');
			wslBtn.type = 'button';
			wslBtn.className = 'alaska-empty-remote-cta-btn';
			const wslGlyph = document.createElement('span');
			wslGlyph.className = 'alaska-empty-remote-cta-glyph';
			// allow-any-unicode-next-line
			wslGlyph.textContent = '▤';
			wslBtn.appendChild(wslGlyph);
			const wslLabel = document.createElement('span');
			// allow-any-unicode-next-line
			wslLabel.textContent = localize('alaska.chat.remote.wsl', 'Открыть в WSL…');
			wslBtn.appendChild(wslLabel);
			wslBtn.addEventListener('click', () => {
				void this.commandService.executeCommand('alaskaAI.connectWSL');
			});
			row.appendChild(wslBtn);
		}

		wrap.appendChild(row);
		const hint = document.createElement('div');
		hint.className = 'alaska-empty-remote-cta-hint';
		// allow-any-unicode-next-line
		hint.textContent = localize('alaska.chat.remote.hint', 'Нужно расширение Open Remote SSH / WSL — установится автоматически по клику.');
		wrap.appendChild(hint);
		return wrap;
	}

	private loadSessions(): void {
		const raw = this.storageService.get(CHAT_SESSIONS_KEY, StorageScope.WORKSPACE, '[]');
		let sessions: IChatSession[] = [];
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				sessions = parsed
					.filter(isStoredChatSession)
					.map(session => migrateSessionTitleFlags({ ...session, messages: session.messages.filter(isThreadMessage) }))
					.map(session => migrateSessionToV2(session));
			}
		} catch {
			sessions = [];
		}
		this.sessions = sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
		this.activeSessionId = this.storageService.get(ACTIVE_CHAT_SESSION_KEY, StorageScope.WORKSPACE, undefined);
		if (!this.activeSessionId || !this.sessions.some(session => session.id === this.activeSessionId)) {
			this.activeSessionId = this.sessions[0]?.id;
		}
		if (!this.activeSessionId) {
			this.createSession(false);
		}
	}

	private createSession(save = true): IChatSession {
		const now = Date.now();
		const session: IChatSession = {
			id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
			title: 'New chat',
			messages: [],
			version: 2,
			activeLeafId: null,
			createdAt: now,
			updatedAt: now,
		};
		this.sessions.unshift(session);
		this.activeSessionId = session.id;
		if (save) {
			this.saveSessions();
		}
		this.renderSessionsMenu();
		return session;
	}

	private openSession(id: string | undefined, save = true): void {
		let session = id ? this.sessions.find(candidate => candidate.id === id) : undefined;
		if (!session) {
			session = this.createSession(false);
		}
		this.activeSessionId = session.id;
		const branch = getActiveThread(session);
		this.thread.splice(0, this.thread.length, ...branch.map(msg => ({ ...msg })));
		this.renderThread();
		if (save) {
			this.saveSessions();
		}
		this.renderSessionsMenu();
		this.updateContextRibbon();
		this.refreshThreadTitle();
		this.updateModePicker();
		this.refreshModeBanner();
	}

	private refreshThreadTitle(): void {
		if (!this.threadTitleEl) { return; }
		const session = this.currentSession();
		const title = session?.title || localize('alaska.chat.newThread', 'New chat');
		this.threadTitleEl.textContent = title;
		this.threadTitleEl.title = title;
	}

	private saveActiveSession(): void {
		const session = this.sessions.find(candidate => candidate.id === this.activeSessionId) ?? this.createSession(false);
		this.syncThreadIntoSession(session);
		session.version = 2;
		session.updatedAt = Date.now();
		if (!session.titleUserSet && !session.titleAuto) {
			session.title = getSessionTitle(getActiveThread(session));
		}
		this.sessions = [session, ...this.sessions.filter(candidate => candidate.id !== session.id)].slice(0, 50);
		this.saveSessions();
		this.renderSessionsMenu();
		this.refreshThreadTitle();
		void this.maybeSummarizeTitle(session);
	}

	private syncThreadIntoSession(session: IChatSession): void {
		const existingById = new Map(session.messages.map(m => [m.id ?? '', m]));
		let prevId: string | null = null;
		const seenIds = new Set<string>();
		for (const msg of this.thread) {
			if (!msg.id) {
				msg.id = generateThreadMessageId(msg.role[0]);
			}
			msg.parentId = prevId;
			const prev = existingById.get(msg.id);
			msg.childIds = prev?.childIds ?? [];
			seenIds.add(msg.id);
			existingById.set(msg.id, msg);
			if (prevId) {
				const parent = existingById.get(prevId);
				if (parent) {
					const childIds = parent.childIds ?? [];
					if (!childIds.includes(msg.id)) {
						parent.childIds = [...childIds, msg.id];
					}
				}
			}
			prevId = msg.id;
		}
		session.messages = Array.from(existingById.values());
		session.activeLeafId = prevId ?? null;
	}

	private beginRenameSession(host: HTMLElement): void {
		const session = this.currentSession();
		if (!session) { return; }
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'alaska-chat-title-input';
		input.value = session.title;
		input.size = Math.max(8, session.title.length + 2);
		const commit = (next: string | undefined) => {
			input.replaceWith(host);
			if (next === undefined) { return; }
			const trimmed = next.trim();
			if (!trimmed || trimmed === session.title) { return; }
			session.title = trimmed.slice(0, 80);
			session.titleUserSet = true;
			session.titleAuto = false;
			this.saveSessions();
			this.renderSessionsMenu();
			this.refreshThreadTitle();
		};
		input.addEventListener('keydown', e => {
			if (e.key === 'Enter') { e.preventDefault(); commit(input.value); }
			else if (e.key === 'Escape') { e.preventDefault(); commit(undefined); }
		});
		input.addEventListener('blur', () => commit(input.value));
		host.replaceWith(input);
		input.focus();
		input.select();
	}

	private async maybeSummarizeTitle(session: IChatSession): Promise<void> {
		if (!this.shouldSummarizeTitle(session)) { return; }
		await this.runTitleSummarize(session);
	}

	private shouldSummarizeTitle(session: IChatSession): boolean {
		if (session.titleUserSet) { return false; }
		if (session.titleAuto) { return false; }
		if (session.titleSummarizeAttempted) { return false; }
		if (this.titleSummarizing.has(session.id)) { return false; }
		const userTurns = session.messages.filter(m => m.role === 'user' && m.content.trim()).length;
		const assistantTurns = session.messages.filter(m => m.role === 'assistant' && m.content.trim()).length;
		if (userTurns < TITLE_SUMMARIZE_MIN_USER_TURNS) { return false; }
		if (userTurns > TITLE_SUMMARIZE_MAX_USER_TURNS) { return false; }
		if (assistantTurns < 1) { return false; }
		return true;
	}

	private async runTitleSummarize(session: IChatSession): Promise<void> {
		this.titleSummarizing.add(session.id);
		session.titleSummarizeAttempted = true;
		const persistedAttempt = this.sessions.find(s => s.id === session.id);
		if (persistedAttempt && persistedAttempt !== session) {
			persistedAttempt.titleSummarizeAttempted = true;
		}
		this.saveSessions();
		const cts = new CancellationTokenSource();
		this.titleCancelSources.set(session.id, cts);
		try {
			const wire: IAlaskaChatMessage[] = session.messages
				.filter(m => m.role === 'user' || m.role === 'assistant')
				.slice(0, 6)
				.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
			const title = await this.chatService.summarizeSession(wire, cts.token);
			if (cts.token.isCancellationRequested) { return; }
			if (!title) { return; }
			const stored = this.sessions.find(s => s.id === session.id);
			if (!stored || stored.titleUserSet) { return; }
			stored.title = title;
			stored.titleAuto = true;
			this.saveSessions();
			this.renderSessionsMenu();
			if (stored.id === this.activeSessionId) {
				this.refreshThreadTitle();
			}
		} catch (err) {
			this.logService.trace('[alaska.chat] title summarize failed', err);
		} finally {
			this.titleSummarizing.delete(session.id);
			this.titleCancelSources.delete(session.id);
			cts.dispose();
		}
	}

	public async regenerateActiveTitle(): Promise<void> {
		const session = this.currentSession();
		if (!session) { return; }
		const userTurns = session.messages.filter(m => m.role === 'user' && m.content.trim()).length;
		const assistantTurns = session.messages.filter(m => m.role === 'assistant' && m.content.trim()).length;
		if (userTurns < 1 || assistantTurns < 1) {
			this.notificationService.warn(localize('alaska.title.regen.empty', 'Send a message and wait for a reply before regenerating the title.'));
			return;
		}
		session.titleSummarizeAttempted = false;
		session.titleAuto = false;
		session.titleUserSet = false;
		await this.runTitleSummarize(session);
	}

	private saveSessions(): void {
		this.storageService.store(CHAT_SESSIONS_KEY, JSON.stringify(this.sessions), StorageScope.WORKSPACE, StorageTarget.USER);
		if (this.activeSessionId) {
			this.storageService.store(ACTIVE_CHAT_SESSION_KEY, this.activeSessionId, StorageScope.WORKSPACE, StorageTarget.USER);
		}
	}

	private resetThread(): void {
		const prevSessionId = this.activeSessionId;
		this.stopStreaming();
		this.isStreaming = false;
		this.setStreaming(false);
		this.clearMentions();
		this.pendingEdits.discardAll();
		this.hunkTracker.reset();
		if (prevSessionId) {
			void this.runHook('sessionEnd', undefined, undefined);
		}
		const session = this.createSession();
		this.openSession(session.id);
		this.composerEl?.focus();
	}

	public async startNewThread(): Promise<void> {
		this.resetThread();
	}

	public async insertCodeContext(): Promise<void> {
		await this.openCodeContextPicker();
	}

	public getActiveSessionId(): string | undefined {
		return this.activeSessionId;
	}

	public getExportableActiveSession(): IExportableSession | undefined {
		const session = this.currentSession();
		if (!session || session.messages.length === 0) {
			return undefined;
		}
		return {
			id: session.id,
			title: session.title,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			messages: session.messages,
		};
	}

	public deleteSession(id: string): void {
		if (!id) { return; }
		const idx = this.sessions.findIndex(s => s.id === id);
		if (idx < 0) { return; }
		this.sessions.splice(idx, 1);
		const wasActive = this.activeSessionId === id;
		if (wasActive) {
			this.activeSessionId = this.sessions[0]?.id;
			if (!this.activeSessionId) {
				this.createSession(false);
			}
		}
		this.saveSessions();
		this.renderSessionsMenu();
		if (wasActive) {
			this.openSession(this.activeSessionId, false);
		}
	}

	private appendMessage(msg: IThreadMessage, persist = true): HTMLElement {
		if (!this.messagesEl) { return document.createElement('div'); }
		if (this.thread.length === 0) {
			this.clearMessagesContainer();
		}
		// Every message carries a stable id so the DOM can be keyed by it — this is
		// what makes a duplicate avatar/message node impossible even if a render races.
		if (!msg.id) { msg.id = generateThreadMessageId(msg.role); }
		this.thread.push(msg);
		this.scheduleTokenCounterUpdate();
		const content = this.renderThreadMessage(msg);
		this.scrollToBottomIfNear();
		if (persist) {
			this.saveActiveSession();
		}
		return content;
	}

	private renderThreadMessage(msg: IThreadMessage): HTMLElement {
		if (!this.messagesEl) { return document.createElement('div'); }
		const messagesEl = this.messagesEl;
		const node = document.createElement('div');
		node.className = `alaska-msg alaska-msg-${msg.role}`;
		// Key the node by message id and evict any stale node for the same message
		// before we append, so a message can never appear twice (duplicate avatars).
		if (msg.id) {
			node.dataset.msgId = msg.id;
			const existing = messagesEl.querySelector<HTMLElement>(`.alaska-msg[data-msg-id="${CSS.escape(msg.id)}"]`);
			existing?.remove();
		}

		const avatar = document.createElement('div');
		avatar.className = 'alaska-msg-avatar';
		if (msg.role === 'assistant') {
			avatar.appendChild(buildAuroraMark('alaska-aurora-mark'));
		} else if (msg.role === 'error') {
			avatar.textContent = '!';
		} else {
			const email = this.authService.state.user?.email ?? '';
			avatar.textContent = (email[0] ?? 'U').toUpperCase();
		}
		node.appendChild(avatar);

		const body = document.createElement('div');
		body.className = 'alaska-msg-body';
		if (msg.role === 'assistant') {
			body.setAttribute('aria-live', 'polite');
		}
		node.appendChild(body);

		const role = document.createElement('div');
		role.className = 'alaska-msg-role';
		const roleStrong = document.createElement('b');
		roleStrong.textContent = msg.role === 'assistant'
			? localize('alaska.chat.author.alaska', 'XIPHER')
			: msg.role === 'error'
				? localize('alaska.chat.author.error', 'ERROR')
				// allow-any-unicode-next-line
				: localize('alaska.chat.author.you', 'ВЫ');
		role.appendChild(roleStrong);
		if (typeof msg.createdAt === 'number') {
			const dot = document.createElement('span');
			dot.className = 'alaska-msg-meta-sep';
			dot.textContent = ' · ';
			role.appendChild(dot);
			const time = document.createElement('span');
			time.className = 'alaska-msg-time';
			time.textContent = formatTimeShort(msg.createdAt);
			role.appendChild(time);
		}
		if (msg.edited) {
			const tag = document.createElement('span');
			tag.className = 'alaska-msg-edited-tag';
			tag.textContent = ' · ' + localize('alaska.msg.editedTag', 'edited');
			role.appendChild(tag);
		}
		body.appendChild(role);

		if (msg.role === 'assistant' && msg.reasoning && msg.reasoning.trim()) {
			body.appendChild(this.renderReasoningPanel(msg.reasoning));
		}

		if (msg.role === 'assistant' && msg.toolActivities && msg.toolActivities.length > 0) {
			body.appendChild(this.renderActivitiesList(msg.toolActivities));
		}

		const content = document.createElement('div');
		content.className = 'alaska-msg-content';
		this.renderMessageContent(content, msg.content, msg.role !== 'error');
		body.appendChild(content);

		if (msg.role === 'user' && msg.images && msg.images.length > 0) {
			body.appendChild(this.renderUserImages(msg));
		}

		if (msg.role === 'assistant' && msg.retryReason === 'tool_truncation') {
			body.appendChild(this.renderToolTruncationBanner());
		}

		if (msg.role === 'assistant' && (msg.model || msg.usage || typeof msg.credits === 'number')) {
			body.appendChild(this.renderMessageFooter(msg));
		}

		if (msg.role === 'user' || msg.role === 'assistant') {
			node.appendChild(this.renderMessageToolbar(msg, node));
		}

		messagesEl.appendChild(node);
		this.scrollToBottomIfNear();
		return content;
	}

	private renderMessageFooter(msg: IThreadMessage): HTMLElement {
		const footer = document.createElement('div');
		footer.className = 'alaska-msg-footer';

		if (msg.model) {
			const model = document.createElement('span');
			model.className = 'alaska-msg-footer-model';
			const dot = document.createElement('span');
			dot.className = 'alaska-msg-footer-dot';
			model.appendChild(dot);
			model.appendChild(document.createTextNode(msg.model));
			footer.appendChild(model);
		}

		if (typeof msg.credits === 'number') {
			const credits = document.createElement('span');
			credits.className = 'alaska-msg-footer-credits';
			const n = msg.credits;
			const shown = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
			credits.textContent = `${shown} ${localize('alaska.msg.footer.credits', 'credits')}`;
			credits.title = localize('alaska.msg.footer.creditsTip', 'Credits charged for this turn');
			footer.appendChild(credits);
		}

		if (msg.usage && (msg.usage.input || msg.usage.output)) {
			const tok = document.createElement('span');
			tok.className = 'alaska-msg-footer-tokens';
			tok.textContent = `${formatTokenCount(msg.usage.input)}→${formatTokenCount(msg.usage.output)} ${localize('alaska.msg.footer.tok', 'tok')}`;
			tok.title = localize('alaska.msg.footer.tokTip', 'Input → output tokens');
			footer.appendChild(tok);
		}

		return footer;
	}

	private renderMessageToolbar(msg: IThreadMessage, node: HTMLElement): HTMLElement {
		const toolbar = document.createElement('div');
		toolbar.className = 'alaska-msg-toolbar';
		toolbar.setAttribute('role', 'toolbar');

		const switcher = this.buildBranchSwitcher(msg);
		if (switcher) { toolbar.appendChild(switcher); }

		if (msg.role === 'user') {
			// allow-any-unicode-next-line
			toolbar.appendChild(this.makeMsgButton('alaska-msg-btn-edit', '✎',
				localize('alaska.msg.edit', 'Edit and regenerate from this message'),
				() => this.beginEditUserMessage(node, msg)));
			// allow-any-unicode-next-line
			toolbar.appendChild(this.makeMsgButton('alaska-msg-btn-copy', '⧉',
				localize('alaska.msg.copy', 'Copy message'),
				() => void this.copyMessage(msg)));
			// allow-any-unicode-next-line
			toolbar.appendChild(this.makeMsgButton('alaska-msg-btn-delete', '×',
				localize('alaska.msg.delete', 'Delete this and messages below'),
				() => void this.deleteFromMessage(msg)));
		} else if (msg.role === 'assistant') {
			// allow-any-unicode-next-line
			toolbar.appendChild(this.makeMsgButton('alaska-msg-btn-copy', '⧉',
				localize('alaska.msg.copy', 'Copy message'),
				() => void this.copyMessage(msg)));
			// allow-any-unicode-next-line
			toolbar.appendChild(this.makeMsgButton('alaska-msg-btn-retry', '↻',
				localize('alaska.msg.retry', 'Regenerate response'),
				() => void this.retryAssistant(msg)));
			// allow-any-unicode-next-line
			toolbar.appendChild(this.makeMsgButton('alaska-msg-btn-delete', '×',
				localize('alaska.msg.delete', 'Delete this and messages below'),
				() => void this.deleteFromMessage(msg)));
		}
		return toolbar;
	}

	private buildBranchSwitcher(msg: IThreadMessage): HTMLElement | undefined {
		if (!msg.id || !msg.parentId) { return undefined; }
		const session = this.currentSession();
		if (!session) { return undefined; }
		const parent = session.messages.find(m => m.id === msg.parentId);
		if (!parent) { return undefined; }
		const siblings = parent.childIds ?? [];
		if (siblings.length <= 1) { return undefined; }
		const idx = siblings.indexOf(msg.id);
		if (idx < 0) { return undefined; }
		const total = siblings.length;
		const wrap = document.createElement('div');
		wrap.className = 'alaska-branch-switcher';
		const prev = document.createElement('button');
		prev.type = 'button';
		prev.className = 'alaska-branch-arrow';
		// allow-any-unicode-next-line
		prev.textContent = '◂';
		prev.disabled = idx === 0;
		prev.title = localize('alaska.branch.prev', 'Previous branch');
		prev.addEventListener('click', () => this.switchBranch(siblings[idx - 1]));
		wrap.appendChild(prev);
		const label = document.createElement('span');
		label.className = 'alaska-branch-label';
		label.textContent = `${idx + 1} / ${total}`;
		wrap.appendChild(label);
		const next = document.createElement('button');
		next.type = 'button';
		next.className = 'alaska-branch-arrow';
		// allow-any-unicode-next-line
		next.textContent = '▸';
		next.disabled = idx === total - 1;
		next.title = localize('alaska.branch.next', 'Next branch');
		next.addEventListener('click', () => this.switchBranch(siblings[idx + 1]));
		wrap.appendChild(next);
		return wrap;
	}

	private async switchBranch(messageId: string): Promise<void> {
		const session = this.currentSession();
		if (!session) { return; }
		const leaf = findDeepestDescendant(session, messageId);
		session.activeLeafId = leaf;
		const branch = getActiveThread(session);
		this.thread.splice(0, this.thread.length, ...branch.map(msg => ({ ...msg })));
		this.renderThread();
		this.saveSessions();
	}

	private makeMsgButton(extraClass: string, glyph: string, title: string, onClick: () => void): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = `alaska-msg-btn ${extraClass}`;
		btn.textContent = glyph;
		btn.title = title;
		btn.setAttribute('aria-label', title);
		btn.addEventListener('click', e => {
			e.stopPropagation();
			onClick();
		});
		return btn;
	}

	private renderToolTruncationBanner(): HTMLElement {
		const banner = document.createElement('div');
		banner.className = 'alaska-msg-retry-banner';
		const label = document.createElement('span');
		label.className = 'alaska-msg-retry-label';
		label.textContent = localize('alaska.chat.truncation.label', 'Tool arguments were truncated after multiple retries.');
		banner.appendChild(label);
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'alaska-msg-retry-btn';
		btn.textContent = localize('alaska.chat.truncation.retry', 'Retry');
		btn.addEventListener('click', () => { void this.retryToolTruncation(); });
		banner.appendChild(btn);
		return banner;
	}

	public async retryToolTruncation(): Promise<void> {
		if (this.isStreaming) { return; }
		while (this.thread.length > 0) {
			const last = this.thread[this.thread.length - 1];
			if (last.role === 'user') { break; }
			this.releaseObjectUrlsFor(last);
			this.thread.pop();
		}
		this.renderThread();
		this.saveActiveSession();
		await this.submit(false, { resumeFromLastUser: true });
	}

	private renderUserImages(msg: IThreadMessage): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'alaska-msg-images';
		const existing = this.objectUrlsByMessage.get(msg);
		if (existing) {
			for (const url of existing) {
				try { URL.revokeObjectURL(url); } catch { }
			}
		}
		const urls: string[] = [];
		for (const img of msg.images ?? []) {
			const blob = base64ToBlob(img.base64, img.mime);
			const objectUrl = URL.createObjectURL(blob);
			urls.push(objectUrl);
			const fig = document.createElement('figure');
			fig.className = 'alaska-msg-image-fig';
			const el = document.createElement('img');
			el.className = 'alaska-msg-image';
			el.src = objectUrl;
			el.alt = img.name;
			el.title = `${img.name} · ${formatBytes(img.bytes)}`;
			el.loading = 'lazy';
			fig.appendChild(el);
			const cap = document.createElement('figcaption');
			cap.className = 'alaska-msg-image-cap';
			cap.textContent = img.name;
			fig.appendChild(cap);
			wrap.appendChild(fig);
		}
		this.objectUrlsByMessage.set(msg, urls);
		return wrap;
	}

	private releaseObjectUrlsFor(msg: IThreadMessage): void {
		const urls = this.objectUrlsByMessage.get(msg);
		if (!urls) { return; }
		for (const url of urls) {
			try { URL.revokeObjectURL(url); } catch { }
		}
		this.objectUrlsByMessage.delete(msg);
	}

	private releaseAllThreadObjectUrls(): void {
		for (const urls of this.objectUrlsByMessage.values()) {
			for (const url of urls) {
				try { URL.revokeObjectURL(url); } catch { }
			}
		}
		this.objectUrlsByMessage.clear();
	}

	private renderThread(): void {
		if (!this.messagesEl) { return; }
		this.releaseAllThreadObjectUrls();
		if (this.thread.length === 0) {
			this.renderEmpty();
			return;
		}
		this.clearMessagesContainer();
		for (const msg of this.thread) {
			this.renderThreadMessage(msg);
		}
		this.scrollToBottom();
	}

	private ensureMentionDropdown(): HTMLDivElement | undefined {
		if (this.mentionDropdownEl) { return this.mentionDropdownEl; }
		const host = this.composerEl?.parentElement;
		if (!host) { return undefined; }
		const el = document.createElement('div');
		el.className = 'alaska-mention-dropdown';
		el.setAttribute('role', 'listbox');
		host.appendChild(el);
		this.mentionDropdownEl = el;
		this._register({ dispose: () => { el.remove(); this.mentionDropdownEl = undefined; } });
		return el;
	}

	private async updateMentionDropdown(): Promise<void> {
		const ta = this.composerEl;
		if (!ta) { return; }
		const caret = ta.selectionStart ?? ta.value.length;
		const before = ta.value.slice(0, caret);
		const atMatch = before.match(/(^|[\s\n])(@[^\s@]*)$/);
		if (!atMatch) {
			this.hideMentionDropdown();
			return;
		}
		const partial = atMatch[2].slice(1);
		this.mentionAtStart = caret - atMatch[2].length;
		this.mentionAtCaret = caret;

		const dropdown = this.ensureMentionDropdown();
		if (!dropdown) { return; }

		this.mentionFetchCts?.cancel();
		this.mentionFetchCts?.dispose();
		const cts = new CancellationTokenSource();
		this.mentionFetchCts = cts;

		dropdown.setAttribute('data-open', 'true');

		const candidates = await this.fetchMentionCandidates(partial, cts.token);
		if (cts.token.isCancellationRequested) { return; }

		this.mentionItems = candidates;
		this.mentionActiveIdx = 0;
		this.renderMentionDropdown();
	}

	private renderMentionDropdown(): void {
		const dropdown = this.mentionDropdownEl;
		if (!dropdown) { return; }
		DOM.clearNode(dropdown);
		dropdown.setAttribute('data-open', 'true');
		if (this.mentionItems.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'alaska-mention-empty';
			empty.textContent = localize('alaska.mention.empty', 'No matches.');
			dropdown.appendChild(empty);
			return;
		}
		this.mentionItems.forEach((c, i) => {
			const item = document.createElement('div');
			item.className = 'alaska-mention-item';
			if (i === this.mentionActiveIdx) {
				item.classList.add('alaska-mention-item-active');
			}
			const icon = document.createElement('span');
			icon.className = `alaska-mention-icon codicon codicon-${c.icon}`;
			item.appendChild(icon);
			const label = document.createElement('span');
			label.className = 'alaska-mention-label';
			label.textContent = c.label;
			item.appendChild(label);
			if (c.detail) {
				const detail = document.createElement('small');
				detail.className = 'alaska-mention-detail';
				detail.textContent = c.detail;
				item.appendChild(detail);
			}
			item.addEventListener('mousedown', e => {
				e.preventDefault();
				this.mentionActiveIdx = i;
				this.applyMentionCandidate(c);
			});
			item.addEventListener('mouseenter', () => {
				this.mentionActiveIdx = i;
				this.updateMentionHighlight();
			});
			dropdown.appendChild(item);
		});
	}

	private updateMentionHighlight(): void {
		if (!this.mentionDropdownEl) { return; }
		// eslint-disable-next-line no-restricted-syntax
		const children = this.mentionDropdownEl.querySelectorAll<HTMLElement>('.alaska-mention-item');
		children.forEach((el, i) => {
			el.classList.toggle('alaska-mention-item-active', i === this.mentionActiveIdx);
		});
		const active = children[this.mentionActiveIdx];
		active?.scrollIntoView({ block: 'nearest' });
	}

	private hideMentionDropdown(): void {
		this.mentionFetchCts?.cancel();
		this.mentionFetchCts?.dispose();
		this.mentionFetchCts = undefined;
		if (this.mentionDropdownEl) {
			this.mentionDropdownEl.removeAttribute('data-open');
			DOM.clearNode(this.mentionDropdownEl);
		}
		this.mentionItems = [];
		this.mentionActiveIdx = 0;
	}

	private async fetchMentionCandidates(query: string, token: CancellationToken): Promise<IAlaskaMentionCandidate[]> {
		if (query === 'code' || query.startsWith('code:')) {
			const symbolQuery = query.startsWith('code:') ? query.slice('code:'.length) : '';
			return this.fetchSymbolCandidates(symbolQuery, token);
		}
		const lower = query.toLowerCase();
		const out: IAlaskaMentionCandidate[] = [];
		const ctx = this.contextSvc.captureCurrent();

		const matchesSpecial = (name: string) => query === '' || name.startsWith(lower) || name.includes(lower);

		if (matchesSpecial('code')) {
			out.push({
				id: 'code-prefix',
				kind: 'special',
				icon: 'symbol-method',
				label: '@code:',
				detail: localize('alaska.mention.code.prefix.detail', 'pin a symbol via LSP — type @code:<name>'),
				apply: () => this.insertMentionPrefix('@code:'),
			});
		}

		if (matchesSpecial('workspace')) {
			out.push({
				id: 'workspace',
				kind: 'special',
				icon: 'folder-active',
				label: '@workspace',
				detail: localize('alaska.mention.workspace.detail', 'all open folders'),
				apply: () => this.addMention({ kind: 'folder', target: '', label: '@folder:/' }),
			});
		}
		if (ctx.filePath && (matchesSpecial('active') || ctx.filePath.toLowerCase().includes(lower))) {
			const filePath = ctx.filePath;
			out.push({
				id: 'active',
				kind: 'special',
				icon: 'edit',
				label: '@active',
				detail: filePath,
				apply: () => this.addMention({ kind: 'file', target: filePath, label: `@file:${filePath}` }),
			});
		}
		if (ctx.selection && ctx.filePath && matchesSpecial('selection')) {
			const sel = ctx.selection;
			const filePath = ctx.filePath;
			out.push({
				id: 'selection',
				kind: 'special',
				icon: 'selection',
				label: '@selection',
				detail: `${filePath}:${sel.startLine}-${sel.endLine}`,
				apply: () => this.addMention({
					kind: 'selection',
					target: filePath,
					label: `@selection:${filePath}:${sel.startLine}-${sel.endLine}`,
					selection: { startLine: sel.startLine, endLine: sel.endLine, text: sel.text },
				}),
			});
		}

		try {
			const idxQuery = query.trim() || 'file';
			const hits = await this.indexService.searchRelevant(idxQuery, { topK: 12 }, token);
			if (token.isCancellationRequested) { return []; }
			const seen = new Set<string>();
			for (const h of hits) {
				const fp = h.filePath;
				if (seen.has(fp)) { continue; }
				seen.add(fp);
				out.push({
					id: `idx-${fp}`,
					kind: 'file',
					icon: 'file-code',
					label: '@' + basenameOfPath(fp),
					detail: fp,
					apply: () => this.addMention({ kind: 'file', target: fp, label: `@file:${fp}` }),
				});
			}
		} catch (err) {
			this.logService.trace('[alaska.mention] index search failed', err);
		}

		if (out.length < 5) {
			try {
				const wsFiles = await this.contextSvc.captureWorkspaceFiles();
				if (token.isCancellationRequested) { return []; }
				const matching = wsFiles.filter(p => !p.endsWith('/') && (p.toLowerCase().includes(lower) || basenameOfPath(p).toLowerCase().includes(lower)));
				for (const fp of matching.slice(0, 10)) {
					if (out.some(c => c.detail === fp)) { continue; }
					out.push({
						id: `ws-${fp}`,
						kind: 'file',
						icon: 'file',
						label: '@' + basenameOfPath(fp),
						detail: fp,
						apply: () => this.addMention({ kind: 'file', target: fp, label: `@file:${fp}` }),
					});
				}
			} catch { /* ignore */ }
		}

		return out.slice(0, 8);
	}

	private async fetchSymbolCandidates(symbolQuery: string, token: CancellationToken): Promise<IAlaskaMentionCandidate[]> {
		const candidates: IAlaskaMentionCandidate[] = [];
		const seen = new Set<string>();
		const ctrl = this.editorService.activeTextEditorControl;
		const activeCodeEditor = isCodeEditor(ctrl) ? ctrl : undefined;
		const model = activeCodeEditor?.getModel();
		const lowerQuery = symbolQuery.toLowerCase();

		if (model) {
			const providers = this.languageFeaturesService.documentSymbolProvider.all(model);
			for (const provider of providers) {
				try {
					const symbols = await provider.provideDocumentSymbols(model, token);
					if (token.isCancellationRequested) {
						return candidates;
					}
					if (!symbols) {
						continue;
					}
					const flat = flattenDocumentSymbols(symbols);
					const filtered = lowerQuery
						? flat.filter(s => s.name.toLowerCase().includes(lowerQuery))
						: flat;
					for (const s of filtered.slice(0, 5)) {
						const key = `doc:${s.name}:${s.range.startLineNumber}`;
						if (seen.has(key)) {
							continue;
						}
						seen.add(key);
						const symbolKind = symbolKindLabel(s.kind);
						const uri = model.uri;
						const range = s.range;
						const baseName = uri.path.split('/').pop() ?? '';
						candidates.push({
							id: `sym-doc-${key}`,
							kind: 'symbol',
							icon: symbolKindIconName(s.kind),
							label: `@code:${s.name}`,
							detail: `${symbolKind} · ${baseName}:${range.startLineNumber}`,
							apply: () => this.addCodeMention(uri, range, s.name, symbolKind),
						});
					}
					break;
				} catch (err) {
					this.logService.trace('[alaska.mention] document symbol provider failed', err);
				}
			}
		}

		if (symbolQuery.length > 0) {
			try {
				const items = await getWorkspaceSymbols(symbolQuery, token);
				if (token.isCancellationRequested) {
					return candidates;
				}
				for (const item of items.slice(0, 8)) {
					const sym = item.symbol;
					const range = sym.location.range;
					const key = `ws:${sym.name}:${sym.location.uri.toString()}:${range.startLineNumber}`;
					if (seen.has(key)) {
						continue;
					}
					seen.add(key);
					const kindLabel = symbolKindLabel(sym.kind);
					const relPath = this.relativeWorkspacePath(sym.location.uri);
					candidates.push({
						id: `sym-ws-${key}`,
						kind: 'symbol',
						icon: symbolKindIconName(sym.kind),
						label: `@code:${sym.name}`,
						detail: `${kindLabel} · ${relPath}:${range.startLineNumber}`,
						apply: () => this.addCodeMention(sym.location.uri, range, sym.name, kindLabel),
					});
				}
			} catch (err) {
				this.logService.trace('[alaska.mention] workspace symbol search failed', err);
			}
		}

		return candidates.slice(0, 12);
	}

	private insertMentionPrefix(prefix: string): void {
		const ta = this.composerEl;
		if (!ta) {
			return;
		}
		const before = ta.value.slice(0, this.mentionAtStart);
		const after = ta.value.slice(this.mentionAtCaret);
		ta.value = before + prefix + after;
		ta.selectionStart = ta.selectionEnd = before.length + prefix.length;
		this.mentionAtCaret = before.length + prefix.length;
		this.autosizeComposer();
		void this.updateMentionDropdown();
	}

	private addCodeMention(uri: URI, range: IRange, symbolName: string, symbolKindLbl: string): void {
		const relPath = this.relativeWorkspacePath(uri);
		this.addMention({
			kind: 'code',
			target: relPath,
			label: `@code:${symbolName}`,
			codeSymbol: {
				uri,
				startLine: range.startLineNumber,
				endLine: range.endLineNumber,
				symbolName,
				symbolKindLabel: symbolKindLbl,
			},
		});
	}

	private relativeWorkspacePath(uri: URI): string {
		for (const folder of this.workspaceService.getWorkspace().folders) {
			if (uri.path === folder.uri.path || uri.path.startsWith(folder.uri.path + '/')) {
				return uri.path.slice(folder.uri.path.length + 1);
			}
		}
		return uri.path;
	}

	private async readSymbolText(uri: URI, startLine: number, endLine: number): Promise<string | undefined> {
		try {
			const ref = await this.textModelService.createModelReference(uri);
			try {
				const range = new Range(startLine, 1, endLine, Number.MAX_SAFE_INTEGER);
				return ref.object.textEditorModel.getValueInRange(range);
			} finally {
				ref.dispose();
			}
		} catch (err) {
			this.logService.trace('[alaska.mention] read symbol text failed', err);
			return undefined;
		}
	}

	private applyMentionCandidate(c: IAlaskaMentionCandidate): void {
		const ta = this.composerEl;
		if (!ta) { return; }
		const before = ta.value.slice(0, this.mentionAtStart);
		const after = ta.value.slice(this.mentionAtCaret);
		ta.value = before + after;
		ta.selectionStart = ta.selectionEnd = before.length;
		this.autosizeComposer();
		c.apply();
		this.hideMentionDropdown();
		ta.focus();
	}

	private handleMentionKeydown(e: KeyboardEvent): boolean {
		const dropdown = this.mentionDropdownEl;
		if (!dropdown || dropdown.getAttribute('data-open') !== 'true') { return false; }
		if (e.key === 'Escape') {
			e.preventDefault();
			this.hideMentionDropdown();
			return true;
		}
		if (this.mentionItems.length === 0) { return false; }
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			this.mentionActiveIdx = (this.mentionActiveIdx + 1) % this.mentionItems.length;
			this.updateMentionHighlight();
			return true;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			this.mentionActiveIdx = (this.mentionActiveIdx - 1 + this.mentionItems.length) % this.mentionItems.length;
			this.updateMentionHighlight();
			return true;
		}
		if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
			e.preventDefault();
			const choice = this.mentionItems[this.mentionActiveIdx];
			if (choice) {
				this.applyMentionCandidate(choice);
			}
			return true;
		}
		return false;
	}

	private async openCodeContextPicker(): Promise<void> {
		type Choice = 'selection' | 'file' | 'mention-file' | 'mention-folder';
		type CtxItem = IQuickPickItem & { choice: Choice };
		const ctx = this.contextSvc.captureCurrent();
		const items: CtxItem[] = [];
		if (ctx.selection && ctx.filePath) {
			const sel = ctx.selection;
			items.push({
				choice: 'selection',
				label: '$(selection) ' + localize('alaska.chat.codeCtx.currentSelection', "Current selection"),
				description: `${ctx.filePath}:${sel.startLine}-${sel.endLine}`,
			});
		}
		if (ctx.filePath) {
			items.push({
				choice: 'file',
				label: '$(file) ' + localize('alaska.chat.codeCtx.currentFile', "Current file"),
				description: ctx.filePath,
			});
		}
		items.push({
			choice: 'mention-file',
			// allow-any-unicode-next-line
			label: '$(mention) ' + localize('alaska.chat.codeCtx.atFile', "@file…"),
			description: localize('alaska.chat.codeCtx.atFileDesc', "Pin any workspace file"),
		});
		items.push({
			choice: 'mention-folder',
			// allow-any-unicode-next-line
			label: '$(mention) ' + localize('alaska.chat.codeCtx.atFolder', "@folder…"),
			description: localize('alaska.chat.codeCtx.atFolderDesc', "Pin every file under a workspace folder"),
		});
		const picked = await this.quickInputService.pick(items, {
			placeHolder: localize('alaska.chat.codeCtx.placeholder', "Add code context to the next prompt"),
		});
		if (!picked) {
			this.composerEl?.focus();
			return;
		}
		switch (picked.choice) {
			case 'selection': {
				if (ctx.selection && ctx.filePath) {
					const sel = ctx.selection;
					this.addMention({
						kind: 'selection',
						target: ctx.filePath,
						label: `@selection:${ctx.filePath}:${sel.startLine}-${sel.endLine}`,
						selection: { startLine: sel.startLine, endLine: sel.endLine, text: sel.text },
					});
				}
				break;
			}
			case 'file': {
				if (ctx.filePath) {
					this.addMention({ kind: 'file', target: ctx.filePath, label: `@file:${ctx.filePath}` });
				}
				break;
			}
			case 'mention-file': await this.pickFileMention(); break;
			case 'mention-folder': await this.pickFolderMention(); break;
		}
		this.composerEl?.focus();
	}

	private async pickFileMention(): Promise<void> {
		const all = await this.contextSvc.captureWorkspaceFiles().catch(() => [] as string[]);
		const files = all.filter(p => !p.endsWith('/'));
		if (files.length === 0) {
			this.notificationService.notify({ severity: Severity.Info, message: 'No workspace files available to pin.' });
			return;
		}
		type FileItem = IQuickPickItem & { target: string };
		const items: FileItem[] = files.map(p => ({ label: p, target: p }));
		const picked = await this.quickInputService.pick(items, { placeHolder: 'Pick a file to pin' });
		if (picked) {
			this.addMention({ kind: 'file', target: picked.target, label: `@file:${picked.target}` });
		}
	}

	private async pickFolderMention(): Promise<void> {
		const all = await this.contextSvc.captureWorkspaceFiles().catch(() => [] as string[]);
		const folders = all.filter(p => p.endsWith('/')).map(p => p.slice(0, -1));
		const root = this.workspaceService.getWorkspace().folders[0];
		if (root && !folders.includes('')) {
			folders.unshift('');
		}
		if (folders.length === 0) {
			this.notificationService.notify({ severity: Severity.Info, message: 'No folders available to pin.' });
			return;
		}
		type FolderItem = IQuickPickItem & { target: string };
		const items: FolderItem[] = folders.map(p => ({ label: p === '' ? '/ (workspace root)' : p, target: p }));
		const picked = await this.quickInputService.pick(items, { placeHolder: 'Pick a folder to pin' });
		if (picked) {
			this.addMention({ kind: 'folder', target: picked.target, label: `@folder:${picked.target || '/'}` });
		}
	}

	private async pickUrlMention(): Promise<void> {
		const url = await this.quickInputService.input({
			prompt: 'Fetch a URL and pin the readable text into context',
			placeHolder: 'https://example.com/article',
			validateInput: async (value: string) => {
				if (!/^https?:\/\//i.test(value.trim())) {
					return 'Must start with http:// or https://';
				}
				return null;
			},
		});
		if (url) {
			const cleaned = url.trim();
			this.addMention({ kind: 'url', target: cleaned, label: `@url:${shortenUrl(cleaned)}` });
		}
	}

	private addMention(m: IPendingMention): void {
		const exists = this.pendingMentions.some(p => p.kind === m.kind && p.target === m.target);
		if (exists) {
			return;
		}
		this.pendingMentions.push(m);
		this.renderMentionChips();
	}

	private setupComposerDropZone(composer: HTMLElement): void {
		composer.setAttribute('data-drop-hint', localize('alaska.drop.hint', 'Drop image to attach'));

		const setHovering = (on: boolean) => {
			composer.classList.toggle('alaska-composer-dropping', on);
		};

		this._register(DOM.addDisposableListener(composer, 'dragenter', (e: DragEvent) => {
			if (!this.dragHasFiles(e)) { return; }
			e.preventDefault();
			setHovering(true);
		}));
		this._register(DOM.addDisposableListener(composer, 'dragover', (e: DragEvent) => {
			if (!this.dragHasFiles(e)) { return; }
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'copy';
			}
		}));
		this._register(DOM.addDisposableListener(composer, 'dragleave', (e: DragEvent) => {
			if (e.target === composer) {
				setHovering(false);
			}
		}));
		this._register(DOM.addDisposableListener(composer, 'drop', (e: DragEvent) => {
			if (!this.dragHasFiles(e)) { return; }
			e.preventDefault();
			setHovering(false);
			const files = Array.from(e.dataTransfer?.files ?? []);
			if (files.length === 0) { return; }
			void this.ingestDroppedFiles(files);
		}));

		if (this.composerEl) {
			this._register(DOM.addDisposableListener(this.composerEl, 'paste', (e: ClipboardEvent) => {
				const items = Array.from(e.clipboardData?.items ?? []);
				const imageItems = items.filter(i => i.kind === 'file' && i.type.startsWith('image/'));
				if (imageItems.length === 0) { return; }
				e.preventDefault();
				const files = imageItems.map(i => i.getAsFile()).filter((f): f is File => !!f);
				if (files.length === 0) { return; }
				void this.ingestDroppedFiles(files);
			}));
		}
	}

	private dragHasFiles(e: DragEvent): boolean {
		const types = e.dataTransfer?.types;
		if (!types) { return false; }
		for (let i = 0; i < types.length; i++) {
			if (types[i] === 'Files') { return true; }
		}
		return false;
	}

	private async ingestDroppedFiles(files: readonly File[]): Promise<void> {
		const model = this.models.find(m => m.id === this.selectedModelId);
		if (model && !model.supports_vision) {
			this.notificationService.notify({
				severity: Severity.Warning,
				message: localize('alaska.drop.noVision', 'Switch to a vision-capable model before attaching images.'),
			});
			return;
		}
		let added = 0;
		let rejected = 0;
		for (const file of files) {
			const declaredMime = file.type && ALASKA_IMAGE_SUPPORTED_MIMES.has(file.type) ? file.type : undefined;
			const guessedMime = !declaredMime ? guessImageMime(file.name) : undefined;
			const mime = declaredMime ?? guessedMime;
			if (!mime || !ALASKA_IMAGE_SUPPORTED_MIMES.has(mime)) {
				rejected++;
				continue;
			}
			if (file.size > ALASKA_IMAGE_MAX_BYTES) {
				this.notificationService.notify({
					severity: Severity.Warning,
					// allow-any-unicode-next-line
					message: localize('alaska.drop.tooBig', '{0} is over 20 MB — skipped.', file.name || localize('alaska.drop.untitled', '(pasted image)')),
				});
				continue;
			}
			try {
				const buf = await file.arrayBuffer();
				const base64 = encodeBase64(VSBuffer.wrap(new Uint8Array(buf)));
				this.pendingImages.push({
					id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					name: file.name || `pasted-${Date.now()}.${mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'img'}`,
					mime,
					base64,
					bytes: buf.byteLength,
				});
				added++;
			} catch (err) {
				this.logService.warn('[alaska.composer.drop] failed to read file', err);
				rejected++;
			}
		}
		if (rejected > 0) {
			this.notificationService.notify({
				severity: Severity.Warning,
				message: localize('alaska.drop.unsupported', 'Skipped {0} item(s) — unsupported format.', rejected),
			});
		}
		if (added > 0) {
			this.renderImageChips();
			this.scheduleTokenCounterUpdate();
			this.warnIfModelLacksVision();
			this.composerEl?.focus();
		}
	}

	private async pickImageAttachment(): Promise<void> {
		const picked = await this.fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			filters: [{
				name: localize('alaska.attach.imageFilter', 'Images'),
				extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
			}],
			title: localize('alaska.attach.imageDialog', 'Attach images for Xipher IDE'),
		});
		if (!picked || picked.length === 0) {
			return;
		}
		for (const uri of picked) {
			try {
				const stat = await this.fileService.stat(uri);
				if (typeof stat.size === 'number' && stat.size > ALASKA_IMAGE_MAX_BYTES) {
					this.notificationService.notify({
						severity: Severity.Warning,
						message: localize('alaska.attach.imageTooBig', 'Skipping {0} — over 20 MB.', basenameOfPath(uri.path)),
					});
					continue;
				}
				const mime = guessImageMime(uri.path);
				if (!mime) {
					this.notificationService.notify({
						severity: Severity.Warning,
						message: localize('alaska.attach.imageBadMime', 'Skipping {0} — unsupported format.', basenameOfPath(uri.path)),
					});
					continue;
				}
				const file = await this.fileService.readFile(uri);
				const base64 = encodeBase64(file.value);
				this.pendingImages.push({
					id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					name: basenameOfPath(uri.path),
					mime,
					base64,
					bytes: file.value.byteLength,
				});
			} catch (err) {
				this.logService.warn('[alaska.attach] failed to load image', err);
				this.notificationService.notify({
					severity: Severity.Warning,
					message: localize('alaska.attach.imageReadFailed', 'Failed to load {0}.', basenameOfPath(uri.path)),
				});
			}
		}
		this.renderImageChips();
		this.warnIfModelLacksVision();
	}

	private removeImageAttachment(id: string): void {
		this.pendingImages = this.pendingImages.filter(img => img.id !== id);
		this.renderImageChips();
		this.scheduleTokenCounterUpdate();
	}

	private clearImageAttachments(): void {
		if (this.pendingImages.length === 0) {
			return;
		}
		this.pendingImages = [];
		this.renderImageChips();
		this.scheduleTokenCounterUpdate();
	}

	private renderImageChips(): void {
		const host = this.imageChipsEl;
		if (!host) { return; }
		host.replaceChildren();
		for (const img of this.pendingImages) {
			const chip = document.createElement('span');
			chip.className = 'alaska-attach-image-chip';
			chip.title = `${img.name} · ${formatBytes(img.bytes)}`;

			const thumb = document.createElement('span');
			thumb.className = 'alaska-attach-image-chip-thumb';
			thumb.style.backgroundImage = `url("data:${img.mime};base64,${img.base64}")`;
			chip.appendChild(thumb);

			const label = document.createElement('span');
			label.className = 'alaska-attach-image-chip-label';
			label.textContent = img.name;
			chip.appendChild(label);

			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'alaska-attach-image-chip-remove';
			remove.setAttribute('aria-label', localize('alaska.attach.imageRemove', 'Remove image {0}', img.name));
			remove.textContent = '×';
			remove.addEventListener('click', ev => {
				ev.preventDefault();
				ev.stopPropagation();
				this.removeImageAttachment(img.id);
			});
			chip.appendChild(remove);
			host.appendChild(chip);
		}
		host.style.display = this.pendingImages.length > 0 ? '' : 'none';
	}

	private warnIfModelLacksVision(): void {
		if (this.pendingImages.length === 0) {
			return;
		}
		const model = this.models.find(m => m.id === this.selectedModelId);
		if (model && !model.supports_vision) {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize(
					'alaska.attach.imageNeedsVision',
					'{0} does not support image input — switch to a vision-capable model before sending.',
					model.label,
				),
			});
		}
	}

	private removeMention(m: IPendingMention): void {
		this.pendingMentions = this.pendingMentions.filter(p => !(p.kind === m.kind && p.target === m.target));
		this.renderMentionChips();
	}

	private clearMentions(): void {
		if (this.pendingMentions.length === 0) {
			return;
		}
		this.pendingMentions = [];
		this.renderMentionChips();
	}

	private renderMentionChips(): void {
		if (!this.chipsEl) { return; }
		this.chipsEl.replaceChildren();
		for (const m of this.pendingMentions) {
			const chip = document.createElement('span');
			chip.className = `alaska-mention-chip alaska-mention-chip-${m.kind}`;
			chip.title = m.label;
			const text = document.createElement('span');
			text.className = 'alaska-mention-chip-text';
			text.textContent = m.label;
			chip.appendChild(text);
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'alaska-mention-chip-remove';
			remove.setAttribute('aria-label', `Remove ${m.label}`);
			remove.textContent = '×';
			remove.addEventListener('click', (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				this.removeMention(m);
			});
			chip.appendChild(remove);
			this.chipsEl.appendChild(chip);
		}
		this.chipsEl.style.display = this.pendingMentions.length > 0 ? '' : 'none';
	}

	private async resolvePinnedMentions(mentions: IPendingMention[], activeDiagnostics?: readonly IAlaskaCodeDiagnostic[]): Promise<{
		pinnedFiles: IAlaskaPinnedFile[];
		pinnedFolders: IAlaskaPinnedFolder[];
		pinnedUrls: IAlaskaPinnedUrl[];
		pinnedDiagnostics: IAlaskaCodeDiagnostic[] | undefined;
	}> {
		const out = {
			pinnedFiles: [] as IAlaskaPinnedFile[],
			pinnedFolders: [] as IAlaskaPinnedFolder[],
			pinnedUrls: [] as IAlaskaPinnedUrl[],
			pinnedDiagnostics: undefined as IAlaskaCodeDiagnostic[] | undefined,
		};
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		const sizes: number[] = [];
		const slots: { kind: AlaskaMentionKind; index: number }[] = [];
		for (const m of mentions) {
			if (m.kind === 'file') {
				if (!root) { continue; }
				const file = await this.readPinnedFile(root, m.target);
				if (file) {
					out.pinnedFiles.push(file);
					sizes.push(approxBytes(file.content));
					slots.push({ kind: 'file', index: out.pinnedFiles.length - 1 });
				}
			} else if (m.kind === 'folder') {
				if (!root) { continue; }
				const folder = await this.readPinnedFolder(root, m.target);
				if (folder) {
					out.pinnedFolders.push(folder);
					sizes.push(folder.files.reduce((acc, f) => acc + approxBytes(f.content), 0));
					slots.push({ kind: 'folder', index: out.pinnedFolders.length - 1 });
				}
			} else if (m.kind === 'url') {
				const url = await this.fetchPinnedUrl(m.target);
				if (url) {
					out.pinnedUrls.push(url);
					sizes.push(approxBytes(url.text) + approxBytes(url.title ?? ''));
					slots.push({ kind: 'url', index: out.pinnedUrls.length - 1 });
				}
			} else if (m.kind === 'diag') {
				if (activeDiagnostics && activeDiagnostics.length > 0) {
					out.pinnedDiagnostics = activeDiagnostics.slice();
					sizes.push(activeDiagnostics.length * 80);
					slots.push({ kind: 'diag', index: 0 });
				}
			} else if (m.kind === 'selection') {
				if (m.selection) {
					const file: IAlaskaPinnedFile = {
						path: `${m.target}:L${m.selection.startLine}-L${m.selection.endLine}`,
						content: m.selection.text,
					};
					out.pinnedFiles.push(file);
					sizes.push(approxBytes(file.content));
					slots.push({ kind: 'file', index: out.pinnedFiles.length - 1 });
				}
			} else if (m.kind === 'code') {
				if (m.codeSymbol) {
					const sym = m.codeSymbol;
					const text = await this.readSymbolText(sym.uri, sym.startLine, sym.endLine);
					if (text) {
						const relPath = this.relativeWorkspacePath(sym.uri);
						const file: IAlaskaPinnedFile = {
							path: `${relPath}:L${sym.startLine}-L${sym.endLine} (${sym.symbolKindLabel} ${sym.symbolName})`,
							content: text,
						};
						out.pinnedFiles.push(file);
						sizes.push(approxBytes(file.content));
						slots.push({ kind: 'file', index: out.pinnedFiles.length - 1 });
					}
				}
			}
		}
		let total = sizes.reduce((a, b) => a + b, 0);
		let dropFrom = 0;
		while (total > MENTION_TOTAL_BUDGET_BYTES && dropFrom < slots.length) {
			total -= sizes[dropFrom];
			const slot = slots[dropFrom];
			if (slot.kind === 'file') {
				out.pinnedFiles[slot.index] = { ...out.pinnedFiles[slot.index], content: '', truncated: true };
			} else if (slot.kind === 'folder') {
				out.pinnedFolders[slot.index] = { ...out.pinnedFolders[slot.index], files: [], truncated: true };
			} else if (slot.kind === 'url') {
				out.pinnedUrls[slot.index] = { ...out.pinnedUrls[slot.index], text: '', truncated: true };
			} else if (slot.kind === 'diag') {
				out.pinnedDiagnostics = undefined;
			}
			dropFrom++;
		}
		return out;
	}

	private deriveIndexQuery(currentPrompt: string, reusingPriorTurn: boolean): string {
		const trimmed = (currentPrompt ?? '').trim();
		if (trimmed.length >= 10) {
			return trimmed;
		}
		if (!reusingPriorTurn && trimmed.length === 0) {
			return '';
		}
		for (let i = this.thread.length - 1; i >= 0; i--) {
			const m = this.thread[i];
			if (m.role !== 'user' || !m.content) { continue; }
			const text = m.content.trim();
			if (!text) { continue; }
			return text.length > 800 ? text.slice(-800) : text;
		}
		return trimmed;
	}

	private async collectIndexHits(prompt: string, token: import('../../../../base/common/cancellation.js').CancellationToken): Promise<IAlaskaIndexContextHit[]> {
		const trimmed = (prompt ?? '').trim();
		if (!trimmed) { return []; }
		if (this.indexService.progress.state === 'disabled' || this.indexService.progress.state === 'unauthenticated') {
			return [];
		}
		try {
			const hits = await this.indexService.searchRelevant(trimmed, { topK: 15 }, token);
			return hits.map(h => ({
				filePath: h.filePath,
				startLine: h.startLine,
				endLine: h.endLine,
				symbolName: h.symbolName,
				symbolKind: h.symbolKind,
				content: h.content,
				score: h.score,
			}));
		} catch (err) {
			this.logService.warn('[alaska.chat] index search failed; falling back to file-tree snapshot', err);
			return [];
		}
	}

	private async readPinnedFile(root: URI, relPath: string): Promise<IAlaskaPinnedFile | undefined> {
		try {
			const resource = resolveWorkspacePath(root, relPath);
			if (!(await this.fileService.exists(resource))) {
				return undefined;
			}
			const raw = (await this.textFileService.read(resource)).value;
			if (raw.length > MENTION_FILE_BYTES) {
				return { path: relPath, content: raw.slice(0, MENTION_FILE_BYTES), truncated: true };
			}
			return { path: relPath, content: raw };
		} catch (err) {
			this.logService.warn(`[alaska.chat] @file fetch failed for ${relPath}`, err);
			return undefined;
		}
	}

	private async readPinnedFolder(root: URI, relPath: string): Promise<IAlaskaPinnedFolder | undefined> {
		try {
			const all = await this.contextSvc.captureWorkspaceFiles();
			const norm = relPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
			const prefix = norm.length === 0 ? '' : norm + '/';
			const matched = all
				.filter(p => !p.endsWith('/'))
				.filter(p => prefix === '' ? true : p.startsWith(prefix));
			const slice = matched.slice(0, MENTION_FOLDER_FILE_CAP);
			const files: IAlaskaPinnedFile[] = [];
			for (const rel of slice) {
				const f = await this.readPinnedFile(root, rel);
				if (f) {
					files.push(f);
				}
			}
			return { path: norm || '/', files, truncated: matched.length > MENTION_FOLDER_FILE_CAP };
		} catch (err) {
			this.logService.warn(`[alaska.chat] @folder fetch failed for ${relPath}`, err);
			return undefined;
		}
	}

	private async fetchPinnedUrl(url: string): Promise<IAlaskaPinnedUrl | undefined> {
		const rejection = rejectSsrfUrl(url);
		if (rejection) {
			return { url, text: `(refused to fetch — ${rejection})`, truncated: true };
		}
		try {
			const ctx = await this.requestService.request({ type: 'GET', url, callSite: 'alaskaAI.atMentionUrl' }, CancellationToken.None);
			const status = ctx.res.statusCode ?? 0;
			if (status >= 400) {
				return { url, text: `(failed to fetch — HTTP ${status})`, truncated: true };
			}
			const body = (await asText(ctx)) ?? '';
			const { title, text } = htmlToReadableText(body);
			const trimmed = text.length > MENTION_URL_BYTES ? text.slice(0, MENTION_URL_BYTES) : text;
			return { url, title, text: trimmed, truncated: text.length > MENTION_URL_BYTES };
		} catch (err) {
			this.logService.warn(`[alaska.chat] @url fetch failed for ${url}`, err);
			return { url, text: `(failed to fetch — ${err instanceof Error ? err.message : String(err)})`, truncated: true };
		}
	}

	private async submit(continuation = false, options?: { resumeFromLastUser?: boolean }): Promise<void> {
		if (this.isStreaming || !this.composerEl) { return; }
		const resumeFromLastUser = !!options?.resumeFromLastUser;
		let prompt = (continuation || resumeFromLastUser) ? '' : this.composerEl.value.trim();
		if (!continuation && !resumeFromLastUser && !prompt) { return; }
		if (!continuation && !resumeFromLastUser && prompt.startsWith('/')) {
			const cmd = this.slashService.get(prompt.split(/\s+/)[0]);
			if (cmd) {
				this.composerEl.value = '';
				this.autosizeComposer();
				this.hideSlashMenu();
				await this.executeSlashTrigger(prompt);
				return;
			}
		}
		if (!continuation && !resumeFromLastUser && prompt) {
			const hookResult = await this.runHook('userPromptSubmit', undefined, prompt);
			if (hookResult.action === 'block') {
				this.appendMessage({
					role: 'error',
					content: localize('alaska.hook.blocked', 'Submission blocked by hook: {0}', hookResult.reason),
					createdAt: Date.now(),
				});
				this.composerEl.value = '';
				this.autosizeComposer();
				return;
			}
			if (hookResult.action === 'modify' && typeof hookResult.modifiedPayload?.userMessage === 'string') {
				prompt = hookResult.modifiedPayload.userMessage;
				this.composerEl.value = prompt;
			}
		}
		const session = this.currentSession();
		if (!continuation) {
			if ((this.currentContextRatio() ?? 0) >= COMPRESS_AT_RATIO) {
				try { await this.compressOlderMessages(true); } catch { }
			}
			if (session) {
				session.turnStartedAt = Date.now();
			}
		}
		const turnImages = (continuation || resumeFromLastUser) ? [] : this.pendingImages.slice();
		if (resumeFromLastUser) {
			// existing trailing user message in thread becomes the prompt — no new append needed.
		} else if (!continuation) {
			this.composerEl.value = '';
			this.autosizeComposer();
			this.refreshContextLabel();
			this.appendMessage({
				role: 'user',
				content: prompt,
				createdAt: Date.now(),
				images: turnImages.length > 0 ? turnImages : undefined,
			});
			this.clearImageAttachments();
			this.scrollToBottom();
		} else {
			// allow-any-unicode-next-line
			this.appendMessage({ role: 'user', content: 'Продолжай с того места, где ты остановился.', createdAt: Date.now() });
			this.scrollToBottom();
		}

		const assistantNode = this.appendMessage({ role: 'assistant', content: '', createdAt: Date.now() }, false);
		const assistantMessageNode = assistantNode.parentElement;
		this.isStreaming = true;
		this.setStreaming(true);
		const streamSource = new CancellationTokenSource();
		this.streamCancel = streamSource;

		const liveRefs = this.attachLiveAssistantUI(assistantNode, assistantMessageNode);
		const liveMsg = this.thread[this.thread.length - 1];
		this.showPendingPlaceholder(liveRefs);
		this.setStage(liveMsg, liveRefs, 'Reading workspace…');

		try {
			const baseCtx = this.contextSvc.captureCurrent();
			const indexQuery = this.deriveIndexQuery(prompt, continuation || resumeFromLastUser);
			const indexHits = await this.collectIndexHits(indexQuery, streamSource.token);
			const workspaceFiles = indexHits.length > 0
				? []
				: await this.contextSvc.captureWorkspaceFiles().catch(() => []);
			if (indexHits.length > 0) {
				this.logService.info(`[alaska.context] using ${indexHits.length} index hits — skipping workspace tree snapshot`);
			}
			const requestAgentAccess: AlaskaAgentAccess = this.agentAccess;
			const pinnedSnapshot = this.pendingMentions.slice();
			const resolvedPins = await this.resolvePinnedMentions(pinnedSnapshot, baseCtx.diagnostics);
			this.clearMentions();
			const allSkills = this.skillService.list();
			const forcedSkills = this.takeForcedSkills();
			const matchedSkills = this.skillService.findRelevant(prompt, 3);
			const activeSkills = [
				...forcedSkills,
				...matchedSkills.filter(s => !forcedSkills.some(f => f.id === s.id)),
			].slice(0, 3);
			const skillsInjection = renderSkillsInjection(activeSkills);
			const skillsCatalog = renderSkillCatalog(allSkills, 20);
			const codeCtx = {
				...baseCtx,
				workspaceFiles,
				agentAccess: requestAgentAccess,
				pinnedFiles: resolvedPins.pinnedFiles.length > 0 ? resolvedPins.pinnedFiles : undefined,
				pinnedFolders: resolvedPins.pinnedFolders.length > 0 ? resolvedPins.pinnedFolders : undefined,
				pinnedUrls: resolvedPins.pinnedUrls.length > 0 ? resolvedPins.pinnedUrls : undefined,
				pinnedDiagnostics: resolvedPins.pinnedDiagnostics,
				indexHits: indexHits.length > 0 ? indexHits : undefined,
				skillsInjection: skillsInjection || undefined,
				skillsCatalog: skillsCatalog || undefined,
			};

			const root = this.workspaceService.getWorkspace().folders[0]?.uri;
			const toolsAvailable = !!root;
			const executor = root ? new AlaskaToolExecutor(this.fileService, this.textFileService, root, this.workspaceTrust, this.activityService, this.logService, this.searchService, this.authService) : undefined;
			const turnSessionId = session?.id ?? '';
			const turnAgentMode: AlaskaAgentMode = turnSessionId ? this.agentModeService.getMode(turnSessionId) : 'chat';
			const turnApprovedTasklist = turnSessionId ? this.agentModeService.getApprovedTasklist(turnSessionId) : undefined;
			if (executor) {
				executor.setPermissionMode(this.readPermissionMode());
				executor.setAgentMode(turnAgentMode);
			}

			const summaryStart = session?.summarizedThroughIndex ?? 0;
			const wireMessages: IAlaskaChatMessage[] = [];
			if (session?.runningSummary) {
				// allow-any-unicode-next-line
				wireMessages.push({ role: 'system', content: `Сводка предыдущей части разговора:\n${session.runningSummary}` });
			}
			for (let i = summaryStart; i < this.thread.length; i++) {
				const m = this.thread[i];
				if (m.role === 'error') { continue; }
				if (m.role === 'user' && m.images && m.images.length > 0) {
					const parts: IAlaskaContentPart[] = [];
					if (m.content.trim()) {
						parts.push({ type: 'text', text: m.content });
					}
					for (const img of m.images) {
						parts.push({
							type: 'image_url',
							image_url: {
								url: `data:${img.mime};base64,${img.base64}`,
								detail: 'auto',
							},
						});
					}
					wireMessages.push({ role: 'user', content: parts });
					continue;
				}
				wireMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
			}

			// One-shot interrupt reminder: if the previous turn was cancelled with
			// nothing in flight, tell the model it was stopped so it doesn't assume
			// its last action finished (ported from grok's file tracker one-shot).
			if (!continuation) {
				const interrupt = this.reminderService.takeInterruptReminder();
				if (interrupt) {
					wireMessages.push({ role: 'user', content: interrupt });
				}
			}

			const collectedEdits: IPreparedEditOperation[] = [];
			const allTurnToolCalls: IAlaskaToolCall[] = [];
			let finalText = '';
			let stoppedByError = false;
			let lastFinishReason: string | undefined;
			let toolRetryCount = 0;
			let lastTurnHadNoToolCalls = false;
			const MAX_TURNS = 8;
			const MAX_TOOL_RETRY = 2;
			if (!continuation) {
				this.chatTruncationRetryCount = 0;
				this.chatEmptyRetryCount = 0;
				// New user prompt: reset per-prompt reminder rate-limit counters.
				this.reminderService.beginPrompt();
			}

			for (let turn = 0; turn < MAX_TURNS; turn++) {
				if (streamSource.token.isCancellationRequested) {
					this.completeStage(liveMsg, liveRefs);
					liveMsg.role = 'assistant';
					liveMsg.content = finalText || 'Stopped.';
					this.saveActiveSession();
					if (!finalText) {
						assistantNode.textContent = 'Stopped.';
					}
					stoppedByError = true;
					break;
				}
				const result = await this.runOneTurn({
					wireMessages,
					codeCtx,
					accessMode: requestAgentAccess,
					toolsAvailable,
					assistantNode,
					streamSource,
					liveRefs,
					liveMsg,
					agentMode: turnAgentMode,
					approvedTasklist: turnApprovedTasklist,
				});
				if (result.kind === 'cancelled') {
					this.completeStage(liveMsg, liveRefs);
					liveMsg.role = 'assistant';
					liveMsg.content = finalText + result.partial || 'Stopped.';
					this.saveActiveSession();
					if (!finalText && !result.partial) {
						assistantNode.textContent = 'Stopped.';
					}
					stoppedByError = true;
					break;
				}
				if (result.kind === 'error') {
					if (result.code === 'truncated_tool_call' && toolRetryCount < MAX_TOOL_RETRY) {
						toolRetryCount++;
						this.logService.warn(`[alaska.chat] stream-close truncated_tool_call → silent auto-retry ${toolRetryCount}/${MAX_TOOL_RETRY}`);
						this.hideStage(liveRefs);
						this.showPendingPlaceholder(liveRefs);
						const backoffMs = toolRetryCount === 1 ? 500 : 1500;
						await new Promise(r => setTimeout(r, backoffMs));
						continue;
					}
					this.completeStage(liveMsg, liveRefs);
					if (result.code === 'truncated_tool_call') {
						liveMsg.role = 'assistant';
						liveMsg.content = '';
						liveMsg.retryReason = 'tool_truncation';
						assistantNode.textContent = '';
					} else {
						liveMsg.role = 'error';
						liveMsg.content = result.message;
						assistantNode.textContent = result.message;
						assistantMessageNode?.classList.add('alaska-msg-error');
					}
					this.saveActiveSession();
					stoppedByError = true;
					break;
				}

				lastFinishReason = result.finishReason;
				if (result.usage && session) {
					session.lastInputTokens = result.usage.input;
					session.lastOutputTokens = result.usage.output;
				}

				// Stamp model + usage + credits on the assistant message for its footer.
				// The agent loop can make several round-trips per turn; each is charged
				// the model's multiplier, so credits + output tokens accumulate.
				{
					const activeModel = this.models.find(m => m.id === this.selectedModelId);
					if (activeModel) {
						liveMsg.model = activeModel.label;
						if (typeof activeModel.credit_multiplier === 'number') {
							liveMsg.credits = Number(((liveMsg.credits ?? 0) + activeModel.credit_multiplier).toFixed(2));
						}
					}
					if (result.usage) {
						liveMsg.usage = {
							input: result.usage.input,
							output: (liveMsg.usage?.output ?? 0) + result.usage.output,
						};
					}
				}

				if (turnSessionId && turnAgentMode === 'act' && result.text) {
					const completedSteps = parseCompletedSteps(result.text);
					for (const idx of completedSteps) {
						this.agentModeService.markTaskCompleted(turnSessionId, idx);
					}
				}

				if (result.toolCalls.length === 0) {
					if (result.finishReason === 'length'
						&& hasUnclosedCodeFence(result.text)
						&& this.chatTruncationRetryCount < MAX_CHAT_TRUNCATION_RETRY) {
						this.chatTruncationRetryCount++;
						this.logService.warn(`[alaska.chat] response truncated mid-code-block → silent auto-retry ${this.chatTruncationRetryCount}/${MAX_CHAT_TRUNCATION_RETRY}`);
						this.metricsService.counter('alaska.chat.truncation_retry', 1, { reason: 'unclosed_fence' });
						wireMessages.push({ role: 'assistant', content: result.text });
						wireMessages.push({
							role: 'user',
							content: 'Your previous response was cut off mid-code-block (finish_reason: length). Continue from where you stopped, BUT this time use alaska_write_file for each file. Do not show code inline.',
						});
						assistantNode.textContent = '';
						this.removeStreamingCaret(liveRefs);
						this.hideStage(liveRefs);
						this.showPendingPlaceholder(liveRefs);
						const backoffMs = this.chatTruncationRetryCount === 1 ? 500 : 1500;
						await new Promise(r => setTimeout(r, backoffMs));
						continue;
					}
					// EMPTY-TURN RETRY: a flaky upstream (agentrouter Claude under load)
					// sometimes returns no text AND no tool calls AND no error. Rather than
					// surfacing the bleak "No response from Xipher IDE", silently retry a
					// couple of times with a short backoff before giving up.
					if (!result.text.trim() && this.chatEmptyRetryCount < MAX_CHAT_EMPTY_RETRY) {
						this.chatEmptyRetryCount++;
						this.logService.warn(`[alaska.chat] empty turn from upstream → auto-retry ${this.chatEmptyRetryCount}/${MAX_CHAT_EMPTY_RETRY}`);
						this.metricsService.counter('alaska.chat.empty_retry', 1, {});
						assistantNode.textContent = '';
						this.removeStreamingCaret(liveRefs);
						this.hideStage(liveRefs);
						this.showPendingPlaceholder(liveRefs);
						await new Promise(r => setTimeout(r, this.chatEmptyRetryCount === 1 ? 700 : 1800));
						continue;
					}
					// GOAL HARNESS (/goal): before letting the agent stop, a skeptic
					// verifier checks the transcript against the active goal. Until it
					// is met, inject a continuation and keep working (ported from grok /goal).
					{
						const goal = this.goalService.active;
						if (goal && !goal.paused && result.text) {
							const transcript = wireMessages.slice(-6)
								.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 600) : '[parts]'}`)
								.join('\n') + `\nassistant: ${result.text.slice(0, 1500)}`;
							const verdict = await this.goalService.verify(transcript, CancellationToken.None);
							if (!verdict.met && this.goalService.tick()) {
								wireMessages.push({ role: 'assistant', content: result.text });
								wireMessages.push({ role: 'user', content: `[goal not yet met — verifier] ${verdict.feedback}\n\nKeep working until this goal is fully satisfied: ${goal.condition}` });
								this.logService.info(`[alaska.goal] not met, continuing: ${verdict.feedback}`);
								assistantNode.textContent = '';
								this.removeStreamingCaret(liveRefs);
								this.hideStage(liveRefs);
								this.showPendingPlaceholder(liveRefs);
								continue;
							}
							if (verdict.met) {
								this.goalService.clear();
								result.text += '\n\n---\n🎯 **Goal met** — verifier confirmed the condition is satisfied.';
							}
						}
					}
					finalText = result.text;
					lastTurnHadNoToolCalls = true;
					break;
				}
				lastTurnHadNoToolCalls = false;
				allTurnToolCalls.push(...result.toolCalls);
				wireMessages.push({
					role: 'assistant',
					content: result.text,
					tool_calls: result.toolCalls.map(c => ({
						id: c.id,
						type: 'function',
						function: { name: c.name, arguments: c.argumentsJson },
					})),
				});

				const toolResults: IAlaskaToolResult[] = [];
				const subAgentCalls = result.toolCalls.filter(c => c.name === 'alaska_dispatch_subagent');
				const subAgentResultMap = new Map<string, IAlaskaToolResult>();
				if (subAgentCalls.length > 0) {
					if (turnAgentMode === 'plan') {
						for (const c of subAgentCalls) {
							subAgentResultMap.set(c.id, {
								callId: c.id,
								name: c.name,
								content: JSON.stringify({ ok: false, error: 'plan_mode_blocked: sub-agents are disabled in Plan mode — use read tools directly to gather context for the plan.', soft: true }),
							});
						}
					} else {
						const groups = groupSubAgentsByParallelGroup(subAgentCalls);
						for (const group of groups) {
							const groupResults = await Promise.all(group.calls.map(c => dispatchSubAgent(c, {
								depth: 0,
								token: streamSource.token,
								toolExecutor: executor,
								chatService: this.chatService,
								logService: this.logService,
							})));
							for (let i = 0; i < group.calls.length; i++) {
								subAgentResultMap.set(group.calls[i].id, groupResults[i]);
							}
						}
					}
				}
				for (const call of result.toolCalls) {
					this.setStage(liveMsg, liveRefs, formatCallingStage(call));
					let toolArgs: unknown = undefined;
					try { toolArgs = call.argumentsJson ? JSON.parse(call.argumentsJson) : {}; } catch { toolArgs = {}; }
					const preHook = await this.runHook('preToolUse', { name: call.name, arguments: toolArgs }, undefined);
					if (preHook.action === 'block') {
						const tr: IAlaskaToolResult = {
							callId: call.id,
							name: call.name,
							content: JSON.stringify({ ok: false, error: `hook_blocked: ${preHook.reason}`, soft: true }),
						};
						toolResults.push(tr);
						wireMessages.push({ role: 'tool', content: tr.content, tool_call_id: tr.callId });
						this.completeActivity(liveMsg, liveRefs, call.id, tr);
						continue;
					}
					let tr: IAlaskaToolResult;
					const toolStartedAt = performance.now();
					if (call.name === 'alaska_dispatch_subagent') {
						tr = subAgentResultMap.get(call.id) ?? {
							callId: call.id,
							name: call.name,
							content: JSON.stringify({ ok: false, error: 'sub-agent dispatch missing — internal error', soft: true }),
						};
					} else if (call.name === 'alaska_announce_plan') {
						tr = await this.handleAnnouncePlan(call, liveMsg, liveRefs);
					} else if (call.name === 'alaska_run_command') {
						tr = await this.handleRunCommand(call, liveMsg, liveRefs, executor);
					} else if (call.name === 'alaska_open_browser') {
						tr = await this.handleOpenBrowser(call);
					} else if (call.name.startsWith('alaska_terminal_')) {
						tr = await this.handleTerminalTool(call);
					} else if (call.name.startsWith('mcp:')) {
						tr = await this.handleMcpCall(call);
					} else {
						try {
							tr = await this.runTools(executor, [call]).then(arr => arr[0]);
						} catch (err) {
							tr = {
								callId: call.id, name: call.name,
								content: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
							};
						}
					}
					this.metricsService.histogram('alaska.tool.exec_ms', performance.now() - toolStartedAt, {
						tool: call.name,
						outcome: classifyToolOutcome(tr.content),
					});
					void this.runHook('postToolUse', { name: call.name, arguments: toolArgs }, undefined);
					toolResults.push(tr);
					wireMessages.push({ role: 'tool', content: tr.content, tool_call_id: tr.callId });
					this.completeActivity(liveMsg, liveRefs, call.id, tr);
					this.captureReadFileLineCount(call, tr);

					if (tr.edit) {
						try {
							const prepared = await this.prepareEditFromTool(tr.edit);
							collectedEdits.push(prepared);
							await this.applyPreparedEdits([prepared]);
							this.registerWithPendingEdits(prepared);
							await this.finishLiveDiff(call.id, prepared.resource);
							// The agent's own write bumps mtime — refresh the baseline
							// so it isn't later mistaken for an external change.
							void this.recordReadVersion(this.relativePathFor(prepared.resource));
						} catch (err) {
							const errMsg = err instanceof Error ? err.message : String(err);
							const idx = wireMessages.findIndex(m => m.tool_call_id === tr.callId);
							if (idx >= 0) {
								wireMessages[idx] = {
									role: 'tool',
									tool_call_id: tr.callId,
									content: JSON.stringify({ ok: false, error: `apply_failed: ${errMsg}` }),
								};
							}
							this.completeActivity(liveMsg, liveRefs, call.id, {
								callId: call.id, name: call.name,
								content: JSON.stringify({ ok: false, error: errMsg }),
							});
							this.abortLiveDiff(call.id, `apply failed: ${errMsg}`);
						}
					} else {
						this.abortLiveDiff(call.id, tr.content && tryParseError(tr.content) || undefined);
					}
				}
				if (result.text) {
					finalText = result.text;
					this.renderMessageContent(assistantNode, finalText, true);
				}

				const hadParseError = toolResults.some(tr => isToolParseErrorResult(tr.content));
				if (hadParseError) {
					if (toolRetryCount < MAX_TOOL_RETRY) {
						toolRetryCount++;
						this.logService.warn(`[alaska.chat] tool_parse_error → silent auto-retry ${toolRetryCount}/${MAX_TOOL_RETRY}`);
						this.hideStage(liveRefs);
						this.showPendingPlaceholder(liveRefs);
						unwindLastAssistantTurn(wireMessages);
						wireMessages.push({
							role: 'system',
							content: 'Your previous tool call was cut off mid-string — the upstream stream truncated the JSON arguments before the closing quote. Retry the same plan, but emit the full arguments without splitting them, and prefer alaska_write_file with one complete content payload over many partial calls.',
						});
						const backoffMs = toolRetryCount === 1 ? 500 : 1500;
						await new Promise(r => setTimeout(r, backoffMs));
						continue;
					}
					liveMsg.retryReason = 'tool_truncation';
				}

				// SYSTEM REMINDERS (ported from grok's system_reminder + file tracker):
				// before the next turn, inject a synthetic user message if a file the
				// agent read has since changed on disk, or if a long task lacks a
				// tasklist. This runs after tool results are in wireMessages so the
				// reminder lands as the model's freshest context.
				if (this.reminderService.policy.enabled) {
					const staleFiles = await this.detectStaleReads();
					const tasklistTouchedThisTurn = result.toolCalls.some(c => c.name === 'alaska_announce_plan');
					const hasActiveTasklist = !!turnSessionId
						&& (this.agentModeService.getApprovedTasklist(turnSessionId)?.length ?? 0) > 0;
					const reminder = this.reminderService.buildTurnReminder({
						turnIndex: turn,
						hasActiveTasklist,
						tasklistTouchedThisTurn,
						staleFiles,
					});
					if (reminder) {
						wireMessages.push({ role: 'user', content: reminder });
						this.logService.info(`[alaska.reminder] injected (${staleFiles.length} stale file(s))`);
					}
				}

				this.setStage(liveMsg, liveRefs, 'Composing answer…');
			}

			if (liveRefs.reasoningEl) {
				liveRefs.reasoningEl.removeAttribute('open');
				liveRefs.reasoningEl.classList.remove('alaska-msg-reasoning-live');
			}

			if (session) {
				session.lastFinishReason = lastFinishReason;
				this.saveActiveSession();
			}
			if (lastFinishReason === 'length' && this.thread.length > 0) {
				const last = this.thread[this.thread.length - 1];
				if (last.role === 'assistant') {
					last.truncated = true;
				}
			}
			this.updateContextRibbon();

			if (!stoppedByError) {
				const legacyEdits = extractEditOperations(finalText);
				const fallback = describeEmptyTurn(liveMsg.toolActivities, collectedEdits.length, legacyEdits.length);
				const visibleContent = visibleAssistantContent(finalText, legacyEdits.length > 0 || collectedEdits.length > 0).trim()
					|| fallback;
				this.completeStage(liveMsg, liveRefs);
				liveMsg.role = 'assistant';
				liveMsg.content = visibleContent;
				this.saveActiveSession();
				if (!finalText && collectedEdits.length === 0 && legacyEdits.length === 0) {
					assistantNode.textContent = visibleContent;
					assistantMessageNode?.classList.add('alaska-msg-error');
				} else if (assistantMessageNode) {
					this.renderMessageContent(assistantNode, visibleContent, true);
					if (collectedEdits.length > 0) {
						this.renderPreparedEditBatch(assistantMessageNode, collectedEdits, requestAgentAccess);
					}
					if (legacyEdits.length > 0) {
						await this.renderEditBatch(assistantMessageNode, legacyEdits, requestAgentAccess);
					}
				}
				if (finalText && assistantMessageNode) {
					const orphans = detectOrphanCodeBlocks(finalText, allTurnToolCalls);
					if (orphans.length > 0) {
						this.logService.info(`[alaska.orphan] detected ${orphans.length} orphan code block(s) — rendering recovery banner`);
						this.metricsService.counter('alaska.orphan.detected', orphans.length, {
							turnCount: String(allTurnToolCalls.length),
						});
						this.renderOrphanCodeBanner(assistantMessageNode, orphans);
					}
				}
				if (turnSessionId && turnAgentMode === 'plan' && lastTurnHadNoToolCalls && finalText) {
					const draftCandidate = extractTasklistMarkdown(finalText);
					if (draftCandidate) {
						this.agentModeService.setDraftTasklist(turnSessionId, draftCandidate);
					}
				}
				void this.ensureUsage(true);
			}
		} catch (err) {
			this.logService.error('[alaska.chat] submit failed', err);
			const errMsg = err instanceof Error ? err.message : String(err);
			this.completeStage(liveMsg, liveRefs);
			liveMsg.role = 'error';
			liveMsg.content = errMsg;
			this.saveActiveSession();
			assistantNode.textContent = errMsg;
			assistantMessageNode?.classList.add('alaska-msg-error');
		} finally {
			this.abortAllLiveDiffs('stream ended');
			this.hidePendingPlaceholder(liveRefs);
			this.removeStreamingCaret(liveRefs);
			this.isStreaming = false;
			this.setStreaming(false);
			streamSource.dispose();
			if (this.streamCancel === streamSource) {
				this.streamCancel = undefined;
			}
		}
		const sessionAfter = this.currentSession();
		if (this.shouldAutoContinue(sessionAfter, sessionAfter?.lastFinishReason) && !this.composerEl?.value.trim()) {
			setTimeout(() => { void this.submit(true); }, 60);
		}
	}

	private async runOneTurn(args: {
		wireMessages: IAlaskaChatMessage[];
		codeCtx: ReturnType<IAlaskaContextService['captureCurrent']> & { workspaceFiles: string[]; agentAccess: AlaskaAgentAccess };
		accessMode: AlaskaAgentAccess;
		toolsAvailable: boolean;
		assistantNode: HTMLElement;
		streamSource: CancellationTokenSource;
		liveRefs: ILiveAssistantRefs;
		liveMsg: IThreadMessage;
		agentMode: AlaskaAgentMode;
		approvedTasklist: readonly ITaskItem[] | undefined;
	}): Promise<
		| { kind: 'ok'; text: string; toolCalls: IAlaskaToolCall[]; finishReason?: string; usage?: { input: number; output: number } }
		| { kind: 'error'; message: string; code?: 'truncated_tool_call' }
		| { kind: 'cancelled'; partial: string }
	> {
		const { wireMessages, codeCtx, accessMode, toolsAvailable, assistantNode, streamSource, liveRefs, liveMsg, agentMode, approvedTasklist } = args;
		let acc = '';
		const toolCalls: IAlaskaToolCall[] = [];
		let finishReason: string | undefined;
		let usage: { input: number; output: number } | undefined;

		const turnPermissionMode = this.readPermissionMode();
		const planAgentTurn = agentMode === 'plan';
		const readOnlyTurn = planAgentTurn || accessMode === 'read-only' || turnPermissionMode === 'readonly' || turnPermissionMode === 'plan';
		const allowAnnouncePlan = planAgentTurn || turnPermissionMode === 'plan';
		const baseTools = toolsAvailable
			? (readOnlyTurn
				? TOOL_DEFINITIONS.filter(t => isReadOnlyToolName(t.function.name) || (allowAnnouncePlan && t.function.name === 'alaska_announce_plan'))
				: TOOL_DEFINITIONS.filter(t => t.function.name !== 'alaska_run_command' || accessMode === 'edit'))
			: undefined;
		const mcpTools = planAgentTurn
			? []
			: await this.mcpService.getStatus().then(snap => snap.allTools).catch(() => []);
		const tools = baseTools
			? [...baseTools, ...mcpTools.map(t => mcpToolToWire(t))]
			: undefined;

		const stream = this.chatService.stream({
			model: this.selectedModel(),
			messages: wireMessages,
			context: codeCtx,
			tools,
			reasoningEffort: this.currentModelSupportsEffort() ? this.selectedEffort : undefined,
			agentMode,
			approvedTasklist,
		}, streamSource.token);

		const turnStartedAt = performance.now();
		let firstDeltaSeen = false;
		for await (const ev of stream) {
			this.hideStage(liveRefs);
			this.hidePendingPlaceholder(liveRefs);
			if (ev.kind === 'reasoning') {
				this.removeStreamingCaret(liveRefs);
				const preview = ((liveMsg.reasoning ?? '') + ev.text).replace(/\s+/g, ' ').trim().slice(-80);
				this.updateStreamingStatus('reasoning', preview);
				this.appendReasoning(liveMsg, liveRefs, ev.text);
			} else if (ev.kind === 'delta') {
				if (liveRefs.reasoningEl?.classList.contains('alaska-msg-reasoning-live')) {
					liveRefs.reasoningEl.classList.remove('alaska-msg-reasoning-live');
					liveRefs.reasoningEl.removeAttribute('open');
				}
				if (!firstDeltaSeen) {
					firstDeltaSeen = true;
					this.metricsService.histogram('alaska.chat.ttft_ms', performance.now() - turnStartedAt, {
						model: this.selectedModel() ?? 'default',
						mode: agentMode,
					});
				}
				this.updateStreamingStatus('writing');
				acc += ev.text;
				this.renderMessageContent(assistantNode, acc, true, false);
				this.ensureStreamingCaret(liveRefs);
				this.scrollToBottomIfNear();
			} else if (ev.kind === 'tool_progress') {
				this.updateStreamingStatus('tool', activityVerb(ev.name));
				void this.handleToolProgress(liveMsg, liveRefs, ev.id, ev.name, ev.partialArguments);
			} else if (ev.kind === 'tool_call') {
				this.updateStreamingStatus('tool', activityVerb(ev.call.name));
				toolCalls.push(ev.call);
				this.beginActivity(liveMsg, liveRefs, ev.call);
				this.finalizeToolCard(liveRefs, ev.call);
			} else if (ev.kind === 'done') {
				finishReason = ev.finishReason;
				usage = ev.usage;
				break;
			} else if (ev.kind === 'error') {
				if (streamSource.token.isCancellationRequested) {
					return { kind: 'cancelled', partial: acc };
				}
				return { kind: 'error', message: ev.message, code: ev.code };
			}
		}
		this.removeStreamingCaret(liveRefs);
		return { kind: 'ok', text: acc, toolCalls, finishReason, usage };
	}

	private attachLiveAssistantUI(contentEl: HTMLElement, messageNode: HTMLElement | null): ILiveAssistantRefs {
		return {
			messageNode,
			contentEl,
			reasoningEl: undefined,
			reasoningPre: undefined,
			activitiesEl: undefined,
			activityRows: new Map(),
		};
	}

	private showPendingPlaceholder(refs: ILiveAssistantRefs): void {
		if (refs.pendingEl) { return; }
		const wrap = document.createElement('div');
		wrap.className = 'alaska-msg-pending';
		const dots = document.createElement('span');
		dots.className = 'alaska-msg-pending-dots';
		for (let i = 0; i < 3; i++) {
			dots.appendChild(document.createElement('span'));
		}
		wrap.appendChild(dots);
		const label = document.createElement('span');
		// allow-any-unicode-next-line
		label.textContent = localize('alaska.chat.pending', 'Xipher работает');
		wrap.appendChild(label);
		const elapsed = document.createElement('span');
		elapsed.className = 'alaska-pending-elapsed';
		elapsed.textContent = this.streamStartMs ? this.formatElapsed(Date.now() - this.streamStartMs) : '0s';
		wrap.appendChild(elapsed);
		refs.contentEl.before(wrap);
		refs.pendingEl = wrap;
	}

	private hidePendingPlaceholder(refs: ILiveAssistantRefs): void {
		refs.pendingEl?.remove();
		refs.pendingEl = undefined;
	}

	private ensureStreamingCaret(refs: ILiveAssistantRefs): void {
		if (!refs.caretEl) {
			const caret = document.createElement('span');
			caret.className = 'alaska-caret';
			caret.setAttribute('aria-hidden', 'true');
			refs.caretEl = caret;
		}
		if (refs.caretEl.parentNode !== refs.contentEl) {
			refs.contentEl.appendChild(refs.caretEl);
		} else {
			refs.contentEl.appendChild(refs.caretEl);
		}
	}

	private removeStreamingCaret(refs: ILiveAssistantRefs): void {
		refs.caretEl?.remove();
		refs.caretEl = undefined;
	}

	private appendReasoning(msg: IThreadMessage, refs: ILiveAssistantRefs, text: string): void {
		if (!text) { return; }
		msg.reasoning = (msg.reasoning ?? '') + text;
		refs.contentEl.classList.remove('alaska-msg-thinking');
		refs.contentEl.textContent = '';
		if (!refs.reasoningEl || !refs.reasoningPre) {
			const det = this.renderReasoningPanel(msg.reasoning);
			det.setAttribute('open', '');
			det.classList.add('alaska-msg-reasoning-live');
			refs.reasoningEl = det;
			// eslint-disable-next-line no-restricted-syntax
			refs.reasoningPre = det.querySelector<HTMLPreElement>('.alaska-msg-reasoning-text') ?? undefined;
			const anchor = refs.activitiesEl ?? refs.stageEl ?? refs.contentEl;
			anchor.before(det);
		} else {
			refs.reasoningPre.textContent = msg.reasoning;
			this.scrollToBottomIfNear();
		}
	}

	private beginActivity(msg: IThreadMessage, refs: ILiveAssistantRefs, call: IAlaskaToolCall): void {
		if (!msg.toolActivities) {
			msg.toolActivities = [];
		}
		const existing = msg.toolActivities.find(a => a.id === call.id);
		if (existing) {
			const target = extractToolTarget(call.argumentsJson);
			if (target !== undefined && target !== existing.target) {
				existing.target = target;
				const oldRow = refs.activityRows.get(call.id);
				if (oldRow) {
					const newRow = this.renderActivityRow(existing);
					oldRow.replaceWith(newRow);
					refs.activityRows.set(call.id, newRow);
				}
			}
			return;
		}
		const activity: IThreadToolActivity = {
			id: call.id,
			name: call.name,
			target: extractToolTarget(call.argumentsJson),
			status: 'running',
		};
		if (call.name === 'alaska_run_command') {
			const parsed = tryParseRunCommandArgs(call.argumentsJson);
			if (parsed.command) {
				this.runCommandPending++;
				const display = parsed.command.length > 200 ? parsed.command.slice(0, 200) + '…' : parsed.command;
				activity.target = display;
				activity.runCommand = {
					command: parsed.command,
					displayCommand: display,
					cwd: parsed.cwd,
					status: 'queued',
					output: '',
					droppedBytes: 0,
					encoding: 'utf-8',
					queuePosition: this.runCommandPending,
				};
			}
		}
		msg.toolActivities.push(activity);

		if (!refs.activitiesEl) {
			refs.activitiesEl = document.createElement('div');
			refs.activitiesEl.className = 'alaska-msg-activities';
			const anchor = refs.stageEl ?? refs.contentEl;
			anchor.before(refs.activitiesEl);
		}
		const row = this.renderActivityRow(activity);
		refs.activityRows.set(call.id, row);
		refs.activitiesEl.appendChild(row);
		this.scrollToBottomIfNear();
	}

	private completeActivity(msg: IThreadMessage, refs: ILiveAssistantRefs, callId: string, result: IAlaskaToolResult): void {
		const activity = msg.toolActivities?.find(a => a.id === callId);
		if (!activity) { return; }
		const parsed = parseToolResultSummary(result.content);
		activity.status = parsed.ok ? 'ok' : (parsed.soft ? 'skipped' : 'err');
		activity.summary = parsed.summary;
		activity.progress = undefined;
		const oldRow = refs.activityRows.get(callId);
		if (oldRow) {
			const newRow = this.renderActivityRow(activity);
			oldRow.replaceWith(newRow);
			refs.activityRows.set(callId, newRow);
		}
		if ((result.name === 'alaska_grep_search' || result.name === 'alaska_list_directory') && parsed.ok) {
			this.renderDiscoveryPreview(refs, callId, result);
		}
		const card = this.findToolCard(refs, callId);
		if (card) {
			card.dataset.state = activity.status === 'ok' ? 'done' : activity.status === 'err' ? 'error' : 'skipped';
		}
	}

	private renderDiscoveryPreview(refs: ILiveAssistantRefs, callId: string, result: IAlaskaToolResult): void {
		let output: string | undefined;
		try {
			const obj = JSON.parse(result.content) as { ok?: boolean; output?: unknown };
			if (obj.ok === false) { return; }
			if (typeof obj.output === 'string') { output = obj.output; }
		} catch {
			return;
		}
		if (!output) { return; }
		const card = this.ensureToolPreviewCard(refs, callId, result.name);
		if (!card) { return; }
		card.dataset.state = 'done';
		this.paintToolPreview(card, output, true);
		const lineCount = output.split('\n').length;
		if (lineCount > ALASKA_TOOL_PREVIEW_AUTO_COLLAPSE_LINES && !card.classList.contains('collapsed')) {
			card.classList.add('collapsed');
			// eslint-disable-next-line no-restricted-syntax
			const btn = card.querySelector<HTMLButtonElement>('.alaska-msg-tool-collapse');
			if (btn) {
				btn.textContent = '▸';
			}
		}
	}

	private async handleToolProgress(msg: IThreadMessage, refs: ILiveAssistantRefs, callId: string, toolName: string, partialArgs: string): Promise<void> {
		if (toolName === 'alaska_run_command') {
			return;
		}
		if (toolName !== 'alaska_write_file' && toolName !== 'alaska_patch_file') {
			return;
		}
		const path = tryStablePath(partialArgs);
		const content = toolName === 'alaska_patch_file'
			? tryPartialReplace(partialArgs)
			: tryPartialContent(partialArgs);
		const contentFirst = !path && partialArgsMissingPath(partialArgs);
		if (!path && typeof content !== 'string') {
			return;
		}
		let activity = msg.toolActivities?.find(a => a.id === callId);
		if (!activity) {
			this.beginActivity(msg, refs, { id: callId, name: toolName, argumentsJson: partialArgs });
			activity = msg.toolActivities?.find(a => a.id === callId);
			if (!activity) {
				return;
			}
		}
		if (path && path !== activity.target) {
			activity.target = path;
			const oldRow = refs.activityRows.get(callId);
			if (oldRow) {
				const newRow = this.renderActivityRow(activity);
				oldRow.replaceWith(newRow);
				refs.activityRows.set(callId, newRow);
			}
		}
		if (typeof content === 'string' && content.length > 0) {
			this.updateToolPreview(refs, callId, toolName, content);
		} else if (path) {
			this.ensureToolPreviewCardWithPlaceholder(refs, callId, toolName);
		}
		if (contentFirst && typeof content === 'string') {
			const expectedFromPrior = this.expectedLinesByPath.get(activity.target ?? '');
			this.updateActivityProgress(msg, refs, callId, content, expectedFromPrior, '(detecting path…)');
			return;
		}
		if (!path) {
			return;
		}
		if (toolName === 'alaska_patch_file') {
			if (typeof content === 'string') {
				this.updateActivityProgress(msg, refs, callId, content, undefined);
			}
			return;
		}
		let session = this.liveWriteSessions.get(callId);
		if (!session) {
			session = await this.openLiveDiff(callId, path);
			if (!session) {
				return;
			}
		}
		if (typeof content !== 'string') {
			return;
		}
		this.pushLiveContent(session, content);
		const expected = session.expectedLines ?? this.expectedLinesByPath.get(path);
		this.updateActivityProgress(msg, refs, callId, content, expected);
	}

	private async openLiveDiff(callId: string, relPath: string): Promise<ILiveWriteSession | undefined> {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root) {
			return undefined;
		}
		const targetUri = resolveWorkspacePath(root, relPath);
		let originalContent = '';
		try {
			if (await this.fileService.exists(targetUri)) {
				originalContent = (await this.textFileService.read(targetUri)).value;
			}
		} catch (err) {
			this.logService.warn('[alaska.chat] live-diff: read original failed', err);
		}
		const expectedLines = originalContent ? originalContent.split('\n').length : undefined;
		const baseSegment = encodeURIComponent(callId);
		const pathSegment = relPath.replace(/^\/+/, '');
		const originalUri = URI.from({ scheme: ALASKA_LIVE_SCHEME, path: `/${baseSegment}/original/${pathSegment}` });
		const liveUri = URI.from({ scheme: ALASKA_LIVE_SCHEME, path: `/${baseSegment}/modified/${pathSegment}` });
		const langSel = this.languageService.createByFilepathOrFirstLine(targetUri, originalContent.slice(0, 200));
		this.modelService.createModel(originalContent, langSel, originalUri);
		const liveModel = this.modelService.createModel('', this.languageService.createByFilepathOrFirstLine(targetUri, ''), liveUri);
		const session: ILiveWriteSession = {
			callId,
			path: relPath,
			targetUri,
			liveUri,
			originalUri,
			originalContent,
			expectedLines,
			model: liveModel,
			lastContent: '',
			lastFlushAt: 0,
			closed: false,
		};
		this.liveWriteSessions.set(callId, session);
		try {
			await this.editorService.openEditor({
				label: `Xipher IDE · writing ${relPath}…`,
				description: '',
				original: { resource: originalUri },
				modified: { resource: liveUri },
				options: { preserveFocus: true, pinned: false },
			}, SIDE_GROUP);
		} catch (err) {
			this.logService.warn('[alaska.chat] live-diff: openEditor failed', err);
		}
		return session;
	}

	private pushLiveContent(session: ILiveWriteSession, content: string): void {
		if (session.closed) {
			return;
		}
		if (content === session.lastContent) {
			return;
		}
		session.lastContent = content;
		const now = Date.now();
		const dueIn = Math.max(0, 80 - (now - session.lastFlushAt));
		if (session.pendingFlush) {
			return;
		}
		// eslint-disable-next-line no-restricted-globals
		session.pendingFlush = window.setTimeout(() => {
			session.pendingFlush = undefined;
			session.lastFlushAt = Date.now();
			const model = session.model ?? this.modelService.getModel(session.liveUri);
			if (!model) {
				return;
			}
			if (model.getValue() === session.lastContent) {
				return;
			}
			model.setValue(session.lastContent);
		}, dueIn);
	}

	private async finishLiveDiff(callId: string, appliedResource: URI): Promise<void> {
		const session = this.liveWriteSessions.get(callId);
		if (!session) {
			return;
		}
		session.closed = true;
		if (session.pendingFlush) {
			// eslint-disable-next-line no-restricted-globals
			window.clearTimeout(session.pendingFlush);
			session.pendingFlush = undefined;
		}
		this.liveWriteSessions.delete(callId);
		await this.closeLiveDiffEditors(session);
		this.destroyLiveModels(session);
		try {
			await this.editorService.openEditor({ resource: appliedResource, options: { preserveFocus: true, pinned: false } }, SIDE_GROUP);
		} catch (err) {
			this.logService.warn('[alaska.chat] live-diff: open applied resource failed', err);
		}
	}

	private abortLiveDiff(callId: string, reason?: string): void {
		const session = this.liveWriteSessions.get(callId);
		if (!session) {
			return;
		}
		session.closed = true;
		if (session.pendingFlush) {
			// eslint-disable-next-line no-restricted-globals
			window.clearTimeout(session.pendingFlush);
			session.pendingFlush = undefined;
		}
		this.liveWriteSessions.delete(callId);
		this.logService.info(`[alaska.chat] live-diff aborted for ${session.path}: ${reason ?? 'unknown'}`);
	}

	private abortAllLiveDiffs(reason: string): void {
		for (const id of Array.from(this.liveWriteSessions.keys())) {
			this.abortLiveDiff(id, reason);
		}
		for (const [id, state] of this.toolPreviewState) {
			if (state.rafHandle !== undefined) {
				mainWindow.cancelAnimationFrame(state.rafHandle);
				state.rafHandle = undefined;
			}
			if (!state.finalized) {
				this.toolPreviewState.delete(id);
			}
		}
	}

	private async closeLiveDiffEditors(session: ILiveWriteSession): Promise<void> {
		const targets = [session.liveUri.toString(), session.originalUri.toString()];
		for (const group of this.editorGroupsService.groups) {
			const toClose = group.editors.filter(e => {
				const primary = e.resource?.toString();
				const candidates = [primary];
				const asDiff = e as unknown as { original?: { resource?: URI }; modified?: { resource?: URI } };
				if (asDiff?.original?.resource) {
					candidates.push(asDiff.original.resource.toString());
				}
				if (asDiff?.modified?.resource) {
					candidates.push(asDiff.modified.resource.toString());
				}
				return candidates.some(u => u && targets.includes(u));
			});
			if (toClose.length > 0) {
				try {
					await group.closeEditors(toClose, { preserveFocus: true });
				} catch (err) {
					this.logService.warn('[alaska.chat] live-diff: close editors failed', err);
				}
			}
		}
	}

	private destroyLiveModels(session: ILiveWriteSession): void {
		try { this.modelService.destroyModel(session.liveUri); } catch { }
		try { this.modelService.destroyModel(session.originalUri); } catch { }
		session.model = undefined;
	}

	private async handleMcpCall(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		let args: Record<string, unknown> = {};
		const raw = call.argumentsJson.trim();
		if (raw.length > 0) {
			try {
				const parsed = JSON.parse(raw) as Record<string, unknown>;
				if (parsed && typeof parsed === 'object') {
					args = parsed;
				}
			} catch (err) {
				return {
					callId: call.id,
					name: call.name,
					content: JSON.stringify({ ok: false, error: `invalid JSON arguments for ${call.name}: ${err instanceof Error ? err.message : String(err)}` }),
				};
			}
		}
		try {
			const result = await this.mcpService.callTool(call.name, args);
			if (!result.ok) {
				return {
					callId: call.id,
					name: call.name,
					content: JSON.stringify({ ok: false, error: result.error ?? 'mcp call failed' }),
				};
			}
			return {
				callId: call.id,
				name: call.name,
				content: JSON.stringify({ ok: true, content: result.content ?? '', isError: !!result.isError }),
			};
		} catch (err) {
			return {
				callId: call.id,
				name: call.name,
				content: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
			};
		}
	}

	// Open a URL in the IDE's built-in Simple Browser panel (like Cursor's in-editor
	// browser). Unlike alaska_web_fetch (backend, SSRF-blocked), this renders in the
	// user's own webview, so localhost dev servers are allowed.
	private async handleOpenBrowser(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		let url = '';
		try { url = String((JSON.parse(call.argumentsJson || '{}') as { url?: unknown }).url ?? '').trim(); } catch { /* handled below */ }
		if (!url) {
			return { callId: call.id, name: call.name, content: JSON.stringify({ ok: false, error: '`url` must be a non-empty string', soft: true }) };
		}
		if (!/^https?:\/\//i.test(url)) {
			return { callId: call.id, name: call.name, content: JSON.stringify({ ok: false, error: '`url` must start with http:// or https://', soft: true }) };
		}
		try {
			// simpleBrowser.show opens (or focuses) the in-IDE browser panel at the URL.
			await this.commandService.executeCommand('simpleBrowser.show', url);
			return { callId: call.id, name: call.name, content: JSON.stringify({ ok: true, opened: url, output: `Opened ${url} in the in-IDE browser panel. The user can now see the live page beside their code.` }) };
		} catch (err) {
			return { callId: call.id, name: call.name, content: JSON.stringify({ ok: false, error: `could not open browser: ${err instanceof Error ? err.message : String(err)}`, soft: true }) };
		}
	}

	private async handleAnnouncePlan(call: IAlaskaToolCall, msg: IThreadMessage, refs: ILiveAssistantRefs): Promise<IAlaskaToolResult> {
		let parsed: { rationale?: unknown; changes?: unknown };
		try {
			parsed = JSON.parse(call.argumentsJson) as { rationale?: unknown; changes?: unknown };
		} catch (err) {
			return {
				callId: call.id,
				name: call.name,
				content: JSON.stringify({ ok: false, approved: false, error: 'invalid_arguments', reason: err instanceof Error ? err.message : String(err) }),
			};
		}
		const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';
		const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : [];
		const changes: IPlanChange[] = [];
		for (const raw of rawChanges) {
			if (!raw || typeof raw !== 'object') {
				continue;
			}
			const c = raw as { path?: unknown; action?: unknown; summary?: unknown };
			if (typeof c.path !== 'string' || typeof c.action !== 'string' || typeof c.summary !== 'string') {
				continue;
			}
			if (c.action !== 'create' && c.action !== 'edit' && c.action !== 'delete') {
				continue;
			}
			changes.push({ path: c.path, action: c.action, summary: c.summary });
		}
		if (changes.length === 0) {
			return {
				callId: call.id,
				name: call.name,
				content: JSON.stringify({ ok: false, approved: false, error: 'empty_plan', reason: 'changes[] must include at least one path/action/summary triple' }),
			};
		}
		this.beginActivity(msg, refs, call);
		const activity = msg.toolActivities?.find(a => a.id === call.id);
		if (!activity) {
			return {
				callId: call.id,
				name: call.name,
				content: JSON.stringify({ ok: false, approved: false, error: 'render_failed' }),
			};
		}
		activity.plan = { rationale, changes };
		activity.target = `${changes.length} file${changes.length === 1 ? '' : 's'}`;
		const outcome = await this.renderPlanCard(msg, refs, activity);
		activity.plan = { ...activity.plan, ...outcome.activityPatch };
		activity.status = outcome.approved ? 'ok' : 'err';
		activity.summary = outcome.summary;
		const oldRow = refs.activityRows.get(call.id);
		if (oldRow) {
			const newRow = this.renderActivityRow(activity);
			oldRow.replaceWith(newRow);
			refs.activityRows.set(call.id, newRow);
		}
		this.saveActiveSession();
		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify(outcome.toolPayload),
		};
	}

	private async handleTerminalTool(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const fail = (code: string, msg: string): IAlaskaToolResult => ({
			callId: call.id, name: call.name,
			content: JSON.stringify({ ok: false, error: code, message: msg }),
		});
		const permissionMode = this.readPermissionMode();
		if (permissionMode === 'readonly' || permissionMode === 'plan') {
			return fail('permission_blocked', `terminal tools are blocked in ${permissionMode} mode`);
		}
		if (!this.workspaceTrust.isWorkspaceTrusted()) {
			return fail('workspace_untrusted', 'terminal tools require a trusted workspace');
		}
		let args: Record<string, unknown>;
		try {
			args = JSON.parse(call.argumentsJson) as Record<string, unknown>;
		} catch (err) {
			return fail('invalid_arguments', err instanceof Error ? err.message : String(err));
		}
		const name = call.name;
		try {
			if (name === 'alaska_terminal_start') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				if (!sessionName) { return fail('invalid_arguments', '`name` is required'); }
				const command = typeof args.command === 'string' ? args.command.trim() : undefined;
				const consent = await this.assessRunCommandConsent(command ?? `terminal session: ${sessionName}`);
				if (!consent.granted) { return fail('consent_denied', (consent as { reason: string }).reason); }
				const root = this.workspaceService.getWorkspace().folders[0]?.uri;
				const cwdRel = typeof args.cwd === 'string' ? args.cwd.trim() : '';
				const cwd = cwdRel && root ? resolveWorkspacePath(root, cwdRel) : root;
				const session = await this.ptySessionService.start({
					name: sessionName,
					command: command || undefined,
					cwd,
					force: args.force === true,
				});
				return { callId: call.id, name, content: JSON.stringify({ ok: true, name: session.name, shell: session.shell, status: session.status }) };
			}
			if (name === 'alaska_terminal_send') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				const input = typeof args.input === 'string' ? args.input : '';
				const execute = args.execute !== false;
				await this.ptySessionService.send(sessionName, input, execute);
				return { callId: call.id, name, content: JSON.stringify({ ok: true }) };
			}
			if (name === 'alaska_terminal_read') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				const r = this.ptySessionService.read(sessionName);
				return { callId: call.id, name, content: JSON.stringify({ ok: true, output: r.output, status: r.status, exit_code: r.exitCode ?? null, truncated: r.droppedBytes > 0 }) };
			}
			if (name === 'alaska_terminal_wait') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				let condition: import('../common/alaskaPtySession.js').IAlaskaPtyWaitCondition;
				if (typeof args.text === 'string') { condition = { kind: 'text', value: args.text }; }
				else if (typeof args.regex === 'string') { condition = { kind: 'regex', value: args.regex }; }
				else if (typeof args.gone === 'string') { condition = { kind: 'gone', value: args.gone }; }
				else if (typeof args.stable_ms === 'number') { condition = { kind: 'stable', stableMs: args.stable_ms }; }
				else { return fail('invalid_arguments', 'one of text, regex, gone, or stable_ms is required'); }
				const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 10000;
				const r = await this.ptySessionService.waitFor(sessionName, condition, timeoutMs);
				return { callId: call.id, name, content: JSON.stringify({ ok: true, matched: r.matched, reason: r.reason, output: r.output }) };
			}
			if (name === 'alaska_terminal_stop') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				await this.ptySessionService.stop(sessionName);
				return { callId: call.id, name, content: JSON.stringify({ ok: true }) };
			}
			if (name === 'alaska_terminal_list') {
				const sessions = this.ptySessionService.list().map(s => ({ name: s.name, command: s.command, status: s.status, exit_code: s.exitCode ?? null, shell: s.shell }));
				return { callId: call.id, name, content: JSON.stringify({ ok: true, sessions }) };
			}
			return fail('unknown_tool', `unknown terminal tool: ${name}`);
		} catch (err) {
			return fail('error', err instanceof Error ? err.message : String(err));
		}
	}

	private async handleTerminalTool(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const fail = (code: string, msg: string): IAlaskaToolResult => ({
			callId: call.id, name: call.name,
			content: JSON.stringify({ ok: false, error: code, message: msg }),
		});
		const permissionMode = this.readPermissionMode();
		if (permissionMode === 'readonly' || permissionMode === 'plan') {
			return fail('permission_blocked', `terminal tools are blocked in ${permissionMode} mode`);
		}
		if (!this.workspaceTrust.isWorkspaceTrusted()) {
			return fail('workspace_untrusted', 'terminal tools require a trusted workspace');
		}
		let args: Record<string, unknown>;
		try {
			args = JSON.parse(call.argumentsJson) as Record<string, unknown>;
		} catch (err) {
			return fail('invalid_arguments', err instanceof Error ? err.message : String(err));
		}
		const name = call.name;
		try {
			if (name === 'alaska_terminal_start') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				if (!sessionName) { return fail('invalid_arguments', '`name` is required'); }
				const command = typeof args.command === 'string' ? args.command.trim() : undefined;
				const consent = await this.assessRunCommandConsent(command ?? `terminal session: ${sessionName}`);
				if (!consent.granted) { return fail('consent_denied', (consent as { reason: string }).reason); }
				const root = this.workspaceService.getWorkspace().folders[0]?.uri;
				const cwdRel = typeof args.cwd === 'string' ? args.cwd.trim() : '';
				const cwd = cwdRel && root ? resolveWorkspacePath(root, cwdRel) : root;
				const session = await this.ptySessionService.start({
					name: sessionName,
					command: command || undefined,
					cwd,
					force: args.force === true,
				});
				return { callId: call.id, name, content: JSON.stringify({ ok: true, name: session.name, shell: session.shell, status: session.status }) };
			}
			if (name === 'alaska_terminal_send') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				const input = typeof args.input === 'string' ? args.input : '';
				const execute = args.execute !== false;
				await this.ptySessionService.send(sessionName, input, execute);
				return { callId: call.id, name, content: JSON.stringify({ ok: true }) };
			}
			if (name === 'alaska_terminal_read') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				const r = this.ptySessionService.read(sessionName);
				return { callId: call.id, name, content: JSON.stringify({ ok: true, output: r.output, status: r.status, exit_code: r.exitCode ?? null, truncated: r.droppedBytes > 0 }) };
			}
			if (name === 'alaska_terminal_wait') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				let condition: import('../common/alaskaPtySession.js').IAlaskaPtyWaitCondition;
				if (typeof args.text === 'string') { condition = { kind: 'text', value: args.text }; }
				else if (typeof args.regex === 'string') { condition = { kind: 'regex', value: args.regex }; }
				else if (typeof args.gone === 'string') { condition = { kind: 'gone', value: args.gone }; }
				else if (typeof args.stable_ms === 'number') { condition = { kind: 'stable', stableMs: args.stable_ms }; }
				else { return fail('invalid_arguments', 'one of text, regex, gone, or stable_ms is required'); }
				const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 10000;
				const r = await this.ptySessionService.waitFor(sessionName, condition, timeoutMs);
				return { callId: call.id, name, content: JSON.stringify({ ok: true, matched: r.matched, reason: r.reason, output: r.output }) };
			}
			if (name === 'alaska_terminal_stop') {
				const sessionName = typeof args.name === 'string' ? args.name.trim() : '';
				await this.ptySessionService.stop(sessionName);
				return { callId: call.id, name, content: JSON.stringify({ ok: true }) };
			}
			if (name === 'alaska_terminal_list') {
				const sessions = this.ptySessionService.list().map(s => ({ name: s.name, command: s.command, status: s.status, exit_code: s.exitCode ?? null, shell: s.shell }));
				return { callId: call.id, name, content: JSON.stringify({ ok: true, sessions }) };
			}
			return fail('unknown_tool', `unknown terminal tool: ${name}`);
		} catch (err) {
			return fail('error', err instanceof Error ? err.message : String(err));
		}
	}

	private async handleRunCommand(call: IAlaskaToolCall, msg: IThreadMessage, refs: ILiveAssistantRefs, executor: AlaskaToolExecutor | undefined): Promise<IAlaskaToolResult> {
		const permissionMode = this.readPermissionMode();
		if (permissionMode === 'readonly') {
			return runCommandFail(call, 'permission_readonly', 'shell-command execution is blocked in Read-only permission mode.');
		}
		if (permissionMode === 'plan') {
			return runCommandFail(call, 'permission_plan', 'shell-command execution is deferred in Plan permission mode — the plan was recorded, no command was run.');
		}
		if (!this.workspaceTrust.isWorkspaceTrusted()) {
			return runCommandFail(call, 'workspace_untrusted', 'shell-command execution is blocked until you mark this workspace as trusted in VS Code (File → Manage Workspace Trust).');
		}
		let parsedArgs: { command?: unknown; cwd?: unknown };
		try {
			parsedArgs = JSON.parse(call.argumentsJson) as { command?: unknown; cwd?: unknown };
		} catch (err) {
			return runCommandFail(call, 'invalid_arguments', err instanceof Error ? err.message : String(err));
		}
		const command = typeof parsedArgs.command === 'string' ? parsedArgs.command.trim() : '';
		if (!command) {
			return runCommandFail(call, 'invalid_arguments', '`command` must not be empty');
		}
		const cwdRel = typeof parsedArgs.cwd === 'string' ? parsedArgs.cwd.trim() : '';
		const workspaceRoot = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!workspaceRoot) {
			return runCommandFail(call, 'no_workspace', 'no workspace is open');
		}
		let cwdUri: URI;
		try {
			cwdUri = cwdRel && executor ? executor.resolveSafe(cwdRel) : workspaceRoot;
		} catch {
			cwdUri = workspaceRoot;
		}

		this.beginActivity(msg, refs, call);
		const activity = msg.toolActivities?.find(a => a.id === call.id);
		if (!activity) {
			return runCommandFail(call, 'render_failed', 'failed to register run-command activity');
		}
		const displayCommand = command.length > 200 ? command.slice(0, 200) + '…' : command;
		activity.target = displayCommand;
		if (!activity.runCommand) {
			this.runCommandPending++;
			activity.runCommand = {
				command,
				displayCommand,
				cwd: cwdRel || undefined,
				status: 'queued',
				output: '',
				droppedBytes: 0,
				encoding: 'utf-8',
				queuePosition: this.runCommandPending,
			};
		}
		this.replaceRunCommandRow(refs, call.id, activity);

		const denial = evaluateRunCommandDenial(command);
		if (denial) {
			activity.runCommand.status = 'blocked';
			activity.runCommand.reason = denial.reason;
			activity.runCommand.endedAt = Date.now();
			activity.status = 'err';
			activity.summary = denial.reason;
			this.runCommandPending = Math.max(0, this.runCommandPending - 1);
			this.applyRunCardState(call.id, activity);
			this.saveActiveSession();
			return runCommandFail(call, 'command_blocked', denial.reason);
		}

		let releaseQueue: (() => void) | undefined;
		const slotPromise = this.runCommandQueue;
		this.runCommandQueue = new Promise<void>(resolve => { releaseQueue = resolve; });
		try {
			await slotPromise;
		} catch {
		}
		try {
			activity.runCommand.queuePosition = undefined;
			activity.runCommand.status = 'awaiting-consent';
			this.applyRunCardState(call.id, activity);
			this.rebalanceRunCommandQueue(msg);

			const consent = await this.assessRunCommandConsent(command);
			if (!consent.granted) {
				activity.runCommand.status = 'blocked';
				activity.runCommand.reason = consent.reason;
				activity.runCommand.endedAt = Date.now();
				activity.status = 'err';
				activity.summary = consent.reason;
				this.applyRunCardState(call.id, activity);
				this.saveActiveSession();
				return runCommandFail(call, consent.errorCode, consent.reason);
			}

			const os = await this.detectOs();
			const isRemote = workspaceRoot.scheme === Schemas.alaskacodeRemote;
			const userShellEnv = os === OperatingSystem.Windows ? undefined : this.readUserShellEnv();
			let profile: ReturnType<typeof this.terminalProfileService.getDefaultProfile> | undefined;
			try {
				profile = this.terminalProfileService.getDefaultProfile(os);
			} catch {
				profile = undefined;
			}
			const terminalName = `Xipher IDE · ${command.length > 40 ? command.slice(0, 40) + '…' : command}`;
			const plan = buildRunCommandShellPlan({
				command,
				cwd: cwdUri,
				os,
				isRemote,
				profile: profile ?? undefined,
				userShellEnv,
				terminalName,
			});
			activity.runCommand.shell = plan.shellLabel;
			activity.runCommand.displayShellName = plan.displayShellName;
			activity.runCommand.startedAt = Date.now();
			activity.runCommand.status = 'running';
			this.applyRunCardState(call.id, activity);

			const result = await this.driveRunCommandTerminal(call, msg, refs, activity, plan.config);
			this.saveActiveSession();
			return result;
		} finally {
			this.runCommandPending = Math.max(0, this.runCommandPending - 1);
			releaseQueue?.();
		}
	}

	private async driveRunCommandTerminal(call: IAlaskaToolCall, msg: IThreadMessage, refs: ILiveAssistantRefs, activity: IThreadToolActivity, config: import('../../../../platform/terminal/common/terminal.js').IShellLaunchConfig): Promise<IAlaskaToolResult> {
		const rc = activity.runCommand!;
		let instance: ITerminalInstance | undefined;
		try {
			instance = await this.terminalService.createTerminal({
				config,
				location: TerminalLocation.Panel,
			});
		} catch (err) {
			rc.status = 'err';
			rc.reason = err instanceof Error ? err.message : String(err);
			rc.endedAt = Date.now();
			activity.status = 'err';
			activity.summary = `failed to start: ${rc.reason}`;
			this.applyRunCardState(call.id, activity);
			return runCommandFail(call, 'spawn_failed', rc.reason);
		}
		rc.terminalInstanceId = instance.instanceId;
		try {
			await this.terminalService.revealTerminal(instance, true);
		} catch (err) {
			this.logService.warn('[alaska.run-command] revealTerminal failed', err);
		}
		this.applyRunCardState(call.id, activity);

		const disposables = new DisposableStore();
		const SOFT_TAIL_BUDGET = 64 * 1024;
		const HARD_TIMEOUT_MS = 30 * 60 * 1000;
		let outputBuffer = '';
		let droppedBytes = 0;
		let outputDirty = false;
		let outputTimer: number | undefined;
		const appendOutput = (raw: string) => {
			const text = stripAnsiSeq(raw);
			if (!text) {
				return;
			}
			outputBuffer += text;
			if (outputBuffer.length > SOFT_TAIL_BUDGET) {
				const excess = outputBuffer.length - SOFT_TAIL_BUDGET;
				droppedBytes += excess;
				outputBuffer = outputBuffer.slice(excess);
			}
			rc.output = outputBuffer;
			rc.droppedBytes = droppedBytes;
			outputDirty = true;
			if (outputTimer === undefined) {
				outputTimer = setTimeout(() => {
					outputTimer = undefined;
					if (outputDirty) {
						outputDirty = false;
						this.applyRunCardOutput(call.id, activity);
					}
				}, 80) as unknown as number;
			}
		};

		const flushOutput = () => {
			if (outputTimer !== undefined) {
				clearTimeout(outputTimer);
				outputTimer = undefined;
			}
			if (outputDirty) {
				outputDirty = false;
				this.applyRunCardOutput(call.id, activity);
			}
		};

		disposables.add(instance.onData(appendOutput));

		let resolved = false;
		const exitPromise = new Promise<{ exitCode: number | null; reason: 'exit' | 'cancelled' | 'timed-out' | 'killed' }>(resolve => {
			disposables.add(instance!.onExit(event => {
				if (resolved) { return; }
				resolved = true;
				const code = typeof event === 'number' ? event : null;
				resolve({ exitCode: code, reason: 'exit' });
			}));
		});

		let abortRequested = false;
		const abortTimers: ReturnType<typeof setTimeout>[] = [];
		const cancelByUser = () => {
			if (resolved || abortRequested) {
				return;
			}
			abortRequested = true;
			rc.status = 'cancelled';
			this.applyRunCardState(call.id, activity);
			try {
				void instance!.sendText('\x03', false);
			} catch (err) {
				this.logService.warn('[alaska.run-command] sendText abort failed', err);
			}
			abortTimers.push(setTimeout(() => {
				if (resolved) { return; }
				try { void instance!.sendText('\x03', false); } catch { }
			}, 3000));
			abortTimers.push(setTimeout(() => {
				if (resolved) { return; }
				try { instance!.dispose(TerminalExitReason.User); } catch (err) {
					this.logService.warn('[alaska.run-command] dispose after abort failed', err);
				}
				if (!resolved) {
					resolved = true;
					exitResolveOnHardDispose({ exitCode: null, reason: 'cancelled' });
				}
			}, 10000));
		};

		let exitResolveOnHardDispose: (v: { exitCode: number | null; reason: 'exit' | 'cancelled' | 'timed-out' | 'killed' }) => void = () => { };
		const cancelExitPromise = new Promise<{ exitCode: number | null; reason: 'exit' | 'cancelled' | 'timed-out' | 'killed' }>(resolve => {
			exitResolveOnHardDispose = resolve;
		});

		const timeoutTimer = setTimeout(() => {
			if (resolved) { return; }
			resolved = true;
			rc.status = 'timed-out';
			this.applyRunCardState(call.id, activity);
			try { instance!.dispose(TerminalExitReason.Process); } catch { }
			exitResolveOnHardDispose({ exitCode: null, reason: 'timed-out' });
		}, HARD_TIMEOUT_MS);

		const refsState = this.runCardRefs.get(call.id);
		if (refsState) {
			refsState.onAbort = cancelByUser;
			refsState.onShowTerminal = () => {
				if (!instance) { return; }
				void this.terminalService.revealTerminal(instance, false).catch(err => this.logService.warn('[alaska.run-command] show-terminal failed', err));
			};
		}

		const outcome = await Promise.race([exitPromise, cancelExitPromise]);
		clearTimeout(timeoutTimer);
		for (const t of abortTimers) { clearTimeout(t); }
		flushOutput();
		disposables.dispose();

		rc.endedAt = Date.now();
		rc.exitCode = outcome.exitCode;
		const durationMs = (rc.endedAt - (rc.startedAt ?? rc.endedAt));
		const encoding: 'utf-8' | 'cp866' = detectMojibake(outputBuffer) ? 'cp866' : 'utf-8';
		rc.encoding = encoding;

		let payload: Record<string, unknown>;
		if (abortRequested && outcome.reason !== 'timed-out') {
			rc.status = 'cancelled';
			activity.status = 'err';
			activity.summary = `cancelled · ${formatDuration(durationMs)}`;
			payload = { ok: false, error: 'cancelled_by_user', exit_code: null, duration_ms: durationMs, output_tail: tailOutput(outputBuffer), full_size: outputBuffer.length + droppedBytes, truncated: droppedBytes > 0, encoding, shell: rc.shell };
		} else if (outcome.reason === 'timed-out') {
			rc.status = 'timed-out';
			activity.status = 'err';
			activity.summary = `timed out after 30m`;
			payload = { ok: false, error: 'timeout_30m', exit_code: null, duration_ms: durationMs, output_tail: tailOutput(outputBuffer), full_size: outputBuffer.length + droppedBytes, truncated: droppedBytes > 0, encoding, shell: rc.shell };
		} else {
			const code = outcome.exitCode ?? -1;
			const ok = code === 0;
			rc.status = ok ? 'ok' : 'err';
			activity.status = ok ? 'ok' : 'err';
			activity.summary = ok ? `exit 0 · ${formatDuration(durationMs)}` : `exit ${code} · ${formatDuration(durationMs)}`;
			payload = { ok, exit_code: code, duration_ms: durationMs, output_tail: tailOutput(outputBuffer), full_size: outputBuffer.length + droppedBytes, truncated: droppedBytes > 0, encoding, shell: rc.shell };
		}
		this.applyRunCardState(call.id, activity);
		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify(payload),
		};
	}

	private async assessRunCommandConsent(command: string): Promise<{ granted: true } | { granted: false; reason: string; errorCode: string }> {
		const trust = this.getRunCommandTrust();
		if (trust === 'auto-safe' && isReadOnlyRunCommand(command)) {
			return { granted: true };
		}
		const head = command.length > 200 ? command.slice(0, 200) + '…' : command;
		type ChoiceItem = IQuickPickItem & { id: 'allow-once' | 'auto-safe' | 'deny' };
		const items: ChoiceItem[] = [
			{ id: 'allow-once', label: '$(check) Allow Once', description: 'Run this command and ask again next time' },
			{ id: 'auto-safe', label: '$(shield) Auto-approve Read-Only Commands', description: 'Auto-approve a narrow allow-list of read-only commands (ls, git status, etc.). Everything else still asks.' },
			{ id: 'deny', label: '$(circle-slash) Deny', description: 'Do not run this command' },
		];
		const picked = await this.quickInputService.pick(items, {
			placeHolder: `Xipher IDE wants to run: ${head}`,
			matchOnDescription: false,
			matchOnDetail: false,
			ignoreFocusLost: true,
			title: 'Xipher IDE · Shell command',
		}) as ChoiceItem | undefined;
		if (!picked || picked.id === 'deny') {
			return { granted: false, reason: 'User declined the command in the consent prompt.', errorCode: 'consent_denied' };
		}
		if (picked.id === 'auto-safe') {
			this.setRunCommandTrust('auto-safe');
		}
		return { granted: true };
	}

	private getRunCommandTrust(): RunCommandTrustLevel {
		const raw = this.storageService.get(RUN_COMMAND_TRUST_KEY, StorageScope.WORKSPACE, '');
		if (raw === 'auto-safe' || raw === 'ask') {
			return raw;
		}
		return 'ask';
	}

	private setRunCommandTrust(level: RunCommandTrustLevel): void {
		this.storageService.store(RUN_COMMAND_TRUST_KEY, level, StorageScope.WORKSPACE, StorageTarget.USER);
	}

	private readUserShellEnv(): string | undefined {
		try {
			const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
			const shell = env?.SHELL;
			if (typeof shell === 'string' && shell.length > 0) {
				return shell;
			}
		} catch {
		}
		return undefined;
	}

	private async detectOs(): Promise<OperatingSystem> {
		if (this.osCache !== undefined) {
			return this.osCache;
		}
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (root && root.scheme === Schemas.alaskacodeRemote && this.remoteAgentService) {
			try {
				const env = await this.remoteAgentService.getEnvironment();
				if (env) {
					this.osCache = env.os;
					return env.os;
				}
			} catch {
			}
		}
		this.osCache = OS;
		return OS;
	}

	private rebalanceRunCommandQueue(msg: IThreadMessage): void {
		if (!msg.toolActivities) { return; }
		let position = 1;
		for (const a of msg.toolActivities) {
			if (a.runCommand?.status === 'queued') {
				if (a.runCommand.queuePosition !== position) {
					a.runCommand.queuePosition = position;
					this.applyRunCardState(a.id, a);
				}
				position++;
			}
		}
	}

	private replaceRunCommandRow(refs: ILiveAssistantRefs, callId: string, activity: IThreadToolActivity): void {
		const oldRow = refs.activityRows.get(callId);
		const card = this.renderRunCommandCard(activity);
		if (oldRow && oldRow !== card) {
			oldRow.replaceWith(card);
		} else if (!oldRow && refs.activitiesEl) {
			refs.activitiesEl.appendChild(card);
		}
		refs.activityRows.set(callId, card);
	}

	private renderRunCommandCard(activity: IThreadToolActivity): HTMLElement {
		let refs = this.runCardRefs.get(activity.id);
		if (!refs) {
			refs = this.buildRunCardSkeleton(activity);
			this.runCardRefs.set(activity.id, refs);
		}
		this.applyRunCardStateInternal(refs, activity);
		return refs.root;
	}

	private buildRunCardSkeleton(activity: IThreadToolActivity): IRunCardRefs {
		const root = document.createElement('div');
		root.className = 'alaska-run-card';

		const header = document.createElement('div');
		header.className = 'alaska-run-card-header';

		const statusIcon = buildCodicon(Codicon.terminal);
		statusIcon.classList.add('alaska-run-card-icon');
		header.appendChild(statusIcon);

		const headerLabel = document.createElement('span');
		headerLabel.className = 'alaska-run-card-title';
		headerLabel.textContent = 'Run';
		header.appendChild(headerLabel);

		const shellLabel = document.createElement('span');
		shellLabel.className = 'alaska-run-card-shell';
		header.appendChild(shellLabel);

		const spacer = document.createElement('span');
		spacer.className = 'alaska-run-card-spacer';
		header.appendChild(spacer);

		const timerIcon = buildCodicon(Codicon.watch);
		timerIcon.classList.add('alaska-run-card-timer-icon');
		header.appendChild(timerIcon);

		const timer = document.createElement('span');
		timer.className = 'alaska-run-card-timer';
		timer.textContent = '0:00';
		header.appendChild(timer);

		const closeBtn = document.createElement('button');
		closeBtn.type = 'button';
		closeBtn.className = 'alaska-run-card-close';
		closeBtn.title = 'Hide this card';
		closeBtn.setAttribute('aria-label', 'Hide run-command card');
		closeBtn.appendChild(buildCodicon(Codicon.close));
		header.appendChild(closeBtn);

		root.appendChild(header);

		const commandRow = document.createElement('div');
		commandRow.className = 'alaska-run-card-command';
		const commandIcon = buildCodicon(Codicon.chevronRight);
		commandIcon.classList.add('alaska-run-card-command-icon');
		commandRow.appendChild(commandIcon);
		const commandText = document.createElement('span');
		commandText.className = 'alaska-run-card-command-text';
		commandText.textContent = activity.runCommand?.displayCommand ?? '';
		commandRow.appendChild(commandText);
		root.appendChild(commandRow);

		const output = document.createElement('pre');
		output.className = 'alaska-run-card-output';
		root.appendChild(output);

		const footer = document.createElement('div');
		footer.className = 'alaska-run-card-footer';

		const footerIcon = buildCodicon(Codicon.loading);
		footerIcon.classList.add('alaska-run-card-footer-icon');
		footer.appendChild(footerIcon);

		const footerStatus = document.createElement('span');
		footerStatus.className = 'alaska-run-card-footer-status';
		footer.appendChild(footerStatus);

		const footerSpacer = document.createElement('span');
		footerSpacer.className = 'alaska-run-card-spacer';
		footer.appendChild(footerSpacer);

		const showTerminalBtn = document.createElement('button');
		showTerminalBtn.type = 'button';
		showTerminalBtn.className = 'alaska-run-card-link';
		showTerminalBtn.textContent = 'Show in terminal';
		footer.appendChild(showTerminalBtn);

		const abortBtn = document.createElement('button');
		abortBtn.type = 'button';
		abortBtn.className = 'alaska-run-card-button';
		abortBtn.textContent = 'Abort';
		footer.appendChild(abortBtn);

		root.appendChild(footer);

		const handle: IRunCardRefs = {
			root,
			statusIcon,
			headerLabel,
			shellLabel,
			timerIcon,
			timer,
			closeBtn,
			commandText,
			output,
			footer,
			footerIcon,
			footerStatus,
			showTerminalBtn,
			abortBtn,
			activityId: activity.id,
		};

		closeBtn.addEventListener('click', () => {
			handle.onClose?.();
			root.classList.add('alaska-run-card-hidden');
		});
		abortBtn.addEventListener('click', () => handle.onAbort?.());
		showTerminalBtn.addEventListener('click', () => handle.onShowTerminal?.());

		return handle;
	}

	private applyRunCardState(callId: string, activity: IThreadToolActivity): void {
		const refs = this.runCardRefs.get(callId);
		if (refs) {
			this.applyRunCardStateInternal(refs, activity);
		}
	}

	private applyRunCardStateInternal(refs: IRunCardRefs, activity: IThreadToolActivity): void {
		const rc = activity.runCommand;
		if (!rc) {
			return;
		}
		const tier = runCardSeverityTier(rc);
		const root = refs.root;
		root.classList.remove(
			'alaska-run-card-queued',
			'alaska-run-card-awaiting-consent',
			'alaska-run-card-running',
			'alaska-run-card-ok',
			'alaska-run-card-err',
			'alaska-run-card-err-soft',
			'alaska-run-card-err-hard',
			'alaska-run-card-cancelled',
			'alaska-run-card-timed-out',
			'alaska-run-card-blocked',
		);
		root.classList.add(`alaska-run-card-${rc.status}`);
		if (tier === 'err-soft') {
			root.classList.add('alaska-run-card-err-soft');
		} else if (tier === 'err-hard') {
			root.classList.add('alaska-run-card-err-hard');
		}
		const chipText = rc.shell ?? rc.displayShellName ?? '';
		refs.shellLabel.textContent = chipText;
		refs.shellLabel.title = rc.displayShellName ?? '';
		refs.shellLabel.classList.toggle('alaska-run-card-shell-empty', !chipText);
		refs.commandText.textContent = rc.displayCommand;

		const iconId = runCardStatusIcon(rc.status, tier).id;
		const iconTitle = runCardIconTooltip(tier);

		refs.statusIcon.className = '';
		refs.statusIcon.classList.add('codicon', 'alaska-run-card-icon');
		refs.statusIcon.classList.add(`codicon-${iconId}`);
		if (rc.status === 'running') {
			refs.statusIcon.classList.add('codicon-modifier-spin');
		}
		if (iconTitle) {
			refs.statusIcon.title = iconTitle;
		} else {
			refs.statusIcon.removeAttribute('title');
		}

		refs.footerIcon.className = '';
		refs.footerIcon.classList.add('codicon', 'alaska-run-card-footer-icon');
		refs.footerIcon.classList.add(`codicon-${iconId}`);
		if (rc.status === 'running' || rc.status === 'awaiting-consent' || rc.status === 'queued') {
			refs.footerIcon.classList.add('codicon-modifier-spin');
		}
		if (iconTitle) {
			refs.footerIcon.title = iconTitle;
		} else {
			refs.footerIcon.removeAttribute('title');
		}

		refs.footerStatus.textContent = runCardFooterLabel(rc);

		refs.abortBtn.style.display = (rc.status === 'running' || rc.status === 'awaiting-consent' || rc.status === 'queued') ? '' : 'none';
		refs.abortBtn.disabled = false;
		refs.showTerminalBtn.style.display = rc.terminalInstanceId !== undefined ? '' : 'none';

		this.refreshRunCardTimer(refs, rc);
		this.applyRunCardOutputInternal(refs, activity);
	}

	private applyRunCardOutput(callId: string, activity: IThreadToolActivity): void {
		const refs = this.runCardRefs.get(callId);
		if (refs) {
			this.applyRunCardOutputInternal(refs, activity);
		}
	}

	private applyRunCardOutputInternal(refs: IRunCardRefs, activity: IThreadToolActivity): void {
		const rc = activity.runCommand;
		if (!rc) {
			return;
		}
		const lines = rc.output.split('\n');
		const trailing = lines.length > 20 ? lines.slice(lines.length - 20) : lines;
		const text = rc.droppedBytes > 0
			? `[…${formatCompactNumber(rc.droppedBytes)} bytes dropped]\n${trailing.join('\n')}`
			: trailing.join('\n');
		refs.output.textContent = text;
		this.scrollToBottomIfNear();
	}

	private refreshRunCardTimer(refs: IRunCardRefs, rc: IRunCommandActivity): void {
		if (refs.timerInterval !== undefined) {
			mainWindow.clearInterval(refs.timerInterval);
			refs.timerInterval = undefined;
		}
		const render = () => {
			if (rc.status === 'queued') {
				refs.timer.textContent = 'queued';
				return;
			}
			if (rc.status === 'awaiting-consent') {
				refs.timer.textContent = 'waiting';
				return;
			}
			const start = rc.startedAt ?? Date.now();
			const end = rc.endedAt ?? Date.now();
			refs.timer.textContent = formatDuration(end - start);
		};
		render();
		if (rc.status === 'running') {
			refs.timerInterval = mainWindow.setInterval(render, 500);
		}
	}

	private renderPlanCard(msg: IThreadMessage, refs: ILiveAssistantRefs, activity: IThreadToolActivity): Promise<{ approved: boolean; summary: string; toolPayload: Record<string, unknown>; activityPatch: Partial<IPlanActivity> }> {
		return new Promise((resolve) => {
			const planId = activity.id;
			const card = document.createElement('div');
			card.className = 'alaska-plan-card alaska-plan-card-pending';

			const header = document.createElement('div');
			header.className = 'alaska-plan-header';
			const headerText = document.createElement('strong');
			headerText.textContent = `Xipher IDE proposes ${activity.plan!.changes.length} file change${activity.plan!.changes.length === 1 ? '' : 's'}`;
			header.appendChild(headerText);
			card.appendChild(header);

			if (activity.plan!.rationale) {
				const rationale = document.createElement('div');
				rationale.className = 'alaska-plan-rationale';
				rationale.textContent = activity.plan!.rationale;
				card.appendChild(rationale);
			}

			const list = document.createElement('div');
			list.className = 'alaska-plan-list';
			for (const change of activity.plan!.changes) {
				list.appendChild(this.renderPlanRow(change));
			}
			card.appendChild(list);

			const editor = document.createElement('textarea');
			editor.className = 'alaska-plan-editor';
			editor.spellcheck = false;
			editor.style.display = 'none';
			card.appendChild(editor);

			let workingPlan: IPlanActivity = activity.plan!;
			let editedFromOriginal = false;
			let settled = false;
			let autoUndoStrip: HTMLElement | undefined;
			let undoStore: DisposableStore | undefined;
			let undoFireTimer: ReturnType<typeof setTimeout> | undefined;

			const cleanupUndo = () => {
				if (undoFireTimer !== undefined) {
					clearTimeout(undoFireTimer);
					undoFireTimer = undefined;
				}
				if (undoStore) {
					this.undoTimers.delete(undoStore);
					undoStore.dispose();
					undoStore = undefined;
				}
				if (autoUndoStrip) {
					autoUndoStrip.remove();
					autoUndoStrip = undefined;
				}
			};

			const finishApprove = (auto?: boolean) => {
				if (settled) { return; }
				settled = true;
				cleanupUndo();
				this.chatService.clearPendingPlan(planId);
				card.classList.remove('alaska-plan-card-pending');
				card.classList.add(editedFromOriginal ? 'alaska-plan-card-approved-edited' : 'alaska-plan-card-approved');
				const summary = editedFromOriginal
					? `approved (edited) · ${workingPlan.changes.length} file${workingPlan.changes.length === 1 ? '' : 's'}`
					: auto
						? `auto-approved · ${workingPlan.changes.length} file${workingPlan.changes.length === 1 ? '' : 's'}`
						: `approved · ${workingPlan.changes.length} file${workingPlan.changes.length === 1 ? '' : 's'}`;
				const payload: Record<string, unknown> = { ok: true, approved: true };
				if (editedFromOriginal) {
					payload.plan = { rationale: workingPlan.rationale, changes: workingPlan.changes };
				}
				if (auto) {
					payload.auto = true;
				}
				resolve({
					approved: true,
					summary,
					toolPayload: payload,
					activityPatch: editedFromOriginal
						? { outcome: 'edited-approved', editedChanges: workingPlan.changes, editedRationale: workingPlan.rationale }
						: { outcome: 'approved' },
				});
			};

			const finishDecline = (reason: string) => {
				if (settled) { return; }
				settled = true;
				cleanupUndo();
				this.chatService.clearPendingPlan(planId);
				card.classList.remove('alaska-plan-card-pending');
				card.classList.add('alaska-plan-card-declined');
				resolve({
					approved: false,
					summary: 'declined',
					toolPayload: { ok: false, approved: false, reason },
					activityPatch: { outcome: 'declined', outcomeReason: reason },
				});
			};

			const startEdit = () => {
				if (settled) { return; }
				editor.style.display = '';
				editor.value = JSON.stringify({ rationale: workingPlan.rationale, changes: workingPlan.changes }, null, 2);
				list.style.display = 'none';
				this.chatService.updatePendingPlan(planId, { mode: 'editing' });
				editor.focus();
			};

			const saveEdit = () => {
				if (settled) { return; }
				let next: { rationale?: unknown; changes?: unknown };
				try {
					next = JSON.parse(editor.value) as { rationale?: unknown; changes?: unknown };
				} catch (err) {
					this.notificationService.notify({ severity: Severity.Warning, message: `Plan JSON is invalid: ${err instanceof Error ? err.message : String(err)}` });
					return;
				}
				const newChanges: IPlanChange[] = [];
				if (Array.isArray(next.changes)) {
					for (const raw of next.changes) {
						if (!raw || typeof raw !== 'object') { continue; }
						const c = raw as { path?: unknown; action?: unknown; summary?: unknown };
						if (typeof c.path !== 'string' || typeof c.summary !== 'string') { continue; }
						if (c.action !== 'create' && c.action !== 'edit' && c.action !== 'delete') { continue; }
						newChanges.push({ path: c.path, action: c.action, summary: c.summary });
					}
				}
				if (newChanges.length === 0) {
					this.notificationService.notify({ severity: Severity.Warning, message: 'Edited plan must contain at least one valid change.' });
					return;
				}
				workingPlan = {
					rationale: typeof next.rationale === 'string' ? next.rationale : workingPlan.rationale,
					changes: newChanges,
				};
				editedFromOriginal = true;
				list.replaceChildren();
				for (const change of newChanges) {
					list.appendChild(this.renderPlanRow(change));
				}
				editor.style.display = 'none';
				list.style.display = '';
				headerText.textContent = `Xipher IDE proposes ${newChanges.length} file change${newChanges.length === 1 ? '' : 's'} (edited)`;
				this.chatService.updatePendingPlan(planId, {
					rationale: workingPlan.rationale,
					changes: workingPlan.changes,
					editedFromOriginal: true,
					mode: 'deciding',
				});
			};

			const cancelEdit = () => {
				if (settled) { return; }
				editor.style.display = 'none';
				list.style.display = '';
				this.chatService.updatePendingPlan(planId, { mode: 'deciding' });
			};

			if (!refs.activitiesEl) {
				refs.activitiesEl = document.createElement('div');
				refs.activitiesEl.className = 'alaska-msg-activities';
				const anchor = refs.stageEl ?? refs.contentEl;
				anchor.before(refs.activitiesEl);
			}
			refs.activitiesEl.appendChild(card);

			const autoApprove = this.isAutoApproveEnabled();
			if (autoApprove) {
				const strip = document.createElement('div');
				strip.className = 'alaska-plan-undo-strip';

				const spinner = buildCodicon(Codicon.loading);
				spinner.classList.add('codicon-modifier-spin');
				strip.appendChild(spinner);

				const label = document.createElement('span');
				label.className = 'alaska-plan-undo-label';
				label.textContent = `Plan auto-approving · ${workingPlan.changes.length} file${workingPlan.changes.length === 1 ? '' : 's'}`;
				strip.appendChild(label);

				const spacer = document.createElement('span');
				spacer.className = 'alaska-plan-undo-spacer';
				strip.appendChild(spacer);

				const undoBtn = document.createElement('button');
				undoBtn.type = 'button';
				undoBtn.className = 'alaska-plan-undo-btn';
				undoBtn.textContent = 'Undo';
				undoBtn.addEventListener('click', () => finishDecline('user_undo'));
				strip.appendChild(undoBtn);

				refs.activitiesEl.appendChild(strip);
				autoUndoStrip = strip;

				undoStore = new DisposableStore();
				this.undoTimers.add(undoStore);
				undoFireTimer = setTimeout(() => {
					undoFireTimer = undefined;
					finishApprove(true);
				}, ALASKA_PLAN_UNDO_WINDOW_MS);
				undoStore.add({ dispose: () => { if (undoFireTimer !== undefined) { clearTimeout(undoFireTimer); undoFireTimer = undefined; } } });
			} else {
				this.chatService.registerPendingPlan({
					id: planId,
					rationale: workingPlan.rationale,
					changes: workingPlan.changes,
					editedFromOriginal: false,
					mode: 'deciding',
					approve: () => finishApprove(false),
					decline: () => finishDecline('User declined the plan in the chat panel.'),
					startEdit,
					saveEdit,
					cancelEdit,
				});
			}

			this.scrollToBottomIfNear();
		});
	}

	private renderPlanRow(change: IPlanChange): HTMLElement {
		const row = document.createElement('div');
		row.className = `alaska-plan-row alaska-plan-row-${change.action}`;
		const tag = document.createElement('span');
		tag.className = 'alaska-plan-row-action';
		tag.textContent = change.action;
		row.appendChild(tag);
		const path = document.createElement('span');
		path.className = 'alaska-plan-row-path';
		path.textContent = change.path;
		row.appendChild(path);
		const summary = document.createElement('span');
		summary.className = 'alaska-plan-row-summary';
		summary.textContent = change.summary;
		row.appendChild(summary);
		return row;
	}

	private isAutoApproveEnabled(): boolean {
		if (this.storageService.getBoolean(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.APPLICATION, false)) {
			return true;
		}
		return this.storageService.getBoolean(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.WORKSPACE, false);
	}

	private refreshPlanDock(): void {
		const dock = this.planDockEl;
		if (!dock) { return; }
		const plan = this.chatService.pendingPlans[0];
		if (!plan) {
			dock.classList.remove('alaska-plan-dock-visible');
			if (this.planDockHideTimer !== undefined) { clearTimeout(this.planDockHideTimer); }
			this.planDockHideTimer = setTimeout(() => {
				if (this.chatService.pendingPlans.length === 0 && this.planDockEl) {
					this.planDockEl.replaceChildren();
				}
				this.planDockHideTimer = undefined;
			}, ALASKA_PLAN_DOCK_FADE_MS);
			return;
		}
		if (this.planDockHideTimer !== undefined) {
			clearTimeout(this.planDockHideTimer);
			this.planDockHideTimer = undefined;
		}
		dock.replaceChildren();

		const row = document.createElement('div');
		row.className = 'alaska-plan-dock-row';
		dock.appendChild(row);

		const buttons = document.createElement('div');
		buttons.className = 'alaska-plan-dock-buttons';
		row.appendChild(buttons);

		if (plan.mode === 'editing') {
			const saveBtn = document.createElement('button');
			saveBtn.type = 'button';
			saveBtn.className = 'alaska-plan-btn alaska-plan-btn-approve';
			saveBtn.textContent = 'Save edits';
			saveBtn.addEventListener('click', () => plan.saveEdit());
			buttons.appendChild(saveBtn);

			const cancelBtn = document.createElement('button');
			cancelBtn.type = 'button';
			cancelBtn.className = 'alaska-plan-btn';
			cancelBtn.textContent = 'Cancel edits';
			cancelBtn.addEventListener('click', () => plan.cancelEdit());
			buttons.appendChild(cancelBtn);
		} else {
			const approveBtn = document.createElement('button');
			approveBtn.type = 'button';
			approveBtn.className = 'alaska-plan-btn alaska-plan-btn-approve';
			approveBtn.textContent = 'Approve';
			approveBtn.addEventListener('click', () => plan.approve());
			buttons.appendChild(approveBtn);

			const declineBtn = document.createElement('button');
			declineBtn.type = 'button';
			declineBtn.className = 'alaska-plan-btn alaska-plan-btn-decline';
			declineBtn.textContent = 'Decline';
			declineBtn.addEventListener('click', () => plan.decline());
			buttons.appendChild(declineBtn);

			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.className = 'alaska-plan-btn alaska-plan-btn-edit';
			editBtn.textContent = plan.editedFromOriginal ? 'Edit plan again' : 'Edit plan';
			editBtn.addEventListener('click', () => plan.startEdit());
			buttons.appendChild(editBtn);

			const autoLabel = document.createElement('label');
			autoLabel.className = 'alaska-plan-dock-auto';
			const autoCheck = document.createElement('input');
			autoCheck.type = 'checkbox';
			autoCheck.checked = this.storageService.getBoolean(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.WORKSPACE, false);
			autoCheck.addEventListener('change', () => {
				if (autoCheck.checked) {
					this.storageService.store(ALASKA_PLAN_AUTO_APPROVE_KEY, true, StorageScope.WORKSPACE, StorageTarget.USER);
				} else {
					this.storageService.remove(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.WORKSPACE);
				}
			});
			autoLabel.appendChild(autoCheck);
			const autoText = document.createElement('span');
			autoText.textContent = 'Auto-approve plans in this workspace';
			autoLabel.appendChild(autoText);
			row.appendChild(autoLabel);

			if (this.storageService.getBoolean(ALASKA_PLAN_AUTO_APPROVE_KEY, StorageScope.APPLICATION, false)) {
				autoCheck.disabled = true;
				autoCheck.checked = true;
				autoText.textContent = 'Auto-approve plans (set globally)';
			}
		}

		mainWindow.requestAnimationFrame(() => dock.classList.add('alaska-plan-dock-visible'));
	}

	private handlePlanDockKey(ev: KeyboardEvent): void {
		const plan = this.chatService.pendingPlans[0];
		if (!plan || plan.mode !== 'deciding') { return; }
		const target = ev.target as HTMLElement | null;
		if (DOM.isHTMLTextAreaElement(target) && target !== this.composerEl) { return; }
		if (DOM.isHTMLInputElement(target) && target.type !== 'checkbox') { return; }
		if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
			ev.preventDefault();
			ev.stopPropagation();
			plan.approve();
			return;
		}
		if (ev.key === 'Escape' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey) {
			ev.preventDefault();
			ev.stopPropagation();
			plan.decline();
		}
	}

	private captureReadFileLineCount(call: IAlaskaToolCall, result: IAlaskaToolResult): void {
		if (call.name !== 'alaska_read_file') {
			return;
		}
		try {
			const args = JSON.parse(call.argumentsJson) as { path?: string };
			const payload = JSON.parse(result.content) as { ok?: boolean; content?: string };
			if (!args.path || typeof payload.content !== 'string' || payload.ok === false) {
				return;
			}
			const lines = payload.content.length === 0 ? 0 : payload.content.split('\n').length;
			this.expectedLinesByPath.set(args.path, lines);
			// Record the on-disk version the agent just saw, so a later
			// external edit can be detected and a re-read reminder injected
			// (ported from grok's file-change tracker). Fire-and-forget.
			void this.recordReadVersion(args.path);
		} catch {
		}
	}

	/** Stat the file the agent just read and store its version for staleness checks. */
	private async recordReadVersion(path: string): Promise<void> {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root) {
			return;
		}
		try {
			const uri = resolveWorkspacePath(root, path);
			const stat = await this.fileService.stat(uri);
			this.reminderService.noteRead({ path, mtime: stat.mtime ?? 0, size: stat.size ?? 0 });
		} catch {
			// Untracked / non-file path — nothing to compare later.
		}
	}

	/**
	 * Return the workspace-relative paths of files the agent read earlier this
	 * conversation that have since changed on disk (mtime or size differs).
	 * Consumes the check: matched files are re-stat'd so a single external edit
	 * only reminds once per new version.
	 */
	private async detectStaleReads(): Promise<string[]> {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root || !this.reminderService.policy.fileChange) {
			return [];
		}
		const stale: string[] = [];
		const seen = new Set<string>();
		// Snapshot the tracked paths from expectedLinesByPath keys crossed with
		// what the reminder service holds; iterate reminder records via lastRead.
		for (const path of this.expectedLinesByPath.keys()) {
			if (seen.has(path)) {
				continue;
			}
			seen.add(path);
			const record: IReadRecord | undefined = this.reminderService.lastRead(path);
			if (!record) {
				continue;
			}
			try {
				const uri = resolveWorkspacePath(root, path);
				const stat = await this.fileService.stat(uri);
				const mtime = stat.mtime ?? 0;
				const size = stat.size ?? 0;
				if (mtime !== record.mtime || size !== record.size) {
					stale.push(path);
					// The agent's own writes refresh the read baseline, so a
					// surviving stale file is an external (human/tool) edit.
					this.hunkTracker.recordExternalEdit(uri, this.hunkTracker.hasAgentTouched(uri));
				}
			} catch {
				// Deleted or unreadable now — treat as stale so the agent re-checks.
				stale.push(path);
			}
		}
		return stale;
	}

	private updateActivityProgress(msg: IThreadMessage, refs: ILiveAssistantRefs, callId: string, content: string, expectedLines: number | undefined, suffix?: string): void {
		const activity = msg.toolActivities?.find(a => a.id === callId);
		if (!activity) {
			return;
		}
		const lines = content.length === 0 ? 0 : content.split('\n').length;
		const base = expectedLines
			? `${lines} / ~${expectedLines} lines`
			: `${lines} lines · ${formatBytes(new TextEncoder().encode(content).byteLength)}`;
		const progress = suffix ? `${base} · ${suffix}` : base;
		if (activity.progress === progress) {
			return;
		}
		activity.progress = progress;
		const row = refs.activityRows.get(callId);
		if (!row) {
			return;
		}
		// eslint-disable-next-line no-restricted-syntax
		let badge = row.querySelector<HTMLSpanElement>('.alaska-activity-progress');
		if (!badge) {
			badge = document.createElement('span');
			badge.className = 'alaska-activity-progress';
			row.appendChild(badge);
		}
		badge.textContent = progress;
	}

	private updateToolPreview(refs: ILiveAssistantRefs, callId: string, toolName: string, content: string): void {
		if (!content) {
			return;
		}
		const card = this.ensureToolPreviewCard(refs, callId, toolName);
		if (!card) {
			return;
		}
		const pending = this.toolPreviewState.get(callId) ?? { content: '', finalized: false };
		pending.content = content;
		if (pending.diffMode === undefined) {
			pending.diffMode = (toolName === 'alaska_write_file' || toolName === 'alaska_patch_file') ? 'single' : 'single';
			if (toolName === 'alaska_write_file') {
				this.ensureBeforeContentForLiveDiff(callId, refs, card, toolName);
			} else if (toolName === 'alaska_patch_file') {
				this.ensurePatchBeforeForLiveDiff(callId, refs, card);
			}
		}
		if (pending.rafHandle === undefined && !pending.finalized) {
			pending.rafHandle = mainWindow.requestAnimationFrame(() => {
				pending.rafHandle = undefined;
				const state = this.toolPreviewState.get(callId);
				if (!state) {
					return;
				}
				const liveCard = this.findToolCard(refs, callId);
				if (!liveCard) {
					return;
				}
				this.paintToolPreview(liveCard, state.content, false);
				this.scrollToBottomIfNear();
			});
		}
		this.toolPreviewState.set(callId, pending);
	}

	private async ensureBeforeContentForLiveDiff(callId: string, refs: ILiveAssistantRefs, card: HTMLElement, toolName: string): Promise<void> {
		const state = this.toolPreviewState.get(callId);
		if (!state || state.beforeLoading || state.beforeLoaded) { return; }
		state.beforeLoading = true;
		try {
			const activity = this.findActivityForCard(card);
			const path = activity?.target;
			if (!path) {
				state.beforeLoaded = true;
				return;
			}
			const root = this.workspaceService.getWorkspace().folders[0]?.uri;
			if (!root) {
				state.beforeLoaded = true;
				return;
			}
			const uri = resolveWorkspacePath(root, path);
			if (await this.fileService.exists(uri)) {
				const before = (await this.textFileService.read(uri)).value;
				if (before.split('\n').length <= ALASKA_LIVEDIFF_LINE_CAP) {
					state.beforeContent = before;
					state.diffMode = 'split';
				}
			} else {
				state.beforeContent = '';
				state.diffMode = 'split';
			}
			state.beforeLoaded = true;
			this.upgradeCardToSplitDiff(card, state, toolName);
			const liveCard = this.findToolCard(refs, callId);
			if (liveCard) {
				this.paintToolPreview(liveCard, state.content, state.finalized);
			}
		} catch (err) {
			state.beforeLoaded = true;
			this.logService.trace('[alaska.livediff] before load failed', err);
		} finally {
			state.beforeLoading = false;
		}
	}

	private ensurePatchBeforeForLiveDiff(callId: string, refs: ILiveAssistantRefs, card: HTMLElement): void {
		const state = this.toolPreviewState.get(callId);
		if (!state) { return; }
		state.beforeLoading = true;
		void (async () => {
			try {
				const activity = this.findActivityForCard(card);
				const path = activity?.target;
				if (!path) { state.beforeLoaded = true; return; }
				const root = this.workspaceService.getWorkspace().folders[0]?.uri;
				if (!root) { state.beforeLoaded = true; return; }
				const uri = resolveWorkspacePath(root, path);
				if (await this.fileService.exists(uri)) {
					const before = (await this.textFileService.read(uri)).value;
					if (before.split('\n').length <= ALASKA_LIVEDIFF_LINE_CAP) {
						state.beforeContent = before;
						state.diffMode = 'split';
					}
				}
				state.beforeLoaded = true;
				this.upgradeCardToSplitDiff(card, state, 'alaska_patch_file');
				const liveCard = this.findToolCard(refs, callId);
				if (liveCard) {
					this.paintToolPreview(liveCard, state.content, state.finalized);
				}
			} catch (err) {
				state.beforeLoaded = true;
				this.logService.trace('[alaska.livediff] patch before load failed', err);
			} finally {
				state.beforeLoading = false;
			}
		})();
	}

	private findActivityForCard(card: HTMLElement): IThreadToolActivity | undefined {
		const callId = card.dataset.callId;
		if (!callId) { return undefined; }
		for (const m of this.thread) {
			const found = m.toolActivities?.find(a => a.id === callId);
			if (found) { return found; }
		}
		return undefined;
	}

	private upgradeCardToSplitDiff(card: HTMLElement, state: IToolPreviewState, toolName: string): void {
		if (state.diffMode !== 'split') { return; }
		// eslint-disable-next-line no-restricted-syntax
		if (card.querySelector('.alaska-livediff-grid')) { return; }
		// eslint-disable-next-line no-restricted-syntax
		const preview = card.querySelector<HTMLElement>('.alaska-msg-tool-preview');
		if (!preview) { return; }
		preview.replaceChildren();
		const grid = document.createElement('div');
		grid.className = 'alaska-livediff-grid';
		const beforeCol = document.createElement('div');
		beforeCol.className = 'alaska-livediff-col alaska-livediff-before';
		const beforeHead = document.createElement('div');
		beforeHead.className = 'alaska-livediff-head';
		beforeHead.textContent = state.beforeContent === '' || state.beforeContent === undefined
			? '(new file)'
			: 'before';
		beforeCol.appendChild(beforeHead);
		const beforeBody = document.createElement('div');
		beforeBody.className = 'alaska-livediff-body alaska-livediff-before-body';
		beforeCol.appendChild(beforeBody);
		const afterCol = document.createElement('div');
		afterCol.className = 'alaska-livediff-col alaska-livediff-after';
		const afterHead = document.createElement('div');
		afterHead.className = 'alaska-livediff-head';
		afterHead.textContent = toolName === 'alaska_patch_file' ? 'after (streaming)' : 'after';
		afterCol.appendChild(afterHead);
		const afterBody = document.createElement('div');
		afterBody.className = 'alaska-livediff-body alaska-livediff-after-body';
		afterCol.appendChild(afterBody);
		grid.appendChild(beforeCol);
		grid.appendChild(afterCol);
		preview.appendChild(grid);
	}

	private ensureToolPreviewCard(refs: ILiveAssistantRefs, callId: string, toolName: string): HTMLElement | undefined {
		const existing = this.findToolCard(refs, callId);
		if (existing) {
			return existing;
		}
		const row = refs.activityRows.get(callId);
		if (!row) {
			return undefined;
		}
		const card = document.createElement('div');
		card.className = 'alaska-msg-tool-card';
		card.dataset.tool = toolName;
		card.dataset.callId = callId;
		card.dataset.state = 'running';

		const parent = row.parentNode;
		if (!parent) {
			return undefined;
		}
		parent.insertBefore(card, row);
		card.appendChild(row);

		const collapse = document.createElement('button');
		collapse.type = 'button';
		collapse.className = 'alaska-msg-tool-collapse';
		collapse.setAttribute('aria-label', localize('alaska.tool.preview.collapse', 'Toggle preview'));
		collapse.textContent = '▾';
		collapse.addEventListener('click', ev => {
			ev.stopPropagation();
			const collapsed = card.classList.toggle('collapsed');
			collapse.textContent = collapsed ? '▸' : '▾';
		});
		card.appendChild(collapse);

		const preview = document.createElement('div');
		preview.className = 'alaska-msg-tool-preview';
		const pre = document.createElement('pre');
		pre.className = 'alaska-msg-tool-preview-pre';
		const code = document.createElement('code');
		pre.appendChild(code);
		preview.appendChild(pre);
		card.appendChild(preview);
		return card;
	}

	private findToolCard(refs: ILiveAssistantRefs, callId: string): HTMLElement | undefined {
		const row = refs.activityRows.get(callId);
		if (!row) {
			return undefined;
		}
		const parent = row.parentElement;
		if (!parent || !parent.classList.contains('alaska-msg-tool-card')) {
			return undefined;
		}
		return parent;
	}

	private ensureToolPreviewCardWithPlaceholder(refs: ILiveAssistantRefs, callId: string, toolName: string): void {
		if (this.findToolCard(refs, callId)) {
			return;
		}
		const card = this.ensureToolPreviewCard(refs, callId, toolName);
		if (!card) {
			return;
		}
		// eslint-disable-next-line no-restricted-syntax
		const code = card.querySelector<HTMLElement>('.alaska-msg-tool-preview-pre code');
		if (code) {
			code.textContent = localize('alaska.tool.preview.awaiting', 'Awaiting content…');
		}
		this.scrollToBottomIfNear();
	}

	private paintToolPreview(card: HTMLElement, content: string, finalized: boolean): void {
		const callId = card.dataset.callId ?? '';
		const state = this.toolPreviewState.get(callId);
		if (state && state.diffMode === 'split' && typeof state.beforeContent === 'string') {
			this.paintLiveDiff(card, state.beforeContent, content, finalized);
			this.updateToolMeta(card, content);
			return;
		}
		// eslint-disable-next-line no-restricted-syntax
		const code = card.querySelector<HTMLElement>('.alaska-msg-tool-preview-pre code');
		if (!code) {
			return;
		}
		if (content.length <= ALASKA_TOOL_PREVIEW_MAX_BYTES) {
			code.textContent = content;
		} else {
			const hidden = content.length - ALASKA_TOOL_PREVIEW_MAX_BYTES;
			code.textContent = localize('alaska.tool.preview.truncated', '… ({0} chars hidden for performance)\n\n', hidden) + content.slice(-ALASKA_TOOL_PREVIEW_MAX_BYTES);
		}
		this.updateToolMeta(card, content);
		if (!finalized) {
			// eslint-disable-next-line no-restricted-syntax
			const preview = card.querySelector<HTMLElement>('.alaska-msg-tool-preview');
			if (preview) {
				preview.scrollTop = preview.scrollHeight;
			}
		}
	}

	private paintLiveDiff(card: HTMLElement, before: string, after: string, finalized: boolean): void {
		// eslint-disable-next-line no-restricted-syntax
		const beforeBody = card.querySelector<HTMLElement>('.alaska-livediff-before-body');
		// eslint-disable-next-line no-restricted-syntax
		const afterBody = card.querySelector<HTMLElement>('.alaska-livediff-after-body');
		if (!beforeBody || !afterBody) { return; }
		const beforeLines = before === '' ? 0 : before.split('\n').length;
		const afterLines = after === '' ? 0 : after.split('\n').length;
		if (beforeLines > ALASKA_LIVEDIFF_LINE_CAP || afterLines > ALASKA_LIVEDIFF_LINE_CAP) {
			beforeBody.replaceChildren();
			afterBody.replaceChildren();
			const note = document.createElement('div');
			note.className = 'alaska-livediff-note';
			note.textContent = localize('alaska.livediff.tooBig', 'File too large for live diff — showing streaming content only.');
			afterBody.appendChild(note);
			const pre = document.createElement('pre');
			pre.className = 'alaska-livediff-fallback-pre';
			pre.textContent = after.length > ALASKA_TOOL_PREVIEW_MAX_BYTES
				? after.slice(-ALASKA_TOOL_PREVIEW_MAX_BYTES)
				: after;
			afterBody.appendChild(pre);
			return;
		}
		const sides = computeLineDiff(before, after);
		this.renderDiffSide(beforeBody, sides.left);
		this.renderDiffSide(afterBody, sides.right);
		if (!finalized) {
			afterBody.scrollTop = afterBody.scrollHeight;
			beforeBody.scrollTop = afterBody.scrollTop;
		}
	}

	private renderDiffSide(host: HTMLElement, lines: IDiffLineEntry[]): void {
		host.replaceChildren();
		for (let i = 0; i < lines.length; i++) {
			const entry = lines[i];
			const row = document.createElement('div');
			row.className = `alaska-livediff-line alaska-livediff-line-${entry.kind}`;
			const num = document.createElement('span');
			num.className = 'alaska-livediff-num';
			num.textContent = entry.kind === 'pad' ? '' : String(i + 1);
			row.appendChild(num);
			const txt = document.createElement('span');
			txt.className = 'alaska-livediff-text';
			txt.textContent = entry.text || ' ';
			row.appendChild(txt);
			host.appendChild(row);
		}
	}

	private updateToolMeta(card: HTMLElement, content: string): void {
		// eslint-disable-next-line no-restricted-syntax
		let meta = card.querySelector<HTMLElement>('.alaska-msg-tool-meta');
		if (!meta) {
			// eslint-disable-next-line no-restricted-syntax
			const row = card.querySelector<HTMLElement>('.alaska-activity');
			if (!row) {
				return;
			}
			meta = document.createElement('span');
			meta.className = 'alaska-msg-tool-meta';
			row.appendChild(meta);
		}
		const lines = content.length === 0 ? 0 : content.split('\n').length;
		const bytes = new TextEncoder().encode(content).byteLength;
		meta.textContent = `${lines} lines · ${formatBytes(bytes)}`;
	}

	private finalizeToolCard(refs: ILiveAssistantRefs, call: IAlaskaToolCall): void {
		const state = this.toolPreviewState.get(call.id);
		if (state?.rafHandle !== undefined) {
			mainWindow.cancelAnimationFrame(state.rafHandle);
			state.rafHandle = undefined;
		}

		if (call.name !== 'alaska_write_file' && call.name !== 'alaska_patch_file') {
			this.toolPreviewState.delete(call.id);
			return;
		}

		const finalContent = this.extractFinalPreviewContent(call);
		if (typeof finalContent !== 'string' || finalContent.length === 0) {
			this.toolPreviewState.delete(call.id);
			return;
		}

		let card = this.findToolCard(refs, call.id);
		if (!card) {
			card = this.ensureToolPreviewCard(refs, call.id, call.name);
		}
		if (!card) {
			this.toolPreviewState.delete(call.id);
			return;
		}

		card.dataset.state = 'done';
		this.paintToolPreview(card, finalContent, true);

		const lineCount = finalContent.split('\n').length;
		if (lineCount > ALASKA_TOOL_PREVIEW_AUTO_COLLAPSE_LINES && !card.classList.contains('collapsed')) {
			card.classList.add('collapsed');
			// eslint-disable-next-line no-restricted-syntax
			const btn = card.querySelector<HTMLButtonElement>('.alaska-msg-tool-collapse');
			if (btn) {
				btn.textContent = '▸';
			}
		}

		this.toolPreviewState.delete(call.id);
		this.scrollToBottomIfNear();
	}

	private extractFinalPreviewContent(call: IAlaskaToolCall): string | undefined {
		try {
			const obj = JSON.parse(call.argumentsJson) as { content?: unknown; replace?: unknown };
			if (call.name === 'alaska_write_file' && typeof obj.content === 'string') {
				return obj.content;
			}
			if (call.name === 'alaska_patch_file' && typeof obj.replace === 'string') {
				return obj.replace;
			}
		} catch {
			/* truncated args — fall back to streamed content */
		}
		return undefined;
	}

	private cancelAllToolPreviewRafs(): void {
		for (const state of this.toolPreviewState.values()) {
			if (state.rafHandle !== undefined) {
				mainWindow.cancelAnimationFrame(state.rafHandle);
				state.rafHandle = undefined;
			}
		}
		this.toolPreviewState.clear();
	}

	private refreshPendingEditsPanel(): void {
		const panel = this.pendingEditsEl;
		if (!panel) {
			return;
		}
		const resources = this.pendingEdits.resources();
		DOM.clearNode(panel);
		if (resources.length === 0) {
			panel.style.display = 'none';
			return;
		}
		panel.style.display = '';

		const header = document.createElement('div');
		header.className = 'alaska-pending-edits-header';

		const title = document.createElement('span');
		title.className = 'alaska-pending-edits-title';
		title.textContent = resources.length === 1
			? localize('alaska.pending.titleOne', '1 pending edit')
			: localize('alaska.pending.titleMany', '{0} pending edits', resources.length);
		header.appendChild(title);

		const actions = document.createElement('div');
		actions.className = 'alaska-pending-edits-actions';

		const acceptAllBtn = document.createElement('button');
		acceptAllBtn.type = 'button';
		acceptAllBtn.className = 'alaska-pending-btn alaska-pending-btn-primary';
		acceptAllBtn.textContent = localize('alaska.pending.acceptAll', 'Accept All');
		acceptAllBtn.title = localize('alaska.pending.acceptAllHint', 'Accept all pending edits (Ctrl+Shift+Enter)');
		acceptAllBtn.addEventListener('click', () => this.pendingEdits.acceptAll());
		actions.appendChild(acceptAllBtn);

		const revertAllBtn = document.createElement('button');
		revertAllBtn.type = 'button';
		revertAllBtn.className = 'alaska-pending-btn alaska-pending-btn-secondary';
		revertAllBtn.textContent = localize('alaska.pending.revertAll', 'Revert All');
		revertAllBtn.addEventListener('click', () => { void this.pendingEdits.revertAll(); });
		actions.appendChild(revertAllBtn);

		header.appendChild(actions);
		panel.appendChild(header);

		const list = document.createElement('ul');
		list.className = 'alaska-pending-edits-list';
		for (const uri of resources) {
			const edit = this.pendingEdits.get(uri);
			if (!edit) {
				continue;
			}
			list.appendChild(this.renderPendingEditRow(uri, edit));
		}
		panel.appendChild(list);
	}

	private renderPendingEditRow(uri: URI, edit: IAlaskaPendingEdit): HTMLLIElement {
		const row = document.createElement('li');
		row.className = 'alaska-pending-edits-row';

		const icon = document.createElement('span');
		icon.className = 'alaska-pending-edits-icon';
		icon.dataset.action = edit.action;
		icon.textContent = edit.action === 'create' ? '+'
			: edit.action === 'delete' ? '×'
				: edit.action === 'patch' ? '~'
					: '↻';
		icon.title = pendingEditActionLabel(edit.action);
		row.appendChild(icon);

		const name = document.createElement('button');
		name.type = 'button';
		name.className = 'alaska-pending-edits-name';
		name.textContent = this.relativePathFor(uri);
		name.title = uri.fsPath;
		name.addEventListener('click', () => {
			void this.editorService.openEditor({ resource: uri, options: { preserveFocus: false } });
		});
		row.appendChild(name);

		const stats = document.createElement('span');
		stats.className = 'alaska-pending-edits-stats';
		stats.textContent = this.computeEditStats(edit);
		row.appendChild(stats);

		const acceptBtn = document.createElement('button');
		acceptBtn.type = 'button';
		acceptBtn.className = 'alaska-pending-btn alaska-pending-btn-tiny';
		acceptBtn.textContent = localize('alaska.pending.accept', 'Accept');
		acceptBtn.addEventListener('click', () => this.pendingEdits.accept(uri));
		row.appendChild(acceptBtn);

		const revertBtn = document.createElement('button');
		revertBtn.type = 'button';
		revertBtn.className = 'alaska-pending-btn alaska-pending-btn-tiny alaska-pending-btn-secondary';
		revertBtn.textContent = localize('alaska.pending.revert', 'Revert');
		revertBtn.addEventListener('click', () => { void this.pendingEdits.revert(uri); });
		row.appendChild(revertBtn);

		return row;
	}

	private computeEditStats(edit: IAlaskaPendingEdit): string {
		const beforeLines = edit.before ? edit.before.split('\n').length : 0;
		const afterLines = edit.after ? edit.after.split('\n').length : 0;
		if (edit.action === 'create') {
			return `+${afterLines} −0`;
		}
		if (edit.action === 'delete') {
			return `+0 −${beforeLines}`;
		}
		return `+${afterLines} −${beforeLines}`;
	}

	private relativePathFor(uri: URI): string {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root) {
			return uri.fsPath;
		}
		const rootPath = root.fsPath.replace(/[\\/]+$/, '');
		const filePath = uri.fsPath;
		if (filePath.startsWith(rootPath)) {
			return filePath.slice(rootPath.length + 1).replace(/\\/g, '/');
		}
		return filePath;
	}

	private async runTools(executor: AlaskaToolExecutor | undefined, calls: readonly IAlaskaToolCall[]): Promise<IAlaskaToolResult[]> {
		const out: IAlaskaToolResult[] = [];
		for (const call of calls) {
			if (!executor) {
				out.push({
					callId: call.id, name: call.name,
					content: JSON.stringify({ ok: false, error: 'no workspace folder open' }),
				});
				continue;
			}
			out.push(await executor.execute(call));
		}
		return out;
	}

	private async prepareEditFromTool(edit: { action: 'create' | 'replace' | 'patch' | 'delete'; path: string; resource: URI; content?: string; find?: string; newSnippet?: string }): Promise<IPreparedEditOperation> {
		const prepared: IPreparedEditOperation = {
			action: edit.action,
			path: edit.path,
			resource: edit.resource,
			status: 'pending',
			content: edit.content,
			find: edit.find,
			replace: edit.newSnippet,
		};
		if (edit.action !== 'create') {
			try {
				prepared.before = (await this.textFileService.read(edit.resource)).value;
			} catch {
				// File may legitimately not exist for a `delete` race; leave undefined.
			}
		}
		if (edit.action !== 'delete') {
			prepared.after = edit.content;
		}
		return prepared;
	}

	private registerWithPendingEdits(op: IPreparedEditOperation): void {
		if (op.status !== 'applied') {
			return;
		}
		this.pendingEdits.register({
			resource: op.resource,
			action: op.action,
			before: op.before,
			after: op.after,
			at: Date.now(),
		});
		// Attribute this edit to the agent + the driving prompt (hunk tracker).
		this.hunkTracker.recordAgentEdit(
			op.resource,
			op.before ?? '',
			op.action === 'delete' ? '' : (op.after ?? ''),
			this.reminderService.promptIndex,
		);
		if (op.action !== 'delete') {
			void this.editorService.openEditor({ resource: op.resource, options: { preserveFocus: true } });
		}
	}

	private renderOrphanCodeBanner(messageNode: HTMLElement, orphans: readonly IOrphanCodeBlock[]): void {
		const banner = document.createElement('div');
		banner.className = 'alaska-orphan-banner';

		const heading = document.createElement('div');
		heading.className = 'alaska-orphan-banner-heading';
		heading.textContent = orphans.length === 1
			? localize('alaska.orphan.heading.single', 'AI showed 1 code block in chat instead of writing a file')
			: localize('alaska.orphan.heading.multi', 'AI showed {0} code blocks in chat instead of writing files', orphans.length);
		banner.appendChild(heading);

		const subtitle = document.createElement('div');
		subtitle.className = 'alaska-orphan-banner-subtitle';
		subtitle.textContent = localize('alaska.orphan.subtitle', 'This code did NOT reach the filesystem. Save it now or ask AI to retry with the write tool.');
		banner.appendChild(subtitle);

		const list = document.createElement('ul');
		list.className = 'alaska-orphan-list';
		for (const orphan of orphans) {
			list.appendChild(this.renderOrphanItem(orphan));
		}
		banner.appendChild(list);

		const retryBtn = document.createElement('button');
		retryBtn.type = 'button';
		retryBtn.className = 'alaska-orphan-retry-btn';
		retryBtn.textContent = localize('alaska.orphan.retry', 'Ask AI to retry properly');
		retryBtn.addEventListener('click', () => void this.retryOrphanWithToolHint(orphans));
		banner.appendChild(retryBtn);

		messageNode.appendChild(banner);
	}

	private renderOrphanItem(orphan: IOrphanCodeBlock): HTMLLIElement {
		const li = document.createElement('li');
		li.className = 'alaska-orphan-item';

		const info = document.createElement('div');
		info.className = 'alaska-orphan-item-info';
		const pathEl = document.createElement('span');
		pathEl.className = 'alaska-orphan-item-path';
		pathEl.textContent = orphan.inferredPath;
		info.appendChild(pathEl);
		const meta = document.createElement('small');
		meta.className = 'alaska-orphan-item-meta';
		const lineCount = orphan.content.split('\n').length;
		const langLabel = orphan.language || localize('alaska.orphan.langUnknown', 'text');
		meta.textContent = `${lineCount} lines · ${formatBytes(orphan.byteCount)} · ${langLabel}`;
		info.appendChild(meta);
		li.appendChild(info);

		const saveBtn = document.createElement('button');
		saveBtn.type = 'button';
		saveBtn.className = 'alaska-orphan-save-btn';
		saveBtn.textContent = localize('alaska.orphan.save', 'Save to {0}', orphan.inferredPath);
		saveBtn.title = localize('alaska.orphan.saveTooltip', 'Write this block to {0}', orphan.inferredPath);
		saveBtn.addEventListener('click', () => void this.saveOrphanCode(orphan, saveBtn));
		li.appendChild(saveBtn);

		const copyBtn = document.createElement('button');
		copyBtn.type = 'button';
		copyBtn.className = 'alaska-orphan-copy-btn';
		copyBtn.textContent = localize('alaska.orphan.copy', 'Copy');
		copyBtn.addEventListener('click', () => void this.copyOrphanCode(orphan, copyBtn));
		li.appendChild(copyBtn);

		return li;
	}

	private async copyOrphanCode(orphan: IOrphanCodeBlock, btn: HTMLButtonElement): Promise<void> {
		try {
			await this.clipboardService.writeText(orphan.content);
			const original = btn.textContent;
			btn.textContent = localize('alaska.orphan.copied', 'Copied');
			setTimeout(() => {
				if (btn.isConnected) {
					btn.textContent = original ?? localize('alaska.orphan.copy', 'Copy');
				}
			}, 1500);
		} catch (err) {
			this.notificationService.error(localize('alaska.orphan.copyFailed', 'Copy failed: {0}', err instanceof Error ? err.message : String(err)));
		}
	}

	private async saveOrphanCode(orphan: IOrphanCodeBlock, btn: HTMLButtonElement): Promise<void> {
		btn.disabled = true;
		const originalLabel = btn.textContent ?? '';
		btn.textContent = localize('alaska.orphan.saving', 'Saving…');
		try {
			const root = this.workspaceService.getWorkspace().folders[0]?.uri;
			if (!root) {
				throw new Error(localize('alaska.orphan.noWorkspace', 'No workspace folder open — cannot save.'));
			}
			const uri = joinPath(root, orphan.inferredPath);
			const exists = await this.fileService.exists(uri);
			if (exists) {
				const confirmed = await this.dialogService.confirm({
					message: localize('alaska.orphan.overwrite', '{0} already exists. Overwrite it?', orphan.inferredPath),
					detail: localize('alaska.orphan.overwriteDetail', 'The current contents on disk will be replaced with the code block from chat ({0}).', formatBytes(orphan.byteCount)),
					type: 'warning',
				});
				if (!confirmed.confirmed) {
					btn.disabled = false;
					btn.textContent = originalLabel;
					return;
				}
			}
			await this.fileService.writeFile(uri, VSBuffer.fromString(orphan.content));
			btn.textContent = localize('alaska.orphan.saved', 'Saved');
			btn.classList.add('alaska-orphan-saved');
			this.metricsService.counter('alaska.orphan.saved', 1, { language: orphan.language || 'unknown' });
			await this.editorService.openEditor({ resource: uri });
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			this.notificationService.error(localize('alaska.orphan.saveFailed', 'Save failed: {0}', errMsg));
			btn.disabled = false;
			btn.textContent = originalLabel;
		}
	}

	private async retryOrphanWithToolHint(orphans: readonly IOrphanCodeBlock[]): Promise<void> {
		if (!this.composerEl || this.isStreaming) {
			return;
		}
		const filesList = orphans.map(o => `- ${o.inferredPath}`).join('\n');
		const hint = `You just showed code in chat instead of writing files. Please retry using alaska_write_file for each of these files:\n\n${filesList}\n\nUse the tool. Do NOT show the content inline again.`;
		this.composerEl.value = hint;
		this.autosizeComposer();
		this.metricsService.counter('alaska.orphan.retry_requested', 1, { count: String(orphans.length) });
		await this.submit();
	}

	private renderPreparedEditBatch(messageNode: HTMLElement, prepared: IPreparedEditOperation[], _accessMode: AlaskaAgentAccess): void {
		if (prepared.length === 0) { return; }
		const batch = document.createElement('div');
		batch.className = 'alaska-edit-batch alaska-edit-batch-summary';
		const header = document.createElement('div');
		header.className = 'alaska-edit-header';
		const title = document.createElement('strong');
		title.textContent = `${prepared.length} file change${prepared.length === 1 ? '' : 's'} · Accept/Revert in the editor`;
		header.appendChild(title);
		batch.appendChild(header);

		const list = document.createElement('div');
		list.className = 'alaska-edit-list';
		for (const op of prepared) {
			const row = document.createElement('div');
			row.className = 'alaska-edit-row alaska-edit-row-applied';
			const main = document.createElement('div');
			main.className = 'alaska-edit-row-main';
			const t = document.createElement('strong');
			t.textContent = `${op.action} ${op.path}`;
			main.appendChild(t);
			const meta = document.createElement('span');
			meta.textContent = typeof op.after === 'string' ? `${formatCompactNumber(op.after.length)} chars` : op.action;
			main.appendChild(meta);
			row.appendChild(main);
			const actions = document.createElement('div');
			actions.className = 'alaska-edit-row-actions';
			const open = document.createElement('button');
			open.className = 'alaska-mini-button';
			open.type = 'button';
			open.textContent = 'Open';
			open.addEventListener('click', () => void this.editorService.openEditor({ resource: op.resource }));
			actions.appendChild(open);
			row.appendChild(actions);
			list.appendChild(row);
		}
		batch.appendChild(list);
		messageNode.appendChild(batch);
	}

	private renderReasoningPanel(reasoning: string): HTMLElement {
		const det = document.createElement('details');
		det.className = 'alaska-msg-reasoning';
		const summary = document.createElement('summary');
		// allow-any-unicode-next-line
		summary.textContent = '💭 Thinking';
		det.appendChild(summary);
		const pre = document.createElement('pre');
		pre.className = 'alaska-msg-reasoning-text';
		pre.textContent = reasoning;
		det.appendChild(pre);
		return det;
	}

	private renderActivitiesList(activities: IThreadToolActivity[]): HTMLElement {
		const list = document.createElement('div');
		list.className = 'alaska-msg-activities';
		for (const a of activities) {
			list.appendChild(this.renderActivityRow(a));
		}
		return list;
	}

	private renderActivityRow(a: IThreadToolActivity): HTMLElement {
		if (a.runCommand) {
			return this.renderRunCommandCard(a);
		}
		const row = document.createElement('div');
		row.className = `alaska-activity alaska-activity-${a.status}`;
		row.dataset.state = a.status;

		const icon = buildCodicon(activityIcon(a.name, a.status));
		icon.classList.add('alaska-activity-icon');
		row.appendChild(icon);

		const verb = document.createElement('span');
		verb.className = 'alaska-activity-verb';
		verb.textContent = activityVerb(a.name);
		row.appendChild(verb);

		if (a.target) {
			const sep = document.createElement('span');
			sep.className = 'alaska-activity-sep';
			sep.textContent = '·';
			row.appendChild(sep);

			const path = document.createElement('span');
			path.className = 'alaska-activity-path';
			path.title = a.target;
			// allow-any-unicode-next-line
			path.textContent = '‎' + activityDisplayLabel(a.name, a.target);
			row.appendChild(path);
		}

		if (a.progress) {
			const badge = document.createElement('span');
			badge.className = 'alaska-activity-progress';
			badge.textContent = a.progress;
			row.appendChild(badge);
		}

		if (a.status === 'running') {
			const pulse = document.createElement('span');
			pulse.className = 'alaska-activity-pulse';
			pulse.setAttribute('aria-hidden', 'true');
			row.appendChild(pulse);
		} else if (a.summary) {
			const meta = document.createElement('span');
			meta.className = 'alaska-activity-meta';
			meta.textContent = a.summary;
			row.appendChild(meta);
		}

		if (a.target) {
			row.setAttribute('role', 'button');
			row.tabIndex = 0;
			row.setAttribute('aria-label', `Open ${a.target}`);
			const open = () => this.openActivityTarget(a);
			row.addEventListener('click', open);
			row.addEventListener('keydown', e => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					open();
				}
			});
		}

		return row;
	}

	private openActivityTarget(a: IThreadToolActivity): void {
		if (!a.target) {
			return;
		}
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root) {
			return;
		}
		try {
			const resource = resolveWorkspacePath(root, a.target);
			void this.editorService.openEditor({ resource, options: { preserveFocus: false } });
		} catch (err) {
			this.logService.warn('[alaska.chat] activity open failed', err);
		}
	}

	private buildStageRow(): HTMLElement {
		const row = document.createElement('div');
		row.className = 'alaska-msg-stage';
		const pulse = document.createElement('span');
		pulse.className = 'alaska-stage-pulse';
		pulse.setAttribute('aria-hidden', 'true');
		row.appendChild(pulse);
		const label = document.createElement('span');
		label.className = 'alaska-stage-label';
		row.appendChild(label);
		return row;
	}

	private setStage(msg: IThreadMessage, refs: ILiveAssistantRefs, label: string): void {
		msg.stage = { label, state: 'running' };
		if (!refs.stageEl) {
			refs.stageEl = this.buildStageRow();
			refs.contentEl.before(refs.stageEl);
		}
		refs.stageEl.style.display = '';
		// eslint-disable-next-line no-restricted-syntax
		const labelEl = refs.stageEl.querySelector<HTMLSpanElement>('.alaska-stage-label');
		if (labelEl) {
			labelEl.textContent = label;
		}
	}

	private hideStage(refs: ILiveAssistantRefs): void {
		if (refs.stageEl) {
			refs.stageEl.style.display = 'none';
		}
	}

	private completeStage(msg: IThreadMessage, refs: ILiveAssistantRefs): void {
		msg.stage = { label: msg.stage?.label ?? '', state: 'done' };
		if (refs.stageEl) {
			refs.stageEl.remove();
			refs.stageEl = undefined;
		}
	}

	private async copyMessage(msg: IThreadMessage): Promise<void> {
		const text = msg.content ?? '';
		try {
			await this.clipboardService.writeText(text);
			this.toastShort(localize('alaska.msg.copied', 'Copied to clipboard'));
		} catch (err) {
			this.logService.warn('[alaska.chat] copy failed', err);
		}
	}

	private async retryAssistant(msg: IThreadMessage): Promise<void> {
		if (this.isStreaming) { return; }
		const idx = this.thread.indexOf(msg);
		if (idx < 0 || this.thread[idx].role !== 'assistant') { return; }

		let userIdx = idx - 1;
		while (userIdx >= 0 && this.thread[userIdx].role !== 'user') {
			userIdx--;
		}
		if (userIdx < 0) { return; }

		await this.pendingEdits.revertAll().catch(() => { /* best effort */ });

		for (let i = userIdx + 1; i < this.thread.length; i++) {
			this.releaseObjectUrlsFor(this.thread[i]);
		}
		this.thread.splice(userIdx + 1);

		this.renderThread();
		this.saveActiveSession();
		await this.submit(false, { resumeFromLastUser: true });
	}

	private async deleteFromMessage(msg: IThreadMessage): Promise<void> {
		if (this.isStreaming) { return; }
		const idx = this.thread.indexOf(msg);
		if (idx < 0) { return; }

		const removingCount = this.thread.length - idx;
		const confirmation = await this.dialogService.confirm({
			message: removingCount === 1
				? localize('alaska.msg.delete.confirm.one', 'Delete this message?')
				: localize('alaska.msg.delete.confirm.many', 'Delete this and {0} message(s) below?', removingCount - 1),
			primaryButton: localize('alaska.msg.delete.yes', 'Delete'),
			type: 'warning',
		});
		if (!confirmation.confirmed) { return; }

		await this.pendingEdits.revertAll().catch(() => { /* best effort */ });

		for (let i = idx; i < this.thread.length; i++) {
			this.releaseObjectUrlsFor(this.thread[i]);
		}
		this.thread.splice(idx);

		this.renderThread();
		this.saveActiveSession();
	}

	private toastShort(text: string): void {
		const host = this.signedInEl;
		if (!host) { return; }
		const toast = document.createElement('div');
		toast.className = 'alaska-msg-toast';
		toast.setAttribute('role', 'status');
		toast.textContent = text;
		host.appendChild(toast);
		requestAnimationFrame(() => toast.classList.add('show'));
		setTimeout(() => {
			toast.classList.remove('show');
			setTimeout(() => toast.remove(), 200);
		}, 1500);
	}

	private beginEditUserMessage(node: HTMLElement, msg: IThreadMessage): void {
		if (this.isStreaming) { return; }
		const idx = this.thread.indexOf(msg);
		if (idx < 0) { return; }

		// eslint-disable-next-line no-restricted-syntax
		const existing = node.querySelector('.alaska-msg-content');
		// eslint-disable-next-line no-restricted-syntax
		const toolbar = node.querySelector<HTMLElement>('.alaska-msg-toolbar');
		if (!existing) { return; }

		const editor = document.createElement('textarea');
		editor.className = 'alaska-msg-edit-area';
		editor.value = msg.content;
		editor.rows = Math.max(2, Math.min(10, msg.content.split('\n').length + 1));

		const messagesBelow = this.thread.length - idx - 1;
		let warning: HTMLElement | undefined;
		if (messagesBelow > 0) {
			warning = document.createElement('div');
			warning.className = 'alaska-msg-edit-warning';
			warning.textContent = messagesBelow === 1
				? localize('alaska.msg.edit.warning.one', '1 message below will be discarded')
				: localize('alaska.msg.edit.warning.many', '{0} messages below will be discarded', messagesBelow);
		}

		const actions = document.createElement('div');
		actions.className = 'alaska-msg-edit-actions';
		const save = document.createElement('button');
		save.className = 'alaska-button alaska-button-secondary';
		save.type = 'button';
		save.textContent = localize('alaska.msg.edit.save', 'Save & regenerate');
		const cancel = document.createElement('button');
		cancel.className = 'alaska-button alaska-button-secondary';
		cancel.type = 'button';
		cancel.textContent = localize('alaska.msg.edit.cancel', 'Cancel');
		actions.appendChild(save);
		actions.appendChild(cancel);

		existing.replaceWith(editor);
		if (warning) {
			editor.after(warning);
			warning.after(actions);
		} else {
			editor.after(actions);
		}
		if (toolbar) {
			toolbar.style.display = 'none';
		}
		editor.focus();
		editor.setSelectionRange(editor.value.length, editor.value.length);

		const cleanup = () => {
			actions.remove();
			warning?.remove();
			if (toolbar) {
				toolbar.style.display = '';
			}
		};

		cancel.addEventListener('click', () => {
			const restored = document.createElement('div');
			restored.className = 'alaska-msg-content';
			this.renderMessageContent(restored, msg.content, true);
			editor.replaceWith(restored);
			cleanup();
		});

		save.addEventListener('click', () => {
			const next = editor.value.trim();
			if (!next || next === msg.content) {
				cancel.click();
				return;
			}
			void this.applyUserMessageEdit(idx, next);
		});

		editor.addEventListener('keydown', e => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				save.click();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				cancel.click();
			}
		});
	}

	private async applyUserMessageEdit(idx: number, newContent: string): Promise<void> {
		await this.pendingEdits.revertAll().catch(() => { /* best effort */ });

		const session = this.currentSession();
		const original = this.thread[idx];
		for (let i = idx; i < this.thread.length; i++) {
			this.releaseObjectUrlsFor(this.thread[i]);
		}
		this.thread.splice(idx);
		const forkedId = generateThreadMessageId('u');
		const parentId = original?.parentId ?? null;
		const forked: IThreadMessage = {
			id: forkedId,
			parentId,
			childIds: [],
			role: 'user',
			content: newContent,
			edited: true,
			createdAt: Date.now(),
		};
		if (session) {
			session.messages.push(forked);
			if (parentId) {
				const parent = session.messages.find(m => m.id === parentId);
				if (parent && !(parent.childIds ?? []).includes(forkedId)) {
					parent.childIds = [...(parent.childIds ?? []), forkedId];
				}
			}
			session.activeLeafId = forkedId;
			session.version = 2;
		}
		this.thread.push(forked);
		this.renderThread();
		this.saveActiveSession();
		requestAnimationFrame(() => {
			if (!this.messagesEl) { return; }
			// eslint-disable-next-line no-restricted-syntax
			const nodes = this.messagesEl.querySelectorAll<HTMLElement>('.alaska-msg-user');
			const editedNode = nodes[nodes.length - 1];
			if (editedNode) {
				editedNode.scrollIntoView({ block: 'start', behavior: 'auto' });
			}
		});
		// The forked user message is now the trailing message in the thread — regenerate
		// from it via the same proven path as retryAssistant. (The old push/pop + composer
		// dance double-rendered the user message and could silently no-op.)
		await this.submit(false, { resumeFromLastUser: true });
	}

	private renderMessageContent(container: HTMLElement, content: string, markdown: boolean, enhance: boolean = true): void {
		if (!markdown) {
			container.textContent = content;
			return;
		}
		const rendered = renderMarkdown(new MarkdownString(content, { supportThemeIcons: true }), {
			fillInIncompleteTokens: true,
			markedOptions: { gfm: true, breaks: false },
		}, container);
		rendered.dispose();
		if (enhance) {
			void enhanceMarkdownContainer(container, content).catch(err => this.logService.trace('[alaska.markdown.enhance] failed', err));
		}
	}

	private async renderEditBatch(messageNode: HTMLElement, ops: IAlaskaEditOperation[], accessMode: AlaskaAgentAccess): Promise<void> {
		if (ops.length === 0) {
			return;
		}
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root) {
			return;
		}

		const prepared = await Promise.all(ops.map(op => this.prepareEditOperation(root, op)));
		const batch = document.createElement('div');
		batch.className = 'alaska-edit-batch';
		const header = document.createElement('div');
		header.className = 'alaska-edit-header';
		const title = document.createElement('strong');
		title.textContent = `${ops.length} generated file change${ops.length === 1 ? '' : 's'}`;
		header.appendChild(title);
		const mode = document.createElement('span');
		mode.textContent = accessMode === 'edit' ? 'Edit files' : 'Read only';
		header.appendChild(mode);
		batch.appendChild(header);

		const list = document.createElement('div');
		list.className = 'alaska-edit-list';
		batch.appendChild(list);

		const footer = document.createElement('div');
		footer.className = 'alaska-edit-actions';
		const acceptAll = document.createElement('button');
		acceptAll.className = 'alaska-button alaska-button-secondary';
		acceptAll.type = 'button';
		acceptAll.textContent = 'Accept all';
		const rejectAll = document.createElement('button');
		rejectAll.className = 'alaska-button alaska-button-secondary';
		rejectAll.type = 'button';
		rejectAll.textContent = 'Reject all';
		const status = document.createElement('span');
		status.className = 'alaska-edit-status';
		footer.appendChild(acceptAll);
		footer.appendChild(rejectAll);
		footer.appendChild(status);
		batch.appendChild(footer);
		messageNode.appendChild(batch);

		const renderRows = () => {
			list.replaceChildren();
			for (const op of prepared) {
				list.appendChild(this.renderEditRow(op, renderRows));
			}
		};
		renderRows();

		acceptAll.addEventListener('click', () => void this.applyPreparedEdits(prepared, status, renderRows));
		rejectAll.addEventListener('click', () => void this.rejectPreparedEdits(prepared, status, renderRows));
		const permissionMode = this.readPermissionMode();
		if (accessMode === 'edit' && permissionMode === 'auto') {
			await this.applyPreparedEdits(prepared, status, renderRows);
		} else if (permissionMode === 'readonly') {
			status.textContent = localize('alaska.edit.readonlyBlocked', 'Read-only permission — proposed edits blocked.');
		} else if (permissionMode === 'plan') {
			status.textContent = localize('alaska.edit.planRecorded', 'Plan permission — edits recorded, not applied.');
		}
	}

	private renderEditRow(op: IPreparedEditOperation, rerender: () => void): HTMLElement {
		const row = document.createElement('div');
		row.className = `alaska-edit-row alaska-edit-row-${op.status}`;
		const main = document.createElement('div');
		main.className = 'alaska-edit-row-main';
		const title = document.createElement('strong');
		title.textContent = `${op.action} ${op.path}`;
		main.appendChild(title);
		const meta = document.createElement('span');
		meta.textContent = op.error || `${op.status}${typeof op.after === 'string' ? ` · ${formatCompactNumber(op.after.length)} chars` : ''}`;
		main.appendChild(meta);
		row.appendChild(main);

		const actions = document.createElement('div');
		actions.className = 'alaska-edit-row-actions';
		const open = document.createElement('button');
		open.className = 'alaska-mini-button';
		open.type = 'button';
		open.textContent = 'Open';
		open.addEventListener('click', () => void this.editorService.openEditor({ resource: op.resource }));
		actions.appendChild(open);
		if (op.status === 'pending') {
			const apply = document.createElement('button');
			apply.className = 'alaska-mini-button alaska-mini-button-accept';
			apply.type = 'button';
			apply.textContent = 'Accept';
			apply.addEventListener('click', () => void this.applyPreparedEdits([op], undefined, rerender));
			actions.appendChild(apply);
			const reject = document.createElement('button');
			reject.className = 'alaska-mini-button';
			reject.type = 'button';
			reject.textContent = 'Reject';
			reject.addEventListener('click', () => {
				op.status = 'rejected';
				rerender();
			});
			actions.appendChild(reject);
		} else if (op.status === 'applied') {
			const revert = document.createElement('button');
			revert.className = 'alaska-mini-button';
			revert.type = 'button';
			revert.textContent = 'Revert';
			revert.addEventListener('click', () => void this.revertPreparedEdit(op, rerender));
			actions.appendChild(revert);
		}
		row.appendChild(actions);
		return row;
	}

	private async prepareEditOperation(root: URI, op: IAlaskaEditOperation): Promise<IPreparedEditOperation> {
		const resource = resolveWorkspacePath(root, op.path);
		const prepared: IPreparedEditOperation = { ...op, resource, status: 'pending' };
		const exists = await this.fileService.exists(resource);
		if (exists && op.action !== 'create') {
			prepared.before = (await this.textFileService.read(resource)).value;
		}
		if (op.action === 'patch') {
			if (typeof op.find !== 'string' || typeof op.replace !== 'string') {
				prepared.status = 'failed';
				prepared.error = 'Missing find/replace.';
			} else if (typeof prepared.before !== 'string' || !prepared.before.includes(op.find)) {
				prepared.status = 'failed';
				prepared.error = 'Patch text not found.';
			} else {
				prepared.after = prepared.before.replace(op.find, op.replace);
			}
		} else if (op.action === 'replace' || op.action === 'create') {
			if (typeof op.content !== 'string') {
				prepared.status = 'failed';
				prepared.error = 'Missing content.';
			} else {
				prepared.after = op.content;
			}
		}
		return prepared;
	}

	private async applyPreparedEdits(ops: IPreparedEditOperation[], status?: HTMLElement, rerender?: () => void): Promise<void> {
		// eslint-disable-next-line local/code-no-unused-expressions
		status && (status.textContent = 'Applying…');
		let firstResource: URI | undefined;
		for (const op of ops) {
			if (op.status === 'failed' || op.status === 'rejected') {
				continue;
			}
			firstResource ??= op.resource;
			try {
				if (op.action === 'delete') {
					if (typeof op.before !== 'string') {
						op.before = (await this.textFileService.read(op.resource)).value;
					}
					await this.fileService.del(op.resource, { useTrash: false });
				} else {
					if (typeof op.after !== 'string') { throw new Error('Missing content.'); }
					if (op.action === 'create' && !(await this.fileService.exists(op.resource))) {
						await this.textFileService.create([{ resource: op.resource, value: op.after, options: { overwrite: true } }]);
					} else {
						await this.textFileService.write(op.resource, op.after);
					}
				}
				op.status = 'applied';
				op.error = undefined;
			} catch (err) {
				op.status = 'failed';
				op.error = err instanceof Error ? err.message : 'Apply failed';
			}
		}
		// eslint-disable-next-line local/code-no-unused-expressions
		status && (status.textContent = 'Done.');
		if (firstResource) {
			void this.editorService.openEditor({ resource: firstResource });
		}
		rerender?.();
	}

	private async rejectPreparedEdits(ops: IPreparedEditOperation[], status?: HTMLElement, rerender?: () => void): Promise<void> {
		for (const op of ops) {
			if (op.status === 'applied') {
				await this.revertPreparedEdit(op);
			} else if (op.status !== 'failed') {
				op.status = 'rejected';
			}
		}
		// eslint-disable-next-line local/code-no-unused-expressions
		status && (status.textContent = 'Rejected.');
		rerender?.();
	}

	private async revertPreparedEdit(op: IPreparedEditOperation, rerender?: () => void): Promise<void> {
		try {
			if (op.action === 'create') {
				await this.fileService.del(op.resource, { useTrash: false });
			} else if (typeof op.before === 'string') {
				await this.textFileService.write(op.resource, op.before);
			}
			op.status = 'rejected';
			op.error = undefined;
		} catch (err) {
			op.status = 'failed';
			op.error = err instanceof Error ? err.message : 'Revert failed';
		}
		rerender?.();
	}

	private autosizeComposer(): void {
		if (!this.composerEl) { return; }
		this.composerEl.style.height = 'auto';
		this.composerEl.style.height = `${Math.min(180, Math.max(56, this.composerEl.scrollHeight))}px`;
	}

	private stopStreaming(): void {
		if (!this.streamCancel) { return; }
		this.streamCancel.cancel();
		this.streamCancel = undefined;
		this.isStreaming = false;
		this.setStreaming(false);
		// Arm a one-shot reminder so the next prompt tells the model it was
		// interrupted rather than that its last action completed.
		this.reminderService.armInterrupt();
	}

	private setStreaming(streaming: boolean): void {
		// One button morphs between Send and Stop instead of a greyed Send + a
		// separate ■. Stays enabled while streaming so it can be clicked to stop.
		if (this.sendButton) {
			this.sendButton.disabled = false;
			this.sendButton.classList.toggle('alaska-cbtn-send-stopping', streaming);
			this.sendButton.title = streaming
				? localize('alaska.composer.stop', 'Stop generating')
				// allow-any-unicode-next-line
				: localize('alaska.composer.send', 'Send (⌘↵)');
		}
		if (this.sendKbdEl) {
			// allow-any-unicode-next-line
			this.sendKbdEl.textContent = streaming ? '■' : '⌘↵';
		}
		if (this.sendLabelEl) {
			this.sendLabelEl.textContent = streaming
				? localize('alaska.composer.stop.label', 'Стоп')
				: localize('alaska.composer.send.label', 'Send');
		}
		if (this.statusEl) {
			this.statusEl.classList.toggle('alaska-soft-pulse', streaming);
		}
		// Elapsed-time ticker: shows how long the current turn has been running,
		// both on the Stop button and in the in-thread "thinking" placeholder.
		if (streaming) {
			this.streamStartMs = Date.now();
			this.updateElapsed();
			if (!this.elapsedTimer) { this.elapsedTimer = setInterval(() => this.updateElapsed(), 1000); }
		} else {
			if (this.elapsedTimer) { clearInterval(this.elapsedTimer); this.elapsedTimer = undefined; }
		}
		this.updateStreamingStatus(streaming ? 'thinking' : 'idle');
	}

	private formatElapsed(ms: number): string {
		const s = Math.max(0, Math.floor(ms / 1000));
		if (s < 60) { return `${s}s`; }
		const m = Math.floor(s / 60);
		const rem = s % 60;
		return m < 60 ? `${m}m ${rem}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
	}

	private updateElapsed(): void {
		if (!this.streamStartMs) { return; }
		const txt = this.formatElapsed(Date.now() - this.streamStartMs);
		// Stop button: "■ Стоп · 12s"
		if (this.sendLabelEl && this.isStreaming) {
			this.sendLabelEl.textContent = `${localize('alaska.composer.stop.label', 'Стоп')} · ${txt}`;
		}
		// In-thread pending placeholders
		if (this.rootEl) {
			for (const el of Array.from(this.rootEl.querySelectorAll<HTMLElement>('.alaska-pending-elapsed'))) {
				el.textContent = txt;
			}
		}
	}

	private updateStreamingStatus(state: 'idle' | 'thinking' | 'reasoning' | 'writing' | 'tool', detail?: string): void {
		if (!this.statusEl) { return; }
		let text: string;
		switch (state) {
			case 'idle':
				text = '';
				break;
			case 'thinking':
				text = localize('alaska.chat.status.thinking', 'Thinking…');
				break;
			case 'reasoning':
				text = detail
					? localize('alaska.chat.status.reasoningPreview', 'Reasoning · …{0}', detail)
					: localize('alaska.chat.status.reasoning', 'Reasoning…');
				break;
			case 'writing':
				text = localize('alaska.chat.status.writing', 'Writing…');
				break;
			case 'tool':
				text = detail
					? localize('alaska.chat.status.tool', '{0}…', detail)
					: localize('alaska.chat.status.toolGeneric', 'Working…');
				break;
		}
		this.statusEl.textContent = text;
	}

	private isAtBottom(): boolean {
		const el = this.messagesEl;
		if (!el) { return true; }
		return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
	}

	private scrollToBottom(): void {
		const el = this.messagesEl;
		if (!el) { return; }
		el.scrollTop = el.scrollHeight;
	}

	private scrollToBottomIfNear(): void {
		if (this.isAtBottom()) {
			this.scrollToBottom();
		}
	}

	private clearMessagesContainer(): void {
		if (!this.messagesEl) { return; }
		this.messagesEl.replaceChildren();
		const spacer = document.createElement('div');
		spacer.className = 'alaska-messages-spacer';
		this.messagesEl.appendChild(spacer);
	}

	// Messages rendered before auth loaded show the "U" fallback initial; once the
	// account is known, update existing user-message avatars in place to the real
	// initial (no re-render, no duplicate nodes).
	private refreshUserAvatars(email: string): void {
		if (!this.messagesEl) { return; }
		const initial = (email[0] ?? 'U').toUpperCase();
		for (const av of Array.from(this.messagesEl.querySelectorAll<HTMLElement>('.alaska-msg-user .alaska-msg-avatar'))) {
			if (av.textContent !== initial) { av.textContent = initial; }
		}
	}

	private applyState(state: IAlaskaAuthState): void {
		if (!this.signedOutEl || !this.signedInEl) { return; }
		if (state.status === 'signed-in') {
			this.signedOutEl.style.display = 'none';
			this.signedInEl.style.display = 'flex';
			if (this.userEl) {
				this.userEl.replaceChildren(...Array.from(this.buildUserLine().childNodes));
			}
			this.refreshUserAvatars(state.user?.email ?? '');
			this.refreshContextLabel();
			void this.ensureModels();
			void this.ensureUsage();
		} else {
			this.signedOutEl.style.display = 'flex';
			this.signedInEl.style.display = 'none';
		}
	}
}

function buildAlaskaLogo(className: string): SVGSVGElement {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.classList.add(className);
	svg.setAttribute('aria-hidden', 'true');
	const outer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	outer.setAttribute('d', 'M12 1.5 L13.6 10.4 L22.5 12 L13.6 13.6 L12 22.5 L10.4 13.6 L1.5 12 L10.4 10.4 Z');
	outer.setAttribute('fill', 'currentColor');
	outer.setAttribute('fill-opacity', '0.95');
	svg.appendChild(outer);
	const inner = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	inner.setAttribute('d', 'M12 5.5 L12.7 11.3 L18.5 12 L12.7 12.7 L12 18.5 L11.3 12.7 L5.5 12 L11.3 11.3 Z');
	inner.setAttribute('fill', 'var(--vscode-sideBar-background)');
	svg.appendChild(inner);
	return svg;
}

function buildChatHeadAction(pathD: string, label: string, onClick: () => void): HTMLButtonElement {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'alaska-chat-actions-btn';
	btn.title = label;
	btn.setAttribute('aria-label', label);
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '1.4');
	const p = document.createElementNS(NS, 'path');
	p.setAttribute('d', pathD);
	svg.appendChild(p);
	btn.appendChild(svg);
	btn.addEventListener('click', onClick);
	return btn;
}

function buildChatHeadMoreIcon(): SVGSVGElement {
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('fill', 'currentColor');
	for (const cx of [4, 8, 12]) {
		const c = document.createElementNS(NS, 'circle');
		c.setAttribute('cx', String(cx));
		c.setAttribute('cy', '8');
		c.setAttribute('r', '1.2');
		svg.appendChild(c);
	}
	return svg;
}

function buildAuroraMark(className: string): SVGSVGElement {
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('viewBox', '0 0 30 18');
	svg.classList.add(className);
	svg.setAttribute('aria-hidden', 'true');

	const w1 = document.createElementNS(NS, 'path');
	w1.classList.add('w', 'w1');
	w1.setAttribute('d', 'M0,9 Q7.5,3 15,9 T30,9');
	const a1 = document.createElementNS(NS, 'animate');
	a1.setAttribute('attributeName', 'd');
	a1.setAttribute('dur', '3s');
	a1.setAttribute('repeatCount', 'indefinite');
	a1.setAttribute('values', 'M0,9 Q7.5,3 15,9 T30,9;M0,9 Q7.5,15 15,9 T30,9;M0,9 Q7.5,3 15,9 T30,9');
	w1.appendChild(a1);
	svg.appendChild(w1);

	const w2 = document.createElementNS(NS, 'path');
	w2.classList.add('w', 'w2');
	w2.setAttribute('d', 'M0,9 Q7.5,5 15,9 T30,9');
	const a2 = document.createElementNS(NS, 'animate');
	a2.setAttribute('attributeName', 'd');
	a2.setAttribute('dur', '3.5s');
	a2.setAttribute('repeatCount', 'indefinite');
	a2.setAttribute('values', 'M0,9 Q7.5,13 15,9 T30,9;M0,9 Q7.5,5 15,9 T30,9;M0,9 Q7.5,13 15,9 T30,9');
	w2.appendChild(a2);
	svg.appendChild(w2);

	return svg;
}

function buildCodicon(icon: ThemeIcon): HTMLElement {
	const el = document.createElement('span');
	el.classList.add('codicon', `codicon-${icon.id}`);
	return el;
}

interface ILiveAssistantRefs {
	readonly messageNode: HTMLElement | null;
	readonly contentEl: HTMLElement;
	reasoningEl?: HTMLElement;
	reasoningPre?: HTMLPreElement;
	activitiesEl?: HTMLElement;
	activityRows: Map<string, HTMLElement>;
	stageEl?: HTMLElement;
	pendingEl?: HTMLElement;
	caretEl?: HTMLElement;
}

interface IToolPreviewState {
	content: string;
	rafHandle?: number;
	finalized: boolean;
	beforeContent?: string;
	beforeLoaded?: boolean;
	beforeLoading?: boolean;
	diffMode?: 'single' | 'split';
	patchFind?: string;
}

const ALASKA_TOOL_PREVIEW_MAX_BYTES = 100 * 1024;
const ALASKA_TOOL_PREVIEW_AUTO_COLLAPSE_LINES = 150;
const ALASKA_LIVEDIFF_LINE_CAP = 10_000;

interface IDiffLineEntry {
	readonly kind: 'add' | 'del' | 'same' | 'pad';
	readonly text: string;
}

interface IDiffSides {
	readonly left: IDiffLineEntry[];
	readonly right: IDiffLineEntry[];
}

function computeLineDiff(before: string, after: string): IDiffSides {
	const beforeLines = before === '' ? [] : before.split('\n');
	const afterLines = after === '' ? [] : after.split('\n');
	if (beforeLines.length === 0) {
		const right: IDiffLineEntry[] = afterLines.map(t => ({ kind: 'add' as const, text: t }));
		const left: IDiffLineEntry[] = afterLines.map(() => ({ kind: 'pad' as const, text: '' }));
		return { left, right };
	}
	if (afterLines.length === 0) {
		const left: IDiffLineEntry[] = beforeLines.map(t => ({ kind: 'del' as const, text: t }));
		const right: IDiffLineEntry[] = beforeLines.map(() => ({ kind: 'pad' as const, text: '' }));
		return { left, right };
	}
	const n = beforeLines.length;
	const m = afterLines.length;
	const dp: number[] = new Array((n + 1) * (m + 1));
	const width = m + 1;
	for (let i = 0; i <= n; i++) { dp[i * width] = 0; }
	for (let j = 0; j <= m; j++) { dp[j] = 0; }
	for (let i = 1; i <= n; i++) {
		const bi = beforeLines[i - 1];
		const base = i * width;
		const prev = (i - 1) * width;
		for (let j = 1; j <= m; j++) {
			dp[base + j] = bi === afterLines[j - 1]
				? dp[prev + j - 1] + 1
				: Math.max(dp[prev + j], dp[base + j - 1]);
		}
	}
	const left: IDiffLineEntry[] = [];
	const right: IDiffLineEntry[] = [];
	let i = n;
	let j = m;
	while (i > 0 && j > 0) {
		if (beforeLines[i - 1] === afterLines[j - 1]) {
			left.push({ kind: 'same', text: beforeLines[i - 1] });
			right.push({ kind: 'same', text: afterLines[j - 1] });
			i--; j--;
		} else if (dp[(i - 1) * width + j] >= dp[i * width + j - 1]) {
			left.push({ kind: 'del', text: beforeLines[i - 1] });
			right.push({ kind: 'pad', text: '' });
			i--;
		} else {
			left.push({ kind: 'pad', text: '' });
			right.push({ kind: 'add', text: afterLines[j - 1] });
			j--;
		}
	}
	while (i > 0) {
		left.push({ kind: 'del', text: beforeLines[i - 1] });
		right.push({ kind: 'pad', text: '' });
		i--;
	}
	while (j > 0) {
		left.push({ kind: 'pad', text: '' });
		right.push({ kind: 'add', text: afterLines[j - 1] });
		j--;
	}
	left.reverse();
	right.reverse();
	return { left, right };
}

interface IRunCardRefs {
	root: HTMLElement;
	statusIcon: HTMLElement;
	headerLabel: HTMLElement;
	shellLabel: HTMLElement;
	timerIcon: HTMLElement;
	timer: HTMLElement;
	closeBtn: HTMLButtonElement;
	commandText: HTMLElement;
	output: HTMLPreElement;
	footer: HTMLElement;
	footerIcon: HTMLElement;
	footerStatus: HTMLElement;
	showTerminalBtn: HTMLButtonElement;
	abortBtn: HTMLButtonElement;
	timerInterval?: number;
	onAbort?: () => void;
	onShowTerminal?: () => void;
	onClose?: () => void;
	readonly activityId: string;
}

type RunCardSeverityTier = 'none' | 'ok' | 'err-soft' | 'err-hard';

function runCardSeverityTier(rc: IRunCommandActivity): RunCardSeverityTier {
	if (rc.status === 'ok') {
		return 'ok';
	}
	if (rc.status !== 'err') {
		return 'none';
	}
	if (typeof rc.exitCode !== 'number') {
		return 'err-hard';
	}
	const producedOutput = (rc.output?.length ?? 0) + (rc.droppedBytes ?? 0) > 0;
	return producedOutput ? 'err-soft' : 'err-hard';
}

function runCardIconTooltip(tier: RunCardSeverityTier): string {
	switch (tier) {
		case 'err-soft': return 'Command exited non-zero but produced output — the model can still use the result. See terminal pane for full output.';
		case 'err-hard': return 'Command failed before producing any output.';
		default: return '';
	}
}

function runCardStatusIcon(status: RunCommandStatus, tier: RunCardSeverityTier): ThemeIcon {
	switch (status) {
		case 'queued': return Codicon.clock;
		case 'awaiting-consent': return Codicon.shield;
		case 'running': return Codicon.loading;
		case 'ok': return Codicon.check;
		case 'err': return tier === 'err-soft' ? Codicon.warning : Codicon.error;
		case 'cancelled': return Codicon.circleSlash;
		case 'timed-out': return Codicon.watch;
		case 'blocked': return Codicon.circleSlash;
	}
}

function runCardFooterLabel(rc: IRunCommandActivity): string {
	switch (rc.status) {
		case 'queued':
			return rc.queuePosition && rc.queuePosition > 1 ? `Queued (${ordinal(rc.queuePosition)} in line)…` : 'Queued…';
		case 'awaiting-consent':
			return 'Waiting for your approval…';
		case 'running': {
			const since = rc.startedAt ?? Date.now();
			const elapsed = Date.now() - since;
			if (elapsed > 30 * 60_000) {
				return 'Hard cap reached (30 min) — aborting';
			}
			if (elapsed > 5 * 60_000) {
				return 'Still running (big task — sure?)';
			}
			if (elapsed > 60_000) {
				return 'Still running…';
			}
			return 'Running…';
		}
		case 'ok':
			return `exit 0 · ${formatDuration((rc.endedAt ?? Date.now()) - (rc.startedAt ?? Date.now()))}`;
		case 'err': {
			const dur = formatDuration((rc.endedAt ?? Date.now()) - (rc.startedAt ?? Date.now()));
			if (typeof rc.exitCode === 'number') {
				return `exit ${rc.exitCode} · ${dur}`;
			}
			return rc.reason ? `${rc.reason}` : `failed · ${dur}`;
		}
		case 'cancelled':
			return `cancelled · ${formatDuration((rc.endedAt ?? Date.now()) - (rc.startedAt ?? Date.now()))}`;
		case 'timed-out':
			return 'timed out after 30 min';
		case 'blocked':
			return rc.reason ? `Blocked: ${rc.reason}` : 'Blocked by Xipher IDE policy';
	}
}

function ordinal(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) {
		return '0:00';
	}
	const total = Math.floor(ms / 1000);
	if (total < 60) {
		const tenths = Math.floor((ms % 1000) / 100);
		return `${total}.${tenths}s`;
	}
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function tailOutput(text: string, maxBytes: number = 8 * 1024): string {
	if (!text) { return ''; }
	const encoder = new TextEncoder();
	const buf = encoder.encode(text);
	if (buf.byteLength <= maxBytes) {
		return text;
	}
	const tail = buf.slice(buf.byteLength - maxBytes);
	const decoder = new TextDecoder('utf-8', { fatal: false });
	return decoder.decode(tail);
}

function isToolParseErrorResult(content: string): boolean {
	if (!content) { return false; }
	try {
		const parsed = JSON.parse(content) as { error_code?: unknown };
		return parsed.error_code === 'tool_parse_error';
	} catch {
		return false;
	}
}

function unwindLastAssistantTurn(wireMessages: IAlaskaChatMessage[]): void {
	while (wireMessages.length > 0) {
		const tail = wireMessages[wireMessages.length - 1];
		if (tail.role === 'tool') {
			wireMessages.pop();
			continue;
		}
		if (tail.role === 'assistant' && tail.tool_calls && tail.tool_calls.length > 0) {
			wireMessages.pop();
			return;
		}
		return;
	}
}

function classifyToolOutcome(content: string): string {
	if (!content) {
		return 'empty';
	}
	try {
		const parsed = JSON.parse(content) as { ok?: boolean; error?: string };
		if (parsed.ok === false) {
			return parsed.error ? 'soft_fail' : 'fail';
		}
		return 'ok';
	} catch {
		return content.length > 0 ? 'raw' : 'empty';
	}
}

function basenameOfPath(path: string): string {
	const clean = path.replace(/\\/g, '/');
	const trimmed = clean.replace(/\/+$/, '');
	const idx = trimmed.lastIndexOf('/');
	return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function flattenDocumentSymbols(roots: readonly DocumentSymbol[], out: DocumentSymbol[] = []): DocumentSymbol[] {
	for (const s of roots) {
		out.push(s);
		if (s.children && s.children.length > 0) {
			flattenDocumentSymbols(s.children, out);
		}
	}
	return out;
}

function symbolKindLabel(kind: SymbolKind): string {
	switch (kind) {
		case SymbolKind.File: return 'file';
		case SymbolKind.Module: return 'module';
		case SymbolKind.Namespace: return 'namespace';
		case SymbolKind.Package: return 'package';
		case SymbolKind.Class: return 'class';
		case SymbolKind.Method: return 'method';
		case SymbolKind.Property: return 'property';
		case SymbolKind.Field: return 'field';
		case SymbolKind.Constructor: return 'constructor';
		case SymbolKind.Enum: return 'enum';
		case SymbolKind.Interface: return 'interface';
		case SymbolKind.Function: return 'function';
		case SymbolKind.Variable: return 'variable';
		case SymbolKind.Constant: return 'constant';
		case SymbolKind.String: return 'string';
		case SymbolKind.Number: return 'number';
		case SymbolKind.Boolean: return 'boolean';
		case SymbolKind.Array: return 'array';
		case SymbolKind.Object: return 'object';
		case SymbolKind.Key: return 'key';
		case SymbolKind.Null: return 'null';
		case SymbolKind.EnumMember: return 'enum-member';
		case SymbolKind.Struct: return 'struct';
		case SymbolKind.Event: return 'event';
		case SymbolKind.Operator: return 'operator';
		case SymbolKind.TypeParameter: return 'type-parameter';
		default: return 'symbol';
	}
}

function symbolKindIconName(kind: SymbolKind): string {
	switch (kind) {
		case SymbolKind.Function: return 'symbol-method';
		case SymbolKind.Method: return 'symbol-method';
		case SymbolKind.Class: return 'symbol-class';
		case SymbolKind.Interface: return 'symbol-interface';
		case SymbolKind.Variable: return 'symbol-variable';
		case SymbolKind.Constant: return 'symbol-constant';
		case SymbolKind.Property: return 'symbol-property';
		case SymbolKind.Field: return 'symbol-field';
		case SymbolKind.Constructor: return 'symbol-constructor';
		case SymbolKind.Enum: return 'symbol-enum';
		case SymbolKind.EnumMember: return 'symbol-enum-member';
		case SymbolKind.Struct: return 'symbol-struct';
		case SymbolKind.Event: return 'symbol-event';
		case SymbolKind.Module: return 'symbol-namespace';
		case SymbolKind.Namespace: return 'symbol-namespace';
		case SymbolKind.Package: return 'symbol-package';
		case SymbolKind.TypeParameter: return 'symbol-type-parameter';
		default: return 'symbol-misc';
	}
}

function guessImageMime(path: string): string | undefined {
	const lower = path.toLowerCase();
	const ext = lower.slice(lower.lastIndexOf('.') + 1);
	switch (ext) {
		case 'png': return 'image/png';
		case 'jpg':
		case 'jpeg': return 'image/jpeg';
		case 'gif': return 'image/gif';
		case 'webp': return 'image/webp';
		default: return undefined;
	}
}

function base64ToBlob(base64: string, mime: string): Blob {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mime });
}

function runCommandFail(call: IAlaskaToolCall, errorCode: string, reason: string): IAlaskaToolResult {
	return {
		callId: call.id,
		name: call.name,
		content: JSON.stringify({ ok: false, error: errorCode, reason, exit_code: null }),
	};
}

function tryParseRunCommandArgs(argumentsJson: string): { command?: string; cwd?: string } {
	if (!argumentsJson) { return {}; }
	try {
		const obj = JSON.parse(argumentsJson) as { command?: unknown; cwd?: unknown };
		const command = typeof obj.command === 'string' ? obj.command.trim() : undefined;
		const cwd = typeof obj.cwd === 'string' ? obj.cwd.trim() : undefined;
		return { command: command && command.length > 0 ? command : undefined, cwd: cwd && cwd.length > 0 ? cwd : undefined };
	} catch {
		return {};
	}
}

function activityIcon(toolName: string, status: 'running' | 'ok' | 'err' | 'skipped'): ThemeIcon {
	if (status === 'err') {
		return Codicon.error;
	}
	if (status === 'ok') {
		return Codicon.check;
	}
	if (status === 'skipped') {
		return Codicon.circleSlash;
	}
	switch (toolName) {
		case 'alaska_write_file':
		case 'alaska_patch_file':
			return Codicon.edit;
		case 'alaska_delete_file':
			return Codicon.trash;
		case 'alaska_run_command':
			return Codicon.terminal;
		case 'alaska_open_browser':
			return Codicon.globe;
		case 'alaska_announce_plan':
			return Codicon.checklist;
		case 'alaska_grep_search':
			return Codicon.search;
		case 'alaska_list_directory':
			return Codicon.listTree;
		case 'alaska_read_file':
		default:
			return Codicon.eye;
	}
}

function pendingEditActionLabel(action: 'create' | 'replace' | 'patch' | 'delete'): string {
	switch (action) {
		case 'create': return localize('alaska.pending.action.create', 'Create new file');
		case 'replace': return localize('alaska.pending.action.replace', 'Replace file contents');
		case 'patch': return localize('alaska.pending.action.patch', 'Patch file');
		case 'delete': return localize('alaska.pending.action.delete', 'Delete file');
	}
}

function activityVerb(toolName: string): string {
	switch (toolName) {
		// allow-any-unicode-next-line
		case 'alaska_write_file': return localize('alaska.tool.write', 'пишу');
		// allow-any-unicode-next-line
		case 'alaska_patch_file': return localize('alaska.tool.patch', 'правлю');
		// allow-any-unicode-next-line
		case 'alaska_delete_file': return localize('alaska.tool.delete', 'удаляю');
		// allow-any-unicode-next-line
		case 'alaska_read_file': return localize('alaska.tool.read', 'читаю');
		// allow-any-unicode-next-line
		case 'alaska_run_command': return localize('alaska.tool.run', 'запускаю');
		// allow-any-unicode-next-line
		case 'alaska_announce_plan': return localize('alaska.tool.plan', 'план');
		// allow-any-unicode-next-line
		case 'alaska_grep_search': return localize('alaska.tool.search', 'ищу');
		// allow-any-unicode-next-line
		case 'alaska_list_directory': return localize('alaska.tool.list', 'смотрю');
		// allow-any-unicode-next-line
		case 'alaska_open_browser': return localize('alaska.tool.openBrowser', 'открываю браузер');
		case 'alaska_web_search': return localize('alaska.tool.webSearch', 'ищу в вебе');
		// allow-any-unicode-next-line
		case 'alaska_web_fetch': return localize('alaska.tool.webFetch', 'читаю');
		// allow-any-unicode-next-line
		case 'alaska_dispatch_subagent': return localize('alaska.tool.subagent', 'под-агент');
		default:
			if (toolName.startsWith('mcp:')) {
				return localize('alaska.tool.mcp', 'MCP');
			}
			// allow-any-unicode-next-line
			return localize('alaska.tool.do', 'делаю');
	}
}

function formatCallingStage(call: IAlaskaToolCall): string {
	const target = extractToolTarget(call.argumentsJson);
	return target ? `Calling ${call.name} (${target})…` : `Calling ${call.name}…`;
}

function activityDisplayLabel(toolName: string, target: string): string {
	if (toolName === 'alaska_run_command' || toolName === 'alaska_announce_plan') {
		return target;
	}
	if (toolName === 'alaska_grep_search') {
		const pat = target.replace(/\s+/g, ' ');
		return pat.length > 40 ? `"${pat.slice(0, 37)}…"` : `"${pat}"`;
	}
	if (toolName === 'alaska_list_directory') {
		if (target === '' || target === '.') { return '/'; }
		const clean = target.replace(/\\/g, '/').replace(/\/+$/, '');
		return clean.length > 48 ? '…' + clean.slice(-45) : clean + '/';
	}
	if (toolName === 'alaska_web_search') {
		const q = target.replace(/\s+/g, ' ');
		return q.length > 36 ? `"${q.slice(0, 33)}…"` : `"${q}"`;
	}
	if (toolName === 'alaska_web_fetch' || toolName === 'alaska_open_browser') {
		try {
			const u = new URL(target);
			const path = u.pathname.length > 24 ? '/…' : u.pathname;
			return `${u.hostname}${path}`;
		} catch {
			return target.length > 40 ? target.slice(0, 37) + '…' : target;
		}
	}
	const clean = target.replace(/\\/g, '/').replace(/\/+$/, '');
	const idx = clean.lastIndexOf('/');
	const base = idx >= 0 ? clean.slice(idx + 1) : clean;
	if (!base) {
		return target;
	}
	return base.length > 40 ? base.slice(0, 37) + '…' : base;
}

const timeShortFormatter = safeIntl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

function formatTimeShort(value: number): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return '';
	}
	return timeShortFormatter.value.format(date);
}

function extractToolTarget(argumentsJson: string): string | undefined {
	if (!argumentsJson) { return undefined; }
	try {
		const obj = JSON.parse(argumentsJson) as Record<string, unknown>;
		// sub-agent: show its focused task so parallel sub-agents are distinguishable
		const task = obj['task'];
		if (typeof task === 'string' && task.length > 0) {
			return task.length > 90 ? task.slice(0, 90) + '…' : task;
		}
		const url = obj['url'];
		if (typeof url === 'string' && url.length > 0) {
			return url.length > 200 ? url.slice(0, 200) + '…' : url;
		}
		const query = obj['query'];
		if (typeof query === 'string' && query.length > 0) {
			return query.length > 80 ? query.slice(0, 80) + '…' : query;
		}
		const pattern = obj['pattern'];
		if (typeof pattern === 'string') {
			return pattern.length > 80 ? pattern.slice(0, 80) + '…' : pattern;
		}
		const path = obj['path'];
		if (typeof path === 'string') {
			return path;
		}
		const command = obj['command'];
		if (typeof command === 'string') {
			return command.length > 80 ? command.slice(0, 80) + '…' : command;
		}
	} catch {
		const taskMatch = argumentsJson.match(/"task"\s*:\s*"([^"]+)"/);
		if (taskMatch) {
			const t = taskMatch[1];
			return t.length > 90 ? t.slice(0, 90) + '…' : t;
		}
		const urlMatch = argumentsJson.match(/"url"\s*:\s*"([^"]+)"/);
		if (urlMatch) {
			const u = urlMatch[1];
			return u.length > 200 ? u.slice(0, 200) + '…' : u;
		}
		const queryMatch = argumentsJson.match(/"query"\s*:\s*"([^"]+)"/);
		if (queryMatch) {
			const q = queryMatch[1];
			return q.length > 80 ? q.slice(0, 80) + '…' : q;
		}
		const patternMatch = argumentsJson.match(/"pattern"\s*:\s*"([^"]+)"/);
		if (patternMatch) {
			const p = patternMatch[1];
			return p.length > 80 ? p.slice(0, 80) + '…' : p;
		}
		const pathMatch = argumentsJson.match(/"path"\s*:\s*"([^"]+)"/);
		if (pathMatch) {
			return pathMatch[1];
		}
		const cmdMatch = argumentsJson.match(/"command"\s*:\s*"([^"]+)"/);
		if (cmdMatch) {
			const c = cmdMatch[1];
			return c.length > 80 ? c.slice(0, 80) + '…' : c;
		}
	}
	return undefined;
}

function parseToolResultSummary(content: string): { ok: boolean; summary?: string; soft?: boolean } {
	try {
		const obj = JSON.parse(content) as {
			ok?: boolean;
			soft?: boolean;
			bytes?: number;
			action?: string;
			content?: string;
			error?: string;
			truncated?: boolean;
			exit_code?: number;
			stdout?: string;
			timed_out?: boolean;
			match_count?: number;
			file_count?: number;
			dir_count?: number;
			bytes_total?: number;
		};
		if (obj.ok === false) {
			return { ok: false, summary: obj.error, soft: obj.soft === true };
		}
		if (typeof obj.exit_code === 'number') {
			const tail = typeof obj.stdout === 'string' ? obj.stdout.trim().split('\n').slice(-1)[0] : '';
			const head = `exit ${obj.exit_code}`;
			const detail = obj.timed_out ? 'timed out' : tail.length > 0 ? (tail.length > 60 ? tail.slice(0, 60) + '…' : tail) : '';
			return { ok: true, summary: detail ? `${head} · ${detail}` : head };
		}
		if (typeof obj.match_count === 'number' && typeof obj.file_count === 'number') {
			const m = obj.match_count;
			const f = obj.file_count;
			const head = `${m} match${m === 1 ? '' : 'es'} · ${f} file${f === 1 ? '' : 's'}`;
			return { ok: true, summary: obj.truncated ? `${head} · truncated` : head };
		}
		if (typeof obj.dir_count === 'number' && typeof obj.bytes_total === 'number') {
			const f = typeof obj.file_count === 'number' ? obj.file_count : 0;
			const d = obj.dir_count;
			const head = `${f} file${f === 1 ? '' : 's'} · ${d} ${d === 1 ? 'dir' : 'dirs'} · ${formatBytes(obj.bytes_total)}`;
			return { ok: true, summary: obj.truncated ? `${head} · truncated` : head };
		}
		const parts: string[] = [];
		if (typeof obj.content === 'string') {
			const lines = obj.content.length === 0 ? 0 : obj.content.split('\n').length;
			parts.push(`${lines} ${lines === 1 ? 'line' : 'lines'}`);
		}
		if (typeof obj.bytes === 'number') {
			parts.push(formatBytes(obj.bytes));
		}
		if (parts.length === 0 && obj.action) {
			parts.push(obj.action === 'delete' ? 'deleted' : obj.action);
		}
		return { ok: true, summary: parts.join(' · ') || undefined };
	} catch {
		return { ok: true, summary: 'done' };
	}
}

function shortenUrl(url: string): string {
	if (url.length <= 60) { return url; }
	try {
		const u = new URL(url);
		const tail = u.pathname.length > 24 ? '…' + u.pathname.slice(-24) : u.pathname;
		return `${u.host}${tail}`;
	} catch {
		return url.slice(0, 40) + '…' + url.slice(-12);
	}
}

function approxBytes(value: string): number {
	if (!value) { return 0; }
	return new TextEncoder().encode(value).byteLength;
}

function htmlToReadableText(html: string): { title?: string; text: string } {
	if (!html) {
		return { text: '' };
	}
	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const title = titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])).trim() || undefined : undefined;
	let body = html;
	body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
	body = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
	body = body.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');
	body = body.replace(/<\/?(p|div|br|li|h[1-6]|tr|hr|article|section|header|footer|nav|blockquote|pre|ul|ol)[^>]*>/gi, '\n');
	body = stripTags(body);
	body = decodeHtmlEntities(body);
	body = body.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
	return { title, text: body };
}

function stripTags(value: string): string {
	return value.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		// eslint-disable-next-line local/code-no-unexternalized-strings
		.replace(/&#39;/g, "'")
		// eslint-disable-next-line local/code-no-unexternalized-strings
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function mcpToolToWire(tool: IMcpToolInfo): IAlaskaTool {
	const parameters = (tool.inputSchema && typeof tool.inputSchema === 'object')
		? tool.inputSchema
		: { type: 'object', properties: {}, additionalProperties: true };
	const description = tool.description
		? `[${tool.serverId} via MCP] ${tool.description}`
		: `[${tool.serverId} via MCP] external tool`;
	return {
		type: 'function',
		function: {
			name: tool.qualifiedName,
			description,
			parameters,
		},
	};
}

function tryParseError(content: string): string | undefined {
	try {
		const obj = JSON.parse(content) as { ok?: boolean; error?: string };
		if (obj && obj.ok === false && typeof obj.error === 'string') {
			return obj.error;
		}
	} catch {
	}
	return undefined;
}

function describeEmptyTurn(
	activities: IThreadToolActivity[] | undefined,
	collectedEdits: number,
	legacyEdits: number,
): string {
	if (collectedEdits > 0) {
		return 'Applied file changes.';
	}
	if (legacyEdits > 0) {
		return 'Prepared file changes.';
	}
	const calls = activities ?? [];
	if (calls.length === 0) {
		// Reached only after the empty-turn auto-retries were exhausted — the upstream
		// model returned nothing. Be honest and actionable instead of looking crashed.
		return 'Модель вернула пустой ответ (после нескольких повторов) — временная перегрузка. Отправьте сообщение ещё раз или выберите другую модель.';
	}
	const failed = calls.filter(a => a.status === 'err').length;
	const ok = calls.filter(a => a.status === 'ok').length;
	if (failed > 0 && ok === 0) {
		return failed === 1
			? 'The model attempted a tool call but it failed — retry with a shorter request, or break the change into smaller files.'
			: `All ${failed} tool calls failed — retry with a shorter request, or break the change into smaller files.`;
	}
	if (failed > 0 && ok > 0) {
		return `${ok} tool call${ok === 1 ? '' : 's'} succeeded, ${failed} failed — see the activity strip above for details.`;
	}
	const planActivity = calls.find(a => a.name === 'alaska_announce_plan' && a.plan?.outcome === 'approved');
	const editedPlan = calls.find(a => a.name === 'alaska_announce_plan' && a.plan?.outcome === 'edited-approved');
	if (planActivity || editedPlan) {
		// allow-any-unicode-next-line
		return 'Plan approved but the model stopped before writing every file — re-send the request or reply with `продолжи` so it executes the remaining changes.';
	}
	const reads = calls.filter(a => a.name === 'alaska_read_file').length;
	if (reads === calls.length && reads > 0) {
		// allow-any-unicode-next-line
		return `Xipher IDE read ${reads} file${reads === 1 ? '' : 's'} but didn't follow up with any edit — reply with \`продолжи\` or rephrase the request.`;
	}
	// allow-any-unicode-next-line
	return `Xipher IDE ran ${calls.length} tool call${calls.length === 1 ? '' : 's'} but didn't produce a final answer — reply with \`продолжи\` so it finishes the turn.`;
}

function generateThreadMessageId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function migrateSessionToV2(session: IChatSession): IChatSession {
	if (session.version === 2 && session.activeLeafId !== undefined) {
		return session;
	}
	const messages: IThreadMessage[] = [];
	let prevId: string | null = null;
	for (const msg of session.messages) {
		const m = { ...msg } as IThreadMessage;
		if (!m.id) { m.id = generateThreadMessageId('m'); }
		m.parentId = prevId;
		m.childIds = [];
		messages.push(m);
		if (prevId !== null) {
			const parent = messages.find(p => p.id === prevId);
			if (parent) {
				parent.childIds = [...(parent.childIds ?? []), m.id!];
			}
		}
		prevId = m.id!;
	}
	return {
		...session,
		version: 2,
		messages,
		activeLeafId: messages.length > 0 ? messages[messages.length - 1].id ?? null : null,
	};
}

function getActiveThread(session: IChatSession): IThreadMessage[] {
	const leafId = session.activeLeafId;
	if (!leafId) {
		return session.messages.slice();
	}
	const byId = new Map(session.messages.map(m => [m.id ?? '', m]));
	const chain: IThreadMessage[] = [];
	let cur: string | null | undefined = leafId;
	const guard = new Set<string>();
	while (cur) {
		if (guard.has(cur)) { break; }
		guard.add(cur);
		const msg = byId.get(cur);
		if (!msg) { break; }
		chain.unshift(msg);
		cur = msg.parentId ?? null;
	}
	return chain;
}

function findDeepestDescendant(session: IChatSession, fromId: string): string {
	const byId = new Map(session.messages.map(m => [m.id ?? '', m]));
	let cur = fromId;
	const guard = new Set<string>();
	while (true) {
		if (guard.has(cur)) { break; }
		guard.add(cur);
		const msg = byId.get(cur);
		if (!msg || !msg.childIds || msg.childIds.length === 0) { return cur; }
		cur = msg.childIds[msg.childIds.length - 1];
	}
	return cur;
}

function isThreadMessage(value: unknown): value is IThreadMessage {
	return !!value
		&& typeof value === 'object'
		&& (((value as IThreadMessage).role === 'user') || ((value as IThreadMessage).role === 'assistant') || ((value as IThreadMessage).role === 'error'))
		&& typeof (value as IThreadMessage).content === 'string';
}

function isStoredChatSession(value: unknown): value is IChatSession {
	return !!value
		&& typeof value === 'object'
		&& typeof (value as IChatSession).id === 'string'
		&& typeof (value as IChatSession).title === 'string'
		&& Array.isArray((value as IChatSession).messages)
		&& typeof (value as IChatSession).createdAt === 'number'
		&& typeof (value as IChatSession).updatedAt === 'number';
}

function migrateSessionTitleFlags(session: IChatSession): IChatSession {
	if (session.titleSummarizeAttempted !== undefined || session.titleUserSet !== undefined) {
		return session;
	}
	if (session.titleAuto === true) {
		return { ...session, titleSummarizeAttempted: true };
	}
	const firstUser = session.messages.find(m => m.role === 'user')?.content?.trim() ?? '';
	const singleLine = firstUser.replace(/\s+/g, ' ');
	// allow-any-unicode-next-line
	const looksLikeSlice = session.title === singleLine.slice(0, 48) || session.title === singleLine.slice(0, 45) + '…';
	const looksLikeNewChat = !session.title || session.title === 'New chat';
	if (looksLikeSlice || looksLikeNewChat) {
		return { ...session, titleSummarizeAttempted: false };
	}
	return { ...session, titleUserSet: true, titleSummarizeAttempted: true };
}

function getSessionTitle(messages: IThreadMessage[]): string {
	const firstUser = messages.find(message => message.role === 'user')?.content.trim();
	if (!firstUser) {
		return 'New chat';
	}
	const singleLine = firstUser.replace(/\s+/g, ' ');
	return singleLine.length > 48 ? `${singleLine.slice(0, 45)}…` : singleLine;
}

function formatSessionTime(value: number): string {
	const date = new Date(value);
	const now = new Date();
	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function planDetailRow(label: string, value: string): HTMLElement {
	const row = document.createElement('div');
	row.className = 'alaska-plan-row';
	const key = document.createElement('span');
	key.textContent = label;
	row.appendChild(key);
	const val = document.createElement('strong');
	val.textContent = value;
	row.appendChild(val);
	return row;
}

function usageResetDate(usage: IAlaskaUsageWithPlanDates): Date {
	const explicit = parseOptionalDate(usage.reset_at ?? usage.resetAt ?? usage.period_end ?? usage.periodEnd);
	if (explicit) {
		return explicit;
	}
	const periodMatch = usage.period.match(/^(\d{4})-(\d{2})/);
	if (periodMatch) {
		return new Date(Number(periodMatch[1]), Number(periodMatch[2]), 1);
	}
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function usagePlanEndsAt(usage: IAlaskaUsageWithPlanDates): Date | undefined {
	return parseOptionalDate(usage.plan_ends_at ?? usage.planEndsAt ?? usage.current_period_end ?? usage.currentPeriodEnd);
}

function parseOptionalDate(value: string | undefined): Date | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatPlanDate(value: Date): string {
	return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fitFloatingMenu(menu: HTMLElement, container: HTMLElement | undefined): void {
	const fit = () => {
		menu.style.transform = '';
		menu.style.maxWidth = '';
		menu.style.maxHeight = '';
		// eslint-disable-next-line no-restricted-syntax
		const boundary = container?.getBoundingClientRect() ?? document.body.getBoundingClientRect();
		const availableWidth = Math.max(180, Math.floor(boundary.width - 16));
		const availableHeight = Math.max(120, Math.floor(boundary.height - 16));
		menu.style.maxWidth = `${availableWidth}px`;
		menu.style.maxHeight = `${availableHeight}px`;
		const rect = menu.getBoundingClientRect();
		const padding = 8;
		let dx = 0;
		let dy = 0;
		if (rect.right > boundary.right - padding) {
			dx = boundary.right - padding - rect.right;
		}
		if (rect.left + dx < boundary.left + padding) {
			dx += boundary.left + padding - (rect.left + dx);
		}
		if (rect.bottom > boundary.bottom - padding) {
			dy = boundary.bottom - padding - rect.bottom;
		}
		if (rect.top + dy < boundary.top + padding) {
			dy += boundary.top + padding - (rect.top + dy);
		}
		menu.style.transform = dx || dy ? `translate(${Math.round(dx)}px, ${Math.round(dy)}px)` : '';
	};
	fit();
	// eslint-disable-next-line no-restricted-globals
	requestAnimationFrame(fit);
}

function formatBytes(value: number): string {
	if (value < 1024) {
		return `${value} B`;
	}
	if (value < 1024 * 1024) {
		return `${Math.round(value / 1024)} KB`;
	}
	return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function detectOrphanCodeBlocks(messageContent: string, toolCalls: readonly IAlaskaToolCall[]): IOrphanCodeBlock[] {
	const writtenPaths = new Set<string>();
	for (const call of toolCalls) {
		if (call.name !== 'alaska_write_file' && call.name !== 'alaska_patch_file') {
			continue;
		}
		try {
			const parsed = JSON.parse(call.argumentsJson) as { path?: unknown };
			if (typeof parsed.path === 'string' && parsed.path) {
				writtenPaths.add(parsed.path);
			}
		} catch {
			// ignore unparseable args
		}
	}

	const orphans: IOrphanCodeBlock[] = [];
	const fenceRegex = /^([ \t]*)(`{3,})([^\n]*)\n([\s\S]*?)\n\1\2[ \t]*$/gm;
	let match: RegExpExecArray | null;
	while ((match = fenceRegex.exec(messageContent)) !== null) {
		const infoString = match[3].trim();
		const code = match[4];
		const langMatch = infoString.match(/^([A-Za-z0-9+_\-]+)/);
		const lang = langMatch ? langMatch[1].toLowerCase() : '';
		if (lang === 'alaska-edit') {
			continue;
		}

		const lines = code.split('\n');
		if (lines.length < ORPHAN_MIN_LINES) {
			continue;
		}

		const inlineFilename = extractFilenameHint(code);
		const inferredPath = inlineFilename || inferPathFromContent(code, lang);
		if (!inferredPath || !isValidOrphanPath(inferredPath)) {
			continue;
		}
		if (writtenPaths.has(inferredPath)) {
			continue;
		}

		orphans.push({
			inferredPath,
			language: lang,
			content: code,
			byteCount: new TextEncoder().encode(code).byteLength,
			position: match.index,
		});
	}
	return orphans;
}

function extractFilenameHint(code: string): string | undefined {
	const firstLine = code.split('\n', 1)[0] ?? '';
	const match = firstLine.match(/^\s*(?:\/\/|#|--|<!--|\/\*)\s*([\w./-]+\.[A-Za-z0-9]+)\b/);
	return match ? match[1] : undefined;
}

function inferPathFromContent(code: string, lang: string): string | undefined {
	if (lang === 'html' || lang === 'htm') {
		if (/<!doctype html>/i.test(code) || /<html[\s>]/i.test(code)) {
			return 'index.html';
		}
	}
	if (lang === 'css') {
		if (/:root\s*\{/.test(code) || /--[\w-]+\s*:/.test(code) || /^[\s\S]*?\{[\s\S]*?\}/.test(code)) {
			return 'styles.css';
		}
	}
	if (lang === 'scss' || lang === 'sass') {
		return 'styles.scss';
	}
	if (lang === 'js' || lang === 'javascript' || lang === 'mjs') {
		if (/^import\s+|^export\s+/m.test(code)) { return 'main.js'; }
		if (/document\.|window\./.test(code)) { return 'script.js'; }
	}
	if (lang === 'ts' || lang === 'typescript') {
		if (/^import\s+|^export\s+/m.test(code)) { return 'index.ts'; }
	}
	if (lang === 'tsx') { return 'App.tsx'; }
	if (lang === 'jsx') { return 'App.jsx'; }
	if (lang === 'json' || lang === 'jsonc') {
		if (/"scripts"\s*:/.test(code) && /"version"\s*:/.test(code)) { return 'package.json'; }
		if (/"compilerOptions"\s*:/.test(code)) { return 'tsconfig.json'; }
	}
	if (lang === 'py' || lang === 'python') {
		if (/^if __name__\s*==\s*['"]__main__['"]/m.test(code)) { return 'main.py'; }
	}
	if (lang === 'sh' || lang === 'bash' || lang === 'zsh') {
		if (/^#!\/(usr\/)?bin\/(env\s+)?(bash|sh|zsh)/m.test(code)) { return 'script.sh'; }
	}
	if (lang === 'yaml' || lang === 'yml') {
		if (/^on:\s*/m.test(code) && /^jobs:\s*/m.test(code)) { return '.github/workflows/ci.yml'; }
	}
	if (lang === 'dockerfile') { return 'Dockerfile'; }
	if (lang === 'md' || lang === 'markdown') {
		if (/^#\s+/m.test(code)) { return 'README.md'; }
	}
	if (lang === 'go') {
		if (/^package\s+main\b/m.test(code)) { return 'main.go'; }
	}
	if (lang === 'rs' || lang === 'rust') {
		if (/^fn\s+main\s*\(/m.test(code)) { return 'main.rs'; }
	}
	return undefined;
}

function isValidOrphanPath(path: string): boolean {
	if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\')) {
		return false;
	}
	const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
	if (base === 'dockerfile' || base === 'makefile' || base === '.gitignore' || base === '.env') {
		return true;
	}
	const lastDot = path.lastIndexOf('.');
	if (lastDot === -1) {
		return false;
	}
	const ext = path.slice(lastDot + 1).toLowerCase();
	return ORPHAN_ALLOWED_EXTENSIONS.has(ext);
}

function hasUnclosedCodeFence(text: string): boolean {
	let count = 0;
	const re = /^[ \t]*```/gm;
	while (re.exec(text) !== null) {
		count++;
	}
	return count % 2 !== 0;
}

function formatCompactNumber(value: number): string {
	if (value < 1000) {
		return String(value);
	}
	if (value < 1000000) {
		return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
	}
	return `${(value / 1000000).toFixed(1)}m`;
}

function estimateAlaskaTokens(text: string, images: number): number {
	if (!text && !images) { return 0; }
	const textTokens = text ? Math.ceil(text.length / 4) : 0;
	const imageTokens = images * 1500;
	return textTokens + imageTokens;
}

function formatTokenCount(n: number): string {
	if (n < 1000) { return String(n); }
	if (n < 10_000) { return `${(n / 1000).toFixed(1)}k`; }
	if (n < 1_000_000) { return `${Math.round(n / 1000)}k`; }
	return `${(n / 1_000_000).toFixed(2)}M`;
}

interface IModelPriceRate {
	readonly input: number;
	readonly output: number;
}

const ALASKA_PRICE_TABLE_DEFAULT: IModelPriceRate = { input: 3, output: 15 };

const ALASKA_PRICE_TABLE: Record<string, IModelPriceRate> = {
	'claude-opus-4-7': { input: 15, output: 75 },
	'claude-opus-4-6': { input: 15, output: 75 },
	'claude-sonnet-4-6': { input: 3, output: 15 },
	'claude-sonnet-4-5': { input: 3, output: 15 },
	'claude-haiku-4-5': { input: 0.8, output: 4 },
	'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
	'gpt-5.4': { input: 5, output: 20 },
	'gpt-5.4-mini': { input: 0.5, output: 1.5 },
	'gpt-5.5': { input: 8, output: 24 },
	'grok-4-fast': { input: 1, output: 3 },
};

function visibleAssistantContent(content: string, hideCodeBlocks = false): string {
	return content
		.replace(/```alaska-edit\s*[\s\S]*?```/gi, '')
		.replace(/```alaska-edit[\s\S]*$/i, '')
		.replace(hideCodeBlocks ? /```(?!alaska-edit\b)[\w-]*\s*[\s\S]*?```/gi : /$a/, '')
		.replace(hideCodeBlocks ? /```(?!alaska-edit\b)[\s\S]*$/i : /$a/, '')
		.trimEnd();
}

function extractTasklistMarkdown(text: string): string | undefined {
	if (!text) {
		return undefined;
	}
	const stripped = visibleAssistantContent(text, true).trim();
	if (!stripped) {
		return undefined;
	}
	const parsed = parseTasklist(stripped);
	if (parsed.length === 0) {
		return undefined;
	}
	const lines = stripped.split(/\r?\n/);
	const startIdx = lines.findIndex(line => /^\s*(?:\d+[.)]|[-*])\s+/.test(line));
	if (startIdx < 0) {
		return undefined;
	}
	let endIdx = lines.length;
	for (let i = startIdx + 1; i < lines.length; i++) {
		const line = lines[i];
		if (/^\s*(?:\d+[.)]|[-*])\s+/.test(line)) {
			continue;
		}
		if (line.trim() === '') {
			let j = i + 1;
			while (j < lines.length && lines[j].trim() === '') {
				j++;
			}
			if (j < lines.length && /^\s*(?:\d+[.)]|[-*])\s+/.test(lines[j])) {
				i = j - 1;
				continue;
			}
			endIdx = i;
			break;
		}
		endIdx = i;
		break;
	}
	return lines.slice(startIdx, endIdx).join('\n').trim();
}

function extractEditOperations(content: string): IAlaskaEditOperation[] {
	const ops: IAlaskaEditOperation[] = [];
	const re = /```alaska-edit\s*([\s\S]*?)```/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(content))) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(match[1].trim());
		} catch {
			continue;
		}
		const raw = Array.isArray(parsed)
			? parsed
			: parsed && typeof parsed === 'object' && Array.isArray((parsed as { operations?: unknown }).operations)
				? (parsed as { operations: unknown[] }).operations
				: [];
		for (const item of raw) {
			if (!item || typeof item !== 'object') {
				continue;
			}
			const op = item as Partial<IAlaskaEditOperation>;
			if ((op.action === 'replace' || op.action === 'create' || op.action === 'patch' || op.action === 'delete') && typeof op.path === 'string') {
				ops.push(op as IAlaskaEditOperation);
			}
		}
	}
	return ops;
}

function resolveWorkspacePath(root: URI, path: string): URI {
	const clean = path.replace(/\\/g, '/').replace(/^\/+/, '');
	const parts = clean.split('/').filter(Boolean);
	if (parts.length === 0 || parts.some(part => part === '..' || part === '.')) {
		throw new Error(`Unsafe path: ${path}`);
	}
	return joinPath(root, ...parts);
}

function rejectSsrfUrl(raw: string): string | undefined {
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		return 'malformed URL';
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') {
		return `scheme not allowed (${u.protocol.replace(':', '')}) — only http and https are fetched`;
	}
	const host = u.hostname.toLowerCase();
	if (!host) {
		return 'empty host';
	}
	const loopbackNames = ['localhost', 'localhost.localdomain', 'ip6-localhost', 'broadcasthost'];
	if (loopbackNames.includes(host)) {
		return 'loopback hostnames are not allowed';
	}
	if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host === 'metadata.google.internal') {
		return 'private / metadata host suffix is not allowed';
	}
	if (host === '0.0.0.0') {
		return 'unspecified address is not allowed';
	}
	if (host.startsWith('[') && host.endsWith(']')) {
		const inner = host.slice(1, -1);
		if (inner === '::' || inner === '::1' || inner.startsWith('fe80:') || inner.startsWith('fc') || inner.startsWith('fd')) {
			return 'private IPv6 address is not allowed';
		}
	}
	return checkV4Host(host);
}

const ALASKA_PLAN_RANK: Record<string, number> = { free: 0, pro: 1, max: 2, team: 2, ultra: 3 };

function planAllows(userPlan: string, required: string): boolean {
	return (ALASKA_PLAN_RANK[userPlan] ?? -1) >= (ALASKA_PLAN_RANK[required] ?? 0);
}

function checkV4Host(host: string): string | undefined {
	const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) {
		const o = [Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4])];
		if (o.some(b => b > 255)) {
			return 'malformed IPv4 octet';
		}
		if (o[0] === 10) { return 'private IPv4 range (10.0.0.0/8) is not allowed'; }
		if (o[0] === 127) { return 'loopback IPv4 range (127.0.0.0/8) is not allowed'; }
		if (o[0] === 169 && o[1] === 254) { return 'link-local IPv4 (169.254.0.0/16) — includes cloud metadata IPs — is not allowed'; }
		if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) { return 'private IPv4 range (172.16.0.0/12) is not allowed'; }
		if (o[0] === 192 && o[1] === 168) { return 'private IPv4 range (192.168.0.0/16) is not allowed'; }
		if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) { return 'carrier-grade NAT range (100.64.0.0/10) is not allowed'; }
		if (o[0] === 0) { return 'unspecified IPv4 (0.0.0.0/8) is not allowed'; }
		if (o[0] >= 224) { return 'multicast / reserved IPv4 range is not allowed'; }
	}
	return undefined;
}

