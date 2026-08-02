import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Site frontend. The backend runs on :8098 — proxied here so the SPA can call
// /api/* on the same origin in dev (no CORS friction).
export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		proxy: {
			// site API lives under /xapi (prod's /api on ide.xipher.pro is taken by OmniRoute)
			'/xapi': { target: 'http://127.0.0.1:8098', changeOrigin: true },
			// the Web "Code" platform (agent sessions + WS relay) lives on the ide-backend,
			// reached under /ide-api in prod (xpcore strips the prefix). ws:true proxies the
			// WebSocket upgrade too; rewrite strips the prefix for the local backend.
			'/ide-api': {
				target: 'http://127.0.0.1:8097', changeOrigin: true, ws: true,
				rewrite: (p) => p.replace(/^\/ide-api/, ''),
			},
		},
	},
});
