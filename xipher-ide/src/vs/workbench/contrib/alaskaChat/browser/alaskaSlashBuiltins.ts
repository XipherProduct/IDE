/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IAlaskaSlashCommand, IAlaskaSlashCommandService, IAlaskaSlashContext } from '../common/alaskaSlash.js';
import { IAlaskaSkillService } from '../common/alaskaSkill.js';
import { IAlaskaHunkTrackerService } from '../common/alaskaHunkTracker.js';
import { IAlaskaGoalService } from '../common/alaskaGoal.js';

export function registerAlaskaSlashBuiltins(service: IAlaskaSlashCommandService): IDisposable {
	const store = new DisposableStore();
	for (const cmd of buildBuiltins()) {
		store.add(service.register(cmd));
	}
	return store;
}

function buildBuiltins(): IAlaskaSlashCommand[] {
	return [
		{
			id: 'alaska.slash.clear',
			trigger: '/clear',
			label: localize('alaska.slash.clear.label', 'Clear chat'),
			description: localize('alaska.slash.clear.desc', 'Start a new thread, clearing current history'),
			category: 'session',
			iconId: 'clear-all',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				await ctx.newSession();
			},
		},
		{
			id: 'alaska.slash.help',
			trigger: '/help',
			label: localize('alaska.slash.help.label', 'Show help'),
			description: localize('alaska.slash.help.desc', 'List available slash commands and shortcuts'),
			category: 'utility',
			iconId: 'question',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				const all = ctx.services.get(IAlaskaSlashCommandService).list();
				const lines = ['## Slash commands', ''];
				for (const c of all) {
					lines.push(`- \`${c.trigger}\` — ${c.description}`);
				}
				ctx.injectAssistantMessage(lines.join('\n'));
			},
		},
		{
			id: 'alaska.slash.review',
			trigger: '/review',
			label: localize('alaska.slash.review.label', 'Review uncommitted changes'),
			description: localize('alaska.slash.review.desc', 'AI reviews git diff against HEAD'),
			category: 'workflow',
			iconId: 'git-pull-request',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				await ctx.submitUserMessage(
					'Run `git diff HEAD` via alaska_run_command. Then critique each hunk for correctness, security, performance, and style. Group issues by severity.'
				);
			},
		},
		{
			id: 'alaska.slash.summarize',
			trigger: '/summarize',
			label: localize('alaska.slash.summarize.label', 'Summarize this thread'),
			description: localize('alaska.slash.summarize.desc', 'AI summarises the conversation'),
			category: 'export',
			iconId: 'list-ordered',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				await ctx.submitUserMessage(
					'Summarize this conversation in 3-5 bullets: what we worked on, what was decided, what is pending.'
				);
			},
		},
		{
			id: 'alaska.slash.tests',
			trigger: '/tests',
			label: localize('alaska.slash.tests.label', 'Write tests for current file'),
			description: localize('alaska.slash.tests.desc', 'AI generates unit tests for the active editor'),
			category: 'workflow',
			iconId: 'beaker',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				const editorService = ctx.services.get(IEditorService);
				const uri = editorService.activeEditor?.resource;
				if (!uri) {
					ctx.services.get(INotificationService).warn(localize('alaska.slash.tests.noEditor', 'Open a file before /tests — there is no active editor.'));
					return;
				}
				await ctx.submitUserMessage(`Write unit tests for the active file (${uri.fsPath}). Use the project's existing test framework and place tests next to the source.`);
			},
		},
		{
			id: 'alaska.slash.explain',
			trigger: '/explain',
			label: localize('alaska.slash.explain.label', 'Explain current file'),
			description: localize('alaska.slash.explain.desc', 'AI explains the active file in plain language'),
			category: 'workflow',
			iconId: 'book',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				const editorService = ctx.services.get(IEditorService);
				const uri = editorService.activeEditor?.resource;
				if (!uri) {
					ctx.services.get(INotificationService).warn(localize('alaska.slash.explain.noEditor', 'Open a file before /explain — there is no active editor.'));
					return;
				}
				await ctx.submitUserMessage(`Read ${uri.fsPath} and explain what it does, its key abstractions, and how it fits in the larger codebase.`);
			},
		},
		{
			id: 'alaska.slash.hunks',
			trigger: '/hunks',
			label: localize('alaska.slash.hunks.label', 'Show change attribution'),
			description: localize('alaska.slash.hunks.desc', 'LOC changed this session, split agent vs human'),
			category: 'utility',
			iconId: 'diff',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				const summary = ctx.services.get(IAlaskaHunkTrackerService).summary();
				if (summary.totalHunks === 0) {
					ctx.injectAssistantMessage(localize('alaska.slash.hunks.none', 'No tracked changes this session yet.'));
					return;
				}
				const lines: string[] = ['## Change attribution (this session)', ''];
				lines.push(`- Agent: +${summary.agentLinesAdded} / -${summary.agentLinesRemoved}`);
				lines.push(`- Human: +${summary.humanLinesAdded} / -${summary.humanLinesRemoved}`);
				lines.push(`- ${summary.totalHunks} change${summary.totalHunks === 1 ? '' : 's'} across ${summary.files.length} file${summary.files.length === 1 ? '' : 's'}`, '');
				lines.push('| File | Agent | Human |', '| --- | --- | --- |');
				for (const f of summary.files) {
					const agent = f.hasAgentChanges ? `+${f.agentLinesAdded} / -${f.agentLinesRemoved}` : '—';
					const human = f.hasExternalChanges ? `+${f.humanLinesAdded} / -${f.humanLinesRemoved}` : '—';
					lines.push(`| ${f.path} | ${agent} | ${human} |`);
				}
				ctx.injectAssistantMessage(lines.join('\n'));
			},
		},
		{
			id: 'alaska.slash.share',
			trigger: '/share',
			label: localize('alaska.slash.share.label', 'Share thread'),
			description: localize('alaska.slash.share.desc', 'Copy current chat as markdown'),
			category: 'export',
			iconId: 'export',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				const markdown = ctx.exportActiveSessionAsMarkdown();
				if (!markdown) {
					ctx.services.get(INotificationService).info(localize('alaska.slash.share.empty', 'Nothing to share — the thread is empty.'));
					return;
				}
				await ctx.services.get(IClipboardService).writeText(markdown);
				ctx.services.get(INotificationService).info(localize('alaska.slash.share.copied', 'Thread copied to clipboard as markdown.'));
			},
		},
		{
			id: 'alaska.slash.model',
			trigger: '/model',
			label: localize('alaska.slash.model.label', 'Switch model'),
			description: localize('alaska.slash.model.desc', 'Open the model picker'),
			category: 'utility',
			iconId: 'sparkle',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				await ctx.services.get(ICommandService).executeCommand('alaska.chat.openModelPicker');
			},
		},
		{
			id: 'alaska.slash.skill',
			trigger: '/skill',
			label: localize('alaska.slash.skill.label', 'Force-load a skill'),
			description: localize('alaska.slash.skill.desc', 'Inject a packaged skill for the next prompt'),
			category: 'utility',
			iconId: 'package',
			args: [{ name: 'name', description: 'Skill name from .alaska/skills', required: true }],
			async run(ctx: IAlaskaSlashContext, rawArgs: string): Promise<void> {
				const skillService = ctx.services.get(IAlaskaSkillService);
				const trimmed = rawArgs.trim();
				if (!trimmed) {
					const skills = skillService.list();
					if (skills.length === 0) {
						ctx.injectAssistantMessage('No skills loaded. Add `.alaska/skills/<name>/SKILL.md` to your workspace.');
						return;
					}
					const lines = ['## Available skills', ''];
					for (const s of skills) { lines.push(`- **${s.name}** — ${s.description}`); }
					ctx.injectAssistantMessage(lines.join('\n'));
					return;
				}
				const skill = skillService.get(trimmed);
				if (!skill) {
					ctx.services.get(INotificationService).warn(localize('alaska.slash.skill.unknown', 'Skill not found: {0}', trimmed));
					return;
				}
				await ctx.services.get(ICommandService).executeCommand('alaska.chat.forceSkill', skill.name);
				ctx.services.get(INotificationService).info(localize('alaska.slash.skill.armed', 'Skill "{0}" will be injected on the next prompt.', skill.name));
			},
		},
		{
			id: 'alaska.slash.skills',
			trigger: '/skills',
			label: localize('alaska.slash.skills.label', 'List skills'),
			description: localize('alaska.slash.skills.desc', 'Show every packaged skill available to the agent'),
			category: 'utility',
			iconId: 'library',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				const skills = ctx.services.get(IAlaskaSkillService).list();
				if (skills.length === 0) {
					ctx.injectAssistantMessage('No skills loaded. Add `.alaska/skills/<name>/SKILL.md` to your workspace — the agent auto-injects the relevant ones, or force one with `/skill <name>`.');
					return;
				}
				const lines = [`## Skills (${skills.length})`, '', 'The agent auto-injects the most relevant skills each turn. Force one with `/skill <name>`.', ''];
				for (const s of skills) { lines.push(`- **${s.name}** — ${s.description}`); }
				ctx.injectAssistantMessage(lines.join('\n'));
			},
		},
		{
			id: 'alaska.slash.compact',
			trigger: '/compact',
			label: localize('alaska.slash.compact.label', 'Compact history'),
			description: localize('alaska.slash.compact.desc', 'Summarise older messages to reclaim the context window'),
			category: 'session',
			iconId: 'fold',
			async run(ctx: IAlaskaSlashContext): Promise<void> {
				const r = await ctx.compactHistory();
				if (!r.compacted) {
					ctx.injectAssistantMessage('Nothing to compact yet — the conversation still fits comfortably in context.');
					return;
				}
				const pct = (x: number | undefined) => x === undefined ? '—' : `${Math.round(x * 100)}%`;
				const foldNote = `${r.messagesFolded} older message${r.messagesFolded === 1 ? '' : 's'}`;
				ctx.injectAssistantMessage(`🗜️ **History compacted** — folded ${foldNote} into the running summary; recent turns are kept verbatim.\n\nContext use: ${pct(r.ratioBefore)} → **${pct(r.ratioAfter)}**.`);
			},
		},
		{
			id: 'alaska.slash.plan',
			trigger: '/plan',
			label: localize('alaska.slash.plan.label', 'Plan and execute'),
			description: localize('alaska.slash.plan.desc', 'Draft a concrete plan, then autonomously execute it to completion'),
			category: 'workflow',
			iconId: 'checklist',
			args: [{ name: 'task', description: 'What to accomplish', required: true }],
			async run(ctx: IAlaskaSlashContext, rawArgs: string): Promise<void> {
				const task = rawArgs.trim();
				if (!task) {
					ctx.injectAssistantMessage('Usage: `/plan <what to accomplish>` — I draft a concrete plan and then carry it out end to end.');
					return;
				}
				const goalService = ctx.services.get(IAlaskaGoalService);
				goalService.setGoal(`Fully complete, with working and verified results: ${task}`);
				ctx.injectAssistantMessage(`🧭 **Plan mode:** ${task}\n\n_I'll draft a concrete step-by-step plan, then execute every step to completion — a verifier checks each turn and I keep going until it's genuinely done. \`/goal pause\` / \`/goal clear\` to stop._`);
				await ctx.submitUserMessage(`Task: ${task}\n\nFirst write a short, concrete numbered plan (exact steps and the files involved). Then IMMEDIATELY begin executing the plan yourself using tools — edit files, run commands, verify results. Do not stop after presenting the plan; work through every step until the whole task is genuinely done and verified.`);
			},
		},
	];
}
