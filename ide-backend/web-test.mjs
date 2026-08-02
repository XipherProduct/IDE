// Focused tests for web.mjs — run: node web-test.mjs
// Network tests hit example.com + DuckDuckGo; they degrade gracefully offline.
import { webSearch, webFetch } from './web.mjs';

let pass = 0, fail = 0;
function ok(name, cond, detail = '') { if (cond) { console.log(`  ✓ ${name}`); pass++; } else { console.log(`  ✗ ${name} ${detail}`); fail++; } }

console.log('=== CONTRACT: webSearch returns `hits` (not `results`) ===');
{
	const r = await webSearch('site reliability engineering', { max_results: 5 }, 'u_test', 'pro');
	ok('has hits array (client reads body.hits)', Array.isArray(r.hits), JSON.stringify(Object.keys(r)));
	ok('has provider field', typeof r.provider === 'string' && r.provider.length > 0, r.provider);
	ok('has hit_count / cached / truncated / latency_ms', typeof r.hit_count === 'number' && 'cached' in r && 'truncated' in r && typeof r.latency_ms === 'number');
	if (r.hits.length > 0) {
		const h = r.hits[0];
		ok('hit shape {title,url,snippet}', typeof h.title === 'string' && typeof h.url === 'string' && 'snippet' in h, JSON.stringify(h).slice(0, 120));
		ok('respects max_results (≤5)', r.hits.length <= 5, String(r.hits.length));
	} else {
		console.log('  · (0 hits — likely offline; contract shape still verified)');
	}
}

console.log('=== CONTRACT: webFetch returns markdown + metadata ===');
{
	const r = await webFetch('https://example.com', { format: 'markdown' }, 'u_test', 'pro');
	if (r.error) {
		console.log(`  · fetch error (likely offline): ${r.error}`);
	} else {
		ok('has content string', typeof r.content === 'string' && r.content.length > 0);
		ok('has title', typeof r.title === 'string', r.title);
		ok('has content_type / byte_count / final_url / status_code', typeof r.content_type === 'string' && typeof r.byte_count === 'number' && typeof r.final_url === 'string' && typeof r.status_code === 'number');
		ok('example.com content mentions "Example Domain"', /example domain/i.test(r.content), r.content.slice(0, 80));
		ok('status 200', r.status_code === 200, String(r.status_code));
	}
}

console.log('=== SSRF: private/internal hosts blocked ===');
for (const bad of ['http://localhost/', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://192.168.1.1/', 'file:///etc/passwd', 'ftp://x/']) {
	const r = await webFetch(bad, {}, 'u_test', 'pro');
	ok(`blocked: ${bad}`, r.code === 'web_fetch_blocked', JSON.stringify(r));
}

console.log('=== QUOTA: daily search cap enforced (free = 50) ===');
{
	// hammer a fresh user past the free search cap using cached-miss unique queries
	let hitQuota = false;
	for (let i = 0; i < 55; i++) {
		const r = await webSearch(`unique-quota-probe-${i}-${Math.random()}`, {}, 'u_quota', 'free');
		if (r.code === 'web_search_quota_exhausted') { hitQuota = true; break; }
	}
	ok('free search quota (50/day) enforced', hitQuota);
}
{
	const r = await webFetch('https://example.com/quota', {}, 'u_quota_f', 'free');
	// prime then exhaust — fetch cap is 200, so just check the counter path works
	ok('fetch quota path returns normally (or blocked)', r.error === undefined || typeof r.code === 'string');
}

console.log('=== HTML→MARKDOWN: structural conversion ===');
{
	// webFetch does the conversion; test the pure transform via a data-ish page is
	// not possible without network, so assert the markdown of example.com had no tags.
	const r = await webFetch('https://example.com', { format: 'markdown' }, 'u_md', 'pro');
	if (!r.error) {
		ok('markdown output has no raw HTML tags', !/<[a-z][\s\S]*>/i.test(r.content), r.content.slice(0, 80));
	} else {
		console.log('  · skipped (offline)');
	}
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
