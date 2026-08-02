/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { Range } from '../../../../editor/common/core/range.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Hover, HoverProvider } from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IAlaskaAuthService } from './alaskaAuthService.js';
import { IAlaskaChatMessage, IAlaskaChatService } from './alaskaChatService.js';

const MAX_HOVER_CODE_CHARS = 2400;
const MAX_HOVER_CACHE_SIZE = 80;

export class AlaskaCodeHoverProvider extends Disposable implements IWorkbenchContribution, HoverProvider {
	static readonly ID = 'workbench.contrib.alaskaCodeHoverProvider';

	private readonly cache = new Map<string, string>();

	constructor(
		@ILanguageFeaturesService languageFeaturesService: ILanguageFeaturesService,
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@IAlaskaChatService private readonly chatService: IAlaskaChatService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {
		super();
		this._register(languageFeaturesService.hoverProvider.register('*', this));
	}

	async provideHover(model: ITextModel, position: Position, token: CancellationToken): Promise<Hover | undefined> {
		if (this.authService.state.status !== 'signed-in' || token.isCancellationRequested) {
			return undefined;
		}
		const range = this.getCodeRange(model, position);
		if (!range) {
			return undefined;
		}
		const code = model.getValueInRange(range).trim();
		if (code.length < 6) {
			return undefined;
		}
		const cacheKey = `${model.uri.toString()}|${range.startLineNumber}:${range.startColumn}-${range.endLineNumber}:${range.endColumn}|${simpleHash(code)}`;
		let explanation = this.cache.get(cacheKey);
		if (!explanation) {
			explanation = await this.explainCode(model, range, code.slice(0, MAX_HOVER_CODE_CHARS), token);
			if (!explanation || token.isCancellationRequested) {
				return undefined;
			}
			this.cache.set(cacheKey, explanation);
			if (this.cache.size > MAX_HOVER_CACHE_SIZE) {
				const oldest = this.cache.keys().next().value;
				if (oldest) {
					this.cache.delete(oldest);
				}
			}
		}
		// allow-any-unicode-next-line
		const contents = new MarkdownString(`$(sparkle) **Alaska AI объясняет**\n\n${explanation}`, { supportThemeIcons: true });
		return { contents: [contents], range };
	}

	private async explainCode(model: ITextModel, range: Range, code: string, token: CancellationToken): Promise<string | undefined> {
		const languageId = model.getLanguageId();
		const filePath = model.uri.fsPath || model.uri.path;
		const messages: IAlaskaChatMessage[] = [
			{ role: 'system', content: 'You are Alaska AI inside the IDE. Explain hovered code briefly in Russian. Use 2-5 short bullets. Do not rewrite the code. Do not include fenced code blocks.' },
			// allow-any-unicode-next-line
			{ role: 'user', content: `Объясни этот фрагмент ${languageId} из ${filePath}:\n\n\`\`\`${languageId}\n${code}\n\`\`\`` },
		];
		let acc = '';
		for await (const ev of this.chatService.stream({
			messages,
			context: {
				filePath,
				languageId,
				workspaceName: this.workspaceService.getWorkspace().folders[0]?.name,
				selection: {
					startLine: range.startLineNumber,
					endLine: range.endLineNumber,
					text: code,
				},
			},
		}, token)) {
			if (token.isCancellationRequested) {
				return undefined;
			}
			if (ev.kind === 'delta') {
				acc += ev.text;
			} else if (ev.kind === 'error') {
				return undefined;
			}
		}
		return acc.trim() || undefined;
	}

	private getCodeRange(model: ITextModel, position: Position): Range | undefined {
		const selectionRange = this.getActiveSelectionRange(model, position);
		if (selectionRange) {
			return selectionRange;
		}
		const line = model.getLineContent(position.lineNumber);
		if (!line.trim()) {
			return undefined;
		}
		const word = model.getWordAtPosition(position);
		let startLine = position.lineNumber;
		let endLine = position.lineNumber;
		const baseIndent = indentationOf(line);
		while (startLine > 1 && position.lineNumber - startLine < 10) {
			const prev = model.getLineContent(startLine - 1);
			if (!prev.trim()) {
				break;
			}
			if (indentationOf(prev) < baseIndent && !prev.trimEnd().endsWith('{') && !prev.trimEnd().endsWith('(')) {
				break;
			}
			startLine--;
		}
		while (endLine < model.getLineCount() && endLine - position.lineNumber < 14) {
			const next = model.getLineContent(endLine + 1);
			if (!next.trim()) {
				break;
			}
			if (indentationOf(next) < baseIndent && !line.trimEnd().endsWith('{') && !line.trimEnd().endsWith('(')) {
				break;
			}
			endLine++;
		}
		if (startLine === endLine && word) {
			return new Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
		}
		return new Range(startLine, 1, endLine, model.getLineContent(endLine).length + 1);
	}

	private getActiveSelectionRange(model: ITextModel, position: Position): Range | undefined {
		const ctrl = this.editorService.activeTextEditorControl;
		const editor = isCodeEditor(ctrl) ? ctrl : undefined;
		if (editor?.getModel() !== model) {
			return undefined;
		}
		const selection = editor.getSelection();
		if (!selection || selection.isEmpty() || !selection.containsPosition(position)) {
			return undefined;
		}
		return new Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn);
	}
}

function indentationOf(line: string): number {
	return line.length - line.trimStart().length;
}

function simpleHash(value: string): string {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
	}
	return String(hash);
}
