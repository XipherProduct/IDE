/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, getWindow } from '../../../../base/browser/dom.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITitlebarZoneContext, ITitlebarZoneContribution, TitlebarZone, TitlebarZoneRegistry } from './titlebarZones.js';

class AlaskaBrandWidget extends Disposable {
	readonly element: HTMLElement;

	constructor(parent: HTMLElement) {
		super();

		const brand = append(parent, $('div.alaska-brand'));
		brand.setAttribute('role', 'img');
		brand.setAttribute('aria-label', 'Alaska AI');

		const mark = append(brand, $('span.alaska-brand-mark'));
		const SVG_NS = 'http://www.w3.org/2000/svg';
		const doc = getWindow(parent).document;
		const mkPath = (d: string, attrs: Record<string, string>): SVGPathElement => {
			const p = doc.createElementNS(SVG_NS, 'path');
			p.setAttribute('d', d);
			for (const [k, v] of Object.entries(attrs)) {
				p.setAttribute(k, v);
			}
			return p;
		};
		const svg = doc.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 26 26');
		svg.setAttribute('fill', 'none');
		svg.appendChild(mkPath('M13 1 L25 13 L13 25 L1 13 Z', { stroke: 'var(--alaska-ice, #7dd3fc)', 'stroke-width': '1.2', 'stroke-opacity': '.4' }));
		svg.appendChild(mkPath('M13 4 L22 13 L13 22 L4 13 Z', { fill: 'var(--alaska-ice, #7dd3fc)', 'fill-opacity': '.18' }));
		svg.appendChild(mkPath('M13 7 L19 13 L13 19 L7 13 Z', { fill: 'var(--alaska-ice, #7dd3fc)' }));
		mark.appendChild(svg);

		const text = append(brand, $('span.alaska-brand-text'));
		const bold = append(text, $('b'));
		bold.textContent = 'Alaska';
		const dot = append(text, $('span.alaska-brand-dot'));
		dot.textContent = '-AI';

		this.element = brand;
		this._register({ dispose: () => brand.remove() });
	}
}

class AlaskaBrandContribution implements ITitlebarZoneContribution {
	readonly id = 'alaska.brand';
	readonly zone = TitlebarZone.Left;
	readonly order = 100;

	create(container: HTMLElement, _instantiationService: IInstantiationService, _context: ITitlebarZoneContext): IDisposable {
		return new AlaskaBrandWidget(container);
	}
}

TitlebarZoneRegistry.register(new AlaskaBrandContribution());
