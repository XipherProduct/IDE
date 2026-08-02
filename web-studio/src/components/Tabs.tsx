export interface Tab { id: string; label: string; icon?: string; }

export function Tabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
	return (
		<div className="seg-tabs" role="tablist">
			{tabs.map(t => (
				<button
					key={t.id}
					role="tab"
					aria-selected={t.id === active}
					className={'seg-tab' + (t.id === active ? ' active' : '')}
					onClick={() => onChange(t.id)}
				>
					{t.icon && <span className="seg-tab-ico">{t.icon}</span>}
					{t.label}
				</button>
			))}
		</div>
	);
}
