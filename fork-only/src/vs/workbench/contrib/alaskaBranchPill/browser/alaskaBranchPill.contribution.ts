import { localize } from '../../../../nls.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { ISCMService, ISCMRepository } from '../../scm/common/scm.js';
import { autorun, IObservable, IReader } from '../../../../base/common/observable.js';

const ENTRY_ID = 'alaska.branch.pill';

class AlaskaBranchPillContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'alaska.branch.pill';

	private entry: IStatusbarEntryAccessor | undefined;
	private readonly repoStore = this._register(new DisposableStore());

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@ISCMService private readonly scmService: ISCMService,
	) {
		super();

		this._register(this.scmService.onDidAddRepository(() => this.rewire()));
		this._register(this.scmService.onDidRemoveRepository(() => this.rewire()));
		this.rewire();
	}

	private rewire(): void {
		this.repoStore.clear();
		this.disposeEntry();

		const first = this.firstRepo();
		if (!first) {
			this.renderEntry(undefined);
			return;
		}

		this.renderEntry(this.snapshot(first));

		this.repoStore.add(autorun(reader => {
			const snap = this.snapshot(first, reader);
			this.renderEntry(snap);
		}));
	}

	private firstRepo(): ISCMRepository | undefined {
		const iter = this.scmService.repositories[Symbol.iterator]();
		const next = iter.next();
		return next.done ? undefined : next.value;
	}

	private snapshot(repo: ISCMRepository, reader?: IReader): IBranchSnapshot | undefined {
		const provider = repo.provider;
		const histObs: IObservable<unknown> | undefined = provider.historyProvider as unknown as IObservable<unknown> | undefined;
		if (!histObs || typeof histObs.read !== 'function') {
			return undefined;
		}
		const hist = histObs.read(reader as IReader);
		if (!hist || typeof hist !== 'object') {
			return undefined;
		}
		const histAny = hist as { historyItemRef?: IObservable<{ name?: string } | undefined> };
		const ref = histAny.historyItemRef?.read(reader as IReader);
		if (!ref || !ref.name) {
			return undefined;
		}
		return { branch: ref.name };
	}

	private renderEntry(snap: IBranchSnapshot | undefined): void {
		if (!snap) {
			this.disposeEntry();
			return;
		}
		const text = `$(source-control) ${snap.branch}`;
		const tooltip = localize('alaska.branch.tooltip', 'Current Git branch · click to switch');
		if (!this.entry) {
			this.entry = this._register(this.statusbarService.addEntry({
				name: localize('alaska.branch.name', 'Alaska AI · branch'),
				text,
				ariaLabel: snap.branch,
				tooltip,
				command: 'git.checkout',
			}, ENTRY_ID, StatusbarAlignment.LEFT, 600));
		} else {
			this.entry.update({
				name: localize('alaska.branch.name', 'Alaska AI · branch'),
				text,
				ariaLabel: snap.branch,
				tooltip,
				command: 'git.checkout',
			});
		}
	}

	private disposeEntry(): void {
		if (this.entry) {
			this.entry.dispose();
			this.entry = undefined;
		}
	}
}

interface IBranchSnapshot {
	readonly branch: string;
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaBranchPillContribution,
	LifecyclePhase.Restored,
);
