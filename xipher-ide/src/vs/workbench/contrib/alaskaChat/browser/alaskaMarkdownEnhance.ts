/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mainWindow } from '../../../../base/browser/window.js';

interface IKatexAPI {
	renderToString(latex: string, options: { displayMode?: boolean; throwOnError?: boolean; output?: string }): string;
}

interface IMermaidAPI {
	initialize(opts: Record<string, unknown>): void;
	render(id: string, code: string): Promise<{ svg: string }>;
}

interface IWindowWithLibs {
	katex?: IKatexAPI;
	mermaid?: IMermaidAPI;
}

const KATEX_VERSION = '0.16.22';
const MERMAID_VERSION = '11';

let katexLoadPromise: Promise<IKatexAPI> | undefined;
let mermaidLoadPromise: Promise<IMermaidAPI> | undefined;
let katexCssInjected = false;

function w(): IWindowWithLibs {
	return mainWindow as unknown as IWindowWithLibs;
}

function injectCssOnce(href: string): void {
	const doc = mainWindow.document;
	// eslint-disable-next-line no-restricted-syntax
	if (doc.querySelector(`link[data-alaska-cdn="${CSS.escape(href)}"]`)) { return; }
	const link = doc.createElement('link');
	link.rel = 'stylesheet';
	link.href = href;
	link.setAttribute('data-alaska-cdn', href);
	doc.head.appendChild(link);
}

function injectScriptOnce(src: string): Promise<void> {
	const doc = mainWindow.document;
	// eslint-disable-next-line no-restricted-syntax
	const existing = doc.querySelector<HTMLScriptElement>(`script[data-alaska-cdn="${CSS.escape(src)}"]`);
	if (existing) {
		if (existing.dataset.alaskaLoaded === 'true') { return Promise.resolve(); }
		return new Promise<void>((resolve, reject) => {
			existing.addEventListener('load', () => resolve(), { once: true });
			existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
		});
	}
	return new Promise<void>((resolve, reject) => {
		const script = doc.createElement('script');
		script.src = src;
		script.async = true;
		script.setAttribute('data-alaska-cdn', src);
		script.addEventListener('load', () => {
			script.dataset.alaskaLoaded = 'true';
			resolve();
		}, { once: true });
		script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
		doc.head.appendChild(script);
	});
}

function loadKatex(): Promise<IKatexAPI> {
	const win = w();
	if (win.katex) { return Promise.resolve(win.katex); }
	if (!katexLoadPromise) {
		if (!katexCssInjected) {
			injectCssOnce(`https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`);
			katexCssInjected = true;
		}
		katexLoadPromise = injectScriptOnce(`https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`).then(() => {
			const k = w().katex;
			if (!k) { throw new Error('KaTeX failed to attach to window'); }
			return k;
		});
	}
	return katexLoadPromise;
}

function loadMermaid(): Promise<IMermaidAPI> {
	const win = w();
	if (win.mermaid) { return Promise.resolve(win.mermaid); }
	if (!mermaidLoadPromise) {
		mermaidLoadPromise = injectScriptOnce(`https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`).then(() => {
			const m = w().mermaid;
			if (!m) { throw new Error('Mermaid failed to attach to window'); }
			m.initialize({
				startOnLoad: false,
				theme: 'dark',
				securityLevel: 'strict',
				fontFamily: 'JetBrains Mono, ui-monospace, monospace',
				themeVariables: {
					background: 'transparent',
					primaryColor: '#0e131b',
					primaryTextColor: '#ece5d3',
					primaryBorderColor: '#28323f',
					lineColor: '#7dd3fc',
					secondaryColor: '#1a1a2e',
					tertiaryColor: '#12121a',
				},
			});
			return m;
		});
	}
	return mermaidLoadPromise;
}

const CALLOUT_TYPES = new Set<string>(['note', 'info', 'tip', 'warning', 'danger', 'success', 'question', 'example', 'quote']);

function calloutIcon(type: string): string {
	switch (type) {
		// allow-any-unicode-next-line
		case 'note': case 'info': return 'ℹ';
		// allow-any-unicode-next-line
		case 'tip': return '◆';
		// allow-any-unicode-next-line
		case 'warning': return '⚠';
		// allow-any-unicode-next-line
		case 'danger': return '✕';
		// allow-any-unicode-next-line
		case 'success': return '✓';
		case 'question': return '?';
		// allow-any-unicode-next-line
		case 'example': return '▸';
		// allow-any-unicode-next-line
		case 'quote': return '"';
		// allow-any-unicode-next-line
		default: return 'ℹ';
	}
}

function rewriteCallouts(root: HTMLElement): void {
	// eslint-disable-next-line no-restricted-syntax
	const blockquotes = Array.from(root.querySelectorAll('blockquote'));
	for (const bq of blockquotes) {
		const first = bq.firstElementChild;
		if (!first) { continue; }
		const text = (first.textContent ?? '').trimStart();
		const m = text.match(/^\[!(\w+)\][+-]?\s*(.*)$/m);
		if (!m) { continue; }
		const type = m[1].toLowerCase();
		if (!CALLOUT_TYPES.has(type)) { continue; }
		const titleText = m[2].trim();

		const lines = text.split('\n');
		const remainder = lines.slice(1).join('\n').trimStart();
		if (remainder) {
			first.textContent = remainder;
		} else {
			first.remove();
		}

		const div = mainWindow.document.createElement('div');
		div.className = `alaska-callout alaska-callout-${type}`;

		const titleEl = mainWindow.document.createElement('div');
		titleEl.className = 'alaska-callout-title';
		const iconEl = mainWindow.document.createElement('span');
		iconEl.className = 'alaska-callout-title-icon';
		iconEl.textContent = calloutIcon(type);
		titleEl.appendChild(iconEl);
		const titleSpan = mainWindow.document.createElement('span');
		titleSpan.textContent = titleText || (type.charAt(0).toUpperCase() + type.slice(1));
		titleEl.appendChild(titleSpan);
		div.appendChild(titleEl);

		const body = mainWindow.document.createElement('div');
		body.className = 'alaska-callout-body';
		while (bq.firstChild) {
			body.appendChild(bq.firstChild);
		}
		div.appendChild(body);

		bq.replaceWith(div);
	}
}

async function renderMermaidBlocks(root: HTMLElement): Promise<void> {
	// eslint-disable-next-line no-restricted-syntax
	const codes = Array.from(root.querySelectorAll<HTMLElement>('code.language-mermaid'));
	if (codes.length === 0) { return; }

	let mermaid: IMermaidAPI;
	try {
		mermaid = await loadMermaid();
	} catch (err) {
		for (const code of codes) {
			const pre = code.parentElement;
			if (pre?.tagName === 'PRE') {
				const placeholder = mainWindow.document.createElement('div');
				placeholder.className = 'alaska-mermaid-error';
				placeholder.textContent = `Failed to load Mermaid: ${err instanceof Error ? err.message : String(err)}`;
				pre.replaceWith(placeholder);
			}
		}
		return;
	}

	let idx = 0;
	for (const code of codes) {
		const pre = code.parentElement;
		if (!pre || pre.tagName !== 'PRE') { continue; }
		const source = code.textContent ?? '';
		const wrap = mainWindow.document.createElement('div');
		wrap.className = 'alaska-mermaid';
		const pending = mainWindow.document.createElement('div');
		pending.className = 'alaska-mermaid-pending';
		// allow-any-unicode-next-line
		pending.textContent = 'rendering diagram…';
		wrap.appendChild(pending);
		pre.replaceWith(wrap);
		try {
			const id = `alaska-mermaid-${Date.now()}-${idx++}`;
			const { svg } = await mermaid.render(id, source);
			wrap.innerHTML = svg;
		} catch (err) {
			wrap.className = 'alaska-mermaid-error';
			// allow-any-unicode-next-line
			wrap.textContent = `⚠ ${err instanceof Error ? err.message : String(err)}`;
		}
	}
}

async function renderKatexInTextNodes(root: HTMLElement, content: string): Promise<void> {
	if (!/\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(content)) { return; }

	let katex: IKatexAPI;
	try {
		katex = await loadKatex();
	} catch {
		return;
	}

	const skipTags = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
	const walker = mainWindow.document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node: Node): number {
			let parent = node.parentNode as HTMLElement | null;
			while (parent && parent !== root) {
				if (skipTags.has(parent.tagName)) { return NodeFilter.FILTER_REJECT; }
				parent = parent.parentElement;
			}
			return NodeFilter.FILTER_ACCEPT;
		},
	});

	const textNodes: Text[] = [];
	let current = walker.nextNode();
	while (current) {
		textNodes.push(current as Text);
		current = walker.nextNode();
	}

	for (const textNode of textNodes) {
		const original = textNode.textContent ?? '';
		if (!original.includes('$')) { continue; }

		const matches: { start: number; end: number; mode: 'inline' | 'block'; expr: string }[] = [];
		const blockRe = /\$\$([\s\S]+?)\$\$/g;
		let bm: RegExpExecArray | null;
		while ((bm = blockRe.exec(original))) {
			matches.push({ start: bm.index, end: bm.index + bm[0].length, mode: 'block', expr: bm[1] });
		}
		const inlineRe = /\$([^\n$]+?)\$/g;
		let im: RegExpExecArray | null;
		while ((im = inlineRe.exec(original))) {
			const start = im.index;
			const end = im.index + im[0].length;
			const inBlock = matches.some(b => b.mode === 'block' && start >= b.start && end <= b.end);
			if (!inBlock) {
				matches.push({ start, end, mode: 'inline', expr: im[1] });
			}
		}

		if (matches.length === 0) { continue; }
		matches.sort((a, b) => a.start - b.start);

		const fragments: Node[] = [];
		let pos = 0;
		for (const m of matches) {
			if (m.start > pos) {
				fragments.push(mainWindow.document.createTextNode(original.slice(pos, m.start)));
			}
			const span = mainWindow.document.createElement('span');
			try {
				span.innerHTML = katex.renderToString(m.expr, {
					displayMode: m.mode === 'block',
					throwOnError: false,
					output: 'html',
				});
			} catch (err) {
				span.className = 'alaska-katex-error';
				span.textContent = (m.mode === 'block' ? '$$' : '$') + m.expr + (m.mode === 'block' ? '$$' : '$');
				span.title = err instanceof Error ? err.message : String(err);
			}
			fragments.push(span);
			pos = m.end;
		}
		if (pos < original.length) {
			fragments.push(mainWindow.document.createTextNode(original.slice(pos)));
		}

		const parent = textNode.parentNode;
		if (!parent) { continue; }
		for (const f of fragments) {
			parent.insertBefore(f, textNode);
		}
		parent.removeChild(textNode);
	}
}

export async function enhanceMarkdownContainer(container: HTMLElement, content: string): Promise<void> {
	const hasCallout = /(^|\n)>\s*\[!\w+\]/.test(content);
	const hasMermaid = /```mermaid\s/.test(content);
	const hasMath = /\$/.test(content);

	if (hasCallout) {
		rewriteCallouts(container);
	}
	if (hasMermaid) {
		await renderMermaidBlocks(container);
	}
	if (hasMath) {
		await renderKatexInTextNodes(container, content);
	}
}
