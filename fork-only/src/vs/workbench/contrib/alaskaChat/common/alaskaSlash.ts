/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaSlashCategory = 'session' | 'workflow' | 'export' | 'utility';

export interface IAlaskaSlashArg {
	readonly name: string;
	readonly description: string;
	readonly required: boolean;
}

export interface IAlaskaSlashContext {
	readonly services: ServicesAccessor;
	newSession(): Promise<void>;
	submitUserMessage(text: string): Promise<void>;
	injectAssistantMessage(markdown: string): void;
	exportActiveSessionAsMarkdown(): string;
	insertIntoComposer(text: string, focus?: boolean): void;
}

export interface IAlaskaSlashCommand {
	readonly id: string;
	readonly trigger: string;
	readonly label: string;
	readonly description: string;
	readonly category: AlaskaSlashCategory;
	readonly iconId?: string;
	readonly args?: readonly IAlaskaSlashArg[];
	run(ctx: IAlaskaSlashContext, rawArgs: string): Promise<void>;
}

export const IAlaskaSlashCommandService = createDecorator<IAlaskaSlashCommandService>('alaskaSlashCommandService');

export interface IAlaskaSlashCommandService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	register(command: IAlaskaSlashCommand): IDisposable;
	list(): readonly IAlaskaSlashCommand[];
	match(input: string): readonly IAlaskaSlashCommand[];
	get(trigger: string): IAlaskaSlashCommand | undefined;
	execute(input: string, ctx: IAlaskaSlashContext): Promise<boolean>;
}

export function parseSlashInvocation(input: string): { trigger: string; args: string } | undefined {
	const trimmed = input.trimStart();
	if (!trimmed.startsWith('/')) { return undefined; }
	const firstWs = trimmed.search(/\s/);
	if (firstWs < 0) {
		return { trigger: trimmed, args: '' };
	}
	return { trigger: trimmed.slice(0, firstWs), args: trimmed.slice(firstWs + 1).trim() };
}
