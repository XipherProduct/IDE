/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IExportableImage {
	readonly name: string;
	readonly mime: string;
	readonly bytes: number;
}

export interface IExportableToolActivity {
	readonly name: string;
	readonly target?: string;
	readonly status: 'running' | 'ok' | 'err' | 'skipped';
	readonly summary?: string;
}

export interface IExportableMessage {
	readonly role: 'user' | 'assistant' | 'error';
	readonly content: string;
	readonly createdAt?: number;
	readonly reasoning?: string;
	readonly edited?: boolean;
	readonly toolActivities?: readonly IExportableToolActivity[];
	readonly images?: readonly IExportableImage[];
}

export interface IExportableSession {
	readonly id: string;
	readonly title: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly messages: readonly IExportableMessage[];
}

export const ALASKA_SESSION_EXPORT_VERSION = 1;

export function exportSessionAsJSON(session: IExportableSession): string {
	const sanitized = {
		version: ALASKA_SESSION_EXPORT_VERSION,
		id: session.id,
		title: session.title,
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		messages: session.messages.map(m => ({
			role: m.role,
			content: m.content,
			createdAt: m.createdAt,
			reasoning: m.reasoning,
			edited: m.edited,
			toolActivities: m.toolActivities?.map(a => ({
				name: a.name,
				target: a.target,
				status: a.status,
				summary: a.summary,
			})),
			images: m.images?.map(i => ({ name: i.name, mime: i.mime, bytes: i.bytes })),
		})),
	};
	return JSON.stringify(sanitized, null, 2);
}

export function exportSessionAsMarkdown(session: IExportableSession): string {
	const lines: string[] = [
		`# ${session.title || 'Alaska AI thread'}`,
		`_Created: ${new Date(session.createdAt).toISOString()}_`,
		`_Updated: ${new Date(session.updatedAt).toISOString()}_`,
		'',
		'---',
		'',
	];
	for (const m of session.messages) {
		const author = m.role === 'user' ? 'You' : m.role === 'assistant' ? 'Alaska' : 'Error';
		const ts = m.createdAt ? new Date(m.createdAt).toISOString() : '';
		const editedMark = m.edited ? ' _(edited)_' : '';
		lines.push(`## ${author}${ts ? ` · ${ts}` : ''}${editedMark}`);
		lines.push('');
		if (m.reasoning) {
			lines.push('<details><summary>Reasoning</summary>');
			lines.push('');
			lines.push('```');
			lines.push(m.reasoning);
			lines.push('```');
			lines.push('');
			lines.push('</details>');
			lines.push('');
		}
		if (m.toolActivities && m.toolActivities.length > 0) {
			lines.push('**Tool calls:**');
			for (const a of m.toolActivities) {
				const status = activityStatusMark(a.status);
				const target = a.target ? ` · ${a.target}` : '';
				const summary = a.summary ? ` — ${a.summary}` : '';
				lines.push(`- ${status} \`${a.name}\`${target}${summary}`);
			}
			lines.push('');
		}
		if (m.images && m.images.length > 0) {
			for (const img of m.images) {
				lines.push(`![${img.name}](attachment:${img.name})`);
			}
			lines.push('');
		}
		lines.push(m.content || '');
		lines.push('');
		lines.push('---');
		lines.push('');
	}
	return lines.join('\n').trimEnd() + '\n';
}

export function slugifySessionTitle(title: string): string {
	const lower = (title || '').toLowerCase();
	const ascii = lower.normalize('NFKD').replace(/[̀-ͯ]/g, '');
	const cleaned = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	const trimmed = cleaned.slice(0, 60);
	return trimmed || 'session';
}

function activityStatusMark(status: IExportableToolActivity['status']): string {
	switch (status) {
		// allow-any-unicode-next-line
		case 'ok': return '✓';
		// allow-any-unicode-next-line
		case 'err': return '✗';
		// allow-any-unicode-next-line
		case 'skipped': return '⊘';
		// allow-any-unicode-next-line
		default: return '⟳';
	}
}
