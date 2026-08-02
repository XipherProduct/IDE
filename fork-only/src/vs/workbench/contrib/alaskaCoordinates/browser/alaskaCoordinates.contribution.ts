import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';

class OpenAlaskaCoordinatesAction extends Action2 {

	static readonly ID = 'alaska.openCoordinates';

	constructor() {
		super({
			id: OpenAlaskaCoordinatesAction.ID,
			title: localize2('alaska.openCoordinates', 'Alaska: Workspace Coordinates'),
			category: localize2('alaska.category', 'Alaska AI'),
			f1: true,
			menu: [{
				id: MenuId.GlobalActivity,
				group: '1_alaska',
				order: 1
			}]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);
		const fileService = accessor.get(IFileService);
		const labelService = accessor.get(ILabelService);
		const extensionService = accessor.get(IExtensionService);

		const state = workspaceContextService.getWorkbenchState();
		const workspace = workspaceContextService.getWorkspace();

		const items: (IQuickPickItem | IQuickPickSeparator)[] = [];

		if (state === WorkbenchState.EMPTY) {
			items.push({
				type: 'separator',
				label: localize('alaska.coord.workspace', 'workspace')
			});
			items.push({
				label: localize('alaska.coord.noWorkspace', '· no folder open'),
				description: ''
			});
		} else {
			items.push({
				type: 'separator',
				label: state === WorkbenchState.WORKSPACE
					? localize('alaska.coord.multiRoot', 'multi-root workspace')
					: localize('alaska.coord.folder', 'folder')
			});

			if (workspace.configuration) {
				items.push({
					label: labelService.getWorkspaceLabel(workspace, { verbose: 2 }),
					description: workspace.configuration.fsPath
				});
			}

			for (const folder of workspace.folders) {
				let fileCount = 0;
				try {
					const stat = await fileService.resolve(folder.uri, { resolveTo: [] });
					fileCount = countFiles(stat);
				} catch {
					fileCount = -1;
				}
				items.push({
					label: `📁 ${folder.name}`,
					description: folder.uri.fsPath,
					detail: fileCount >= 0
						? localize('alaska.coord.fileCount', '{0} files', fileCount)
						: localize('alaska.coord.fileCountUnknown', 'unindexed')
				});
			}
		}

		await extensionService.whenInstalledExtensionsRegistered();
		const ext = extensionService.extensions.length;
		items.push({ type: 'separator', label: localize('alaska.coord.runtime', 'runtime') });
		items.push({
			label: localize('alaska.coord.extensions', '· {0} extensions loaded', ext)
		});

		const pick = quickInputService.createQuickPick({ useSeparators: true });
		pick.items = items;
		pick.title = localize('alaska.coord.title', 'Alaska Coordinates · workspace context');
		pick.placeholder = localize('alaska.coord.placeholder', 'workspace ↔ runtime ↔ session');
		pick.canSelectMany = false;
		pick.matchOnDescription = true;
		pick.matchOnDetail = true;
		pick.show();
	}
}

function countFiles(stat: { isDirectory?: boolean; children?: readonly { isDirectory?: boolean; children?: readonly any[] }[] }): number {
	let count = 0;
	if (stat.isDirectory && stat.children) {
		for (const c of stat.children) {
			if (c.isDirectory) {
				count += countFiles(c);
			} else {
				count += 1;
			}
		}
	} else if (!stat.isDirectory) {
		count = 1;
	}
	return count;
}

registerAction2(OpenAlaskaCoordinatesAction);
