/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerDefaultConfigurations([{
	overrides: {
		'editor.minimap.enabled': false,
		'editor.alaskaAltitudeProfile.enabled': true,
		'editor.fontFamily': '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
		'editor.fontSize': 13,
		'editor.lineHeight': 1.75,
		'editor.cursorBlinking': 'smooth',
		'editor.cursorWidth': 2,
		'editor.smoothScrolling': true,
		'editor.guides.indentation': true,
		'editor.guides.bracketPairs': false,
		'editor.renderLineHighlight': 'line',
		'editor.renderLineHighlightOnlyWhenFocus': true,
		'editor.padding.top': 14,
		'editor.padding.bottom': 14,
		'editor.scrollbar.verticalScrollbarSize': 6,
		'editor.scrollbar.horizontalScrollbarSize': 6,
		'editor.overviewRulerBorder': false,
		'editor.hideCursorInOverviewRuler': true,
		'editor.bracketPairColorization.enabled': false,
		'editor.stickyScroll.enabled': false,

		'workbench.editor.showTabs': 'multiple',
		'workbench.editor.tabSizing': 'fit',
		'workbench.editor.tabCloseButton': 'right',
		'workbench.editor.labelFormat': 'short',
		'workbench.activityBar.location': 'default',
		'workbench.statusBar.visible': true,
		'workbench.sideBar.location': 'left',
		'workbench.tree.indent': 14,
		'workbench.tree.renderIndentGuides': 'none',
		'workbench.list.smoothScrolling': true,
		'workbench.layoutControl.enabled': false,
		'breadcrumbs.enabled': true,
		'breadcrumbs.icons': false,

		'window.titleBarStyle': 'custom',
		'window.menuBarVisibility': 'visible',
		'window.commandCenter': false,
		'window.customTitleBarVisibility': 'auto',
		'window.density.editorTabHeight': 'default',

		'workbench.startupEditor': 'none',
		'workbench.editor.pinnedTabsOnSeparateRow': false,
		'workbench.editor.tabActionLocation': 'right',
		'workbench.editor.scrollToSwitchTabs': true,

		'terminal.integrated.fontFamily': '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
		'terminal.integrated.fontSize': 12,
		'terminal.integrated.lineHeight': 1.4,
		'terminal.integrated.cursorBlinking': true,
		'terminal.integrated.cursorStyle': 'line',
	},
	source: { id: 'alaska-ai.defaults', displayName: 'Alaska AI' },
}]);
