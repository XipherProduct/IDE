/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'child_process';
import { Disposable } from '../../../base/common/lifecycle.js';
import { isWindows } from '../../../base/common/platform.js';
import { ILogService } from '../../log/common/log.js';
import {
	AlaskaWslDistroState,
	AlaskaWslDistroVersion,
	IAlaskaWslAvailability,
	IAlaskaWslDistro,
	IAlaskaWslService,
} from '../common/alaskaWsl.js';

const CACHE_TTL_MS = 60_000;
const LIST_TIMEOUT_MS = 5_000;
const WSL_EXE = 'wsl.exe';
const LIST_ARGS = Object.freeze(['-l', '-v']);

interface ICached<T> {
	readonly value: T;
	readonly expiresAt: number;
}

export class AlaskaWslMainService extends Disposable implements IAlaskaWslService {

	declare readonly _serviceBrand: undefined;

	private distrosCache: ICached<readonly IAlaskaWslDistro[]> | undefined;
	private availabilityCache: ICached<IAlaskaWslAvailability> | undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async isAvailable(): Promise<IAlaskaWslAvailability> {
		const now = Date.now();
		if (this.availabilityCache && this.availabilityCache.expiresAt > now) {
			return this.availabilityCache.value;
		}
		const value = await this.probeAvailability();
		this.availabilityCache = { value, expiresAt: now + CACHE_TTL_MS };
		return value;
	}

	async listDistros(): Promise<readonly IAlaskaWslDistro[]> {
		const now = Date.now();
		if (this.distrosCache && this.distrosCache.expiresAt > now) {
			return this.distrosCache.value;
		}
		if (!isWindows) {
			this.distrosCache = { value: [], expiresAt: now + CACHE_TTL_MS };
			return this.distrosCache.value;
		}
		try {
			const stdout = await this.runWslList();
			const parsed = parseWslListOutput(stdout);
			this.distrosCache = { value: parsed, expiresAt: now + CACHE_TTL_MS };
			return parsed;
		} catch (err) {
			this.logService.warn('[alaska.wsl] wsl.exe -l -v failed', err);
			this.distrosCache = { value: [], expiresAt: now + CACHE_TTL_MS };
			return this.distrosCache.value;
		}
	}

	private async probeAvailability(): Promise<IAlaskaWslAvailability> {
		if (!isWindows) {
			return { available: false, reason: 'wsl-not-windows' };
		}
		try {
			await this.runWslList();
			return { available: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { available: false, reason: message };
		}
	}

	private runWslList(): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const child = execFile(WSL_EXE, LIST_ARGS as readonly string[] as string[], {
				timeout: LIST_TIMEOUT_MS,
				maxBuffer: 1024 * 256,
				windowsHide: true,
				encoding: 'utf16le',
			}, (err, stdout) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(stdout);
			});
			child.on('error', reject);
		});
	}
}

export function parseWslListOutput(raw: string): readonly IAlaskaWslDistro[] {
	const clean = raw.replace(/\0/g, '').replace(/^\uFEFF/, '');
	const lines = clean.split(/\r?\n/);
	const distros: IAlaskaWslDistro[] = [];
	const seen = new Set<string>();
	let headerSeen = false;
	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (!line.trim()) { continue; }
		if (!headerSeen) {
			if (/^\s*NAME\s+STATE\s+VERSION\s*$/i.test(line.replace(/^\*\s*/, ''))) {
				headerSeen = true;
				continue;
			}
		}
		const isDefault = /^\s*\*/.test(line);
		const body = line.replace(/^\s*\*?\s*/, '');
		const tokens = body.split(/\s+/).filter(Boolean);
		if (tokens.length < 3) { continue; }
		const version = normalizeVersion(tokens[tokens.length - 1]);
		const state = normalizeState(tokens[tokens.length - 2]);
		const name = tokens.slice(0, tokens.length - 2).join(' ');
		if (!name || seen.has(name.toLowerCase())) { continue; }
		seen.add(name.toLowerCase());
		distros.push({ name, state, version, isDefault });
	}
	return distros;
}

function normalizeState(value: string): AlaskaWslDistroState {
	const v = value.trim();
	if (v === 'Running') { return 'Running'; }
	if (v === 'Stopped') { return 'Stopped'; }
	return 'Unknown';
}

function normalizeVersion(value: string): AlaskaWslDistroVersion {
	const v = value.trim();
	if (v === '1') { return '1'; }
	if (v === '2') { return '2'; }
	return 'unknown';
}
