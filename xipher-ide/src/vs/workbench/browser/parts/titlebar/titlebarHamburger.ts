/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, EventType } from '../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { IAction } from '../../../../base/common/actions.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { MenuId, IMenuService } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITitlebarZoneContext, ITitlebarZoneContribution, TitlebarZone, TitlebarZoneRegistry } from './titlebarZones.js';

class TitlebarHamburgerWidget extends Disposable {

	constructor(
		parent: HTMLElement,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IMenuService private readonly menuService: IMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
	) {
		super();

		const button = append(parent, $<HTMLButtonElement>('button.alaska-titlebar-hamburger'));
		button.type = 'button';
		button.setAttribute('aria-label', localize('alaska.hamburger.aria', 'Open menu'));
		button.setAttribute('tabindex', '0');
		button.textContent = '☰'; // ≡

		this._register(addDisposableListener(button, EventType.CLICK, (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.openMainMenu(button, e);
		}));

		this._register(addDisposableListener(button, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this.openMainMenu(button);
			}
		}));

		this._register({ dispose: () => button.remove() });
	}

	private openMainMenu(anchor: HTMLElement, originatingEvent?: MouseEvent): void {
		const menu = this.menuService.createMenu(MenuId.MenubarMainMenu, this.contextKeyService);
		try {
			const actions: IAction[] = [];
			for (const [, group] of menu.getActions({ shouldForwardArgs: true })) {
				actions.push(...group);
			}
			this.contextMenuService.showContextMenu({
				getAnchor: () => originatingEvent ? new StandardMouseEvent(anchor.ownerDocument.defaultView!, originatingEvent) : anchor,
				getActions: () => actions,
				contextKeyService: this.contextKeyService,
				onHide: () => menu.dispose(),
			});
		} catch (err) {
			menu.dispose();
			throw err;
		}
	}
}

class TitlebarHamburgerContribution implements ITitlebarZoneContribution {
	readonly id = 'titlebar.hamburger';
	readonly zone = TitlebarZone.Left;
	readonly order = 200; // after brand (order 100)

	create(container: HTMLElement, instantiationService: IInstantiationService, _context: ITitlebarZoneContext): IDisposable {
		return instantiationService.createInstance(TitlebarHamburgerWidget, container);
	}
}

TitlebarZoneRegistry.register(new TitlebarHamburgerContribution());
