/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export interface IAlaskaSkill {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly triggers: readonly string[];
	readonly requiredTools: readonly string[];
	readonly body: string;
	readonly source: 'workspace' | 'global';
	readonly path: URI;
}

export const IAlaskaSkillService = createDecorator<IAlaskaSkillService>('alaskaSkillService');

export interface IAlaskaSkillService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;

	list(): readonly IAlaskaSkill[];
	get(name: string): IAlaskaSkill | undefined;
	findRelevant(userMessage: string, limit?: number): readonly IAlaskaSkill[];
	reload(): Promise<void>;
}

export function parseSkillFrontmatter(content: string): { meta: Record<string, string | string[]>; body: string } | undefined {
	const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) { return undefined; }
	const meta: Record<string, string | string[]> = {};
	const lines = match[1].split(/\r?\n/);
	for (const line of lines) {
		const m = line.match(/^([a-zA-Z_][\w\-]*)\s*:\s*(.+?)\s*$/);
		if (!m) { continue; }
		const key = m[1];
		const raw = m[2];
		if (raw.startsWith('[') && raw.endsWith(']')) {
			const inner = raw.slice(1, -1);
			meta[key] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
		} else {
			meta[key] = raw.replace(/^["']|["']$/g, '');
		}
	}
	return { meta, body: match[2].trim() };
}
