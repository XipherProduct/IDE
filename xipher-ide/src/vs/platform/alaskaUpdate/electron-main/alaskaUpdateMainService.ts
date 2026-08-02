/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { spawn } from 'child_process';
import { Disposable } from '../../../base/common/lifecycle.js';
import { isLinux, isWindows } from '../../../base/common/platform.js';
import { ILogService } from '../../log/common/log.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { IAlaskaUpdateApplyResult, IAlaskaUpdateMainService } from '../common/alaskaUpdate.js';

const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000; // large artifacts, generous window
const MAX_REDIRECTS = 5;

export class AlaskaUpdateMainService extends Disposable implements IAlaskaUpdateMainService {
	declare readonly _serviceBrand: undefined;

	// A staged Windows installer, run once when the app is closing.
	private stagedInstaller: string | undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
	) {
		super();
		// Non-disruptive Windows apply: run the staged installer as the app exits.
		this._register(this.lifecycleMainService.onWillShutdown(e => {
			if (this.stagedInstaller) {
				e.join('alaska-update', this.runStagedInstaller());
			}
		}));
	}

	async canAutoApply(): Promise<boolean> {
		if (isLinux) { return !!process.env.APPIMAGE; }
		if (isWindows) { return true; }
		return false;
	}

	async applyUpdate(url: string, version: string): Promise<IAlaskaUpdateApplyResult> {
		try {
			if (isLinux) { return await this.applyLinux(url, version); }
			if (isWindows) { return await this.applyWindows(url, version); }
			return { ok: false, error: 'auto-apply is only supported on the Linux AppImage and Windows installer' };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.logService.error('[alaska.update] applyUpdate failed', msg);
			return { ok: false, error: msg };
		}
	}

	// Swap the running AppImage in place. The kernel keeps the current process on the
	// old inode, so replacing the file is safe; the new version is active next launch.
	private async applyLinux(url: string, version: string): Promise<IAlaskaUpdateApplyResult> {
		const appImage = process.env.APPIMAGE;
		if (!appImage) { return { ok: false, error: 'not running as an AppImage (no $APPIMAGE)' }; }
		const dir = path.dirname(appImage);
		// stage next to the target so the final rename is atomic (same filesystem)
		const tmp = path.join(dir, `.xipher-update-${version}-${process.pid}.AppImage`);
		await this.download(url, tmp);
		await fs.promises.chmod(tmp, 0o755);
		await fs.promises.rename(tmp, appImage); // atomic replace
		this.logService.info(`[alaska.update] AppImage replaced with ${version}; active on next launch`);
		return { ok: true, applied: 'appimage' };
	}

	// Stage the installer; it runs silently when the app is closed (onWillShutdown).
	private async applyWindows(url: string, version: string): Promise<IAlaskaUpdateApplyResult> {
		const tmp = path.join(os.tmpdir(), `XipherIDE-Setup-${version}-${process.pid}.exe`);
		await this.download(url, tmp);
		this.stagedInstaller = tmp;
		this.logService.info(`[alaska.update] installer ${version} staged; runs on app close`);
		return { ok: true, applied: 'installer' };
	}

	private async runStagedInstaller(): Promise<void> {
		const installer = this.stagedInstaller;
		if (!installer) { return; }
		this.stagedInstaller = undefined;
		try {
			const child = spawn(installer, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CLOSEAPPLICATIONS', '/RESTARTAPPLICATIONS'], {
				detached: true,
				stdio: 'ignore',
				windowsHide: false,
			});
			child.unref();
			this.logService.info('[alaska.update] launched staged installer');
		} catch (err) {
			this.logService.error('[alaska.update] failed to launch installer', err instanceof Error ? err.message : String(err));
		}
	}

	// Streaming download to `dest` following redirects; fails on non-200.
	private download(url: string, dest: string, redirects = 0): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const mod = url.startsWith('http:') ? http : https;
			const req = mod.get(url, { timeout: DOWNLOAD_TIMEOUT_MS, headers: { 'User-Agent': 'XipherIDE-Updater' } }, res => {
				const status = res.statusCode || 0;
				if (status >= 300 && status < 400 && res.headers.location) {
					res.resume();
					if (redirects >= MAX_REDIRECTS) { reject(new Error('too many redirects')); return; }
					const next = new URL(res.headers.location, url).toString();
					this.download(next, dest, redirects + 1).then(resolve, reject);
					return;
				}
				if (status !== 200) { res.resume(); reject(new Error(`download HTTP ${status}`)); return; }
				const out = fs.createWriteStream(dest);
				res.pipe(out);
				out.on('finish', () => out.close(err => err ? reject(err) : resolve()));
				out.on('error', err => { fs.promises.rm(dest, { force: true }).finally(() => reject(err)); });
				res.on('error', reject);
			});
			req.on('timeout', () => req.destroy(new Error('download timed out')));
			req.on('error', reject);
		});
	}
}
