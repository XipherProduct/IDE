/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IAlaskaCredentials } from './alaskaAuthService.js';

export async function signChecksum(secretHex: string, subject: string, method: string, path: string): Promise<string> {
	const keyBuf = hexToArrayBuffer(secretHex);
	const bucket = Math.floor(Date.now() / 1000 / 60);
	const message = `${subject}\n${method.toUpperCase()}\n${path}\n${bucket}`;
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		keyBuf,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const msgBytes = enc.encode(message);
	const msgBuf = new ArrayBuffer(msgBytes.byteLength);
	new Uint8Array(msgBuf).set(msgBytes);
	const sig = await crypto.subtle.sign('HMAC', key, msgBuf);
	return bytesToHex(new Uint8Array(sig));
}

export function hexToArrayBuffer(hex: string): ArrayBuffer {
	const clean = hex.length % 2 === 0 ? hex : '0' + hex;
	const buf = new ArrayBuffer(clean.length / 2);
	const view = new Uint8Array(buf);
	for (let i = 0; i < view.length; i++) {
		view[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return buf;
}

export function bytesToHex(bytes: Uint8Array): string {
	let s = '';
	for (let i = 0; i < bytes.length; i++) {
		s += bytes[i].toString(16).padStart(2, '0');
	}
	return s;
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
	}
	return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

export function abortSignalFrom(token: CancellationToken): AbortSignal {
	const ac = new AbortController();
	token.onCancellationRequested(() => ac.abort());
	return ac.signal;
}

export function parseAlaskaApiError(status: number, body: string): string {
	try {
		const obj = JSON.parse(body);
		if (obj?.message) { return `${obj.message} (HTTP ${status})`; }
	} catch { /* plain text */ }

	const looksLikeHtml = /<!doctype|<html/i.test(body);
	const friendly = (() => {
		switch (status) {
			case 502: return 'Origin server returned 502 — try again in a moment.';
			case 503: return 'Service temporarily unavailable. Retrying may help.';
			case 504: return 'Upstream timed out (504). The model took too long to respond.';
			case 429: return 'Rate limited — please wait a few seconds before retrying.';
			default: return undefined;
		}
	})();
	if (friendly) {
		return friendly;
	}
	if (looksLikeHtml) {
		return `Edge returned HTTP ${status} (HTML page). Origin may be unreachable.`;
	}
	return body || `HTTP ${status}`;
}

export interface IAuthorizedRequest {
	readonly method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
	readonly path: string;
	readonly accept?: string;
	readonly body?: string | Uint8Array;
}

export async function buildSignedHeaders(
	creds: IAlaskaCredentials,
	userId: string,
	req: IAuthorizedRequest,
): Promise<Record<string, string>> {
	if (!creds.hmacSecret || !creds.clientKey) {
		throw new Error('Missing API signing keys — please sign out and sign in again.');
	}
	const checksum = await signChecksum(creds.hmacSecret, userId, req.method, req.path);
	const headers: Record<string, string> = {
		'Accept': req.accept ?? 'application/json',
		'Authorization': `Bearer ${creds.accessToken}`,
		'X-Client-Key': creds.clientKey,
		'X-Checksum': checksum,
	};
	if (req.body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}
	return headers;
}
