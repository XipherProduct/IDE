/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IPosition } from '../../../../editor/common/core/position.js';
import { ICodeEditor, IContentWidget, IContentWidgetPosition, ContentWidgetPositionPreference, IViewZone } from '../../../../editor/browser/editorBrowser.js';
import { IEditorContribution } from '../../../../editor/common/editorCommon.js';
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution, ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ModelDecorationOptions } from '../../../../editor/common/model/textModel.js';
import { TrackedRangeStickiness } from '../../../../editor/common/model.js';
import { IAlaskaChatService, IAlaskaChatMessage } from './alaskaChatService.js';
import { IAlaskaContextService } from './alaskaContextService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';

const INLINE_EDIT_CONTRIBUTION_ID = 'alaska.editor.inlineEdit';
const INLINE_EDIT_ACTION_ID = 'alaska.action.inlineEdit';
const PREVIEW_MIN_HEIGHT_LINES = 2;
const PREVIEW_MAX_HEIGHT_LINES = 18;

const SELECTION_DECORATION = ModelDecorationOptions.register({
	description: 'alaska-inline-edit-selection',
	className: 'alaska-inline-edit-selection',
	linesDecorationsClassName: 'alaska-inline-edit-selection-margin',
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
});

interface IInlineEditSession {
	readonly promptWidget: PromptWidget;
	readonly selection: Range;
	readonly cancel: CancellationTokenSource;
	previewZone: IViewZone | undefined;
	previewZoneId: string | undefined;
	previewNode: HTMLElement;
	previewCodeEl: HTMLPreElement;
	previewHintEl: HTMLElement;
	previewText: string;
	state: 'prompting' | 'streaming' | 'ready' | 'error';
	decorationIds: string[];
}

export class AlaskaInlineEditController extends Disposable implements IEditorContribution {
	static readonly ID = INLINE_EDIT_CONTRIBUTION_ID;

	private session: IInlineEditSession | undefined;

	constructor(
		private readonly editor: ICodeEditor,
		@IAlaskaChatService private readonly chatService: IAlaskaChatService,
		@IAlaskaContextService private readonly contextService: IAlaskaContextService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
	}

	start(): void {
		const selection = this.editor.getSelection();
		const model = this.editor.getModel();
		if (!selection || !model) {
			return;
		}
		if (selection.isEmpty()) {
			this.notificationService.notify({ severity: Severity.Info, message: 'Alaska AI: select something first.' });
			return;
		}
		this.cleanupSession();
		const range = new Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn);
		const promptWidget = new PromptWidget(
			this.editor,
			range.getStartPosition(),
			(instruction) => this.onPromptSubmit(instruction),
			() => this.onPromptDismiss(),
			() => this.onAcceptIntent(),
			() => this.onCancelIntent(),
		);
		this.editor.addContentWidget(promptWidget);

		const previewNode = document.createElement('div');
		previewNode.className = 'alaska-inline-edit-preview';
		const previewHint = document.createElement('div');
		previewHint.className = 'alaska-inline-edit-preview-hint';
		previewHint.textContent = 'Type an instruction above — preview will stream here.';
		const previewCode = document.createElement('pre');
		previewCode.className = 'alaska-inline-edit-preview-code';
		const previewFooter = document.createElement('div');
		previewFooter.className = 'alaska-inline-edit-preview-footer';
		previewFooter.textContent = 'Enter to accept · Esc to discard';
		previewNode.appendChild(previewHint);
		previewNode.appendChild(previewCode);
		previewNode.appendChild(previewFooter);

		const decorationIds = this.editor.deltaDecorations([], [{ range, options: SELECTION_DECORATION }]);

		this.session = {
			promptWidget,
			selection: range,
			cancel: new CancellationTokenSource(),
			previewZone: undefined,
			previewZoneId: undefined,
			previewNode,
			previewCodeEl: previewCode,
			previewHintEl: previewHint,
			previewText: '',
			state: 'prompting',
			decorationIds,
		};
		promptWidget.focus();
	}

	cancel(): void {
		this.cleanupSession();
	}

	accept(): void {
		const session = this.session;
		if (!session || session.state !== 'ready') {
			return;
		}
		const text = sanitisePreviewText(session.previewText);
		if (text.length === 0) {
			this.cleanupSession();
			return;
		}
		this.editor.executeEdits('alaska-inline-edit', [{ range: session.selection, text }]);
		this.cleanupSession();
	}

	private onPromptSubmit(instruction: string): void {
		if (!this.session) {
			return;
		}
		const trimmed = instruction.trim();
		if (trimmed.length === 0) {
			this.cleanupSession();
			return;
		}
		void this.runStream(trimmed);
	}

	private onPromptDismiss(): void {
		this.cleanupSession();
	}

	private onAcceptIntent(): void {
		this.accept();
	}

	private onCancelIntent(): void {
		this.cleanupSession();
	}

	private async runStream(instruction: string): Promise<void> {
		const session = this.session;
		if (!session) {
			return;
		}
		const model = this.editor.getModel();
		if (!model) {
			return;
		}
		const selectionText = model.getValueInRange(session.selection);
		const languageId = model.getLanguageId();
		const baseCtx = this.contextService.captureCurrent();
		const ctx = {
			...baseCtx,
			languageId,
			selection: { startLine: session.selection.startLineNumber, endLine: session.selection.endLineNumber, text: selectionText },
		};
		const messages: IAlaskaChatMessage[] = [
			{
				role: 'user',
				content: `Selection:\n${selectionText}\n\nInstruction: ${instruction}`,
			},
		];
		session.state = 'streaming';
		session.previewHintEl.textContent = `Streaming a replacement for ${instruction}…`;
		session.promptWidget.setStreaming(true);
		this.ensurePreviewZone();
		try {
			const stream = this.chatService.stream({ messages, context: ctx, replyMode: 'snippet' }, session.cancel.token);
			for await (const ev of stream) {
				if (this.session !== session) {
					return;
				}
				if (ev.kind === 'delta') {
					session.previewText += ev.text;
					this.updatePreviewNode();
				} else if (ev.kind === 'reasoning') {
					continue;
				} else if (ev.kind === 'done') {
					break;
				} else if (ev.kind === 'error') {
					session.state = 'error';
					session.previewHintEl.textContent = `Error: ${ev.message}`;
					session.previewCodeEl.textContent = '';
					session.promptWidget.setStreaming(false);
					return;
				}
			}
		} catch (err) {
			if (this.session !== session) {
				return;
			}
			session.state = 'error';
			session.previewHintEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
			session.promptWidget.setStreaming(false);
			return;
		}
		if (this.session !== session) {
			return;
		}
		session.previewText = sanitisePreviewText(session.previewText);
		this.updatePreviewNode();
		session.state = 'ready';
		session.previewHintEl.textContent = 'Ready — accept to insert the replacement.';
		session.promptWidget.setReady();
	}

	private ensurePreviewZone(): void {
		const session = this.session;
		if (!session || session.previewZoneId !== undefined) {
			return;
		}
		const zone: IViewZone = {
			afterLineNumber: session.selection.endLineNumber,
			heightInLines: PREVIEW_MIN_HEIGHT_LINES,
			domNode: session.previewNode,
			suppressMouseDown: false,
		};
		session.previewZone = zone;
		this.editor.changeViewZones((accessor) => {
			session.previewZoneId = accessor.addZone(zone);
		});
	}

	private updatePreviewNode(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		session.previewCodeEl.textContent = session.previewText;
		if (session.previewZone && session.previewZoneId) {
			const lines = Math.max(PREVIEW_MIN_HEIGHT_LINES, Math.min(PREVIEW_MAX_HEIGHT_LINES, session.previewText.split('\n').length + 2));
			if (session.previewZone.heightInLines !== lines) {
				session.previewZone.heightInLines = lines;
				const id = session.previewZoneId;
				this.editor.changeViewZones((accessor) => {
					accessor.layoutZone(id);
				});
			}
		}
	}

	private cleanupSession(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		this.session = undefined;
		try { session.cancel.cancel(); } catch { }
		try { session.cancel.dispose(); } catch { }
		try { this.editor.removeContentWidget(session.promptWidget); } catch { }
		try { session.promptWidget.dispose(); } catch { }
		if (session.previewZoneId) {
			const id = session.previewZoneId;
			this.editor.changeViewZones((accessor) => {
				try { accessor.removeZone(id); } catch { }
			});
		}
		if (session.decorationIds.length > 0) {
			try { this.editor.deltaDecorations(session.decorationIds, []); } catch { }
		}
		this.editor.focus();
	}

	override dispose(): void {
		this.cleanupSession();
		super.dispose();
	}
}

class PromptWidget implements IContentWidget {

	private readonly node: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly hintEl: HTMLElement;
	private state: 'idle' | 'streaming' | 'ready' = 'idle';

	constructor(
		private readonly editor: ICodeEditor,
		private readonly anchor: IPosition,
		private readonly onSubmit: (instruction: string) => void,
		private readonly onDismiss: () => void,
		private readonly onAcceptIntent: () => void,
		private readonly onCancelIntent: () => void,
	) {
		const node = document.createElement('div');
		node.className = 'alaska-inline-edit-widget';
		node.tabIndex = -1;

		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'alaska-inline-edit-input';
		input.placeholder = 'Describe the change (Enter to run, Esc to dismiss)…';
		input.spellcheck = false;
		node.appendChild(input);

		const hint = document.createElement('span');
		hint.className = 'alaska-inline-edit-hint';
		hint.textContent = 'Alaska AI · Ctrl+K';
		node.appendChild(hint);

		input.addEventListener('keydown', (ev) => this.onInputKeyDown(ev));
		node.addEventListener('keydown', (ev) => this.onWidgetKeyDown(ev));

		this.node = node;
		this.input = input;
		this.hintEl = hint;
	}

	getId(): string { return INLINE_EDIT_CONTRIBUTION_ID + '.widget'; }
	getDomNode(): HTMLElement { return this.node; }
	getPosition(): IContentWidgetPosition | null {
		return { position: this.anchor, preference: [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW] };
	}

	focus(): void {
		setTimeout(() => this.input.focus(), 0);
	}

	setStreaming(streaming: boolean): void {
		this.state = streaming ? 'streaming' : 'idle';
		this.input.disabled = streaming;
		this.hintEl.textContent = streaming ? 'Streaming…' : 'Alaska AI · Ctrl+K';
	}

	setReady(): void {
		this.state = 'ready';
		this.input.disabled = true;
		this.hintEl.textContent = 'Enter accept · Esc discard';
		this.node.classList.add('alaska-inline-edit-widget-ready');
		setTimeout(() => this.node.focus(), 0);
	}

	dispose(): void {
		this.node.remove();
	}

	private onInputKeyDown(ev: KeyboardEvent): void {
		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			this.onSubmit(this.input.value);
		} else if (ev.key === 'Escape') {
			ev.preventDefault();
			this.onDismiss();
		}
	}

	private onWidgetKeyDown(ev: KeyboardEvent): void {
		if (this.state !== 'ready') {
			return;
		}
		if (ev.key === 'Enter') {
			ev.preventDefault();
			this.onAcceptIntent();
		} else if (ev.key === 'Escape') {
			ev.preventDefault();
			this.onCancelIntent();
		}
	}
}

class AlaskaInlineEditAction extends EditorAction {
	constructor() {
		super({
			id: INLINE_EDIT_ACTION_ID,
			label: localize2('alaska.inlineEdit.label', 'Alaska AI: Edit Selection'),
			precondition: undefined,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.CtrlCmd | KeyCode.KeyI,
				weight: KeybindingWeight.EditorContrib + 10,
			},
		});
	}

	run(_accessor: ServicesAccessor, editor: ICodeEditor): void {
		const controller = editor.getContribution<AlaskaInlineEditController>(AlaskaInlineEditController.ID);
		controller?.start();
	}
}

function sanitisePreviewText(text: string): string {
	let out = text;
	out = out.replace(/^\s*<thinking>[\s\S]*?<\/thinking>\s*/i, '');
	const fenceMatch = out.match(/^```(?:[\w-]+)?\n([\s\S]*?)\n?```\s*$/);
	if (fenceMatch) {
		out = fenceMatch[1];
	}
	return out;
}

registerEditorContribution(AlaskaInlineEditController.ID, AlaskaInlineEditController, EditorContributionInstantiation.Lazy);
registerEditorAction(AlaskaInlineEditAction);
