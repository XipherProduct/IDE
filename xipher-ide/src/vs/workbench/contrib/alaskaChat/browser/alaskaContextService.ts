/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { isCodeEditor, isDiffEditor } from '../../../../editor/browser/editorBrowser.js';
import { IFileService, IFileStat } from '../../../../platform/files/common/files.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { OS, OperatingSystem } from '../../../../base/common/platform.js';
import { Schemas } from '../../../../base/common/network.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';

export interface IAlaskaCodeSelection {
	readonly startLine: number;
	readonly endLine: number;
	readonly text: string;
}

export interface IAlaskaCodeDiagnostic {
	readonly line: number;
	readonly column: number;
	readonly severity: 'error' | 'warning' | 'info' | 'hint';
	readonly source?: string;
	readonly message: string;
}

export interface IAlaskaPinnedFile {
	readonly path: string;
	readonly content: string;
	readonly truncated?: boolean;
}

export interface IAlaskaPinnedFolder {
	readonly path: string;
	readonly files: IAlaskaPinnedFile[];
	readonly truncated?: boolean;
}

export interface IAlaskaPinnedUrl {
	readonly url: string;
	readonly title?: string;
	readonly text: string;
	readonly truncated?: boolean;
}

export interface IAlaskaIndexContextHit {
	readonly filePath: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly symbolName?: string;
	readonly symbolKind?: string;
	readonly content: string;
	readonly score: number;
}

export interface IAlaskaCodeContext {
	readonly filePath?: string;
	readonly languageId?: string;
	readonly fullText?: string;
	readonly selection?: IAlaskaCodeSelection;
	readonly workspaceName?: string;
	readonly workspaceRoot?: string;
	readonly hostOs?: 'windows' | 'linux' | 'macos';
	readonly remoteAuthority?: string;
	readonly openFiles?: string[];
	readonly workspaceFiles?: string[];
	readonly agentAccess?: 'edit' | 'read-only';
	readonly projectRules?: string;
	readonly diagnostics?: IAlaskaCodeDiagnostic[];
	readonly pinnedFiles?: IAlaskaPinnedFile[];
	readonly pinnedFolders?: IAlaskaPinnedFolder[];
	readonly pinnedUrls?: IAlaskaPinnedUrl[];
	readonly pinnedDiagnostics?: IAlaskaCodeDiagnostic[];
	readonly indexHits?: readonly IAlaskaIndexContextHit[];
	readonly skillsInjection?: string;
	readonly skillsCatalog?: string;
}

const PROJECT_RULES_FILENAME = '.alaskarules';
const PROJECT_RULES_BYTE_BUDGET = 32 * 1024;
const DIAGNOSTICS_LIMIT = 30;

const TEXT_BUDGET = 120 * 1024;

export const IAlaskaContextService = createDecorator<IAlaskaContextService>('alaskaContextService');

export interface IAlaskaContextService {
	readonly _serviceBrand: undefined;
	captureCurrent(): IAlaskaCodeContext;
	captureWorkspaceFiles(): Promise<string[]>;
	hasProjectRules(): boolean;
	readonly onDidChangeProjectRules: Event<void>;
}

interface IFolderRulesSlot {
	readonly uri: URI;
	readonly folderName: string;
	content: string;
}

export class AlaskaContextService extends Disposable implements IAlaskaContextService {
	declare readonly _serviceBrand: undefined;

	private projectRules: string | undefined;
	private readonly folderRules = new Map<string, IFolderRulesSlot>();
	private readonly rulesWatchers = this._register(new DisposableStore());
	private readonly _onDidChangeProjectRules = this._register(new Emitter<void>());
	readonly onDidChangeProjectRules: Event<void> = this._onDidChangeProjectRules.event;
	private remoteOs: OperatingSystem | undefined;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
	) {
		super();
		this.refreshRulesWatcher();
		void this.refreshRemoteOs();
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => {
			this.refreshRulesWatcher();
			void this.refreshRemoteOs();
		}));
	}

	private async refreshRemoteOs(): Promise<void> {
		const root = this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root || root.scheme !== Schemas.alaskacodeRemote) {
			this.remoteOs = undefined;
			return;
		}
		try {
			const env = await this.remoteAgentService.getEnvironment();
			this.remoteOs = env?.os;
		} catch {
			this.remoteOs = undefined;
		}
	}

	hasProjectRules(): boolean {
		return !!this.projectRules;
	}

	private refreshRulesWatcher(): void {
		this.rulesWatchers.clear();
		const previous = this.projectRules;
		this.folderRules.clear();
		this.projectRules = undefined;
		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			if (previous) {
				this._onDidChangeProjectRules.fire();
			}
			return;
		}
		for (const folder of folders) {
			const uri = joinPath(folder.uri, PROJECT_RULES_FILENAME);
			const key = folder.uri.toString();
			this.folderRules.set(key, { uri, folderName: folder.name, content: '' });
			void this.loadProjectRulesForFolder(key);
			try {
				const watcher = this.fileService.createWatcher(uri, { recursive: false, excludes: [] });
				const onChange = watcher.onDidChange(() => { void this.loadProjectRulesForFolder(key); });
				this.rulesWatchers.add({
					dispose: () => {
						onChange.dispose();
						watcher.dispose();
					},
				});
			} catch {
			}
		}
	}

	private async loadProjectRulesForFolder(folderKey: string): Promise<void> {
		const slot = this.folderRules.get(folderKey);
		if (!slot) {
			return;
		}
		const before = this.projectRules;
		try {
			if (!(await this.fileService.exists(slot.uri))) {
				slot.content = '';
			} else {
				const file = await this.fileService.readFile(slot.uri);
				const text = file.value.toString();
				slot.content = text.length > PROJECT_RULES_BYTE_BUDGET ? text.slice(0, PROJECT_RULES_BYTE_BUDGET) : text;
			}
		} catch {
			slot.content = '';
		}
		this.projectRules = this.composeProjectRules();
		if (before !== this.projectRules) {
			this._onDidChangeProjectRules.fire();
		}
	}

	private composeProjectRules(): string | undefined {
		const populated: IFolderRulesSlot[] = [];
		for (const folder of this.workspaceService.getWorkspace().folders) {
			const slot = this.folderRules.get(folder.uri.toString());
			if (slot && slot.content.trim()) {
				populated.push(slot);
			}
		}
		if (populated.length === 0) {
			return undefined;
		}
		if (populated.length === 1) {
			return populated[0].content;
		}
		return populated
			.map(slot => `## Rules for ${slot.folderName}\n\n${slot.content.trim()}`)
			.join('\n\n---\n\n');
	}

	captureCurrent(): IAlaskaCodeContext {
		const ctrl = this.editorService.activeTextEditorControl ?? this.editorService.visibleTextEditorControls[0];
		const editor = isDiffEditor(ctrl) ? ctrl.getModifiedEditor() : isCodeEditor(ctrl) ? ctrl : undefined;
		const model = editor?.getModel() ?? undefined;

		const ctx: {
			filePath?: string;
			languageId?: string;
			fullText?: string;
			selection?: IAlaskaCodeSelection;
			workspaceName?: string;
			workspaceRoot?: string;
			hostOs?: 'windows' | 'linux' | 'macos';
			remoteAuthority?: string;
			openFiles?: string[];
			projectRules?: string;
			diagnostics?: IAlaskaCodeDiagnostic[];
		} = {};

		if (this.projectRules) {
			ctx.projectRules = this.projectRules;
		}

		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length > 0) {
			ctx.workspaceName = folders[0].name;
			ctx.workspaceRoot = folders[0].uri.path;
			const rootUri = folders[0].uri;
			if (rootUri.scheme === Schemas.alaskacodeRemote && rootUri.authority) {
				ctx.remoteAuthority = rootUri.authority;
			}
		}

		ctx.hostOs = osLabelFor(this.remoteOs ?? OS);

		const openFiles = this.editorService.editors
			.map(editor => EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY }))
			.filter((uri): uri is URI => !!uri)
			.map(uri => this.asWorkspacePath(uri))
			.filter((path, index, all) => all.indexOf(path) === index);
		if (openFiles.length > 0) {
			ctx.openFiles = openFiles.slice(0, 30);
		}

		if (!model) {
			return ctx;
		}

		const uri = model.uri;
		if (folders.length > 0) {
			const folderPath = folders[0].uri.path;
			if (uri.path.startsWith(folderPath + '/')) {
				ctx.filePath = uri.path.slice(folderPath.length + 1);
			}
		}
		if (!ctx.filePath) {
			ctx.filePath = uri.path;
		}

		ctx.languageId = model.getLanguageId();

		const sel = editor?.getSelection();
		if (sel && !sel.isEmpty()) {
			ctx.selection = {
				startLine: sel.startLineNumber,
				endLine: sel.endLineNumber,
				text: model.getValueInRange(sel),
			};
		}

		const total = model.getValueLength();
		if (total <= TEXT_BUDGET) {
			ctx.fullText = model.getValue();
		} else {
			ctx.fullText = model.getValue().slice(0, TEXT_BUDGET) + `\n\n/* …${total - TEXT_BUDGET} bytes truncated by Xipher IDE… */`;
		}

		const diagnostics = this.collectDiagnostics(uri);
		if (diagnostics.length > 0) {
			ctx.diagnostics = diagnostics;
		}

		return ctx;
	}

	private collectDiagnostics(resource: URI): IAlaskaCodeDiagnostic[] {
		try {
			const all = this.markerService.read({ resource, severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info | MarkerSeverity.Hint });
			const sorted = all.slice().sort((a, b) => b.severity - a.severity || a.startLineNumber - b.startLineNumber);
			return sorted.slice(0, DIAGNOSTICS_LIMIT).map((m): IAlaskaCodeDiagnostic => ({
				line: m.startLineNumber,
				column: m.startColumn,
				severity: severityToLabel(m.severity),
				source: m.source,
				message: m.message,
			}));
		} catch {
			return [];
		}
	}

	async captureWorkspaceFiles(): Promise<string[]> {
		const folder = this.workspaceService.getWorkspace().folders[0];
		if (!folder) {
			return [];
		}

		const out: string[] = [];
		const walk = async (resource: URI, depth: number): Promise<void> => {
			if (out.length >= 350 || depth > 7) {
				return;
			}
			let stat: IFileStat;
			try {
				stat = await this.fileService.resolve(resource);
			} catch {
				return;
			}
			const children = stat.children ?? [];
			children.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
			for (const child of children) {
				if (out.length >= 350 || shouldSkipPath(child.name)) {
					continue;
				}
				const rel = this.asWorkspacePath(child.resource);
				out.push(child.isDirectory ? `${rel}/` : rel);
				if (child.isDirectory) {
					await walk(child.resource, depth + 1);
				}
			}
		};

		await walk(folder.uri, 0);
		return out;
	}

	private asWorkspacePath(uri: URI): string {
		const folders = this.workspaceService.getWorkspace().folders;
		for (const folder of folders) {
			if (uri.path.startsWith(folder.uri.path + '/')) {
				return uri.path.slice(folder.uri.path.length + 1);
			}
		}
		return uri.path;
	}
}

function osLabelFor(os: OperatingSystem): 'windows' | 'linux' | 'macos' {
	switch (os) {
		case OperatingSystem.Windows: return 'windows';
		case OperatingSystem.Macintosh: return 'macos';
		default: return 'linux';
	}
}

function severityToLabel(severity: MarkerSeverity): 'error' | 'warning' | 'info' | 'hint' {
	switch (severity) {
		case MarkerSeverity.Error: return 'error';
		case MarkerSeverity.Warning: return 'warning';
		case MarkerSeverity.Info: return 'info';
		case MarkerSeverity.Hint: return 'hint';
		default: return 'info';
	}
}

function shouldSkipPath(name: string): boolean {
	return name === '.git'
		|| name === 'node_modules'
		|| name === 'out'
		|| name === '.build'
		|| name === 'dist'
		|| name === 'coverage'
		|| name.endsWith('.png')
		|| name.endsWith('.jpg')
		|| name.endsWith('.jpeg')
		|| name.endsWith('.gif')
		|| name.endsWith('.webp')
		|| name.endsWith('.ico');
}
