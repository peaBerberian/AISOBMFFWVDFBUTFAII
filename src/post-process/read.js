import { getActualBoxSize } from "../utils/box_size.js";
import { numberFormat } from "../utils/format.js";
import {
  analyzeFragmentTiming,
  analyzeSampleSizes,
  analyzeTrackTiming,
  getFragmentDuration,
  getFragmentFrameArrangement,
  getFragmentSampleSizeSource,
  getGopDescription,
  getGopsFromSyncSamples,
  getGopsFromTruns,
  getSampleTimingDetails,
  getTrackFragmentDefaults,
  getTrackFrameArrangement,
  getTrackSampleSizeSource,
} from "./analysis.js";
import {
  findBoxes,
  findFirstBox,
  getBooleanField,
  getField,
  getFieldPrimitive,
  getNumberArrayField,
  getNumberField,
  getStringField,
  getStructArrayField,
  hasBoxType,
  toNullableNumber,
} from "./box_access.js";
import {
  AUDIO_SAMPLE_ENTRY_TYPES,
  getAudioDescription,
  getCodecLabel,
  getColorDescription,
  getDimensions,
  getEditListDetails,
  getEncryptionDetails,
  getHandlerType,
  getLanguage,
  getPixelAspectRatio,
  isProtectedSampleEntry,
  normalizeTrackKind,
  TEXT_SAMPLE_ENTRY_TYPES,
  VIDEO_SAMPLE_ENTRY_TYPES,
} from "./codec_meta.js";
import {
  formatAvcLevel,
  formatAvcProfile,
  formatChromaFormat,
  formatDuration,
  formatHevcConstantFrameRate,
  formatHevcLevel,
  formatPercent,
  formatTickFieldValue,
  formatTicksWithTime,
} from "./format.js";
import {
  createFragmentSampleView,
  createTrackSampleView,
  getFragmentSampleTimeline,
  getTrackSampleTimeline,
} from "./samples.js";

const ENCRYPTION_BOX_TYPES = new Set([
  "enca",
  "encv",
  "pssh",
  "schm",
  "sinf",
  "tenc",
]);

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {import("./analysis.js").MediaInfo}
 */
export default function deriveMediaInfo(boxes) {
  const ftyp = findFirstBox(boxes, "ftyp");
  const mvhd = findFirstBox(boxes, "mvhd");
  const moov = findFirstBox(boxes, "moov");
  const mdatBoxes = findBoxes(boxes, "mdat");
  const moofBoxes = findBoxes(boxes, "moof");
  const mdatSize = sumBoxes(mdatBoxes);
  const totalSize = boxes.reduce((sum, box) => sum + getActualBoxSize(box), 0);
  const metadataSize = Math.max(0, totalSize - mdatSize);
  const tracks = findBoxes(moov ? [moov] : boxes, "trak").map(deriveTrackInfo);
  const trackTimescales = new Map(
    tracks
      .filter((track) => track.id && track.timescale != null)
      .map((track) => [track.id, track.timescale]),
  );
  const trackKinds = new Map(
    tracks.filter((track) => track.id).map((track) => [track.id, track.kind]),
  );
  const fragmentDefaults = getTrackFragmentDefaults(moov ? [moov] : boxes);
  const fragments = moofBoxes.flatMap((moof) =>
    deriveFragmentInfo(moof, trackTimescales, trackKinds, fragmentDefaults),
  );
  const isFragmented = Boolean(findFirstBox(boxes, "mvex") || moofBoxes.length);
  const duration = durationFromBox(mvhd);
  /** @type {import("./analysis.js").MediaInfo} */
  const info = {
    segmentType: getSegmentType({ boxes, moov, moofBoxes }),
    majorBrand: getStringField(ftyp, "major_brand"),
    compatibleBrands: parseBrandList(getField(ftyp, "compatible_brands")),
    durationLabel: duration?.label ?? "unknown",
    trackCount: tracks.length,
    isFragmented,
    fastStart: getFastStart(boxes),
    totalSize,
    metadataSize,
    mdatSize,
    tracks,
    fragments,
    sampleViews: [
      ...tracks.flatMap((track) =>
        track.sampleView ? [track.sampleView] : [],
      ),
      ...fragments.flatMap((fragment) =>
        fragment.sampleView ? [fragment.sampleView] : [],
      ),
    ],
    hints: [],
  };
  info.hints = deriveHints(info, boxes);
  return info;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} trak
 * @returns {import("./analysis.js").TrackInfo}
 */
function deriveTrackInfo(trak) {
  const tkhd = findFirstBox([trak], "tkhd");
  const mdhd = findFirstBox([trak], "mdhd");
  const hdlr = findFirstBox([trak], "hdlr");
  const sampleEntry = findSampleEntry(trak);
  const originalFormat = getStringField(
    findFirstBox([trak], "frma"),
    "original_format",
  );
  const stsz = findFirstBox([trak], "stsz");
  const stss = findFirstBox([trak], "stss");
  const stts = findFirstBox([trak], "stts");
  const ctts = findFirstBox([trak], "ctts");
  const sdtp = findFirstBox([trak], "sdtp");
  const hvcC = findFirstBox([trak], "hvcC");
  const avcC = findFirstBox([trak], "avcC");
  const colr = findFirstBox([trak], "colr");
  const pasp = findFirstBox([trak], "pasp");
  const schm = findFirstBox([trak], "schm");
  const tenc = findFirstBox([trak], "tenc");
  const elst = findFirstBox([trak], "elst");

  const kind = normalizeTrackKind(getHandlerType(hdlr), sampleEntry?.type);
  const codec = getCodecLabel(sampleEntry?.type, originalFormat, {
    avcC,
    hvcC,
  });
  const protectedSampleEntry = isProtectedSampleEntry(sampleEntry?.type);
  const trackDuration = durationFromBox(mdhd) ?? durationFromBox(tkhd);
  const sampleCount = getNumberField(stsz, "sample_count");
  const syncSamples = getNumberField(stss, "entry_count");
  const syncSampleNumbers = getNumberArrayField(stss, "sample_numbers");
  const sampleSizes = getTrackSampleSizeSource(stsz);
  const gops = getGopsFromSyncSamples(
    syncSampleNumbers,
    sampleCount,
    sampleSizes,
  );
  const sampleTimeline = getTrackSampleTimeline({
    sampleCount,
    syncSampleNumbers,
    ctts,
    sdtp,
  });
  const sampleView = createTrackSampleView({
    trackId: String(getNumberField(tkhd, "track_ID") ?? ""),
    kind,
    timescale: getNumberField(mdhd, "timescale"),
    stts,
    ctts,
    stsz,
    stss,
    sdtp,
  });
  const timing = analyzeTrackTiming(
    stts,
    getNumberField(mdhd, "timescale"),
    kind,
  );
  const sampleSize = analyzeSampleSizes(sampleSizes, gops, {
    totalDuration: timing.totalDuration,
    timescale: getNumberField(mdhd, "timescale"),
  });
  const dimensions = getDimensions(sampleEntry, tkhd);
  const audio = getAudioDescription(sampleEntry);
  const details = [];

  if (protectedSampleEntry && !originalFormat) {
    details.push(
      "protected sample entry found, but original codec metadata (frma) is not available",
    );
  }

  const chromaFormat = getNumberField(hvcC, "chromaFormat");
  if (chromaFormat != null) {
    details.push(`chroma ${formatChromaFormat(chromaFormat)}`);
  }

  const hevcProfile = getNumberField(hvcC, "general_profile_idc");
  const hevcTier = getBooleanField(hvcC, "general_tier_flag");
  const hevcLevel = getNumberField(hvcC, "general_level_idc");
  if (hevcProfile != null || hevcLevel != null) {
    details.push(
      `HEVC profile ${hevcProfile ?? "?"}, ${hevcTier ? "high" : "main"} tier, level ${hevcLevel != null ? formatHevcLevel(hevcLevel) : "?"}`,
    );
  }

  const constantFrameRate = getNumberField(hvcC, "constantFrameRate");
  if (constantFrameRate) {
    details.push(
      `HEVC frame rate mode ${formatHevcConstantFrameRate(constantFrameRate)}`,
    );
  }

  const bitDepthLuma = getNumberField(hvcC, "bitDepthLumaMinus8");
  const bitDepthChroma = getNumberField(hvcC, "bitDepthChromaMinus8");
  if (bitDepthLuma != null || bitDepthChroma != null) {
    details.push(
      `bit depth ${bitDepthLuma != null ? bitDepthLuma + 8 : "?"}/${bitDepthChroma != null ? bitDepthChroma + 8 : "?"}`,
    );
  }

  const avcProfile = getNumberField(avcC, "AVCProfileIndication");
  const avcLevel = getNumberField(avcC, "AVCLevelIndication");
  if (avcProfile != null || avcLevel != null) {
    details.push(
      `AVC profile ${formatAvcProfile(avcProfile)}, level ${avcLevel != null ? formatAvcLevel(avcLevel) : "?"}`,
    );
  }

  const pixelAspect = getPixelAspectRatio(pasp);
  if (pixelAspect) {
    details.push(`pixel aspect ${pixelAspect}`);
  }

  const colorDescription = getColorDescription(colr);
  if (colorDescription) {
    details.push(colorDescription);
  }

  details.push(...getEncryptionDetails(schm, tenc));
  details.push(...getEditListDetails(elst, getNumberField(mdhd, "timescale")));

  return {
    id: String(getNumberField(tkhd, "track_ID") ?? ""),
    kind,
    codec,
    durationLabel: trackDuration?.label ?? "unknown",
    timescale: getNumberField(mdhd, "timescale"),
    dimensions,
    audio,
    language: getLanguage(mdhd),
    samples: sampleCount != null ? numberFormat(sampleCount) : null,
    syncSamples: syncSamples != null ? numberFormat(syncSamples) : null,
    sampleSize: sampleSize.summary,
    sampleSizeDetails: sampleSize.details,
    timing: timing.summary,
    timingDetails: timing.details,
    gop: getGopDescription(gops, sampleCount),
    gops,
    frameArrangement: getTrackFrameArrangement(
      ctts,
      sampleCount,
      getNumberField(mdhd, "timescale"),
    ),
    sampleTimeline,
    sampleView,
    details: details.length ? details : getSampleTimingDetails(stts),
  };
}

/**
 * @param {import("isobmff-inspector").ParsedBox} moof
 * @param {Map<string, number | null>} trackTimescales
 * @param {Map<string, string>} trackKinds
 * @param {Map<string, { defaultSampleDuration: number; defaultSampleSize: number }>} fragmentDefaults
 * @returns {import("./analysis.js").FragmentInfo[]}
 */
function deriveFragmentInfo(
  moof,
  trackTimescales,
  trackKinds,
  fragmentDefaults,
) {
  const sequence = getNumberField(
    findFirstBox([moof], "mfhd"),
    "sequence_number",
  );
  return findBoxes([moof], "traf").map((traf) => {
    const tfhd = findFirstBox([traf], "tfhd");
    const tfdt = findFirstBox([traf], "tfdt");
    const truns = findBoxes([traf], "trun");
    const trackId = String(getNumberField(tfhd, "track_ID") ?? "?");
    const timescale = trackTimescales.get(trackId) ?? null;
    const trackKind = trackKinds.get(trackId) ?? "unknown";
    const defaults = fragmentDefaults.get(trackId) ?? {
      defaultSampleDuration: null,
      defaultSampleSize: null,
    };
    const samples = truns.flatMap((trun) =>
      getStructArrayField(trun, "samples"),
    );
    const sampleCount = truns.reduce(
      (sum, trun) => sum + (getNumberField(trun, "sample_count") ?? 0),
      0,
    );
    const sampleSizes = getFragmentSampleSizeSource(
      truns,
      tfhd,
      defaults.defaultSampleSize,
    );
    const gops = getGopsFromTruns(truns, tfhd, defaults.defaultSampleSize);
    const sampleTimeline = getFragmentSampleTimeline(truns, tfhd);
    const sampleView = createFragmentSampleView({
      sequence,
      trackId,
      trackKind,
      timescale,
      baseDecodeTime: getField(tfdt, "baseMediaDecodeTime"),
      truns,
      tfhd,
      fallbackSampleDuration: defaults.defaultSampleDuration,
      fallbackSampleSize: defaults.defaultSampleSize,
    });
    const timing = analyzeFragmentTiming(
      truns,
      tfhd,
      defaults.defaultSampleDuration,
      timescale,
      trackKind,
    );
    const sampleSize = analyzeSampleSizes(sampleSizes, gops, {
      totalDuration: timing.totalDuration,
      timescale,
    });
    return {
      sequence: sequence != null ? numberFormat(sequence) : "",
      trackId,
      baseDecodeTime: formatTickFieldValue(
        getField(tfdt, "baseMediaDecodeTime"),
        timescale,
      ),
      decodeWindow: getFragmentDecodeWindow(
        getField(tfdt, "baseMediaDecodeTime"),
        timing.totalDuration,
        timescale,
      ),
      sampleCount,
      duration:
        timing.totalDuration != null
          ? formatTicksWithTime(timing.totalDuration, timescale)
          : getFragmentDuration(truns, timescale),
      sampleSize: sampleSize.summary,
      sampleSizeDetails: sampleSize.details,
      timing: timing.summary,
      timingDetails: timing.details,
      gops,
      frameArrangement: getFragmentFrameArrangement(samples, timescale),
      sampleTimeline,
      sampleView,
    };
  });
}

/**
 * @param {import("./analysis.js").MediaInfo} info
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 */
function deriveHints(info, boxes) {
  const hints = [];
  if (info.fastStart === "no") {
    hints.push(
      "The movie metadata appears after media data; moving moov before mdat can improve progressive playback startup.",
    );
  }
  if (info.isFragmented) {
    hints.push("Fragmented MP4 metadata detected through mvex or moof boxes.");
  }
  if (info.segmentType === "media segment") {
    hints.push(
      "This looks like a media segment; init-segment metadata such as duration, codec setup, and dimensions may be absent.",
    );
  }
  if (findFirstBox(boxes, "elst")) {
    hints.push(
      "Edit list metadata is present; timeline presentation may not start at media time zero.",
    );
  }
  if (findBoxes(boxes, "mdat").length > 1) {
    hints.push("Multiple mdat boxes are present.");
  }
  if (findBoxes(boxes, "moof").length > 1) {
    hints.push("Multiple movie fragments are present.");
  }
  if (findFirstBox(boxes, "sidx")) {
    hints.push("Segment index metadata is present.");
  }
  if (hasBoxType(boxes, ENCRYPTION_BOX_TYPES)) {
    hints.push("Protection or encryption metadata detected.");
  }
  if (info.totalSize > 0 && info.metadataSize / info.totalSize > 0.05) {
    hints.push(
      `Metadata is ${formatPercent(info.metadataSize / info.totalSize)} of the file.`,
    );
  }
  if (info.tracks.filter((track) => track.kind === "video").length > 1) {
    hints.push("More than one video track detected.");
  }
  if (
    info.tracks.some((track) => track.gops.length) ||
    info.fragments.some((fragment) => fragment.gops.length)
  ) {
    hints.push(
      "Sync sample or sample flag metadata allows a GOP/keyframe view.",
    );
  }
  return hints;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 */
function durationFromBox(box) {
  const durationValue = getFieldPrimitive(getField(box, "duration"));
  if (isIndefiniteDurationValue(durationValue)) {
    return null;
  }
  const duration = toNullableNumber(durationValue);
  const timescale = getNumberField(box, "timescale");
  if (duration == null || !timescale) {
    return null;
  }
  return {
    seconds: duration / timescale,
    label: formatDuration(duration / timescale),
  };
}

/**
 * @param {string | number | bigint | boolean | null} value
 */
function isIndefiniteDurationValue(value) {
  return value === 0xffffffff || value === 0xffffffffffffffffn;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {"yes" | "no" | "unknown"}
 */
function getFastStart(boxes) {
  const moov = boxes.find((box) => box.type === "moov");
  const mdat = boxes.find((box) => box.type === "mdat");
  if (!moov || !mdat) {
    return "unknown";
  }
  return moov.offset < mdat.offset ? "yes" : "no";
}

/**
 * @param {import("isobmff-inspector").ParsedBoxValue|null} brands
 * @returns {string[]}
 */
function parseBrandList(brands) {
  if (!brands || brands.kind !== "array") {
    return [];
  }
  const brandList = [];
  for (const brand of brands.items) {
    if (brand.kind === "struct" || brand.kind === "array") {
      continue;
    }
    const toStr = String(brand.value).trim();
    if (toStr) {
      brandList.push(toStr);
    }
  }
  return brandList;
}

/**
 * @param {{
 *   boxes: Array<import("isobmff-inspector").ParsedBox>,
 *   moov: import("isobmff-inspector").ParsedBox | null,
 *   moofBoxes: Array<import("isobmff-inspector").ParsedBox>,
 * }} input
 */
function getSegmentType({ boxes, moov, moofBoxes }) {
  const hasMdat = boxes.some((box) => box.type === "mdat");
  if (moofBoxes.length && !moov) {
    return "media segment";
  }
  if (moov && !hasMdat && !moofBoxes.length) {
    return "init segment";
  }
  if (moov && moofBoxes.length) {
    return "fragmented file";
  }
  if (moov && hasMdat) {
    return "complete file";
  }
  return "unknown";
}

/**
 * @param {import("isobmff-inspector").ParsedBox} trak
 */
function findSampleEntry(trak) {
  const stsd = findFirstBox([trak], "stsd");
  return (
    stsd?.children?.find(
      (box) =>
        VIDEO_SAMPLE_ENTRY_TYPES.has(box.type) ||
        AUDIO_SAMPLE_ENTRY_TYPES.has(box.type) ||
        TEXT_SAMPLE_ENTRY_TYPES.has(box.type),
    ) ?? null
  );
}
/**
 * @param {import("isobmff-inspector").ParsedField | null | undefined} baseDecodeTimeField
 * @param {number | null} duration
 * @param {number | null} timescale
 */
function getFragmentDecodeWindow(baseDecodeTimeField, duration, timescale) {
  const start = toNullableNumber(getFieldPrimitive(baseDecodeTimeField));
  if (start == null) {
    return null;
  }
  if (duration == null) {
    return `starts at ${formatTicksWithTime(start, timescale)}`;
  }
  return `${formatTicksWithTime(start, timescale)} to ${formatTicksWithTime(start + duration, timescale)}`;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 */
function sumBoxes(boxes) {
  return boxes.reduce((sum, box) => sum + getActualBoxSize(box), 0);
}
