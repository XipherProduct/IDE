import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { ICodeEditor, IOverlayWidget, IOverlayWidgetPosition, OverlayWidgetPositionPreference } from '../../../browser/editorBrowser.js';
import { IEditorContribution } from '../../../common/editorCommon.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { localize } from '../../../../nls.js';
import { ITextModel } from '../../../common/model.js';

const HOST_WIDTH = 48;
const PADDING_X = 6;
const PADDING_Y = 14;
const FN_REGEX = /^(?:\s*)(?:export\s+)?(?:async\s+)?(?:function\*?\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(|([A-Za-z_$][\w$]*)\s*:\s*function|([A-Za-z_$][\w$]*)\s*=\s*function|public\s+([A-Za-z_$][\w$]*)\s*\(|private\s+([A-Za-z_$][\w$]*)\s*\(|def\s+([A-Za-z_$][\w$]*)|fn\s+([A-Za-z_$][\w$]*))/;

interface ILineSample {
	altitude: number;
	indent: number;
	length: number;
}

interface IFunctionMarker {
	line: number;
	name: string;
}

const CONFIG_KEY = 'editor.alaskaAltitudeProfile.enabled';

const configRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configRegistry.registerConfiguration({
	id: 'editor.alaskaAltitudeProfile',
	order: 100,
	type: 'object',
	title: localize('alaska.altitude.title', 'Alaska Altitude Profile'),
	properties: {
		[CONFIG_KEY]: {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			description: localize('alaska.altitude.enabled', 'Render the Alaska altitude profile in place of the standard minimap.')
		}
	}
});

class AltitudeOverlayWidget implements IOverlayWidget {

	static readonly ID = 'editor.contrib.alaskaAltitudeProfileWidget';

	readonly domNode: HTMLElement;
	readonly canvas: HTMLCanvasElement;
	readonly shimmer: HTMLElement;
	readonly indicator: HTMLElement;
	readonly indicatorLabel: HTMLElement;

	constructor() {
		this.domNode = document.createElement('div');
		this.domNode.className = 'alaska-altitude-host';
		this.canvas = document.createElement('canvas');
		this.canvas.className = 'alaska-altitude-canvas';
		this.shimmer = document.createElement('div');
		this.shimmer.className = 'alaska-altitude-shimmer';
		this.indicator = document.createElement('div');
		this.indicator.className = 'alaska-altitude-indicator';
		this.indicatorLabel = document.createElement('span');
		this.indicatorLabel.className = 'label';
		this.indicator.appendChild(this.indicatorLabel);
		this.domNode.appendChild(this.canvas);
		this.domNode.appendChild(this.shimmer);
		this.domNode.appendChild(this.indicator);
	}

	getId(): string {
		return AltitudeOverlayWidget.ID;
	}

	getDomNode(): HTMLElement {
		return this.domNode;
	}

	getPosition(): IOverlayWidgetPosition {
		return { preference: OverlayWidgetPositionPreference.TOP_RIGHT_CORNER };
	}

	getMinContentWidthInPx(): number {
		return HOST_WIDTH;
	}
}

export class AlaskaAltitudeProfile extends Disposable implements IEditorContribution {

	static readonly ID = 'editor.contrib.alaskaAltitudeProfile';

	private readonly widget: AltitudeOverlayWidget;
	private samples: ILineSample[] = [];
	private markers: IFunctionMarker[] = [];
	private maxAltitude = 1;
	private dpr = 1;
	private hostHeight = 0;
	private installed = false;

	private readonly recompute: RunOnceScheduler;
	private readonly render: RunOnceScheduler;
	private readonly _onDidUpdate = this._register(new Emitter<void>());

	constructor(
		private readonly editor: ICodeEditor,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();

		this.widget = new AltitudeOverlayWidget();
		this.recompute = this._register(new RunOnceScheduler(() => this.computeAltitudes(), 60));
		this.render = this._register(new RunOnceScheduler(() => this.drawProfile(), 16));

		this._register(this.editor.onDidChangeModel(() => {
			this.recompute.schedule();
		}));
		this._register(this.editor.onDidChangeModelContent(() => {
			this.recompute.schedule();
		}));
		this._register(this.editor.onDidChangeCursorPosition(() => {
			this.updateIndicator();
		}));
		this._register(this.editor.onDidScrollChange(() => {
			this.render.schedule();
		}));
		this._register(this.editor.onDidLayoutChange(() => {
			this.fitToLayout();
			this.render.schedule();
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(CONFIG_KEY)) {
				this.syncVisibility();
			}
		}));

		this.syncVisibility();
		this.recompute.schedule();
	}

	private syncVisibility(): void {
		const enabled = this.configurationService.getValue<boolean>(CONFIG_KEY) ?? false;
		if (enabled) {
			if (!this.installed) {
				this.editor.addOverlayWidget(this.widget);
				this.installed = true;
			}
			this.widget.domNode.classList.remove('disabled');
			this.fitToLayout();
		} else {
			if (this.installed) {
				this.editor.removeOverlayWidget(this.widget);
				this.installed = false;
			}
		}
	}

	private fitToLayout(): void {
		const layoutInfo = this.editor.getLayoutInfo();
		const host = this.widget.domNode;
		host.style.top = '0px';
		host.style.right = '0px';
		host.style.width = `${HOST_WIDTH}px`;
		host.style.height = `${layoutInfo.height}px`;
		this.hostHeight = layoutInfo.height;
		this.dpr = window.devicePixelRatio || 1;
		const canvas = this.widget.canvas;
		canvas.width = Math.max(1, Math.floor(HOST_WIDTH * this.dpr));
		canvas.height = Math.max(1, Math.floor(layoutInfo.height * this.dpr));
		canvas.style.width = `${HOST_WIDTH}px`;
		canvas.style.height = `${layoutInfo.height}px`;
	}

	private computeAltitudes(): void {
		const model = this.editor.getModel();
		if (!model) {
			this.samples = [];
			this.markers = [];
			this.maxAltitude = 1;
			this.render.schedule();
			return;
		}
		const lineCount = model.getLineCount();
		const samples: ILineSample[] = new Array(lineCount);
		const markers: IFunctionMarker[] = [];
		let maxAlt = 1;
		const indentSize = model.getOptions().indentSize;
		const tabSize = model.getOptions().tabSize;

		for (let i = 1; i <= lineCount; i++) {
			const text = model.getLineContent(i);
			const indent = this.measureIndent(text, indentSize, tabSize);
			const length = text.length;
			const altitude = indent * 28 + Math.min(length, 120) * 0.6;
			samples[i - 1] = { altitude, indent, length };
			if (altitude > maxAlt) {
				maxAlt = altitude;
			}
			const fnMatch = FN_REGEX.exec(text);
			if (fnMatch) {
				const name = fnMatch.slice(1).find(Boolean) ?? '';
				markers.push({ line: i, name });
			}
		}
		this.samples = samples;
		this.markers = markers;
		this.maxAltitude = maxAlt;
		this._onDidUpdate.fire();
		this.render.schedule();
	}

	private measureIndent(text: string, indentSize: number, tabSize: number): number {
		let visual = 0;
		for (let i = 0; i < text.length; i++) {
			const c = text.charCodeAt(i);
			if (c === 32) {
				visual += 1;
			} else if (c === 9) {
				visual += tabSize;
			} else {
				break;
			}
		}
		return visual / Math.max(1, indentSize);
	}

	private drawProfile(): void {
		const model = this.editor.getModel();
		if (!model || this.samples.length === 0 || this.hostHeight <= 0) {
			this.clearCanvas();
			return;
		}

		const canvas = this.widget.canvas;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}
		ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		ctx.clearRect(0, 0, HOST_WIDTH, this.hostHeight);

		const w = HOST_WIDTH - PADDING_X * 2;
		const h = this.hostHeight - PADDING_Y * 2;
		const x0 = PADDING_X;
		const y0 = PADDING_Y;
		const lineCount = this.samples.length;
		if (lineCount === 0 || w <= 0 || h <= 0) {
			return;
		}

		ctx.strokeStyle = 'rgba(40, 50, 63, 0.55)';
		ctx.lineWidth = 0.6;
		for (let pct = 0.0; pct <= 1.0; pct += 0.0833) {
			const yLine = y0 + h * pct;
			ctx.beginPath();
			ctx.moveTo(x0, yLine);
			ctx.lineTo(x0 + w, yLine);
			ctx.stroke();
		}

		const pts: { x: number; y: number }[] = [];
		for (let i = 0; i < lineCount; i++) {
			const t = lineCount === 1 ? 0.5 : i / (lineCount - 1);
			const y = y0 + h * t;
			const normalised = this.samples[i].altitude / Math.max(1, this.maxAltitude);
			const x = x0 + w - normalised * w * 0.78;
			pts.push({ x, y });
		}

		const ribbon = ctx.createLinearGradient(x0, y0, x0 + w, y0);
		ribbon.addColorStop(0.0, 'rgba(92, 214, 168, 0.02)');
		ribbon.addColorStop(0.45, 'rgba(92, 214, 168, 0.18)');
		ribbon.addColorStop(0.7, 'rgba(92, 214, 168, 0.35)');
		ribbon.addColorStop(0.95, 'rgba(92, 214, 168, 0.04)');
		ctx.save();
		ctx.fillStyle = ribbon;
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length; i++) {
			ctx.lineTo(pts[i].x, pts[i].y);
		}
		ctx.lineTo(x0 + w, y0 + h);
		ctx.lineTo(x0 + w, y0);
		ctx.closePath();
		ctx.fill();
		ctx.restore();

		ctx.save();
		ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
		ctx.lineWidth = 1.0;
		ctx.lineJoin = 'miter';
		ctx.lineCap = 'butt';
		ctx.beginPath();
		ctx.moveTo(pts[0].x + 6, pts[0].y);
		for (let i = 1; i < pts.length; i++) {
			ctx.lineTo(pts[i].x + 6, pts[i].y);
		}
		ctx.stroke();
		ctx.restore();

		ctx.save();
		ctx.shadowColor = 'rgba(92, 214, 168, 0.95)';
		ctx.shadowBlur = 8;
		ctx.strokeStyle = '#5cd6a8';
		ctx.lineWidth = 1.6;
		ctx.lineJoin = 'miter';
		ctx.lineCap = 'butt';
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length; i++) {
			ctx.lineTo(pts[i].x, pts[i].y);
		}
		ctx.stroke();
		ctx.restore();

		ctx.fillStyle = '#5cd6a8';
		for (const m of this.markers) {
			if (m.line < 1 || m.line > lineCount) {
				continue;
			}
			const t = lineCount === 1 ? 0.5 : (m.line - 1) / (lineCount - 1);
			const y = y0 + h * t;
			const normalised = this.samples[m.line - 1].altitude / Math.max(1, this.maxAltitude);
			const x = x0 + w - normalised * w * 0.78;
			ctx.save();
			ctx.shadowColor = 'rgba(92, 214, 168, 1)';
			ctx.shadowBlur = 6;
			ctx.beginPath();
			ctx.arc(x, y, 2.6, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}

		this.updateIndicator();
	}

	private clearCanvas(): void {
		const ctx = this.widget.canvas.getContext('2d');
		if (!ctx) {
			return;
		}
		ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		ctx.clearRect(0, 0, HOST_WIDTH, this.hostHeight);
	}

	private updateIndicator(): void {
		const model = this.editor.getModel();
		const pos = this.editor.getPosition();
		if (!model || !pos || this.samples.length === 0) {
			this.widget.indicator.style.top = '-100px';
			return;
		}
		const lineCount = model.getLineCount();
		const t = lineCount === 1 ? 0.5 : (pos.lineNumber - 1) / (lineCount - 1);
		const y = PADDING_Y + (this.hostHeight - PADDING_Y * 2) * t;
		this.widget.indicator.style.top = `${y - 7}px`;
		this.widget.indicatorLabel.textContent = String(pos.lineNumber);
	}

	override dispose(): void {
		if (this.installed) {
			this.editor.removeOverlayWidget(this.widget);
			this.installed = false;
		}
		super.dispose();
	}
}

export type { ITextModel };
