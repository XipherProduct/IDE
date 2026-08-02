/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/alaskaChat.css';
import { localize, localize2 } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { URI } from '../../../../base/common/uri.js';
import { ICodeEditor, IViewZone } from '../../../../editor/browser/editorBrowser.js';
import { IEditorContribution } from '../../../../editor/common/editorCommon.js';
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution, ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ModelDecorationOptions } from '../../../../editor/common/model/textModel.js';
import { ITextModel, OverviewRulerLane, TrackedRangeStickiness } from '../../../../editor/common/model.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IAlaskaPendingEditsService } from './alaskaPendingEdits.js';

const INLINE_DIFF_CONTRIBUTION_ID = 'alaska.editor.inlineDiff';

const ALASKA_DIFF_ACTIVE = new RawContextKey<boolean>('alaskaDiffActive', false);

const APPROVE_COMMAND_ID = 'alaska.diff.approve';
const DISCARD_COMMAND_ID = 'alaska.diff.discard';
const NEXT_FILE_COMMAND_ID = 'alaska.diff.nextFile';
const PREV_FILE_COMMAND_ID = 'alaska.diff.prevFile';

interface IAddedRange {
	readonly startLine: number;
	readonly endLine: number;
}

interface IRemovedBlock {
	readonly afterLine: number;
	readonly lines: readonly string[];
}

interface ILineDiff {
	readonly added: readonly IAddedRange[];
	readonly removed: readonly IRemovedBlock[];
}

const ADDED_DECORATION = ModelDecorationOptions.register({
	description: 'alaska-diff-added',
	className: 'alaska-diff-added',
	linesDecorationsClassName: 'alaska-diff-added-gutter',
	isWholeLine: true,
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
	overviewRuler: {
		color: 'oklch(0.78 0.16 155 / .55)',
		position: OverviewRulerLane.Right,
	},
});

export class AlaskaInlineDiffContribution extends Disposable implements IEditorContribution {

	static readonly ID = INLINE_DIFF_CONTRIBUTION_ID;

	private decorationIds: string[] = [];
	private viewZoneIds: string[] = [];
	private toolbarZoneId: string | undefined;
	private currentUri: URI | undefined;
	private readonly diffActive: IContextKey<boolean>;
	private addedCount = 0;
	private removedCount = 0;

	constructor(
		private readonly editor: ICodeEditor,
		@IAlaskaPendingEditsService private readonly pendingEdits: IAlaskaPendingEditsService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();
		const editorDom = this.editor.getDomNode();
		const scoped = editorDom ? contextKeyService.createScoped(editorDom) : contextKeyService;
		this.diffActive = ALASKA_DIFF_ACTIVE.bindTo(scoped);
		this._register(this.pendingEdits.onDidChange(uri => this.maybeRefresh(uri)));
		this._register(this.editor.onDidChangeModel(() => this.refresh()));
		this.refresh();
	}

	private maybeRefresh(uri?: URI): void {
		if (!uri) {
			this.refresh();
			return;
		}
		const model = this.editor.getModel();
		if (!model || uri.toString() !== model.uri.toString()) {
			return;
		}
		this.refresh();
	}

	private refresh(): void {
		this.clear();
		const model = this.editor.getModel();
		if (!model) {
			return;
		}
		const pending = this.pendingEdits.get(model.uri);
		if (!pending || pending.action === 'delete') {
			return;
		}
		const beforeText = pending.before ?? '';
		const afterText = pending.after ?? model.getValue();
		const diff = computeLineDiff(beforeText, afterText);
		if (diff.added.length === 0 && diff.removed.length === 0) {
			return;
		}
		this.currentUri = model.uri;
		this.addedCount = diff.added.reduce((acc, r) => acc + (r.endLine - r.startLine + 1), 0);
		this.removedCount = diff.removed.reduce((acc, b) => acc + b.lines.length, 0);
		this.renderAdded(diff.added, model);
		this.renderRemoved(diff.removed);
		this.renderToolbar(diff);
		this.diffActive.set(true);
	}

	private renderAdded(added: readonly IAddedRange[], model: ITextModel): void {
		const maxLine = model.getLineCount();
		const decorations = added
			.filter(r => r.startLine >= 1 && r.startLine <= maxLine)
			.map(r => ({
				range: new Range(r.startLine, 1, Math.min(r.endLine, maxLine), 1),
				options: ADDED_DECORATION,
			}));
		this.decorationIds = this.editor.deltaDecorations([], decorations);
	}

	private renderRemoved(removed: readonly IRemovedBlock[]): void {
		const newZoneIds: string[] = [];
		this.editor.changeViewZones(accessor => {
			for (const block of removed) {
				const dom = document.createElement('div');
				dom.className = 'alaska-diff-removed-zone';
				dom.setAttribute('role', 'group');
				dom.setAttribute('aria-label', localize('alaska.diff.removed.aria', 'Removed by Xipher IDE'));
				for (const line of block.lines) {
					const lineEl = document.createElement('div');
					lineEl.className = 'alaska-diff-removed alaska-diff-removed-zone-line';
					const gut = document.createElement('span');
					gut.className = 'alaska-diff-removed-gutter';
					lineEl.appendChild(gut);
					const text = document.createElement('span');
					text.className = 'alaska-diff-removed-text';
					text.textContent = line.length > 0 ? line : ' ';
					lineEl.appendChild(text);
					dom.appendChild(lineEl);
				}
				const zone: IViewZone = {
					afterLineNumber: Math.max(0, block.afterLine),
					heightInLines: block.lines.length,
					domNode: dom,
					suppressMouseDown: false,
				};
				const id = accessor.addZone(zone);
				newZoneIds.push(id);
			}
		});
		this.viewZoneIds = newZoneIds;
	}

	private renderToolbar(diff: ILineDiff): void {
		const anchorLine = pickToolbarAnchor(diff);
		const dom = document.createElement('div');
		dom.className = 'alaska-diff-toolbar';

		const summary = document.createElement('span');
		summary.className = 'alaska-diff-toolbar-summary';
		summary.textContent = localize('alaska.diff.summary', 'Xipher IDE edit · +{0} / −{1}', this.addedCount, this.removedCount);
		dom.appendChild(summary);

		const spacer = document.createElement('span');
		spacer.className = 'alaska-diff-toolbar-spacer';
		dom.appendChild(spacer);

		const approve = document.createElement('button');
		approve.type = 'button';
		approve.className = 'alaska-diff-toolbar-btn alaska-diff-toolbar-btn-accept';
		approve.textContent = localize('alaska.diff.approve', 'Approve');
		const kbApprove = document.createElement('kbd');
		kbApprove.className = 'alaska-diff-toolbar-kbd';
		kbApprove.textContent = '⌘↵';
		approve.appendChild(kbApprove);
		approve.addEventListener('click', () => this.approve());
		dom.appendChild(approve);

		const discard = document.createElement('button');
		discard.type = 'button';
		discard.className = 'alaska-diff-toolbar-btn alaska-diff-toolbar-btn-discard';
		discard.textContent = localize('alaska.diff.discard', 'Discard');
		const kbDiscard = document.createElement('kbd');
		kbDiscard.className = 'alaska-diff-toolbar-kbd';
		kbDiscard.textContent = 'Esc';
		discard.appendChild(kbDiscard);
		discard.addEventListener('click', () => { void this.discard(); });
		dom.appendChild(discard);

		this.editor.changeViewZones(accessor => {
			this.toolbarZoneId = accessor.addZone({
				afterLineNumber: Math.max(0, anchorLine - 1),
				heightInLines: 1.4,
				domNode: dom,
				suppressMouseDown: false,
			});
		});
	}

	hasActiveDiff(): boolean {
		return this.currentUri !== undefined;
	}

	approve(): void {
		const uri = this.currentUri;
		if (!uri) {
			return;
		}
		const removingZoneIds = this.viewZoneIds.slice();
		for (const id of removingZoneIds) {
			const node = this.zoneDomById(id);
			if (node) {
				node.classList.add('alaska-diff-removed-shatter');
			}
		}
		setTimeout(() => {
			this.pendingEdits.accept(uri);
			this.clear();
		}, 250);
	}

	async discard(): Promise<void> {
		const uri = this.currentUri;
		if (!uri) {
			return;
		}
		try {
			await this.pendingEdits.revert(uri);
		} finally {
			this.clear();
		}
	}

	private zoneDomById(id: string): HTMLElement | undefined {
		const root = this.editor.getDomNode();
		if (!root) { return undefined; }
		return root.querySelector<HTMLElement>(`[monaco-view-zone="${id}"]`) ?? undefined;
	}

	private clear(): void {
		if (this.decorationIds.length > 0) {
			try { this.editor.deltaDecorations(this.decorationIds, []); } catch { /* ignore */ }
			this.decorationIds = [];
		}
		if (this.viewZoneIds.length > 0 || this.toolbarZoneId) {
			this.editor.changeViewZones(accessor => {
				for (const id of this.viewZoneIds) {
					try { accessor.removeZone(id); } catch { /* ignore */ }
				}
				if (this.toolbarZoneId) {
					try { accessor.removeZone(this.toolbarZoneId); } catch { /* ignore */ }
				}
			});
			this.viewZoneIds = [];
			this.toolbarZoneId = undefined;
		}
		this.currentUri = undefined;
		this.addedCount = 0;
		this.removedCount = 0;
		this.diffActive.set(false);
	}

	override dispose(): void {
		this.clear();
		super.dispose();
	}
}

function pickToolbarAnchor(diff: ILineDiff): number {
	let first = Number.POSITIVE_INFINITY;
	for (const r of diff.added) {
		if (r.startLine < first) {
			first = r.startLine;
		}
	}
	for (const b of diff.removed) {
		if (b.afterLine + 1 < first) {
			first = b.afterLine + 1;
		}
	}
	return Number.isFinite(first) ? Math.max(1, first) : 1;
}

export function computeLineDiff(before: string, after: string): ILineDiff {
	const a = before.length === 0 ? [] : before.split('\n');
	const b = after.length === 0 ? [] : after.split('\n');
	const m = a.length;
	const n = b.length;
	if (m === 0 && n === 0) {
		return { added: [], removed: [] };
	}
	if (m === 0) {
		return { added: [{ startLine: 1, endLine: n }], removed: [] };
	}
	if (n === 0) {
		return { added: [], removed: [{ afterLine: 0, lines: a }] };
	}
	const dp: number[][] = [];
	for (let i = 0; i <= m; i++) {
		dp.push(new Array<number>(n + 1).fill(0));
	}
	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			if (a[i] === b[j]) {
				dp[i][j] = dp[i + 1][j + 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
			}
		}
	}
	const added: IAddedRange[] = [];
	const removed: IRemovedBlock[] = [];
	let i = 0;
	let j = 0;
	let curAddedStart: number | undefined;
	let curAddedEnd = 0;
	let curRemovedAnchor = 0;
	let curRemovedLines: string[] = [];
	const flushRemoved = () => {
		if (curRemovedLines.length > 0) {
			removed.push({ afterLine: curRemovedAnchor, lines: curRemovedLines });
			curRemovedLines = [];
		}
	};
	const flushAdded = () => {
		if (curAddedStart !== undefined) {
			added.push({ startLine: curAddedStart, endLine: curAddedEnd });
			curAddedStart = undefined;
		}
	};
	while (i < m && j < n) {
		if (a[i] === b[j]) {
			flushRemoved();
			flushAdded();
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			if (curRemovedLines.length === 0) {
				curRemovedAnchor = j;
			}
			curRemovedLines.push(a[i]);
			i++;
		} else {
			if (curAddedStart === undefined) {
				curAddedStart = j + 1;
			}
			curAddedEnd = j + 1;
			j++;
		}
	}
	while (i < m) {
		if (curRemovedLines.length === 0) {
			curRemovedAnchor = j;
		}
		curRemovedLines.push(a[i]);
		i++;
	}
	while (j < n) {
		if (curAddedStart === undefined) {
			curAddedStart = j + 1;
		}
		curAddedEnd = j + 1;
		j++;
	}
	flushAdded();
	flushRemoved();
	return { added, removed };
}

class ApproveDiffAction extends EditorAction {
	constructor() {
		super({
			id: APPROVE_COMMAND_ID,
			label: localize2('alaska.diff.approve.action', 'Xipher IDE: Approve Inline Diff'),
			precondition: ALASKA_DIFF_ACTIVE,
			kbOpts: {
				kbExpr: ALASKA_DIFF_ACTIVE,
				primary: KeyMod.CtrlCmd | KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib + 20,
			},
		});
	}
	run(_a: ServicesAccessor, editor: ICodeEditor): void {
		const ctrl = editor.getContribution<AlaskaInlineDiffContribution>(AlaskaInlineDiffContribution.ID);
		ctrl?.approve();
	}
}

class DiscardDiffAction extends EditorAction {
	constructor() {
		super({
			id: DISCARD_COMMAND_ID,
			label: localize2('alaska.diff.discard.action', 'Xipher IDE: Discard Inline Diff'),
			precondition: ALASKA_DIFF_ACTIVE,
			kbOpts: {
				kbExpr: ALASKA_DIFF_ACTIVE,
				primary: KeyCode.Escape,
				weight: KeybindingWeight.EditorContrib + 20,
			},
		});
	}
	run(_a: ServicesAccessor, editor: ICodeEditor): void {
		const ctrl = editor.getContribution<AlaskaInlineDiffContribution>(AlaskaInlineDiffContribution.ID);
		void ctrl?.discard();
	}
}

class NextDiffFileAction extends EditorAction {
	constructor() {
		super({
			id: NEXT_FILE_COMMAND_ID,
			label: localize2('alaska.diff.nextFile.action', 'Xipher IDE: Next Pending Diff File'),
			precondition: EditorContextKeys.editorTextFocus,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.RightArrow,
				weight: KeybindingWeight.EditorContrib + 20,
			},
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		await navigatePendingFile(accessor, editor, 1);
	}
}

class PrevDiffFileAction extends EditorAction {
	constructor() {
		super({
			id: PREV_FILE_COMMAND_ID,
			label: localize2('alaska.diff.prevFile.action', 'Xipher IDE: Previous Pending Diff File'),
			precondition: EditorContextKeys.editorTextFocus,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.LeftArrow,
				weight: KeybindingWeight.EditorContrib + 20,
			},
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		await navigatePendingFile(accessor, editor, -1);
	}
}

async function navigatePendingFile(accessor: ServicesAccessor, editor: ICodeEditor, dir: 1 | -1): Promise<void> {
	const pending = accessor.get(IAlaskaPendingEditsService);
	const editorService = accessor.get(IEditorService);
	const resources = pending.resources();
	if (resources.length === 0) {
		return;
	}
	if (resources.length === 1) {
		await editorService.openEditor({ resource: resources[0] });
		return;
	}
	const model = editor.getModel();
	const currentIdx = model ? resources.findIndex(r => r.toString() === model.uri.toString()) : -1;
	const len = resources.length;
	const nextIdx = currentIdx >= 0
		? ((currentIdx + dir) % len + len) % len
		: (dir > 0 ? 0 : len - 1);
	await editorService.openEditor({ resource: resources[nextIdx] });
}

registerEditorContribution(AlaskaInlineDiffContribution.ID, AlaskaInlineDiffContribution, EditorContributionInstantiation.Eager);
registerEditorAction(ApproveDiffAction);
registerEditorAction(DiscardDiffAction);
registerEditorAction(NextDiffFileAction);
registerEditorAction(PrevDiffFileAction);
