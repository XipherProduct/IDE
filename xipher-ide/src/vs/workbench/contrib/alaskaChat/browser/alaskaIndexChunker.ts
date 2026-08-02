/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IAlaskaChunk {
	readonly content: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly symbolName?: string;
	readonly symbolKind?: 'function' | 'class' | 'method' | 'block' | 'window';
	readonly tokenCount: number;
}

const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_OVERLAP_TOKENS = 200;
const APPROX_CHARS_PER_TOKEN = 4;

export function approxTokenCount(text: string): number {
	return Math.max(1, Math.round(text.length / APPROX_CHARS_PER_TOKEN));
}

export function chunkFile(filePath: string, content: string, maxTokens = DEFAULT_MAX_TOKENS): IAlaskaChunk[] {
	if (!content.trim()) { return []; }
	const ext = (filePath.split('.').pop() ?? '').toLowerCase();

	switch (ext) {
		case 'ts':
		case 'tsx':
		case 'js':
		case 'jsx':
		case 'mjs':
		case 'cjs':
			return chunkTypeScriptLike(content, maxTokens);
		case 'go':
			return chunkGoLike(content, maxTokens);
		case 'py':
			return chunkPythonLike(content, maxTokens);
		case 'rs':
			return chunkRustLike(content, maxTokens);
		case 'java':
		case 'kt':
		case 'cs':
			return chunkBraceLanguage(content, maxTokens, BRACE_LANG_PATTERNS);
		default:
			return chunkSlidingWindow(content, maxTokens, DEFAULT_OVERLAP_TOKENS);
	}
}

interface SymbolDescriptor {
	readonly name?: string;
	readonly kind: 'function' | 'class' | 'method' | 'block';
	readonly startLine: number;
	readonly endLine: number;
	readonly text: string;
}

function chunkTypeScriptLike(content: string, maxTokens: number): IAlaskaChunk[] {
	const symbols = extractBraceSymbols(content, [
		/(?:export\s+)?(?:async\s+)?function(?:\s*\*)?\s+([A-Za-z_$][\w$]*)/g,
		/(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
		/(?:export\s+)?(?:async\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g,
	]);
	return symbolsToChunks(content, symbols, maxTokens);
}

function chunkGoLike(content: string, maxTokens: number): IAlaskaChunk[] {
	const symbols = extractBraceSymbols(content, [
		/func\s+(?:\([^)]+\)\s+)?([A-Za-z_][\w]*)/g,
		/type\s+([A-Za-z_][\w]*)\s+struct/g,
		/type\s+([A-Za-z_][\w]*)\s+interface/g,
	]);
	return symbolsToChunks(content, symbols, maxTokens);
}

function chunkRustLike(content: string, maxTokens: number): IAlaskaChunk[] {
	const symbols = extractBraceSymbols(content, [
		/(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/g,
		/(?:pub\s+)?struct\s+([A-Za-z_][\w]*)/g,
		/(?:pub\s+)?enum\s+([A-Za-z_][\w]*)/g,
		/(?:pub\s+)?trait\s+([A-Za-z_][\w]*)/g,
		/impl\s+(?:<[^>]+>\s+)?([A-Za-z_][\w]*)/g,
	]);
	return symbolsToChunks(content, symbols, maxTokens);
}

const BRACE_LANG_PATTERNS: RegExp[] = [
	/(?:public|private|protected|static|abstract|final|internal)?\s*(?:[A-Za-z_<>,\s\[\]]+\s+)?([A-Za-z_][\w]*)\s*\([^)]*\)\s*(?:throws[^{]+)?\{/g,
	/(?:public|private|protected|abstract|final|internal|sealed)?\s*class\s+([A-Za-z_][\w]*)/g,
	/(?:public|private|protected|abstract|final|internal)?\s*interface\s+([A-Za-z_][\w]*)/g,
];

function chunkBraceLanguage(content: string, maxTokens: number, patterns: RegExp[]): IAlaskaChunk[] {
	const symbols = extractBraceSymbols(content, patterns);
	return symbolsToChunks(content, symbols, maxTokens);
}

function chunkPythonLike(content: string, maxTokens: number): IAlaskaChunk[] {
	const lines = content.split('\n');
	const symbols: SymbolDescriptor[] = [];
	const stack: { kind: 'function' | 'class'; name: string; indent: number; start: number }[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trimStart();
		const indent = line.length - trimmed.length;
		while (stack.length > 0 && indent <= stack[stack.length - 1].indent && trimmed.length > 0) {
			const frame = stack.pop()!;
			symbols.push({
				name: frame.name,
				kind: frame.kind,
				startLine: frame.start + 1,
				endLine: i,
				text: lines.slice(frame.start, i).join('\n'),
			});
		}
		const fnMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z_][\w]*)/);
		const clsMatch = trimmed.match(/^class\s+([A-Za-z_][\w]*)/);
		if (fnMatch) {
			stack.push({ kind: 'function', name: fnMatch[1], indent, start: i });
		} else if (clsMatch) {
			stack.push({ kind: 'class', name: clsMatch[1], indent, start: i });
		}
	}
	while (stack.length > 0) {
		const frame = stack.pop()!;
		symbols.push({
			name: frame.name,
			kind: frame.kind,
			startLine: frame.start + 1,
			endLine: lines.length,
			text: lines.slice(frame.start).join('\n'),
		});
	}
	return symbolsToChunks(content, symbols, maxTokens);
}

function extractBraceSymbols(content: string, patterns: RegExp[]): SymbolDescriptor[] {
	const symbols: SymbolDescriptor[] = [];
	for (const pattern of patterns) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(content)) !== null) {
			const headStart = match.index;
			const openIdx = content.indexOf('{', headStart);
			if (openIdx < 0) { continue; }
			const closeIdx = findMatchingBrace(content, openIdx);
			if (closeIdx < 0) { continue; }
			const text = content.slice(headStart, closeIdx + 1);
			symbols.push({
				name: match[1],
				kind: classifyKind(match[0]),
				startLine: lineNumberAt(content, headStart),
				endLine: lineNumberAt(content, closeIdx),
				text,
			});
		}
	}
	symbols.sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine);
	return dedupeOverlappingSymbols(symbols);
}

function dedupeOverlappingSymbols(symbols: SymbolDescriptor[]): SymbolDescriptor[] {
	const result: SymbolDescriptor[] = [];
	for (const sym of symbols) {
		const containing = result.find(r => r.startLine <= sym.startLine && r.endLine >= sym.endLine && r !== sym);
		if (containing) {
			continue;
		}
		result.push(sym);
	}
	return result;
}

function classifyKind(head: string): SymbolDescriptor['kind'] {
	if (/^\s*(?:export\s+)?(?:abstract\s+)?class\b/.test(head) || /class\s+/.test(head)) {
		return 'class';
	}
	if (/^\s*(?:export\s+)?(?:async\s+)?function/.test(head) || /\bfn\b|\bfunc\b/.test(head)) {
		return 'function';
	}
	if (/\bdef\b/.test(head)) {
		return 'function';
	}
	return 'block';
}

function findMatchingBrace(content: string, openIdx: number): number {
	let depth = 0;
	let inString: '"' | "'" | '`' | undefined;
	let inLineComment = false;
	let inBlockComment = false;
	for (let i = openIdx; i < content.length; i++) {
		const ch = content[i];
		const next = content[i + 1];
		if (inLineComment) {
			if (ch === '\n') { inLineComment = false; }
			continue;
		}
		if (inBlockComment) {
			if (ch === '*' && next === '/') { inBlockComment = false; i++; }
			continue;
		}
		if (inString) {
			if (ch === '\\') { i++; continue; }
			if (ch === inString) { inString = undefined; }
			continue;
		}
		if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
		if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
		if (ch === '"' || ch === '\'' || ch === '`') { inString = ch as '"' | '\'' | '`'; continue; }
		if (ch === '{') { depth++; }
		else if (ch === '}') {
			depth--;
			if (depth === 0) { return i; }
		}
	}
	return -1;
}

function lineNumberAt(content: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < content.length; i++) {
		if (content[i] === '\n') { line++; }
	}
	return line;
}

function symbolsToChunks(content: string, symbols: SymbolDescriptor[], maxTokens: number): IAlaskaChunk[] {
	if (symbols.length === 0) {
		return chunkSlidingWindow(content, maxTokens, DEFAULT_OVERLAP_TOKENS);
	}
	const out: IAlaskaChunk[] = [];
	for (const sym of symbols) {
		const tokens = approxTokenCount(sym.text);
		if (tokens <= maxTokens) {
			out.push({
				content: sym.text,
				startLine: sym.startLine,
				endLine: sym.endLine,
				symbolName: sym.name,
				symbolKind: sym.kind,
				tokenCount: tokens,
			});
			continue;
		}
		const subChunks = chunkSlidingWindow(sym.text, maxTokens, DEFAULT_OVERLAP_TOKENS);
		for (let i = 0; i < subChunks.length; i++) {
			const c = subChunks[i];
			out.push({
				content: c.content,
				startLine: sym.startLine + c.startLine - 1,
				endLine: sym.startLine + c.endLine - 1,
				symbolName: sym.name ? `${sym.name}#${i + 1}` : undefined,
				symbolKind: sym.kind,
				tokenCount: c.tokenCount,
			});
		}
	}
	return out;
}

export function chunkSlidingWindow(content: string, maxTokens: number, overlapTokens: number): IAlaskaChunk[] {
	const lines = content.split('\n');
	const out: IAlaskaChunk[] = [];
	let buf: string[] = [];
	let bufTokens = 0;
	let startLine = 1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const tokens = approxTokenCount(line + '\n');
		if (bufTokens + tokens > maxTokens && buf.length > 0) {
			out.push({
				content: buf.join('\n'),
				startLine,
				endLine: startLine + buf.length - 1,
				symbolKind: 'window',
				tokenCount: bufTokens,
			});
			const overlapLines = Math.min(buf.length, Math.max(1, Math.floor(overlapTokens / Math.max(1, bufTokens / buf.length))));
			const overlapStart = Math.max(0, buf.length - overlapLines);
			startLine = startLine + overlapStart;
			buf = buf.slice(overlapStart);
			bufTokens = approxTokenCount(buf.join('\n'));
		}
		buf.push(line);
		bufTokens += tokens;
	}
	if (buf.length > 0) {
		out.push({
			content: buf.join('\n'),
			startLine,
			endLine: startLine + buf.length - 1,
			symbolKind: 'window',
			tokenCount: bufTokens,
		});
	}
	return out;
}

export function isLikelyBinary(text: string): boolean {
	const sample = text.slice(0, 4096);
	for (let i = 0; i < sample.length; i++) {
		if (sample.charCodeAt(i) === 0) { return true; }
	}
	return false;
}
