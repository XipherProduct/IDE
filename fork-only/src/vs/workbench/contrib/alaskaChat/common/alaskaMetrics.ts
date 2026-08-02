/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaMetricLabels = Readonly<Record<string, string>>;

export interface IHistogramSnapshot {
	readonly name: string;
	readonly count: number;
	readonly sumMs: number;
	readonly buckets: Readonly<Record<string, number>>;
	readonly labels?: AlaskaMetricLabels;
}

export interface IMetricsSnapshot {
	readonly takenAt: number;
	readonly histograms: readonly IHistogramSnapshot[];
	readonly counters: Readonly<Record<string, number>>;
	readonly gauges: Readonly<Record<string, number>>;
}

export const IAlaskaMetricsService = createDecorator<IAlaskaMetricsService>('alaskaMetricsService');

export interface IAlaskaMetricsService {
	readonly _serviceBrand: undefined;
	histogram(name: string, valueMs: number, labels?: AlaskaMetricLabels): void;
	counter(name: string, delta?: number, labels?: AlaskaMetricLabels): void;
	gauge(name: string, value: number, labels?: AlaskaMetricLabels): void;
	snapshot(): IMetricsSnapshot;
	reset(): void;
}

export const ALASKA_HISTOGRAM_BUCKETS_MS: readonly number[] = [10, 25, 50, 100, 200, 500, 1000, 2500, 5000, 10000];

export function buildMetricKey(name: string, labels?: AlaskaMetricLabels): string {
	if (!labels) {
		return name;
	}
	const parts: string[] = [];
	for (const k of Object.keys(labels).sort()) {
		parts.push(`${k}=${labels[k]}`);
	}
	return parts.length > 0 ? `${name}{${parts.join(',')}}` : name;
}
