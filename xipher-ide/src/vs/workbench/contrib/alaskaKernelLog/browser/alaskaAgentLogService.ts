import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaLogLevel = 'ok' | 'info' | 'warn' | 'error';

export type AlaskaLogSource = 'indexer' | 'lsp' | 'watcher' | 'agent' | 'grep' | 'scm' | 'auth' | 'net' | string;

export interface IAlaskaLogEvent {
	readonly timestamp: number;
	readonly source: AlaskaLogSource;
	readonly level: AlaskaLogLevel;
	readonly message: string;
}

export const IAlaskaAgentLogService = createDecorator<IAlaskaAgentLogService>('alaskaAgentLogService');

export interface IAlaskaAgentLogService {
	readonly _serviceBrand: undefined;
	readonly onDidLogEvent: Event<IAlaskaLogEvent>;
	readonly buffer: ReadonlyArray<IAlaskaLogEvent>;
	log(source: AlaskaLogSource, level: AlaskaLogLevel, message: string): void;
	clear(): void;
}

const RING_BUFFER_SIZE = 200;

export class AlaskaAgentLogService extends Disposable implements IAlaskaAgentLogService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidLogEvent = this._register(new Emitter<IAlaskaLogEvent>());
	readonly onDidLogEvent: Event<IAlaskaLogEvent> = this._onDidLogEvent.event;

	private readonly _buffer: IAlaskaLogEvent[] = [];

	get buffer(): ReadonlyArray<IAlaskaLogEvent> {
		return this._buffer;
	}

	log(source: AlaskaLogSource, level: AlaskaLogLevel, message: string): void {
		const event: IAlaskaLogEvent = {
			timestamp: Date.now(),
			source,
			level,
			message,
		};
		this._buffer.push(event);
		if (this._buffer.length > RING_BUFFER_SIZE) {
			this._buffer.shift();
		}
		this._onDidLogEvent.fire(event);
	}

	clear(): void {
		this._buffer.length = 0;
	}
}
