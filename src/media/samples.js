import { numberFormat } from "../utils.js";
import { getTrackSampleSizeSource } from "./analysis.js";
import {
  getFieldPrimitive,
  getNumberArrayField,
  getNumberField,
  getNumberFromStruct,
  getStructArrayField,
  toNullableNumber,
} from "./box_access.js";
import {
  classifySample,
  createSampleCounts,
  getSampleKindLabel,
  getSampleKindTitle,
  isSyncSampleFlags,
} from "./sample-utils.js";

const SAMPLE_TIMELINE_LIMIT = 240;

/**
 * @param {{
 *   trackId: string,
 *   kind: string,
 *   timescale: number | null,
 *   stts: import("isobmff-inspector").ParsedBox | null,
 *   ctts: import("isobmff-inspector").ParsedBox | null,
 *   stsz: import("isobmff-inspector").ParsedBox | null,
 *   stss: import("isobmff-inspector").ParsedBox | null,
 *   sdtp: import("isobmff-inspector").ParsedBox | null,
 * }} input
 * @returns {import("./analysis.js").SampleView | null}
 */
export function createTrackSampleView({
  trackId,
  kind,
  timescale,
  stts,
  ctts,
  stsz,
  stss,
  sdtp,
}) {
  const timingRuns = getSampleValueRuns(stts, "entries", "sample_delta");
  const compositionRuns = getSampleValueRuns(ctts, "entries", "sample_offset");
  const sampleSizes = getTrackSampleSizeSource(stsz);
  const syncSampleNumbers = getNumberArrayField(stss, "sample_numbers");
  const dependencyInfo = getSampleDependencyInfo(sdtp);
  const totalSamples = Math.max(
    getNumberField(stsz, "sample_count") ?? 0,
    countSamplesFromEntries(stts),
    countSamplesFromEntries(ctts),
    syncSampleNumbers.at(-1) ?? 0,
    dependencyInfo.size,
  );
  if (!totalSamples) {
    return null;
  }

  const hasUsefulMetadata =
    timingRuns.length ||
    sampleSizes != null ||
    stss != null ||
    sdtp != null ||
    compositionRuns.length;
  if (!hasUsefulMetadata) {
    return null;
  }

  return {
    id: `track:${trackId || kind}`,
    label: `track ${trackId || "?"} (${kind})`,
    kind: "track",
    totalSamples,
    timescale,
    note: "sample table view from moov/stbl metadata",
    getRows(startSample, count) {
      return getTrackSampleRows({
        totalSamples,
        startSample,
        count,
        timescale,
        timingRuns,
        compositionRuns,
        sampleSizes,
        syncSampleNumbers,
        hasExplicitSyncTable: stss != null,
        dependencyInfo,
      });
    },
  };
}

/**
 * @param {{
 *   sequence: number | null,
 *   trackId: string,
 *   trackKind: string,
 *   timescale: number | null,
 *   baseDecodeTime: import("isobmff-inspector").ParsedField | null,
 *   truns: Array<import("isobmff-inspector").ParsedBox>,
 *   tfhd: import("isobmff-inspector").ParsedBox | null,
 *   fallbackSampleDuration: number | null,
 *   fallbackSampleSize: number | null,
 * }} input
 * @returns {import("./analysis.js").SampleView | null}
 */
export function createFragmentSampleView({
  sequence,
  trackId,
  trackKind,
  timescale,
  baseDecodeTime,
  truns,
  tfhd,
  fallbackSampleDuration,
  fallbackSampleSize,
}) {
  const totalSamples = truns.reduce(
    (sum, trun) =>
      sum +
      Math.max(
        getNumberField(trun, "sample_count") ?? 0,
        getStructArrayField(trun, "samples").length,
      ),
    0,
  );
  if (!totalSamples) {
    return null;
  }

  return {
    id: `fragment:${sequence ?? "?"}:${trackId}`,
    label: `fragment ${sequence ?? "?"} / track ${trackId} (${trackKind})`,
    kind: "fragment",
    totalSamples,
    timescale,
    note: "sample rows from moof/traf/trun metadata",
    getRows(startSample, count) {
      return getFragmentSampleRows({
        startSample,
        count,
        timescale,
        baseDecodeTime,
        truns,
        tfhd,
        fallbackSampleDuration,
        fallbackSampleSize,
      });
    },
  };
}

/**
 * @param {{
 *   totalSamples: number,
 *   startSample: number,
 *   count: number,
 *   timescale: number | null,
 *   timingRuns: import("./analysis.js").SampleValueRun[],
 *   compositionRuns: import("./analysis.js").SampleValueRun[],
 *   sampleSizes: import("./analysis.js").SampleSizeSource | null,
 *   syncSampleNumbers: number[],
 *   hasExplicitSyncTable: boolean,
 *   dependencyInfo: Map<number, {
 *     sampleDependsOn: number | null,
 *     sampleIsDependedOn: number | null,
 *     sampleHasRedundancy: number | null,
 *   }>,
 * }} input
 * @returns {import("./analysis.js").SampleRow[]}
 */
export function getTrackSampleRows({
  totalSamples,
  startSample,
  count,
  timescale: _timescale,
  timingRuns,
  compositionRuns,
  sampleSizes,
  syncSampleNumbers,
  hasExplicitSyncTable,
  dependencyInfo,
}) {
  const rows = [];
  const boundedStart = Math.min(Math.max(1, startSample), totalSamples);
  const endSample = Math.min(
    totalSamples,
    boundedStart + Math.max(0, count) - 1,
  );
  const timingWindow = getDecodeTimingWindow(
    timingRuns,
    boundedStart,
    endSample,
  );
  const compositionWindow =
    compositionRuns.length > 0
      ? getSampleRunWindow(compositionRuns, boundedStart, endSample, null)
      : null;
  const syncSamples = hasExplicitSyncTable ? new Set(syncSampleNumbers) : null;

  for (
    let sampleIndex = boundedStart;
    sampleIndex <= endSample;
    sampleIndex++
  ) {
    const offsetIndex = sampleIndex - boundedStart;
    const dependency = dependencyInfo.get(sampleIndex);
    const isSync = syncSamples ? syncSamples.has(sampleIndex) : true;
    const compositionOffset = compositionWindow
      ? compositionWindow[offsetIndex]
      : 0;
    const dts = timingWindow[offsetIndex]?.dts ?? null;
    rows.push({
      index: sampleIndex,
      dts,
      pts:
        dts != null && compositionOffset != null
          ? dts + compositionOffset
          : dts,
      duration: timingWindow[offsetIndex]?.duration ?? null,
      size: getSampleSizeAt(sampleSizes, sampleIndex),
      isSync,
      sampleDependsOn: dependency?.sampleDependsOn ?? null,
      sampleIsDependedOn: dependency?.sampleIsDependedOn ?? null,
      sampleHasRedundancy: dependency?.sampleHasRedundancy ?? null,
      kind: classifySample({
        isSync,
        isReordered: compositionOffset != null && compositionOffset !== 0,
        isExplicitNonSync: syncSamples != null && !isSync,
        dependsOnOthers: dependency?.sampleDependsOn === 1,
        isDiscardable: dependency?.sampleIsDependedOn === 2,
      }),
    });
  }
  return rows;
}

/**
 * @param {{
 *   startSample: number,
 *   count: number,
 *   timescale: number | null,
 *   baseDecodeTime: import("isobmff-inspector").ParsedField | null,
 *   truns: Array<import("isobmff-inspector").ParsedBox>,
 *   tfhd: import("isobmff-inspector").ParsedBox | null,
 *   fallbackSampleDuration: number | null,
 *   fallbackSampleSize: number | null,
 * }} input
 * @returns {import("./analysis.js").SampleRow[]}
 */
export function getFragmentSampleRows({
  startSample,
  count,
  timescale: _timescale,
  baseDecodeTime,
  truns,
  tfhd,
  fallbackSampleDuration,
  fallbackSampleSize,
}) {
  const rows = [];
  const boundedStart = Math.max(1, startSample);
  const boundedCount = Math.max(0, count);
  const endSample = boundedStart + boundedCount - 1;
  const defaultSampleDuration =
    getNumberField(tfhd, "default_sample_duration") ?? fallbackSampleDuration;
  const defaultSampleSize =
    getNumberField(tfhd, "default_sample_size") ?? fallbackSampleSize;
  const defaultSampleFlags = getNumberField(tfhd, "default_sample_flags");
  let sampleIndex = 1;
  let nextDecodeTime = toNullableNumber(getFieldPrimitive(baseDecodeTime));

  for (const trun of truns) {
    const samples = getStructArrayField(trun, "samples");
    const firstSampleFlags = getNumberField(trun, "first_sample_flags");
    const trunSampleCount =
      getNumberField(trun, "sample_count") ?? samples.length;
    for (let i = 0; i < trunSampleCount; i++) {
      const sample = samples[i];
      const duration =
        getNumberFromStruct(sample, "sample_duration") ?? defaultSampleDuration;
      const sampleFlags =
        getNumberFromStruct(sample, "sample_flags") ??
        (i === 0 ? firstSampleFlags : null) ??
        defaultSampleFlags;
      const compositionOffset =
        getNumberFromStruct(sample, "sample_composition_time_offset") ?? 0;
      if (sampleIndex >= boundedStart && sampleIndex <= endSample) {
        rows.push({
          index: sampleIndex,
          dts: nextDecodeTime,
          pts:
            nextDecodeTime != null && compositionOffset != null
              ? nextDecodeTime + compositionOffset
              : nextDecodeTime,
          duration,
          size: getNumberFromStruct(sample, "sample_size") ?? defaultSampleSize,
          isSync: sampleFlags != null ? isSyncSampleFlags(sampleFlags) : null,
          sampleDependsOn:
            sampleFlags != null
              ? getSampleDependsOnFromFlags(sampleFlags)
              : null,
          sampleIsDependedOn:
            sampleFlags != null
              ? getSampleIsDependedOnFromFlags(sampleFlags)
              : null,
          sampleHasRedundancy:
            sampleFlags != null
              ? getSampleHasRedundancyFromFlags(sampleFlags)
              : null,
          kind: classifySample({
            isSync:
              sampleFlags != null ? isSyncSampleFlags(sampleFlags) : undefined,
            isReordered: compositionOffset !== 0,
            isExplicitNonSync:
              sampleFlags != null ? !isSyncSampleFlags(sampleFlags) : false,
            dependsOnOthers:
              sampleFlags != null
                ? getSampleDependsOnFromFlags(sampleFlags) === 1
                : false,
            isDiscardable:
              sampleFlags != null
                ? getSampleIsDependedOnFromFlags(sampleFlags) === 2
                : false,
          }),
        });
      }
      sampleIndex++;
      nextDecodeTime =
        nextDecodeTime != null && duration != null
          ? nextDecodeTime + duration
          : null;
      if (sampleIndex > endSample) {
        return rows;
      }
    }
  }
  return rows;
}

/**
 * @param {{
 *   sampleCount: number | null,
 *   syncSampleNumbers: number[],
 *   ctts: import("isobmff-inspector").ParsedBox | null,
 *   sdtp: import("isobmff-inspector").ParsedBox | null,
 * }} input
 * @returns {import("./analysis.js").SampleTimeline | null}
 */
export function getTrackSampleTimeline({
  sampleCount,
  syncSampleNumbers,
  ctts,
  sdtp,
}) {
  const inferredSampleCount = Math.max(
    sampleCount ?? 0,
    syncSampleNumbers.at(-1) ?? 0,
    countSamplesFromEntries(ctts),
    getStructArrayField(sdtp, "samples").length,
  );
  if (!inferredSampleCount) {
    return null;
  }

  const syncSamples = new Set(syncSampleNumbers);
  const reorderedSamples = getReorderedSamplesFromCtts(
    ctts,
    inferredSampleCount,
  );
  const dependencies = getSampleDependencyInfo(sdtp);
  return buildSampleTimeline(inferredSampleCount, (sampleIndex) => {
    const dependency = dependencies.get(sampleIndex);
    return classifySample({
      isSync: syncSamples.has(sampleIndex),
      isReordered: reorderedSamples.has(sampleIndex),
      isExplicitNonSync: syncSamples.size > 0 && !syncSamples.has(sampleIndex),
      dependsOnOthers: dependency?.sampleDependsOn === 1,
      isDiscardable: dependency?.sampleIsDependedOn === 2,
    });
  });
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} tfhd
 * @returns {import("./analysis.js").SampleTimeline | null}
 */
export function getFragmentSampleTimeline(truns, tfhd) {
  const defaultSampleFlags = getNumberField(tfhd, "default_sample_flags");
  /** @type Array<import("./sample-utils.js").SampleClass> */
  const samples = [];
  for (const trun of truns) {
    const trunSamples = getStructArrayField(trun, "samples");
    const firstSampleFlags = getNumberField(trun, "first_sample_flags");
    const trunSampleCount =
      getNumberField(trun, "sample_count") ?? trunSamples.length;
    for (let i = 0; i < trunSampleCount; i++) {
      const sample = trunSamples[i];
      const sampleFlags =
        getNumberFromStruct(sample, "sample_flags") ??
        (i === 0 ? firstSampleFlags : null) ??
        defaultSampleFlags;
      const compositionOffset = getNumberFromStruct(
        sample,
        "sample_composition_time_offset",
      );
      samples.push(
        classifySample({
          isSync:
            sampleFlags != null ? isSyncSampleFlags(sampleFlags) : undefined,
          isReordered: compositionOffset != null && compositionOffset !== 0,
          isExplicitNonSync:
            sampleFlags != null ? !isSyncSampleFlags(sampleFlags) : false,
          dependsOnOthers:
            sampleFlags != null
              ? getSampleDependsOnFromFlags(sampleFlags) === 1
              : false,
          isDiscardable:
            sampleFlags != null
              ? getSampleIsDependedOnFromFlags(sampleFlags) === 2
              : false,
        }),
      );
    }
  }
  if (!samples.length) {
    return null;
  }
  return buildSampleTimeline(
    samples.length,
    (sampleIndex) => samples[sampleIndex - 1],
  );
}

/**
 * @param {number} totalSamples
 * @param {(sampleIndex: number) => import("./sample-utils.js").SampleClass} getKind
 * @returns {import("./analysis.js").SampleTimeline}
 */
export function buildSampleTimeline(totalSamples, getKind) {
  const counts = createSampleCounts();
  const samples = [];
  const renderedSamples = Math.min(totalSamples, SAMPLE_TIMELINE_LIMIT);
  for (let sampleIndex = 1; sampleIndex <= totalSamples; sampleIndex++) {
    const kind = getKind(sampleIndex);
    counts[kind]++;
    if (sampleIndex <= renderedSamples) {
      samples.push({
        index: sampleIndex,
        kind,
        label: getSampleKindLabel(kind),
        title: `sample ${numberFormat(sampleIndex)}: ${getSampleKindTitle(kind)}`,
      });
    }
  }
  return {
    samples,
    totalSamples,
    limited: totalSamples > SAMPLE_TIMELINE_LIMIT,
    counts,
  };
}

/**
 * @param {number} sampleFlags
 */
function getSampleDependsOnFromFlags(sampleFlags) {
  return (sampleFlags >>> 24) & 3;
}

/**
 * @param {number} sampleFlags
 */
function getSampleIsDependedOnFromFlags(sampleFlags) {
  return (sampleFlags >>> 22) & 3;
}

/**
 * @param {number} sampleFlags
 */
function getSampleHasRedundancyFromFlags(sampleFlags) {
  return (sampleFlags >>> 20) & 3;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} ctts
 * @param {number} sampleLimit
 */
function getReorderedSamplesFromCtts(ctts, sampleLimit) {
  const reordered = new Set();
  let sampleIndex = 1;
  for (const entry of getStructArrayField(ctts, "entries")) {
    const count = getNumberFromStruct(entry, "sample_count") ?? 0;
    const offset = getNumberFromStruct(entry, "sample_offset") ?? 0;
    if (offset !== 0) {
      for (let i = 0; i < count && sampleIndex + i <= sampleLimit; i++) {
        reordered.add(sampleIndex + i);
      }
    }
    sampleIndex += count;
  }
  return reordered;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 */
function countSamplesFromEntries(box) {
  return getStructArrayField(box, "entries").reduce(
    (sum, entry) => sum + (getNumberFromStruct(entry, "sample_count") ?? 0),
    0,
  );
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} sdtp
 */
function getSampleDependencyInfo(sdtp) {
  const dependencies = new Map();
  getStructArrayField(sdtp, "samples").forEach((sample, index) => {
    dependencies.set(index + 1, {
      sampleDependsOn: getNumberFromStruct(sample, "sample_depends_on"),
      sampleIsDependedOn: getNumberFromStruct(sample, "sample_is_depended_on"),
      sampleHasRedundancy: getNumberFromStruct(sample, "sample_has_redundancy"),
    });
  });
  return dependencies;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} arrayKey
 * @param {string} valueKey
 * @returns {import("./analysis.js").SampleValueRun[]}
 */
function getSampleValueRuns(box, arrayKey, valueKey) {
  return getStructArrayField(box, arrayKey)
    .map((entry) => ({
      count: getNumberFromStruct(entry, "sample_count") ?? 0,
      value: getNumberFromStruct(entry, valueKey),
    }))
    .filter((entry) => entry.count > 0);
}

/**
 * @param {import("./analysis.js").SampleSizeSource | null} sampleSizes
 * @param {number} sampleIndex
 */
function getSampleSizeAt(sampleSizes, sampleIndex) {
  if (!sampleSizes) {
    return null;
  }
  if (sampleSizes.constantSize != null) {
    return sampleSizes.constantSize;
  }
  return sampleSizes.entries[sampleIndex - 1] ?? null;
}

/**
 * @param {import("./analysis.js").SampleValueRun[]} runs
 * @param {number} startSample
 * @param {number} endSample
 */
function getDecodeTimingWindow(runs, startSample, endSample) {
  /** @type {Array<{ dts: number | null, duration: number | null }>} */
  const output = [];
  if (endSample < startSample) {
    return output;
  }

  let sampleIndex = 1;
  let dts = 0;
  let dtsKnown = true;
  for (const run of runs) {
    const runStart = sampleIndex;
    const runEnd = sampleIndex + run.count - 1;
    if (run.value == null) {
      dtsKnown = false;
    }
    if (endSample >= runStart && startSample <= runEnd) {
      const from = Math.max(startSample, runStart);
      const to = Math.min(endSample, runEnd);
      for (let index = from; index <= to; index++) {
        output.push({
          dts:
            dtsKnown && run.value != null
              ? dts + (index - runStart) * run.value
              : null,
          duration: run.value,
        });
      }
    }
    if (dtsKnown && run.value != null) {
      dts += run.value * run.count;
    } else {
      dtsKnown = false;
    }
    sampleIndex += run.count;
    if (sampleIndex > endSample) {
      break;
    }
  }

  while (output.length < endSample - startSample + 1) {
    output.push({ dts: null, duration: null });
  }
  return output;
}

/**
 * @param {import("./analysis.js").SampleValueRun[]} runs
 * @param {number} startSample
 * @param {number} endSample
 * @param {number | null} fallbackValue
 */
function getSampleRunWindow(runs, startSample, endSample, fallbackValue) {
  /** @type {Array<number | null>} */
  const output = [];
  if (endSample < startSample) {
    return output;
  }

  let sampleIndex = 1;
  for (const run of runs) {
    const runStart = sampleIndex;
    const runEnd = sampleIndex + run.count - 1;
    if (endSample >= runStart && startSample <= runEnd) {
      const from = Math.max(startSample, runStart);
      const to = Math.min(endSample, runEnd);
      for (let index = from; index <= to; index++) {
        output.push(run.value);
      }
    }
    sampleIndex += run.count;
    if (sampleIndex > endSample) {
      break;
    }
  }

  while (output.length < endSample - startSample + 1) {
    output.push(fallbackValue);
  }
  return output;
}
