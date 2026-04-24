import { numberFormat } from "../utils.js";
import {
  findBoxes,
  getNumberArrayField,
  getNumberField,
  getNumberFromStruct,
  getStructArrayField,
} from "./box_access.js";
import {
  formatBitrate,
  formatByteSize,
  formatFrameRate,
  formatNumber,
  formatPercent,
  formatTicksWithTime,
} from "./format.js";
import { isSyncSampleFlags } from "./sample-utils.js";

/**
 * @typedef {{
 *   segmentType: string,
 *   majorBrand: string | null,
 *   compatibleBrands: string[],
 *   durationLabel: string,
 *   trackCount: number,
 *   isFragmented: boolean,
 *   fastStart: "yes" | "no" | "unknown",
 *   totalSize: number,
 *   metadataSize: number,
 *   mdatSize: number,
 *   tracks: TrackInfo[],
 *   fragments: FragmentInfo[],
 *   sampleViews: SampleView[],
 *   hints: string[],
 * }} MediaInfo
 *
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   codec: string,
 *   durationLabel: string,
 *   timescale: number | null,
 *   dimensions: string | null,
 *   audio: string | null,
 *   language: string | null,
 *   samples: string | null,
 *   syncSamples: string | null,
 *   sampleSize: string | null,
 *   sampleSizeDetails: string[],
 *   timing: string | null,
 *   timingDetails: string[],
 *   gop: string | null,
 *   gops: GopRun[],
 *   frameArrangement: string | null,
 *   sampleTimeline: SampleTimeline | null,
 *   sampleView: SampleView | null,
 *   details: string[],
 * }} TrackInfo
 *
 * @typedef {{
 *   sequence: string,
 *   trackId: string,
 *   baseDecodeTime: string,
 *   decodeWindow: string | null,
 *   sampleCount: number,
 *   duration: string | null,
 *   sampleSize: string | null,
 *   sampleSizeDetails: string[],
 *   timing: string | null,
 *   timingDetails: string[],
 *   gops: GopRun[],
 *   frameArrangement: string | null,
 *   sampleTimeline: SampleTimeline | null,
 *   sampleView: SampleView | null,
 * }} FragmentInfo
 *
 * @typedef {{
 *   startSample: number,
 *   sampleCount: number,
 *   totalBytes: number | null,
 *   known: boolean,
 * }} GopRun
 *
 * @typedef {{
 *   sampleCount: number,
 *   constantSize: number | null,
 *   entries: number[],
 * }} SampleSizeSource
 *
 * @typedef {{
 *   sampleCount: number,
 *   totalDuration: number | null,
 *   summary: string | null,
 *   details: string[],
 * }} TimingAnalysis
 *
 * @typedef {{
 *   count: number,
 *   value: number | null,
 * }} SampleValueRun
 *
 * @typedef {{
 *   index: number,
 *   dts: number | null,
 *   pts: number | null,
 *   duration: number | null,
 *   size: number | null,
 *   isSync: boolean | null,
 *   sampleDependsOn: number | null,
 *   sampleIsDependedOn: number | null,
 *   sampleHasRedundancy: number | null,
 *   kind: import("./sample-utils.js").SampleClass,
 * }} SampleRow
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   kind: "track" | "fragment",
 *   totalSamples: number,
 *   timescale: number | null,
 *   note: string | null,
 *   getRows: (startSample: number, count: number) => SampleRow[],
 * }} SampleView
 *
 * @typedef {{
 *   index: number,
 *   kind: import("./sample-utils.js").SampleClass,
 *   label: string,
 *   title: string,
 * }} SamplePoint
 * @typedef {{
 *   samples: SamplePoint[],
 *   totalSamples: number,
 *   limited: boolean,
 *   counts: Record<import("./sample-utils.js").SampleClass, number>,
 * }} SampleTimeline
 */

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} stts
 * @param {number | null} timescale
 * @param {string} trackKind
 * @returns {TimingAnalysis}
 */
export function analyzeTrackTiming(stts, timescale, trackKind) {
  const entries = getStructArrayField(stts, "entries");
  if (!entries.length) {
    return { sampleCount: 0, totalDuration: null, summary: null, details: [] };
  }
  const runs = entries.map((entry) => ({
    count: getNumberFromStruct(entry, "sample_count") ?? 0,
    duration: getNumberFromStruct(entry, "sample_delta"),
  }));
  return analyzeDurationRuns(runs, timescale, trackKind);
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} tfhd
 * @param {number | null} fallbackDuration
 * @param {number | null} timescale
 * @param {string} trackKind
 * @returns {TimingAnalysis}
 */
export function analyzeFragmentTiming(
  truns,
  tfhd,
  fallbackDuration,
  timescale,
  trackKind,
) {
  const defaultSampleDuration =
    getNumberField(tfhd, "default_sample_duration") ?? fallbackDuration;
  const runs = [];
  for (const trun of truns) {
    const trunSamples = getStructArrayField(trun, "samples");
    const trunSampleCount =
      getNumberField(trun, "sample_count") ?? trunSamples.length;
    for (let i = 0; i < trunSampleCount; i++) {
      const sample = trunSamples[i];
      runs.push({
        count: 1,
        duration:
          getNumberFromStruct(sample, "sample_duration") ??
          defaultSampleDuration,
      });
    }
  }
  return analyzeDurationRuns(runs, timescale, trackKind);
}

/**
 * @param {Array<{ count: number, duration: number | null }>} runs
 * @param {number | null} timescale
 * @param {string} trackKind
 * @returns {TimingAnalysis}
 */
export function analyzeDurationRuns(runs, timescale, trackKind) {
  let sampleCount = 0;
  let totalDuration = 0;
  let hasKnownDuration = false;
  let minDuration = Number.POSITIVE_INFINITY;
  let maxDuration = 0;
  const distinctDurations = new Set();
  const durationCounts = new Map();

  for (const run of runs) {
    if (!run.count) {
      continue;
    }
    sampleCount += run.count;
    if (run.duration == null) {
      continue;
    }
    hasKnownDuration = true;
    totalDuration += run.duration * run.count;
    minDuration = Math.min(minDuration, run.duration);
    maxDuration = Math.max(maxDuration, run.duration);
    distinctDurations.add(run.duration);
    durationCounts.set(
      run.duration,
      (durationCounts.get(run.duration) ?? 0) + run.count,
    );
  }

  if (!sampleCount || !hasKnownDuration) {
    return { sampleCount, totalDuration: null, summary: null, details: [] };
  }

  const summary =
    distinctDurations.size === 1
      ? getConstantTimingSummary(minDuration, timescale, trackKind)
      : `variable sample duration: ${numberFormat(distinctDurations.size)} deltas, ${formatTicksWithTime(minDuration, timescale)} to ${formatTicksWithTime(maxDuration, timescale)}`;
  const details = [];

  if (distinctDurations.size > 1) {
    const dominantDuration = [...durationCounts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];
    if (dominantDuration) {
      details.push(
        `most common duration is ${formatTicksWithTime(dominantDuration[0], timescale)} for ${formatPercent(dominantDuration[1] / sampleCount)} of samples`,
      );
    }
  }

  return { sampleCount, totalDuration, summary, details };
}

/**
 * @param {SampleSizeSource | null} sampleSizes
 * @param {GopRun[]} gops
 * @param {{ totalDuration: number | null, timescale: number | null }} [timing]
 */
export function analyzeSampleSizes(
  sampleSizes,
  gops,
  timing = { totalDuration: null, timescale: null },
) {
  if (!sampleSizes) {
    return { summary: null, details: [] };
  }

  const { sampleCount, constantSize, entries } = sampleSizes;
  if (!sampleCount) {
    return { summary: null, details: [] };
  }

  let totalBytes = 0;
  let maxSize = 0;
  let spikeCount = 0;
  let largestSpikeRatio = 1;

  if (constantSize != null) {
    totalBytes = constantSize * sampleCount;
    maxSize = constantSize;
  } else {
    for (const size of entries) {
      totalBytes += size;
      maxSize = Math.max(maxSize, size);
    }
    const average = totalBytes / sampleCount;
    for (const size of entries) {
      if (size >= average * 2) {
        spikeCount++;
        largestSpikeRatio = Math.max(largestSpikeRatio, size / average);
      }
    }
  }

  const averageSize = totalBytes / sampleCount;
  const summary =
    constantSize != null
      ? `fixed ${formatByteSize(constantSize)} samples`
      : `${formatByteSize(averageSize)} avg, ${formatByteSize(maxSize)} max`;
  const details = [];

  if (constantSize == null) {
    if (spikeCount > 0) {
      details.push(
        `${numberFormat(spikeCount)} samples are at least 2x the average; largest spike is ${formatNumber(largestSpikeRatio)}x`,
      );
    } else {
      details.push("no major sample-size spikes relative to the average");
    }
  }

  if (timing.totalDuration && timing.timescale) {
    details.push(
      `average payload rate ${formatBitrate((totalBytes * 8 * timing.timescale) / timing.totalDuration)}`,
    );
  }

  const gopBytes = gops
    .map((gop) => gop.totalBytes)
    .filter((value) => value != null);
  if (gopBytes.length === gops.length && gopBytes.length > 1) {
    const averageGopBytes =
      gopBytes.reduce((sum, value) => sum + value, 0) / gopBytes.length;
    const maxGopBytes = Math.max(...gopBytes);
    details.push(
      `GOP byte weight avg ${formatByteSize(averageGopBytes)}, max ${formatByteSize(maxGopBytes)}`,
    );
  }

  return { summary, details };
}

/**
 * @param {GopRun[]} gops
 * @param {number | null} sampleCount
 */
export function getGopDescription(gops, sampleCount) {
  if (gops.length <= 1) {
    return null;
  }
  const lengths = gops.map((gop) => gop.sampleCount);
  const avg = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  const max = Math.max(...lengths);
  const suffix = sampleCount
    ? ` across ${numberFormat(sampleCount)} samples`
    : "";
  return `${numberFormat(gops.length)} groups, avg ${formatNumber(avg)}, max ${numberFormat(max)} samples${suffix}`;
}

/**
 * @param {number[]} syncSampleNumbers
 * @param {number | null} sampleCount
 * @param {SampleSizeSource | null} [sampleSizes]
 * @returns {GopRun[]}
 */
export function getGopsFromSyncSamples(
  syncSampleNumbers,
  sampleCount,
  sampleSizes = null,
) {
  if (!syncSampleNumbers.length) {
    return [];
  }
  return syncSampleNumbers.map((sampleNumber, index) => {
    const next =
      syncSampleNumbers[index + 1] ?? (sampleCount ? sampleCount + 1 : null);
    const gopSampleCount = next ? Math.max(1, next - sampleNumber) : 1;
    return {
      startSample: sampleNumber,
      sampleCount: gopSampleCount,
      totalBytes: getGopTotalBytes(sampleSizes, sampleNumber, gopSampleCount),
      known: true,
    };
  });
}

/**
 * @param {SampleSizeSource | null} sampleSizes
 * @param {number} startSample
 * @param {number} sampleCount
 */
export function getGopTotalBytes(sampleSizes, startSample, sampleCount) {
  if (!sampleSizes) {
    return null;
  }
  if (sampleSizes.constantSize != null) {
    return sampleSizes.constantSize * sampleCount;
  }
  if (!sampleSizes.entries.length) {
    return null;
  }
  let total = 0;
  const startIndex = Math.max(0, startSample - 1);
  const endIndex = Math.min(
    sampleSizes.entries.length,
    startIndex + sampleCount,
  );
  for (let index = startIndex; index < endIndex; index++) {
    total += sampleSizes.entries[index] ?? 0;
  }
  return total;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {import("isobmff-inspector").ParsedBox|null} tfhd
 * @param {number|null} fallbackSampleSize
 * @returns {GopRun[]}
 */
export function getGopsFromTruns(truns, tfhd, fallbackSampleSize) {
  const syncSamples = [];
  /** @type {Array<number|null>} */
  const sampleSizes = [];
  let sizesKnown = true;
  let sampleIndex = 1;
  const defaultSampleSize =
    getNumberField(tfhd, "default_sample_size") ?? fallbackSampleSize;
  for (const trun of truns) {
    const samples = getStructArrayField(trun, "samples");
    const firstSampleFlags = getNumberField(trun, "first_sample_flags");
    const trunSampleCount =
      getNumberField(trun, "sample_count") ?? samples.length;
    for (let i = 0; i < trunSampleCount; i++) {
      const sample = samples[i];
      const sampleFlags =
        getNumberFromStruct(sample, "sample_flags") ??
        (i === 0 ? firstSampleFlags : null);
      if (sampleFlags != null && isSyncSampleFlags(sampleFlags)) {
        syncSamples.push(sampleIndex);
      }
      const sampleSize =
        getNumberFromStruct(sample, "sample_size") ?? defaultSampleSize;
      if (sampleSize == null) {
        sizesKnown = false;
      }
      sampleSizes.push(sampleSize);
      sampleIndex++;
    }
  }
  return getGopsFromSyncSamples(syncSamples, sampleIndex - 1, {
    sampleCount: sampleSizes.length,
    constantSize:
      sizesKnown &&
      sampleSizes.length &&
      sampleSizes.every((size) => size === sampleSizes[0])
        ? (sampleSizes[0] ?? null)
        : null,
    entries:
      !sizesKnown ||
      (sampleSizes.length &&
        sampleSizes.every((size) => size === sampleSizes[0]))
        ? []
        : /** @type {number[]} */ (sampleSizes.filter((size) => size != null)),
  });
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} stsz
 * @returns {SampleSizeSource | null}
 */
export function getTrackSampleSizeSource(stsz) {
  const sampleCount = getNumberField(stsz, "sample_count");
  if (!sampleCount) {
    return null;
  }
  const constantSize = getNumberField(stsz, "sample_size");
  if (constantSize != null && constantSize > 0) {
    return {
      sampleCount,
      constantSize,
      entries: [],
    };
  }
  const entries = getNumberArrayField(stsz, "entries");
  if (!entries.length) {
    return null;
  }
  return {
    sampleCount: Math.max(sampleCount, entries.length),
    constantSize: null,
    entries,
  };
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} tfhd
 * @param {number | null} fallbackSize
 * @returns {SampleSizeSource | null}
 */
export function getFragmentSampleSizeSource(truns, tfhd, fallbackSize) {
  const defaultSampleSize =
    getNumberField(tfhd, "default_sample_size") ?? fallbackSize;
  const entries = [];
  for (const trun of truns) {
    const trunSamples = getStructArrayField(trun, "samples");
    const trunSampleCount =
      getNumberField(trun, "sample_count") ?? trunSamples.length;
    for (let i = 0; i < trunSampleCount; i++) {
      const sample = trunSamples[i];
      const sampleSize =
        getNumberFromStruct(sample, "sample_size") ?? defaultSampleSize;
      if (sampleSize == null) {
        return null;
      }
      entries.push(sampleSize);
    }
  }
  if (!entries.length) {
    return null;
  }
  const firstSize = entries[0];
  if (entries.every((entry) => entry === firstSize)) {
    return {
      sampleCount: entries.length,
      constantSize: firstSize,
      entries: [],
    };
  }
  return {
    sampleCount: entries.length,
    constantSize: null,
    entries,
  };
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} ctts
 * @param {number | null} sampleCount
 * @param {number | null} timescale
 */
export function getTrackFrameArrangement(ctts, sampleCount, timescale) {
  const entries = getStructArrayField(ctts, "entries");
  if (!entries.length) {
    return null;
  }

  let affectedSamples = 0;
  let maxOffset = 0;
  for (const entry of entries) {
    const count = getNumberFromStruct(entry, "sample_count") ?? 0;
    const offset = getNumberFromStruct(entry, "sample_offset") ?? 0;
    if (offset !== 0) {
      affectedSamples += count;
      maxOffset = Math.max(maxOffset, Math.abs(offset));
    }
  }

  if (affectedSamples === 0) {
    return "decode and presentation order appear aligned from ctts offsets";
  }

  const total = sampleCount ? ` of ${numberFormat(sampleCount)}` : "";
  return `presentation reordering detected: ${numberFormat(affectedSamples)}${total} samples have non-zero composition offsets, max ${formatTicksWithTime(maxOffset, timescale)}`;
}

/**
 * @param {Array<Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }>>} samples
 * @param {number | null} timescale
 */
export function getFragmentFrameArrangement(samples, timescale) {
  if (!samples.length) {
    return null;
  }

  let affectedSamples = 0;
  let maxOffset = 0;
  let sawOffset = false;
  samples.forEach((sample) => {
    const offset = getNumberFromStruct(
      sample,
      "sample_composition_time_offset",
    );
    if (offset == null) {
      return;
    }
    sawOffset = true;
    if (offset !== 0) {
      affectedSamples++;
      maxOffset = Math.max(maxOffset, Math.abs(offset));
    }
  });

  if (!sawOffset) {
    return null;
  }
  if (affectedSamples === 0) {
    return "decode and presentation order appear aligned from trun composition offsets";
  }
  return `presentation reordering detected: ${numberFormat(affectedSamples)} of ${numberFormat(samples.length)} samples have non-zero composition offsets, max ${formatTicksWithTime(maxOffset, timescale)}`;
}

/**
 * @param {number} duration
 * @param {number | null} timescale
 * @param {string} trackKind
 */
export function getConstantTimingSummary(duration, timescale, trackKind) {
  const cadence = `constant sample duration: ${formatTicksWithTime(duration, timescale)}`;
  if (!timescale || duration <= 0 || trackKind !== "video") {
    return cadence;
  }
  const frameRate = timescale / duration;
  return `${cadence}, nominal ${formatFrameRate(frameRate)} fps`;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {number | null} timescale
 */
export function getFragmentDuration(truns, timescale) {
  let duration = 0;
  let hasDuration = false;
  for (const trun of truns) {
    for (const sample of getStructArrayField(trun, "samples")) {
      const sampleDuration = getNumberFromStruct(sample, "sample_duration");
      if (sampleDuration != null) {
        duration += sampleDuration;
        hasDuration = true;
      }
    }
  }
  return hasDuration ? formatTicksWithTime(duration, timescale) : null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} stts
 */
export function getSampleTimingDetails(stts) {
  const entryCount = getNumberField(stts, "entry_count");
  return entryCount != null
    ? [`timing entries ${numberFormat(entryCount)}`]
    : [];
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {Map<string, { defaultSampleDuration: number; defaultSampleSize: number }>}
 */
export function getTrackFragmentDefaults(boxes) {
  const defaults = new Map();
  for (const trex of findBoxes(boxes, "trex")) {
    const trackId = getNumberField(trex, "track_ID");
    if (trackId == null) {
      continue;
    }
    defaults.set(String(trackId), {
      defaultSampleDuration: getNumberField(trex, "default_sample_duration"),
      defaultSampleSize: getNumberField(trex, "default_sample_size"),
    });
  }
  return defaults;
}
