import { useRoute } from './lib/router';
import { AuthProvider } from './lib/auth';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { Pricing } from './pages/Pricing';
import { Download } from './pages/Download';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Billing } from './pages/Billing';
import { Admin } from './pages/Admin';
import { Redeem } from './pages/Redeem';
import { Verify } from './pages/Verify';
import { Code } from './pages/Code';
import { CodeSession } from './pages/CodeSession';
import { Chat } from './pages/Chat';
import { Executors } from './pages/Executors';

function Route({ path }: { path: string }) {
	if (path === '/' || path === '') { return <Home />; }
	if (path === '/pricing') { return <Pricing />; }
	if (path === '/download') { return <Download />; }
	if (path === '/code') { return <Code />; }
	if (path.startsWith('/code/')) { return <CodeSession id={decodeURIComponent(path.slice('/code/'.length))} />; }
	if (path === '/chat') { return <Chat />; }
	if (path === '/executors') { return <Executors />; }
	if (path === '/login') { return <Login mode="login" />; }
	if (path === '/register') { return <Login mode="register" />; }
	if (path === '/dashboard') { return <Dashboard />; }
	if (path === '/billing') { return <Billing />; }
	if (path === '/admin') { return <Admin />; }
	if (path.startsWith('/r/')) { return <Redeem code={decodeURIComponent(path.slice('/r/'.length))} />; }
	if (path.startsWith('/verify/')) { return <Verify token={decodeURIComponent(path.slice('/verify/'.length))} />; }
	return (
		<div>
			<h1 className="page" style={{ fontSize: 30 }}>404 · файл не найден</h1>
			<p className="lead">Такой страницы нет. <a href="#/">На главную →</a></p>
		</div>
	);
}

export default function App() {
	const path = useRoute();
	return (
		<AuthProvider>
			<Shell path={path}>
				<Route path={path} />
			</Shell>
		</AuthProvider>
	);
}
