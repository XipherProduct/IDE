/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const HKDF_SALT = 'alaska-index-v1';
const HKDF_INFO = 'content-aes-gcm';

export interface IIndexKeyMaterial {
	readonly installId: string;
	readonly userId: string;
	readonly workspaceId: string;
}

export async function deriveIndexKey(material: IIndexKeyMaterial): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const seed = enc.encode(`${material.installId}:${material.userId}:${material.workspaceId}`);
	const seedBuf = toArrayBuffer(seed);
	const baseKey = await crypto.subtle.importKey('raw', seedBuf, { name: 'HKDF' }, false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: toArrayBuffer(enc.encode(HKDF_SALT)),
			info: toArrayBuffer(enc.encode(HKDF_INFO)),
		},
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	);
}

export async function encryptIndexChunk(key: CryptoKey, plaintext: string): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: toArrayBuffer(iv) },
		key,
		toArrayBuffer(new TextEncoder().encode(plaintext)),
	);
	return { ciphertext: new Uint8Array(ct), iv };
}

export async function decryptIndexChunk(key: CryptoKey, ciphertext: Uint8Array, iv: Uint8Array): Promise<string> {
	const pt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: toArrayBuffer(iv) },
		key,
		toArrayBuffer(ciphertext),
	);
	return new TextDecoder().decode(pt);
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const out = new ArrayBuffer(view.byteLength);
	new Uint8Array(out).set(view);
	return out;
}
