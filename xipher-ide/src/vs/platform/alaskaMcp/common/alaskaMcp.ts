/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IAlaskaMcpService = createDecorator<IAlaskaMcpService>('alaskaMcpService');

export type McpRunWhere = 'local' | 'remote';

export interface IMcpServerConfig {
	readonly id: string;
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd?: string;
	readonly env?: Readonly<Record<string, string>>;
	readonly runWhere?: McpRunWhere;
}

export interface IMcpToolInfo {
	readonly serverId: string;
	readonly originalName: string;
	readonly qualifiedName: string;
	readonly description: string;
	readonly inputSchema: Record<string, unknown>;
}

export interface IMcpServerStatus {
	readonly id: string;
	readonly state: 'idle' | 'starting' | 'ready' | 'error' | 'stopped';
	readonly upstream: string;
	readonly toolCount: number;
	readonly tools: readonly IMcpToolInfo[];
	readonly error?: string;
	readonly lastChangeAt: string;
}

export interface IMcpSnapshot {
	readonly servers: readonly IMcpServerStatus[];
	readonly allTools: readonly IMcpToolInfo[];
	readonly totalTools: number;
}

export interface IMcpCallResult {
	readonly ok: boolean;
	readonly content?: string;
	readonly isError?: boolean;
	readonly error?: string;
}

export interface IAlaskaMcpService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeStatus: Event<IMcpSnapshot>;

	getStatus(): Promise<IMcpSnapshot>;

	reload(servers: readonly IMcpServerConfig[]): Promise<IMcpSnapshot>;

	callTool(qualifiedName: string, args: Record<string, unknown>): Promise<IMcpCallResult>;

	stop(): Promise<void>;
}

export const ALASKA_MCP_CHANNEL = 'alaskaMcp';
