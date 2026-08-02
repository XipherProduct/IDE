/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaIndexState =
	| 'disabled'
	| 'unauthenticated'
	| 'idle'
	| 'scanning'
	| 'embedding'
	| 'uploading'
	| 'error';

export interface IAlaskaIndexProgress {
	readonly state: AlaskaIndexState;
	readonly filesIndexed: number;
	readonly filesTotal: number;
	readonly chunksUpserted: number;
	readonly chunkCount: number;
	readonly bytesUsed: number;
	readonly lastIndexedAt?: number;
	readonly errorMessage?: string;
	readonly workspaceId?: string;
}

export interface IAlaskaIndexSearchHit {
	readonly filePath: string;
	readonly uri: URI;
	readonly startLine: number;
	readonly endLine: number;
	readonly symbolName?: string;
	readonly symbolKind?: string;
	readonly content: string;
	readonly score: number;
}

export interface IAlaskaIndexSearchOptions {
	readonly topK?: number;
	readonly fileFilter?: readonly string[];
}

export const IAlaskaIndexService = createDecorator<IAlaskaIndexService>('alaskaIndexService');

export interface IAlaskaIndexService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeProgress: Event<IAlaskaIndexProgress>;
	readonly progress: IAlaskaIndexProgress;

	bootstrap(workspaceUri: URI, token: CancellationToken): Promise<void>;
	stop(): Promise<void>;
	searchRelevant(query: string, opts: IAlaskaIndexSearchOptions, token: CancellationToken): Promise<readonly IAlaskaIndexSearchHit[]>;
	forceReindex(token: CancellationToken): Promise<void>;
	clearWorkspaceIndex(): Promise<void>;
	getWorkspaceId(workspaceUri: URI): string | undefined;
}
