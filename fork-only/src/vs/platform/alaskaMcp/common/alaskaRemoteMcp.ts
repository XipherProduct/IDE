/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';

export const ALASKA_REMOTE_MCP_CHANNEL = 'alaskaRemoteMcp';

export interface IRemoteMcpLaunchArgs {
	readonly id: string;
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd?: string;
	readonly env?: Readonly<Record<string, string>>;
}

export interface IRemoteMcpLaunchResult {
	readonly sessionId: string;
}

export interface IRemoteMcpStdoutEvent {
	readonly sessionId: string;
	readonly line: string;
}

export interface IRemoteMcpExitEvent {
	readonly sessionId: string;
	readonly exitCode: number | null;
	readonly reason?: string;
}

export interface IAlaskaRemoteMcpServer {
	launchServer(args: IRemoteMcpLaunchArgs): Promise<IRemoteMcpLaunchResult>;
	sendMessage(sessionId: string, line: string): Promise<void>;
	terminate(sessionId: string): Promise<void>;
	listSessions(): Promise<readonly string[]>;
	readonly onStdoutLine: Event<IRemoteMcpStdoutEvent>;
	readonly onExit: Event<IRemoteMcpExitEvent>;
}
