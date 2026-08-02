import { useMemo, useState } from 'react';
import { Activity, ActivityDay } from '../lib/api';
import { credits } from '../lib/format';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['', 'пн', '', 'ср', '', 'пт', ''];

// GitHub-style contribution grid: columns = weeks, rows = weekdays (Mon-first).
export function Heatmap({ data }: { data: Activity }) {
	const [hover, setHover] = useState<{ d: ActivityDay; x: number; y: number } | null>(null);

	const weeks = useMemo(() => {
		const days = data.days;
		if (!days.length) { return [] as (ActivityDay | null)[][]; }
		// pad the front so the first column starts on Monday
		const firstDow = (new Date(days[0].date + 'T00:00:00').getDay() + 6) % 7; // Mon=0
		const cells: (ActivityDay | null)[] = [...Array(firstDow).fill(null), ...days];
		const cols: (ActivityDay | null)[][] = [];
		for (let i = 0; i < cells.length; i += 7) { cols.push(cells.slice(i, i + 7)); }
		return cols;
	}, [data]);

	const monthLabels = useMemo(() => {
		const labels: { col: number; label: string }[] = [];
		let last = -1;
		weeks.forEach((col, ci) => {
			const first = col.find(Boolean);
			if (!first) { return; }
			const m = new Date(first.date + 'T00:00:00').getMonth();
			if (m !== last) { labels.push({ col: ci, label: MONTHS[m] }); last = m; }
		});
		return labels;
	}, [weeks]);

	return (
		<div className="heatmap">
			<div className="heatmap-scroll">
				<div className="heatmap-grid" style={{ position: 'relative' }}>
					<div className="hm-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
						{weeks.map((_, ci) => {
							const lbl = monthLabels.find(l => l.col === ci);
							return <span key={ci} className="hm-month">{lbl ? lbl.label : ''}</span>;
						})}
					</div>
					<div className="hm-body">
						<div className="hm-wd">{WD.map((w, i) => <span key={i}>{w}</span>)}</div>
						<div className="hm-cols">
							{weeks.map((col, ci) => (
								<div className="hm-col" key={ci}>
									{Array.from({ length: 7 }).map((_, ri) => {
										const d = col[ri];
										if (!d) { return <span key={ri} className="hm-cell empty" />; }
										return (
											<span
												key={ri}
												className={'hm-cell lvl' + d.level}
												onMouseEnter={e => setHover({ d, x: (e.target as HTMLElement).offsetLeft, y: (e.target as HTMLElement).offsetTop })}
												onMouseLeave={() => setHover(null)}
											/>
										);
									})}
								</div>
							))}
						</div>
					</div>
					{hover && (
						<div className="hm-tip" style={{ left: hover.x + 20, top: hover.y - 6 }}>
							<b>{new Date(hover.d.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</b>
							<div>{hover.d.events ? `${credits(hover.d.credits)} кр · ${hover.d.requests} запросов` : 'нет активности'}</div>
						</div>
					)}
				</div>
			</div>
			<div className="hm-legend">
				<span className="muted">меньше</span>
				{[0, 1, 2, 3, 4].map(l => <span key={l} className={'hm-cell lvl' + l} />)}
				<span className="muted">больше</span>
			</div>
		</div>
	);
}
