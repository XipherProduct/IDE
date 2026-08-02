/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	AlaskaMetricLabels,
	ALASKA_HISTOGRAM_BUCKETS_MS,
	IAlaskaMetricsService,
	IHistogramSnapshot,
	IMetricsSnapshot,
	buildMetricKey,
} from '../common/alaskaMetrics.js';

interface IHistogramBucket {
	readonly name: string;
	readonly labels: AlaskaMetricLabels | undefined;
	count: number;
	sumMs: number;
	readonly buckets: Record<string, number>;
}

export class AlaskaMetricsService extends Disposable implements IAlaskaMetricsService {
	declare readonly _serviceBrand: undefined;

	private readonly histograms = new Map<string, IHistogramBucket>();
	private readonly counters = new Map<string, { value: number; labels?: AlaskaMetricLabels }>();
	private readonly gauges = new Map<string, { value: number; labels?: AlaskaMetricLabels }>();

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	histogram(name: string, valueMs: number, labels?: AlaskaMetricLabels): void {
		if (!Number.isFinite(valueMs) || valueMs < 0) {
			return;
		}
		const key = buildMetricKey(name, labels);
		let bucket = this.histograms.get(key);
		if (!bucket) {
			bucket = { name, labels, count: 0, sumMs: 0, buckets: emptyBuckets() };
			this.histograms.set(key, bucket);
		}
		bucket.count++;
		bucket.sumMs += valueMs;
		for (const b of ALASKA_HISTOGRAM_BUCKETS_MS) {
			if (valueMs <= b) {
				bucket.buckets[`${b}`]++;
			}
		}
		bucket.buckets['+Inf']++;
	}

	counter(name: string, delta = 1, labels?: AlaskaMetricLabels): void {
		const key = buildMetricKey(name, labels);
		const entry = this.counters.get(key);
		if (entry) {
			entry.value += delta;
		} else {
			this.counters.set(key, { value: delta, labels });
		}
	}

	gauge(name: string, value: number, labels?: AlaskaMetricLabels): void {
		const key = buildMetricKey(name, labels);
		this.gauges.set(key, { value, labels });
	}

	snapshot(): IMetricsSnapshot {
		const histograms: IHistogramSnapshot[] = [];
		for (const h of this.histograms.values()) {
			histograms.push({
				name: h.name,
				count: h.count,
				sumMs: h.sumMs,
				buckets: { ...h.buckets },
				labels: h.labels,
			});
		}
		const counters: Record<string, number> = {};
		for (const [key, entry] of this.counters) {
			counters[key] = entry.value;
		}
		const gauges: Record<string, number> = {};
		for (const [key, entry] of this.gauges) {
			gauges[key] = entry.value;
		}
		return { takenAt: Date.now(), histograms, counters, gauges };
	}

	reset(): void {
		this.histograms.clear();
		this.counters.clear();
		this.gauges.clear();
	}

	dumpToLog(prefix: string = '[alaska.metrics]'): void {
		const snap = this.snapshot();
		for (const h of snap.histograms) {
			const avg = h.count > 0 ? (h.sumMs / h.count).toFixed(1) : '0';
			this.logService.info(`${prefix} histogram ${h.name} count=${h.count} avg=${avg}ms labels=${labelString(h.labels)}`);
		}
		for (const [key, val] of Object.entries(snap.counters)) {
			this.logService.info(`${prefix} counter ${key} = ${val}`);
		}
		for (const [key, val] of Object.entries(snap.gauges)) {
			this.logService.info(`${prefix} gauge ${key} = ${val}`);
		}
	}
}

function emptyBuckets(): Record<string, number> {
	const out: Record<string, number> = {};
	for (const b of ALASKA_HISTOGRAM_BUCKETS_MS) {
		out[`${b}`] = 0;
	}
	out['+Inf'] = 0;
	return out;
}

function labelString(labels: AlaskaMetricLabels | undefined): string {
	if (!labels) {
		return '{}';
	}
	const parts: string[] = [];
	for (const k of Object.keys(labels).sort()) {
		parts.push(`${k}=${labels[k]}`);
	}
	return `{${parts.join(',')}}`;
}
