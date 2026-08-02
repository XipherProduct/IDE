/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableMap, IDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IFileService, FileChangesEvent, IFileStat } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IAlaskaAuthService, ALASKA_API_BASE } from './alaskaAuthService.js';
import { IAlaskaIndexService, IAlaskaIndexProgress, IAlaskaIndexSearchHit, IAlaskaIndexSearchOptions } from './alaskaIndex.js';
import { abortSignalFrom, base64ToBytes, buildSignedHeaders, bytesToBase64, parseAlaskaApiError } from './alaskaApiClient.js';
import { chunkFile, isLikelyBinary, approxTokenCount } from './alaskaIndexChunker.js';
import { deriveIndexKey, encryptIndexChunk, decryptIndexChunk } from './alaskaIndexCrypto.js';
import { IAlaskaMetricsService } from '../common/alaskaMetrics.js';

const STORAGE_INSTALL_ID_KEY = 'alaska.installId';
const STORAGE_WORKSPACE_ID_PREFIX = 'alaska.index.workspaceId:';
const STORAGE_INDEX_ENABLED_KEY = 'alaska.index.enabled';

const MAX_FILE_BYTES = 256 * 1024;
const MAX_CHUNK_TOKENS = 1500;
const UPSERT_BATCH = 50;
const EMBED_BATCH = 50;
const WALK_CONCURRENCY = 4;
const REINDEX_DEBOUNCE_MS = 1500;
const PROGRESS_THROTTLE_MS = 250;

const EXCLUDED_DIR_NAMES = new Set([
	'.git', '.svn', '.hg', '.idea', '.vscode-test',
	'node_modules', 'bower_components', 'jspm_packages',
	'out', 'dist', 'build', '.build', '.next', '.nuxt',
	'.cache', '.parcel-cache', '.turbo', '.expo',
	'vendor', 'target', 'bin', 'obj',
	'.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache',
	'coverage', '.nyc_output', '.terraform',
	'.gradle', '.dart_tool',
]);

const EXCLUDED_FILE_SUFFIXES = new Set([
	'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.icns', '.tif', '.tiff',
	'.pdf', '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar',
	'.mp3', '.mp4', '.wav', '.ogg', '.flac', '.mov', '.avi', '.mkv', '.webm',
	'.woff', '.woff2', '.ttf', '.otf', '.eot',
	'.exe', '.dll', '.so', '.dylib', '.bin', '.class', '.jar', '.wasm',
	'.lock', '.snap', '.pyc',
]);

const INCLUDED_EXTENSIONS = new Set<string>([
	'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'd.ts',
	'go', 'rs', 'py', 'rb', 'java', 'kt', 'kts', 'swift', 'scala', 'groovy',
	'c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx', 'cs',
	'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'astro',
	'json', 'jsonc', 'yml', 'yaml', 'toml', 'xml', 'ini', 'env',
	'md', 'mdx', 'rst', 'txt',
	'sql', 'proto', 'graphql', 'gql',
	'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
	'tf', 'hcl', 'ex', 'exs', 'erl', 'hs', 'lua', 'r', 'pl', 'pm', 'dart', 'nim', 'zig',
]);

interface IPendingChunkPayload {
	chunk_id: string;
	file_path: string;
	embedding: number[];
	ciphertext: string;
	iv: string;
	content_hash: string;
	symbol_name?: string;
	symbol_kind?: string;
	start_line: number;
	end_line: number;
	token_count: number;
}

interface IBackendHit {
	chunk_id: string;
	file_path: string;
	start_line: number;
	end_line: number;
	symbol_name?: string;
	symbol_kind?: string;
	ciphertext: string;
	iv: string;
	score: number;
}

interface IBackendStatus {
	workspace_id: string;
	owned: boolean;
	chunk_count: number;
	bytes_used: number;
	last_indexed_at?: string | null;
	embedding_dims: number;
}

export class AlaskaIndexService extends Disposable implements IAlaskaIndexService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeProgress = this._register(new Emitter<IAlaskaIndexProgress>());
	readonly onDidChangeProgress: Event<IAlaskaIndexProgress> = this._onDidChangeProgress.event;

	private _progress: IAlaskaIndexProgress = {
		state: 'idle',
		filesIndexed: 0,
		filesTotal: 0,
		chunksUpserted: 0,
		chunkCount: 0,
		bytesUsed: 0,
	};
	get progress(): IAlaskaIndexProgress { return this._progress; }

	private workspaceUri: URI | undefined;
	private workspaceId: string | undefined;
	private workspaceKey: CryptoKey | undefined;
	private bootstrapToken: CancellationTokenSource | undefined;
	private fileWatchersDisposed = false;
	private readonly debouncedReindex = this._register(new DisposableMap<string, IDisposable>());
	private pendingFlushRunning = false;
	private upsertQueue: IPendingChunkPayload[] = [];
	private lastProgressEmit = 0;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IStorageService private readonly storageService: IStorageService,
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@ILogService private readonly logService: ILogService,
		@IAlaskaMetricsService private readonly metricsService: IAlaskaMetricsService,
	) {
		super();
		this._register({
			dispose: () => {
				void this.stop();
			},
		});
		this._register(this.authService.onDidChangeState(state => {
			if (state.status === 'signed-out' && this._progress.state !== 'disabled') {
				this.setProgress({ ...this._progress, state: 'unauthenticated' });
				void this.stop();
			}
		}));
	}

	getWorkspaceId(workspaceUri: URI): string | undefined {
		const key = STORAGE_WORKSPACE_ID_PREFIX + workspaceUri.toString();
		let id = this.storageService.get(key, StorageScope.APPLICATION);
		if (!id) {
			id = generateUuid();
			this.storageService.store(key, id, StorageScope.APPLICATION, StorageTarget.MACHINE);
		}
		return id;
	}

	private isEnabled(): boolean {
		return this.storageService.getBoolean(STORAGE_INDEX_ENABLED_KEY, StorageScope.APPLICATION, true);
	}

	async bootstrap(workspaceUri: URI, token: CancellationToken): Promise<void> {
		if (!this.isEnabled()) {
			this.setProgress({ ...this._progress, state: 'disabled' });
			return;
		}
		const auth = this.authService.state;
		if (auth.status !== 'signed-in' || !auth.user) {
			this.setProgress({ ...this._progress, state: 'unauthenticated' });
			return;
		}

		this.workspaceUri = workspaceUri;
		this.workspaceId = this.getWorkspaceId(workspaceUri);
		try {
			this.workspaceKey = await this.deriveWorkspaceKey();
		} catch (err) {
			this.logService.warn('[alaska.index] derive key failed', err);
			this.setProgress({ ...this._progress, state: 'error', errorMessage: 'Failed to derive workspace key' });
			return;
		}

		this.bootstrapToken?.dispose();
		const inner = new CancellationTokenSource(token);
		this.bootstrapToken = inner;

		try {
			const status = await this.fetchStatus(inner.token).catch(err => {
				this.logService.warn('[alaska.index] status fetch failed', err);
				return undefined;
			});
			if (status) {
				this.setProgress({
					...this._progress,
					state: 'idle',
					chunkCount: status.chunk_count,
					bytesUsed: status.bytes_used,
					lastIndexedAt: status.last_indexed_at ? Date.parse(status.last_indexed_at) : undefined,
					workspaceId: this.workspaceId,
				});
			}

			const needsInitialIndex = !status || status.chunk_count === 0;
			if (needsInitialIndex) {
				await this.fullReindex(inner.token);
			}

			this.installFileWatcher();
		} catch (err) {
			this.logService.warn('[alaska.index] bootstrap failed', err);
			this.setProgress({ ...this._progress, state: 'error', errorMessage: err instanceof Error ? err.message : String(err) });
		}
	}

	async stop(): Promise<void> {
		this.bootstrapToken?.dispose(true);
		this.bootstrapToken = undefined;
		this.debouncedReindex.clearAndDisposeAll();
		this.upsertQueue.length = 0;
		this.fileWatchersDisposed = true;
		this.workspaceKey = undefined;
	}

	async forceReindex(token: CancellationToken): Promise<void> {
		if (!this.workspaceUri) { return; }
		const inner = new CancellationTokenSource(token);
		try {
			await this.fullReindex(inner.token);
		} finally {
			inner.dispose(true);
		}
	}

	async clearWorkspaceIndex(): Promise<void> {
		if (!this.workspaceUri || !this.workspaceId) { return; }
		await this.signedRequest('DELETE', `/api/index/workspace?workspace_id=${encodeURIComponent(this.workspaceId)}`, undefined, CancellationToken.None);
		this.setProgress({
			...this._progress,
			chunkCount: 0,
			bytesUsed: 0,
			chunksUpserted: 0,
			filesIndexed: 0,
			filesTotal: 0,
			lastIndexedAt: undefined,
			state: 'idle',
			errorMessage: undefined,
		});
	}

	async searchRelevant(query: string, opts: IAlaskaIndexSearchOptions, token: CancellationToken): Promise<readonly IAlaskaIndexSearchHit[]> {
		if (!this.workspaceUri || !this.workspaceId || !this.workspaceKey) { return []; }
		const trimmed = query.trim();
		if (!trimmed) { return []; }

		const startedAt = performance.now();
		let queryVec: number[];
		try {
			const vecs = await this.embed([trimmed], token);
			if (vecs.length !== 1) { return []; }
			queryVec = vecs[0];
		} catch (err) {
			this.logService.warn('[alaska.index] embed query failed', err);
			this.metricsService.counter('alaska.index.search_errors', 1, { phase: 'embed' });
			return [];
		}

		const payload = JSON.stringify({
			workspace_id: this.workspaceId,
			query: queryVec,
			top_k: Math.min(Math.max(opts.topK ?? 20, 1), 50),
			file_filter: opts.fileFilter,
		});
		let body: { hits?: IBackendHit[] };
		try {
			body = await this.signedRequest('POST', '/api/index/search', payload, token);
		} catch (err) {
			this.logService.warn('[alaska.index] search failed', err);
			this.metricsService.counter('alaska.index.search_errors', 1, { phase: 'search' });
			return [];
		}
		const hits = body.hits ?? [];

		const decrypted: IAlaskaIndexSearchHit[] = [];
		for (const h of hits) {
			try {
				const ct = base64ToBytes(h.ciphertext);
				const iv = base64ToBytes(h.iv);
				const content = await this.decrypt(ct, iv);
				decrypted.push({
					filePath: h.file_path,
					uri: URI.joinPath(this.workspaceUri, h.file_path),
					startLine: h.start_line,
					endLine: h.end_line,
					symbolName: h.symbol_name || undefined,
					symbolKind: h.symbol_kind || undefined,
					content,
					score: h.score,
				});
			} catch (err) {
				this.logService.warn('[alaska.index] decrypt hit failed', err);
			}
		}
		this.metricsService.histogram('alaska.index.search_ms', performance.now() - startedAt, {
			topK: String(opts.topK ?? 20),
			hits: decrypted.length > 0 ? 'some' : 'none',
		});
		return decrypted;
	}

	private async fullReindex(token: CancellationToken): Promise<void> {
		if (!this.workspaceUri) { return; }
		this.setProgress({
			...this._progress,
			state: 'scanning',
			filesIndexed: 0,
			filesTotal: 0,
			chunksUpserted: 0,
			errorMessage: undefined,
		});

		const files = await this.walkWorkspace(this.workspaceUri, token);
		if (token.isCancellationRequested) { return; }
		this.setProgress({ ...this._progress, filesTotal: files.length, state: 'embedding' });

		const queue = [...files];
		const workers: Promise<void>[] = [];
		for (let w = 0; w < WALK_CONCURRENCY; w++) {
			workers.push(this.workerLoop(queue, token));
		}
		await Promise.all(workers);
		await this.flushUpserts(token);

		if (token.isCancellationRequested) { return; }
		this.setProgress({ ...this._progress, state: 'idle', lastIndexedAt: Date.now() });

		const status = await this.fetchStatus(token).catch(() => undefined);
		if (status) {
			this.setProgress({
				...this._progress,
				chunkCount: status.chunk_count,
				bytesUsed: status.bytes_used,
			});
		}
	}

	private async workerLoop(queue: URI[], token: CancellationToken): Promise<void> {
		while (queue.length > 0 && !token.isCancellationRequested) {
			const uri = queue.shift();
			if (!uri) { break; }
			try {
				await this.indexFile(uri, token);
			} catch (err) {
				this.logService.warn(`[alaska.index] failed ${uri.toString()}`, err);
			}
			this.setProgress({ ...this._progress, filesIndexed: this._progress.filesIndexed + 1 });
			await yieldToMicrotask();
		}
	}

	private async indexFile(uri: URI, token: CancellationToken): Promise<void> {
		const stat = await this.fileService.stat(uri).catch(() => undefined);
		if (!stat || stat.size > MAX_FILE_BYTES) { return; }

		const file = await this.fileService.readFile(uri).catch(() => undefined);
		if (!file) { return; }
		const text = file.value.toString();
		if (!text.trim() || isLikelyBinary(text)) { return; }

		const chunks = chunkFile(uri.fsPath, text, MAX_CHUNK_TOKENS);
		if (chunks.length === 0) { return; }

		const texts = chunks.map(c => c.content);
		let vectors: number[][];
		try {
			vectors = await this.embedInBatches(texts, token);
		} catch (err) {
			this.logService.warn('[alaska.index] embed batch failed', err);
			return;
		}
		if (vectors.length !== chunks.length) { return; }

		const relPath = this.relPath(uri);
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];
			const { ciphertext, iv } = await this.encrypt(chunk.content);
			const hash = await sha256Hex(chunk.content);
			this.upsertQueue.push({
				chunk_id: `${relPath}#${chunk.startLine}-${chunk.endLine}`,
				file_path: relPath,
				embedding: vectors[i],
				ciphertext: bytesToBase64(ciphertext),
				iv: bytesToBase64(iv),
				content_hash: hash,
				symbol_name: chunk.symbolName,
				symbol_kind: chunk.symbolKind,
				start_line: chunk.startLine,
				end_line: chunk.endLine,
				token_count: chunk.tokenCount,
			});
			if (this.upsertQueue.length >= UPSERT_BATCH) {
				await this.flushUpserts(token);
			}
		}
	}

	private async embedInBatches(inputs: string[], token: CancellationToken): Promise<number[][]> {
		if (inputs.length === 0) { return []; }
		const out: number[][] = [];
		for (let i = 0; i < inputs.length; i += EMBED_BATCH) {
			const slice = inputs.slice(i, i + EMBED_BATCH);
			const vecs = await this.embed(slice, token);
			for (const v of vecs) {
				out.push(v);
			}
		}
		return out;
	}

	private async embed(inputs: string[], token: CancellationToken): Promise<number[][]> {
		const body = JSON.stringify({ input: inputs });
		const resp = await this.signedRequest<{ embeddings: number[][] }>('POST', '/api/ai/embeddings', body, token);
		return resp.embeddings ?? [];
	}

	private async flushUpserts(token: CancellationToken): Promise<void> {
		if (this.pendingFlushRunning) {
			while (this.pendingFlushRunning) {
				await yieldToMicrotask();
				if (token.isCancellationRequested) { return; }
			}
		}
		if (this.upsertQueue.length === 0) { return; }
		this.pendingFlushRunning = true;
		try {
			while (this.upsertQueue.length > 0 && !token.isCancellationRequested) {
				const batch = this.upsertQueue.splice(0, UPSERT_BATCH);
				const payload = JSON.stringify({
					workspace_id: this.workspaceId,
					chunks: batch,
				});
				this.setProgress({ ...this._progress, state: 'uploading' });
				try {
					await this.signedRequest<{ written: number }>('POST', '/api/index/upsert', payload, token);
					this.setProgress({
						...this._progress,
						chunksUpserted: this._progress.chunksUpserted + batch.length,
					});
				} catch (err) {
					this.logService.warn('[alaska.index] upsert batch failed', err);
				}
				await yieldToMicrotask();
			}
			this.setProgress({ ...this._progress, state: this._progress.filesIndexed === this._progress.filesTotal && this._progress.filesTotal > 0 ? 'idle' : this._progress.state });
		} finally {
			this.pendingFlushRunning = false;
		}
	}

	private installFileWatcher(): void {
		if (this.fileWatchersDisposed) { return; }
		this._register(this.fileService.onDidFilesChange(e => this.handleFileChanges(e)));
	}

	private handleFileChanges(e: FileChangesEvent): void {
		if (!this.workspaceUri) { return; }
		const seen = new Set<string>();
		const consider = (uri: URI, deletion: boolean): void => {
			if (!this.isIndexable(uri)) { return; }
			if (!this.isInsideWorkspace(uri)) { return; }
			const key = uri.toString();
			if (seen.has(key)) { return; }
			seen.add(key);
			this.scheduleIncremental(uri, deletion);
		};
		for (const uri of e.rawDeleted) { consider(uri, true); }
		for (const uri of e.rawAdded) { consider(uri, false); }
		for (const uri of e.rawUpdated) { consider(uri, false); }
	}

	private scheduleIncremental(uri: URI, deletion: boolean): void {
		const key = uri.toString();
		this.debouncedReindex.deleteAndDispose(key);
		const handle = setTimeout(() => {
			this.debouncedReindex.deleteAndLeak(key);
			if (deletion) {
				void this.deleteFileFromIndex(uri);
			} else {
				const src = new CancellationTokenSource();
				void this.indexFile(uri, src.token)
					.then(() => this.flushUpserts(src.token))
					.finally(() => src.dispose());
			}
		}, REINDEX_DEBOUNCE_MS);
		this.debouncedReindex.set(key, { dispose: () => clearTimeout(handle) });
	}

	private async deleteFileFromIndex(uri: URI): Promise<void> {
		if (!this.workspaceId) { return; }
		const rel = this.relPath(uri);
		try {
			await this.signedRequest('DELETE', `/api/index/file?workspace_id=${encodeURIComponent(this.workspaceId)}&file_path=${encodeURIComponent(rel)}`, undefined, CancellationToken.None);
		} catch (err) {
			this.logService.warn('[alaska.index] delete file failed', err);
		}
	}

	private async walkWorkspace(root: URI, token: CancellationToken): Promise<URI[]> {
		const result: URI[] = [];
		const queue: URI[] = [root];
		while (queue.length > 0 && !token.isCancellationRequested) {
			const uri = queue.shift()!;
			let stat: IFileStat;
			try {
				stat = await this.fileService.resolve(uri);
			} catch {
				continue;
			}
			if (!stat.isDirectory) {
				if (this.isIndexable(uri)) { result.push(uri); }
				continue;
			}
			const children = stat.children ?? [];
			for (const child of children) {
				if (child.isDirectory) {
					if (this.shouldSkipDir(child.name)) { continue; }
					queue.push(child.resource);
				} else {
					if (this.isIndexable(child.resource)) {
						result.push(child.resource);
					}
				}
			}
			if (result.length % 200 === 0) {
				await yieldToMicrotask();
			}
		}
		return result;
	}

	private shouldSkipDir(name: string): boolean {
		if (name.startsWith('.') && EXCLUDED_DIR_NAMES.has(name)) { return true; }
		return EXCLUDED_DIR_NAMES.has(name);
	}

	private isIndexable(uri: URI): boolean {
		const path = uri.path;
		const segments = path.split('/');
		for (const seg of segments) {
			if (EXCLUDED_DIR_NAMES.has(seg)) { return false; }
		}
		const name = segments[segments.length - 1] ?? '';
		const lowerName = name.toLowerCase();
		const dot = lowerName.lastIndexOf('.');
		if (dot < 0) { return false; }
		const ext = lowerName.slice(dot);
		if (EXCLUDED_FILE_SUFFIXES.has(ext)) { return false; }
		const pureExt = lowerName.slice(dot + 1);
		return INCLUDED_EXTENSIONS.has(pureExt);
	}

	private isInsideWorkspace(uri: URI): boolean {
		if (!this.workspaceUri) { return false; }
		return uri.path === this.workspaceUri.path || uri.path.startsWith(this.workspaceUri.path + '/');
	}

	private relPath(uri: URI): string {
		if (!this.workspaceUri) { return uri.path; }
		const rootPath = this.workspaceUri.path;
		if (uri.path.startsWith(rootPath + '/')) {
			return uri.path.slice(rootPath.length + 1);
		}
		return uri.path;
	}

	private setProgress(next: IAlaskaIndexProgress): void {
		this._progress = next;
		const now = Date.now();
		if (now - this.lastProgressEmit < PROGRESS_THROTTLE_MS && next.state !== 'idle' && next.state !== 'error') {
			return;
		}
		this.lastProgressEmit = now;
		this._onDidChangeProgress.fire(next);
	}

	private async fetchStatus(token: CancellationToken): Promise<IBackendStatus | undefined> {
		if (!this.workspaceId) { return undefined; }
		try {
			return await this.signedRequest<IBackendStatus>('GET', `/api/index/status?workspace_id=${encodeURIComponent(this.workspaceId)}`, undefined, token);
		} catch (err) {
			this.logService.warn('[alaska.index] status fetch failed', err);
			return undefined;
		}
	}

	private async deriveWorkspaceKey(): Promise<CryptoKey> {
		const user = this.authService.state.user;
		if (!user || !this.workspaceId) {
			throw new Error('Not signed in');
		}
		const installId = this.storageService.get(STORAGE_INSTALL_ID_KEY, StorageScope.APPLICATION) ?? 'no-install';
		return deriveIndexKey({ installId, userId: user.id, workspaceId: this.workspaceId });
	}

	private async encrypt(plaintext: string): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
		if (!this.workspaceKey) { throw new Error('Workspace key unavailable'); }
		return encryptIndexChunk(this.workspaceKey, plaintext);
	}

	private async decrypt(ciphertext: Uint8Array, iv: Uint8Array): Promise<string> {
		if (!this.workspaceKey) { throw new Error('Workspace key unavailable'); }
		return decryptIndexChunk(this.workspaceKey, ciphertext, iv);
	}

	private async signedRequest<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body: string | undefined, token: CancellationToken): Promise<T> {
		await this.authService.getFreshAccessToken();
		const creds = await this.authService.getCredentials();
		const userId = this.authService.state.user?.id;
		if (!creds || !userId) {
			throw new Error('Not signed in');
		}
		const pathOnly = path.split('?')[0];
		const headers = await buildSignedHeaders(creds, userId, { method, path: pathOnly, body });
		const res = await fetch(`${ALASKA_API_BASE}${path}`, {
			method,
			headers,
			body,
			signal: abortSignalFrom(token),
		});
		if (res.status === 401) {
			try { await this.authService.signOut(); } catch { }
			throw new Error('Session expired');
		}
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(parseAlaskaApiError(res.status, text));
		}
		if (res.status === 204) { return undefined as unknown as T; }
		return res.json() as Promise<T>;
	}
}

function yieldToMicrotask(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

async function sha256Hex(text: string): Promise<string> {
	const enc = new TextEncoder().encode(text);
	const buf = new ArrayBuffer(enc.byteLength);
	new Uint8Array(buf).set(enc);
	const digest = await crypto.subtle.digest('SHA-256', buf);
	const bytes = new Uint8Array(digest);
	let out = '';
	for (let i = 0; i < bytes.length; i++) {
		out += bytes[i].toString(16).padStart(2, '0');
	}
	return out;
}

export const __testables = {
	approxTokenCount,
	chunkFile,
	isLikelyBinary,
};
