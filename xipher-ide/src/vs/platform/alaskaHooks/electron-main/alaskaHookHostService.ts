/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { isWindows } from '../../../base/common/platform.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ILogService } from '../../log/common/log.js';
import { IAlaskaHookHostRequest, IAlaskaHookHostResult, IAlaskaHookHostService } from '../common/alaskaHooks.js';

const STDOUT_MAX = 256 * 1024;

export class AlaskaHookHostService extends Disposable implements IAlaskaHookHostService {
	declare readonly _serviceBrand: undefined;

	constructor(@ILogService private readonly logService: ILogService) {
		super();
	}

	runHookCommand(req: IAlaskaHookHostRequest): Promise<IAlaskaHookHostResult> {
		return new Promise<IAlaskaHookHostResult>((resolve) => {
			const shell = isWindows ? 'cmd.exe' : '/bin/sh';
			const flag = isWindows ? '/c' : '-c';
			const env: NodeJS.ProcessEnv = Object.create(null);
			for (const [k, v] of Object.entries(process.env)) {
				if (typeof v === 'string') { env[k] = v; }
			}
			for (const [k, v] of Object.entries(req.env || {})) {
				env[k] = v;
			}
			const child = spawn(shell, [flag, req.command], {
				cwd: req.cwd,
				env,
				stdio: ['pipe', 'pipe', 'pipe'],
				windowsHide: true,
			});
			let stdout = '';
			let stderr = '';
			let stdoutCapped = false;
			let stderrCapped = false;
			let timedOut = false;
			let settled = false;

			child.stdout.on('data', (chunk: Buffer) => {
				if (stdoutCapped) { return; }
				const remaining = STDOUT_MAX - stdout.length;
				if (remaining <= 0) { stdoutCapped = true; return; }
				stdout += chunk.toString('utf8', 0, Math.min(remaining, chunk.length));
				if (stdout.length >= STDOUT_MAX) { stdoutCapped = true; }
			});
			child.stderr.on('data', (chunk: Buffer) => {
				if (stderrCapped) { return; }
				const remaining = STDOUT_MAX - stderr.length;
				if (remaining <= 0) { stderrCapped = true; return; }
				stderr += chunk.toString('utf8', 0, Math.min(remaining, chunk.length));
				if (stderr.length >= STDOUT_MAX) { stderrCapped = true; }
			});
			const timeout = Math.min(Math.max(req.timeoutMs || 5000, 100), 60_000);
			const timer = setTimeout(() => {
				timedOut = true;
				try { child.kill('SIGTERM'); } catch { /* ignore */ }
				setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } }, 500);
			}, timeout);
			child.on('close', code => {
				if (settled) { return; }
				settled = true;
				clearTimeout(timer);
				resolve({ exitCode: code ?? -1, stdout, stderr, timedOut });
			});
			child.on('error', err => {
				if (settled) { return; }
				settled = true;
				clearTimeout(timer);
				this.logService.warn('[alaska.hooks] spawn error', err);
				resolve({ exitCode: -1, stdout, stderr: stderr || (err instanceof Error ? err.message : String(err)), timedOut });
			});
			if (req.stdin) {
				try {
					child.stdin.write(req.stdin);
					child.stdin.end();
				} catch (err) {
					this.logService.warn('[alaska.hooks] stdin write failed', err);
				}
			} else {
				try { child.stdin.end(); } catch { /* ignore */ }
			}
		});
	}
}
