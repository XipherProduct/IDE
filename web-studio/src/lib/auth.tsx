import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, getToken, setToken, PublicUser, Usage } from './api';
import { consumeGoogleRedirect } from './googleAuth';
import { navigate } from './router';

interface AuthState {
	user: PublicUser | null;
	usage: Usage | null;
	loading: boolean;
	refresh: () => Promise<void>;
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, password: string) => Promise<{ emailVerificationRequired: boolean; email: string; devVerifyToken?: string }>;
	verifyEmail: (token: string) => Promise<void>;
	logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<PublicUser | null>(null);
	const [usage, setUsage] = useState<Usage | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		if (!getToken()) { setUser(null); setUsage(null); setLoading(false); return; }
		try {
			const r = await api.me();
			setUser(r.user); setUsage(r.usage);
		} catch {
			setToken(null); setUser(null); setUsage(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const g = consumeGoogleRedirect();
		if (g) {
			const pref = localStorage.getItem('xipher.pendingRef');
			api.googleAuth(g.code, g.redirectUri)
				.then(r => { setToken(r.token); return refresh(); })
				.then(() => { if (pref) { localStorage.removeItem('xipher.pendingRef'); navigate('/r/' + pref); } else { navigate('/dashboard'); } })
				.catch(() => { void refresh(); });
			return;
		}
		void refresh();
	}, [refresh]);

	const login = useCallback(async (email: string, password: string) => {
		const r = await api.login(email, password);
		setToken(r.token); await refresh();
	}, [refresh]);

	const register = useCallback(async (email: string, password: string) => {
		return await api.register(email, password); // no session yet — email must be confirmed first
	}, []);

	const verifyEmail = useCallback(async (token: string) => {
		const r = await api.verifyEmail(token);
		setToken(r.token); await refresh();
	}, [refresh]);

	const logout = useCallback(async () => {
		try { await api.logout(); } catch { /* ignore */ }
		setToken(null); setUser(null); setUsage(null);
	}, []);

	return <Ctx.Provider value={{ user, usage, loading, refresh, login, register, verifyEmail, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
	const c = useContext(Ctx);
	if (!c) { throw new Error('useAuth outside provider'); }
	return c;
}
