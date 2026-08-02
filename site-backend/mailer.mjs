// Email sending — via the local MTA (postfix `sendmail`). Zero external deps.
// In dev/test (no sendmail, or MAIL_MODE=log) it just logs the message so the
// flow is testable without actually sending.

import { spawn } from 'node:child_process';
import fs from 'node:fs';

const SENDMAIL = process.env.SENDMAIL_PATH || '/usr/sbin/sendmail';
const MAIL_FROM = process.env.MAIL_FROM || 'Xipher IDE <noreply@xipher.pro>';
const MAIL_MODE = process.env.MAIL_MODE || (fs.existsSync(SENDMAIL) ? 'sendmail' : 'log');

export function mailMode() { return MAIL_MODE; }

function encodeSubject(s) {
	// RFC 2047 encoded-word so Cyrillic subjects arrive intact
	return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function buildMessage({ from, to, subject, html, text }) {
	const boundary = 'xip_' + Math.random().toString(36).slice(2);
	const headers = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: ${encodeSubject(subject)}`,
		'MIME-Version: 1.0',
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
	];
	const parts = [
		`--${boundary}`,
		'Content-Type: text/plain; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		Buffer.from(text || '', 'utf8').toString('base64'),
		`--${boundary}`,
		'Content-Type: text/html; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		Buffer.from(html || '', 'utf8').toString('base64'),
		`--${boundary}--`,
		'',
	];
	return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
}

export async function sendMail({ to, subject, html, text, from = MAIL_FROM }) {
	const raw = buildMessage({ from, to, subject, html, text });
	if (MAIL_MODE !== 'sendmail') {
		console.log(`[mail:log] to=${to} subject=${subject}\n${text || ''}`);
		return { ok: true, mode: 'log' };
	}
	return new Promise(resolve => {
		let done = false;
		const p = spawn(SENDMAIL, ['-t', '-i', '-f', 'noreply@xipher.pro'], { stdio: ['pipe', 'ignore', 'ignore'] });
		p.on('error', e => { if (!done) { done = true; console.error('[mail] sendmail error', e.message); resolve({ ok: false }); } });
		p.on('close', code => { if (!done) { done = true; resolve({ ok: code === 0 }); } });
		p.stdin.write(raw); p.stdin.end();
	});
}

// The Xipher-branded verification email.
export function sendVerificationEmail(email, verifyUrl) {
	const subject = 'Подтвердите e-mail — Xipher IDE';
	const text = `Добро пожаловать в Xipher IDE!\n\nПодтвердите адрес, перейдя по ссылке:\n${verifyUrl}\n\nСсылка действует 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.`;
	const html = `<!doctype html><html><body style="margin:0;background:#06080c;font-family:'Segoe UI',system-ui,sans-serif">
<div style="max-width:460px;margin:0 auto;padding:36px 28px;color:#ece5d3">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 1 L25 13 L13 25 L1 13 Z" stroke="#57b6e6" stroke-width="1.2" stroke-opacity=".4"/><path d="M13 7 L19 13 L13 19 L7 13 Z" fill="#57b6e6"/></svg>
    <b style="font-size:18px">Xipher IDE</b>
  </div>
  <h1 style="font-size:22px;margin:0 0 12px">Подтвердите e-mail</h1>
  <p style="color:#a8a193;line-height:1.6;margin:0 0 24px">Остался один шаг — подтвердите адрес, чтобы активировать аккаунт и войти в IDE.</p>
  <a href="${verifyUrl}" style="display:inline-block;background:#57b6e6;color:#06121d;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">Подтвердить e-mail →</a>
  <p style="color:#6f6a5e;font-size:12px;line-height:1.6;margin:24px 0 0">Или скопируйте ссылку:<br><span style="color:#57b6e6;word-break:break-all">${verifyUrl}</span></p>
  <p style="color:#6f6a5e;font-size:12px;margin:18px 0 0">Ссылка действует 24 часа. Если вы не регистрировались — проигнорируйте письмо.</p>
</div></body></html>`;
	return sendMail({ to: email, subject, html, text });
}
