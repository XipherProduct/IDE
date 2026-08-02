import { useEffect, useState } from 'react';

// Minimal hash router: routes are the "files" in the IDE tree (e.g. #/pricing).
export function currentPath(): string {
	const h = window.location.hash.replace(/^#/, '');
	return h || '/';
}

export function navigate(path: string) {
	window.location.hash = path.startsWith('/') ? path : '/' + path;
}

export function useRoute(): string {
	const [path, setPath] = useState(currentPath());
	useEffect(() => {
		const on = () => { setPath(currentPath()); window.scrollTo(0, 0); };
		window.addEventListener('hashchange', on);
		return () => window.removeEventListener('hashchange', on);
	}, []);
	return path;
}
