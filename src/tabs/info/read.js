import {
  classifySample,
  createSampleCounts,
  getSampleKindLabel,
  getSampleKindTitle,
  numberFormat,
} from "./utils";

const SAMPLE_TIMELINE_LIMIT = 240;
const VIDEO_SAMPLE_ENTRY_TYPES = new Set([
  "av01",
  "avc1",
  "avc3",
  "encv",
  "hev1",
  "hvc1",
  "vp08",
  "vp09",
]);
const AUDIO_SAMPLE_ENTRY_TYPES = new Set([
  "ac-3",
  "alac",
  "enca",
  "ec-3",
  "fLaC",
  "mp4a",
  "Opus",
]);
const TEXT_SAMPLE_ENTRY_TYPES = new Set(["stpp", "tx3g", "vttc", "wvtt"]);
const ENCRYPTION_BOX_TYPES = new Set([
  "enca",
  "encv",
  "pssh",
  "schm",
  "sinf",
  "tenc",
]);
const COLOR_PRIMARIES_NAMES = new Map([
  [1, "BT.709 / sRGB-ish"],
  [2, "unspecified"],
  [4, "BT.470M"],
  [5, "BT.470BG"],
  [6, "SMPTE 170M"],
  [7, "SMPTE 240M"],
  [8, "film"],
  [9, "BT.2020"],
  [11, "SMPTE RP 431-2 (DCI-P3)"],
  [12, "SMPTE EG 432-1 (Display P3)"],
  [22, "EBU Tech 3213-E"],
]);
const TRANSFER_CHARACTERISTIC_NAMES = new Map([
  [1, "BT.709"],
  [2, "unspecified"],
  [4, "gamma 2.2"],
  [5, "gamma 2.8"],
  [6, "SMPTE 170M"],
  [7, "SMPTE 240M"],
  [8, "linear"],
  [9, "log 100"],
  [10, "log 316"],
  [11, "xvYCC"],
  [13, "sRGB"],
  [14, "BT.2020 10-bit"],
  [15, "BT.2020 12-bit"],
  [16, "PQ"],
  [17, "SMPTE 428-1"],
  [18, "HLG"],
]);
const MATRIX_COEFFICIENT_NAMES = new Map([
  [0, "identity / RGB"],
  [1, "BT.709"],
  [2, "unspecified"],
  [4, "FCC"],
  [5, "BT.470BG"],
  [6, "SMPTE 170M"],
  [7, "SMPTE 240M"],
  [8, "YCgCo"],
  [9, "BT.2020 non-constant"],
  [10, "BT.2020 constant"],
  [11, "SMPTE ST 2085"],
  [12, "chromaticity-derived non-constant"],
  [13, "chromaticity-derived constant"],
  [14, "ICtCp"],
]);
const HEVC_PROFILE_SPACE_LETTERS = ["", "A", "B", "C"];
const PROTECTION_SCHEME_NAMES = new Map([
  ["cenc", "AES-CTR"],
  ["cbc1", "AES-CBC"],
  ["cens", "subsample AES-CTR"],
  ["cbcs", "pattern AES-CBC"],
  ["piff", "PIFF"],
]);
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
 * }} FragmentInfo
 *
 * @typedef {{
 *   startSample: number,
 *   sampleCount: number,
 *   totalBytes: number | null,
 *   known: boolean,
 * }} GopRun

 * @typedef {{
 *   sampleCount: number,
 *   constantSize: number | null,
 *   entries: number[],
 * }} SampleSizeSource

 * @typedef {{
 *   sampleCount: number,
 *   totalDuration: number | null,
 *   summary: string | null,
 *   details: string[],
 * }} TimingAnalysis
 *
 * @typedef {{
 *   index: number,
 *   kind: import("./utils").SampleClass,
 *   label: string,
 *   title: string,
 * }} SamplePoint
 * @typedef {{
 *   samples: SamplePoint[],
 *   totalSamples: number,
 *   limited: boolean,
 *   counts: Record<import("./utils").SampleClass, number>,
 * }} SampleTimeline
 */

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {MediaInfo}
 */
export default function deriveMediaInfo(boxes) {
  const ftyp = findFirstBox(boxes, "ftyp");
  const mvhd = findFirstBox(boxes, "mvhd");
  const moov = findFirstBox(boxes, "moov");
  const mdatBoxes = findBoxes(boxes, "mdat");
  const moofBoxes = findBoxes(boxes, "moof");
  const mdatSize = sumBoxes(mdatBoxes);
  const totalSize = boxes.reduce((sum, box) => sum + toNumber(box.size), 0);
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
  /** @type {MediaInfo} */
  const info = {
    segmentType: getSegmentType({ boxes, moov, moofBoxes }),
    majorBrand: getStringField(ftyp, "major_brand"),
    compatibleBrands: parseBrandList(getStringField(ftyp, "compatible_brands")),
    durationLabel: duration?.label ?? "unknown",
    trackCount: tracks.length,
    isFragmented,
    fastStart: getFastStart(boxes),
    totalSize,
    metadataSize,
    mdatSize,
    tracks,
    fragments,
    hints: [],
  };
  info.hints = deriveHints(info, boxes);
  return info;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} trak
 * @returns {TrackInfo}
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
    details: details.length ? details : getSampleTimingDetails(stts),
  };
}

/**
 * @param {import("isobmff-inspector").ParsedBox} moof
 * @param {Map<string, number | null>} trackTimescales
 * @param {Map<string, string>} trackKinds
 * @param {Map<string, { defaultSampleDuration: number; defaultSampleSize: number }>} fragmentDefaults
 * @returns {FragmentInfo[]}
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
    };
  });
}

/**
 * @param {MediaInfo} info
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
 * @param {number} value
 */
function numberToFourCC(value) {
  return String.fromCharCode(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ).replace(/\0+$/, "");
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
 * @param {string | null} brands
 */
function parseBrandList(brands) {
  if (!brands) {
    return [];
  }
  return brands
    .split(",")
    .map((brand) => brand.trim())
    .filter(Boolean);
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
 * @param {string | undefined} sampleEntryType
 * @param {string | null} originalFormat
 * @param {{
 *   avcC: import("isobmff-inspector").ParsedBox | null,
 *   hvcC: import("isobmff-inspector").ParsedBox | null,
 * }} configBoxes
 */
function getCodecLabel(sampleEntryType, originalFormat, configBoxes) {
  const codecType = isProtectedSampleEntry(sampleEntryType)
    ? originalFormat
    : sampleEntryType;
  const codecString = getCodecString(codecType, configBoxes);
  if (codecString && isProtectedSampleEntry(sampleEntryType)) {
    return `${codecString} (${sampleEntryType} protected entry)`;
  }
  if (codecString) {
    return codecString;
  }
  if (isProtectedSampleEntry(sampleEntryType) && originalFormat) {
    return `${originalFormat} (${sampleEntryType} protected entry)`;
  }
  if (isProtectedSampleEntry(sampleEntryType)) {
    return `unknown (${sampleEntryType} protected entry)`;
  }
  return sampleEntryType ?? "unknown";
}

/**
 * @param {string | undefined} sampleEntryType
 */
function isProtectedSampleEntry(sampleEntryType) {
  return sampleEntryType === "encv" || sampleEntryType === "enca";
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 */
function getHandlerType(box) {
  const value = getFieldPrimitive(getField(box, "handler_type"));
  if (typeof value === "string") {
    return value.replace(/\0+$/, "");
  }
  if (typeof value === "number") {
    return numberToFourCC(value);
  }
  return null;
}

/**
 * @param {string | null} handlerType
 * @param {string | undefined} sampleEntryType
 */
function normalizeTrackKind(handlerType, sampleEntryType) {
  if (handlerType === "vide") {
    return "video";
  }
  if (handlerType === "soun") {
    return "audio";
  }
  if (
    handlerType === "subt" ||
    handlerType === "text" ||
    handlerType === "sbtl"
  ) {
    return "text";
  }
  if (handlerType === "meta") {
    return "metadata";
  }
  if (sampleEntryType && VIDEO_SAMPLE_ENTRY_TYPES.has(sampleEntryType)) {
    return "video";
  }
  if (sampleEntryType && AUDIO_SAMPLE_ENTRY_TYPES.has(sampleEntryType)) {
    return "audio";
  }
  if (sampleEntryType && TEXT_SAMPLE_ENTRY_TYPES.has(sampleEntryType)) {
    return "text";
  }
  return "unknown";
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} sampleEntry
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} tkhd
 */
function getDimensions(sampleEntry, tkhd) {
  const width =
    getNumberField(sampleEntry, "width") ?? getNumberField(tkhd, "width");
  const height =
    getNumberField(sampleEntry, "height") ?? getNumberField(tkhd, "height");
  if (!width || !height) {
    return null;
  }
  return `${formatNumber(width)} x ${formatNumber(height)}`;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} sampleEntry
 */
function getAudioDescription(sampleEntry) {
  const channels =
    getNumberField(sampleEntry, "channelcount") ??
    getNumberField(sampleEntry, "channel_count");
  const sampleRate =
    getNumberField(sampleEntry, "samplerate") ??
    getNumberField(sampleEntry, "sample_rate");
  const bitDepth =
    getNumberField(sampleEntry, "samplesize") ??
    getNumberField(sampleEntry, "bits_per_channel");
  const parts = [];
  if (channels) {
    parts.push(`${channels} ch`);
  }
  if (sampleRate) {
    parts.push(`${formatNumber(sampleRate)} Hz`);
  }
  if (bitDepth) {
    parts.push(`${bitDepth} bit`);
  }
  return parts.length ? parts.join(", ") : null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} mdhd
 */
function getLanguage(mdhd) {
  const field = getField(mdhd, "language");
  if (field?.kind !== "struct") {
    return null;
  }
  const language = field.fields.find((item) => item.key === "language");
  const value = getFieldPrimitive(language);
  return value == null ? null : String(value);
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} pasp
 */
function getPixelAspectRatio(pasp) {
  const hSpacing = getNumberField(pasp, "hSpacing");
  const vSpacing = getNumberField(pasp, "vSpacing");
  if (!hSpacing || !vSpacing) {
    return null;
  }
  return `${hSpacing}:${vSpacing}`;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} colr
 */
function getColorDescription(colr) {
  const colourType = getStringField(colr, "colour_type");
  if (!colourType) {
    return null;
  }

  const primaries = getNumberField(colr, "colour_primaries");
  const transfer = getNumberField(colr, "transfer_characteristics");
  const matrix = getNumberField(colr, "matrix_coefficients");
  const fullRange = getBooleanField(colr, "full_range_flag");
  const parts = [`color ${colourType}`];
  if (primaries != null || transfer != null || matrix != null) {
    parts.push(
      `P/T/M ${formatNamedId(primaries, COLOR_PRIMARIES_NAMES)}/${formatNamedId(transfer, TRANSFER_CHARACTERISTIC_NAMES)}/${formatNamedId(matrix, MATRIX_COEFFICIENT_NAMES)}`,
    );
  }
  if (fullRange != null) {
    parts.push(fullRange ? "full range" : "limited range");
  }
  return parts.join(", ");
}

/**
 * @param {number | null} value
 * @param {Map<number, string>} names
 */
function formatNamedId(value, names) {
  if (value == null) {
    return "?";
  }
  return `${names.get(value) ?? "unknown"} (${value})`;
}

/**
 * @param {string | null | undefined} codecType
 * @param {{
 *   avcC: import("isobmff-inspector").ParsedBox | null,
 *   hvcC: import("isobmff-inspector").ParsedBox | null,
 * }} configBoxes
 */
function getCodecString(codecType, { avcC, hvcC }) {
  if (!codecType) {
    return null;
  }
  if ((codecType === "avc1" || codecType === "avc3") && avcC) {
    return getAvcCodecString(codecType, avcC);
  }
  if ((codecType === "hvc1" || codecType === "hev1") && hvcC) {
    return getHevcCodecString(codecType, hvcC);
  }
  return codecType;
}

/**
 * @param {string} codecType
 * @param {import("isobmff-inspector").ParsedBox} avcC
 */
function getAvcCodecString(codecType, avcC) {
  const profile = getNumberField(avcC, "AVCProfileIndication");
  const compatibility = getNumberField(avcC, "profile_compatibility");
  const level = getNumberField(avcC, "AVCLevelIndication");
  if (profile == null || compatibility == null || level == null) {
    return codecType;
  }
  return `${codecType}.${toTwoDigitHex(profile)}${toTwoDigitHex(compatibility)}${toTwoDigitHex(level)}`;
}

/**
 * @param {string} codecType
 * @param {import("isobmff-inspector").ParsedBox} hvcC
 */
function getHevcCodecString(codecType, hvcC) {
  const profileSpace = getNumberField(hvcC, "general_profile_space") ?? 0;
  const profileIdc = getNumberField(hvcC, "general_profile_idc");
  const compatibilityFlags = getNumberField(
    hvcC,
    "general_profile_compatibility_flags",
  );
  const tierFlag = getBooleanField(hvcC, "general_tier_flag");
  const levelIdc = getNumberField(hvcC, "general_level_idc");
  const constraintFlags = getNumberField(
    hvcC,
    "general_constraint_indicator_flags",
  );
  if (
    profileIdc == null ||
    compatibilityFlags == null ||
    tierFlag == null ||
    levelIdc == null
  ) {
    return codecType;
  }

  const parts = [
    codecType,
    `${HEVC_PROFILE_SPACE_LETTERS[profileSpace] ?? ""}${profileIdc}`,
    String(compatibilityFlags),
    `${tierFlag ? "H" : "L"}${levelIdc}`,
  ];
  const constraintString = formatHevcConstraintString(constraintFlags);
  if (constraintString) {
    parts.push(constraintString);
  }
  return parts.join(".");
}

/**
 * @param {number | null} value
 */
function formatHevcConstraintString(value) {
  if (value == null) {
    return null;
  }
  const hex = value.toString(16).toUpperCase().padStart(12, "0");
  const trimmed = hex.replace(/(00)+$/, "");
  return trimmed || "0";
}

/**
 * @param {number} value
 */
function toTwoDigitHex(value) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * @param {string} value
 */
function formatUuidLikeHex(value) {
  const normalized = value.replace(/[^0-9A-Fa-f]/g, "").toLowerCase();
  if (normalized.length !== 32) {
    return value;
  }
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} schm
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} tenc
 */
function getEncryptionDetails(schm, tenc) {
  const details = [];
  const schemeType = getStringField(schm, "scheme_type");
  const schemeVersion = getNumberField(schm, "scheme_version");
  const schemeName = schemeType
    ? (PROTECTION_SCHEME_NAMES.get(schemeType) ?? "unknown scheme")
    : null;
  if (schemeType) {
    details.push(
      `protection scheme ${schemeType}${schemeName ? ` (${schemeName})` : ""}${schemeVersion != null ? `, version 0x${schemeVersion.toString(16).toUpperCase()}` : ""}`,
    );
  }

  const isProtected = getNumberField(tenc, "default_IsProtected");
  const perSampleIvSize = getNumberField(tenc, "default_Per_Sample_IV_Size");
  const defaultKid = getStringField(tenc, "default_KID");
  const cryptByteBlock = getNumberField(tenc, "default_crypt_byte_block");
  const skipByteBlock = getNumberField(tenc, "default_skip_byte_block");
  if (isProtected != null || perSampleIvSize != null) {
    details.push(
      `tenc default protection ${isProtected === 1 ? "enabled" : "disabled"}, IV size ${perSampleIvSize ?? "?"} bytes`,
    );
  }
  if (defaultKid) {
    details.push(`default KID ${formatUuidLikeHex(defaultKid)}`);
  }
  if (cryptByteBlock != null || skipByteBlock != null) {
    details.push(
      `pattern encryption crypt/skip ${cryptByteBlock ?? "?"}/${skipByteBlock ?? "?"}`,
    );
  }
  return details;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} elst
 * @param {number | null} timescale
 */
function getEditListDetails(elst, timescale) {
  const entries = getStructArrayField(elst, "entries");
  if (!entries.length) {
    return [];
  }

  const details = [`edit list entries ${numberFormat(entries.length)}`];
  const firstEntry = entries[0];
  const mediaTime = getPrimitiveNumberFromStruct(firstEntry, "media_time");
  const segmentDuration = getPrimitiveNumberFromStruct(
    firstEntry,
    "segment_duration",
  );
  if (mediaTime === -1 && segmentDuration != null) {
    details.push(
      `initial empty edit delay ${formatTicksWithTime(segmentDuration, timescale)}`,
    );
  } else if (mediaTime != null && mediaTime > 0) {
    details.push(
      `presentation starts after skipping ${formatTicksWithTime(mediaTime, timescale)} of media timeline`,
    );
  } else if (mediaTime === 0) {
    details.push("presentation starts at media time zero");
  }
  return details;
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
 * @returns {Map<string, { defaultSampleDuration: number; defaultSampleSize: number }>}
 */
function getTrackFragmentDefaults(boxes) {
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

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} stsz
 * @returns {SampleSizeSource | null}
 */
function getTrackSampleSizeSource(stsz) {
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
function getFragmentSampleSizeSource(truns, tfhd, fallbackSize) {
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
 * @param {SampleSizeSource | null} sampleSizes
 * @param {GopRun[]} gops
 * @param {{ totalDuration: number | null, timescale: number | null }} [timing]
 */
function analyzeSampleSizes(
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
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} stts
 * @param {number | null} timescale
 * @param {string} trackKind
 * @returns {TimingAnalysis}
 */
function analyzeTrackTiming(stts, timescale, trackKind) {
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
function analyzeFragmentTiming(
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
function analyzeDurationRuns(runs, timescale, trackKind) {
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
 * @param {number} duration
 * @param {number | null} timescale
 * @param {string} trackKind
 */
function getConstantTimingSummary(duration, timescale, trackKind) {
  const cadence = `constant sample duration: ${formatTicksWithTime(duration, timescale)}`;
  if (!timescale || duration <= 0 || trackKind !== "video") {
    return cadence;
  }
  const frameRate = timescale / duration;
  return `${cadence}, nominal ${formatFrameRate(frameRate)} fps`;
}

/**
 * @param {GopRun[]} gops
 * @param {number | null} sampleCount
 */
function getGopDescription(gops, sampleCount) {
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
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} ctts
 * @param {number | null} sampleCount
 * @param {number | null} timescale
 */
function getTrackFrameArrangement(ctts, sampleCount, timescale) {
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
function getFragmentFrameArrangement(samples, timescale) {
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
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {string} type
 * @returns {import("isobmff-inspector").ParsedBox | null}
 */
function findFirstBox(boxes, type) {
  for (const box of boxes) {
    if (box.type === type) {
      return box;
    }
    const child = findFirstBox(box.children ?? [], type);
    if (child) {
      return child;
    }
  }
  return null;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {string} type
 * @param {Array<import("isobmff-inspector").ParsedBox>} out
 * @returns {Array<import("isobmff-inspector").ParsedBox>}
 */
function findBoxes(boxes, type, out = []) {
  for (const box of boxes) {
    if (box.type === type) {
      out.push(box);
    }
    findBoxes(box.children ?? [], type, out);
  }
  return out;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {Set<string>} types
 * @returns {boolean}
 */
function hasBoxType(boxes, types) {
  return boxes.some(
    (box) => types.has(box.type) || hasBoxType(box.children ?? [], types),
  );
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
function getField(box, key) {
  return box?.values?.find((field) => field.key === key) ?? null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
function getStringField(box, key) {
  const field = getField(box, key);
  if (!field) {
    return null;
  }
  const value = getFieldPrimitive(field);
  return value == null ? null : String(value);
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
function getNumberField(box, key) {
  const field = getField(box, key);
  const value = getFieldPrimitive(field);
  return toNullableNumber(value);
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
function getBooleanField(box, key) {
  const value = getFieldPrimitive(getField(box, key));
  return typeof value === "boolean" ? value : null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
function getNumberArrayField(box, key) {
  const field = getField(box, key);
  if (field?.kind !== "array") {
    return [];
  }
  return field.items
    .map((item) => toNullableNumber(getFieldPrimitive(item)))
    .filter((value) => value != null);
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
function getStructArrayField(box, key) {
  const field = getField(box, key);
  if (field?.kind !== "array") {
    return [];
  }
  return field.items.filter((item) => item.kind === "struct");
}

/**
 * @param {import("isobmff-inspector").ParsedField | null | undefined} field
 * @returns {string | number | bigint | boolean | null}
 */
function getFieldPrimitive(field) {
  if (!field) {
    return null;
  }
  switch (field.kind) {
    case "number":
    case "bigint":
    case "string":
    case "bytes":
    case "boolean":
    case "fixed-point":
    case "date":
    case "bits":
    case "flags":
      return field.value;
    case "null":
      return null;
    default:
      return null;
  }
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {number | null} timescale
 */
function getFragmentDuration(truns, timescale) {
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
function getSampleTimingDetails(stts) {
  const entryCount = getNumberField(stts, "entry_count");
  return entryCount != null
    ? [`timing entries ${numberFormat(entryCount)}`]
    : [];
}

/**
 * @param {number} value
 */
function formatDuration(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }
  if (value < 1) {
    return `${Math.round(value * 1000)} ms`;
  }
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  const time =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds.toFixed(3).padStart(6, "0")}`
      : `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
  return `${time} (${value.toFixed(value < 10 ? 3 : 1)} s)`;
}

/**
 * @param {import("isobmff-inspector").ParsedBoxValue | import("isobmff-inspector").ParsedField | null | undefined} field
 * @param {number | null} timescale
 */
function formatTickFieldValue(field, timescale) {
  const value = getFieldPrimitive(field);
  if (value == null) {
    return "unknown";
  }
  const numberValue = toNullableNumber(value);
  if (numberValue == null) {
    return String(value);
  }
  return formatTicksWithTime(numberValue, timescale);
}

/**
 * @param {number} ticks
 * @param {number | null} timescale
 */
function formatTicksWithTime(ticks, timescale) {
  const tickLabel = `${numberFormat(ticks)} ticks`;
  if (!timescale) {
    return tickLabel;
  }
  return `${tickLabel} (${formatDuration(ticks / timescale)})`;
}

/**
 * @param {number} value
 */
function formatByteSize(value) {
  if (!Number.isFinite(value)) {
    return "0 B";
  }
  if (value < 1024) {
    return `${Math.round(value)} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = -1;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex++;
  }
  return `${amount.toFixed(unitIndex === 0 ? 1 : 2)} ${units[unitIndex]}`;
}

/**
 * @param {number} value
 */
function formatFrameRate(value) {
  return value >= 100
    ? formatNumber(value)
    : value.toLocaleString(undefined, {
        minimumFractionDigits: value < 10 ? 3 : value < 30 ? 2 : 0,
        maximumFractionDigits: value < 10 ? 3 : value < 30 ? 2 : 3,
      });
}

/**
 * @param {number} bitsPerSecond
 */
function formatBitrate(bitsPerSecond) {
  if (!Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) {
    return "unknown";
  }
  if (bitsPerSecond < 1000) {
    return `${formatNumber(bitsPerSecond)} bps`;
  }
  if (bitsPerSecond < 1_000_000) {
    return `${formatNumber(bitsPerSecond / 1000)} kbps`;
  }
  return `${formatNumber(bitsPerSecond / 1_000_000)} Mbps`;
}

/**
 * @param {number} value
 */
function formatChromaFormat(value) {
  switch (value) {
    case 0:
      return "monochrome";
    case 1:
      return "4:2:0";
    case 2:
      return "4:2:2";
    case 3:
      return "4:4:4";
    default:
      return String(value);
  }
}

/**
 * @param {number} level
 */
function formatAvcLevel(level) {
  return (level / 10).toFixed(1);
}

/**
 * @param {number} level
 */
function formatHevcLevel(level) {
  return (level / 30).toFixed(1);
}

/**
 * @param {number} value
 */
function formatHevcConstantFrameRate(value) {
  switch (value) {
    case 1:
      return "constant";
    case 2:
      return "constant, each temporal layer";
    default:
      return String(value);
  }
}

/**
 * @param {number | null} value
 */
function formatAvcProfile(value) {
  if (value == null) {
    return "?";
  }
  switch (value) {
    case 66:
      return "Baseline (66)";
    case 77:
      return "Main (77)";
    case 88:
      return "Extended (88)";
    case 100:
      return "High (100)";
    case 110:
      return "High 10 (110)";
    case 122:
      return "High 4:2:2 (122)";
    case 144:
      return "High 4:4:4 (144)";
    case 244:
      return "High 4:4:4 Predictive (244)";
    default:
      return String(value);
  }
}

/**
 * @param {number} value
 */
function formatNumber(value) {
  if (Number.isInteger(value)) {
    return numberFormat(value);
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/**
 * @param {number} ratio
 */
function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(ratio < 0.01 ? 2 : 1)}%`;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 */
function sumBoxes(boxes) {
  return boxes.reduce((sum, box) => sum + toNumber(box.size), 0);
}

/**
 * @param {unknown} value
 */
function toNumber(value) {
  return toNullableNumber(value) ?? 0;
}

/**
 * @param {{
 *   sampleCount: number | null,
 *   syncSampleNumbers: number[],
 *   ctts: import("isobmff-inspector").ParsedBox | null,
 *   sdtp: import("isobmff-inspector").ParsedBox | null,
 * }} input
 * @returns {SampleTimeline | null}
 */
function getTrackSampleTimeline({
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
      dependsOnOthers: dependency?.dependsOnOthers ?? false,
      isDiscardable: dependency?.isDiscardable ?? false,
    });
  });
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} tfhd
 * @returns {SampleTimeline | null}
 */
function getFragmentSampleTimeline(truns, tfhd) {
  const defaultSampleFlags = getNumberField(tfhd, "default_sample_flags");
  /** @type Array<import("./utils").SampleClass> */
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
 * @param {(sampleIndex: number) => import("./utils").SampleClass} getKind
 * @returns {SampleTimeline}
 */
function buildSampleTimeline(totalSamples, getKind) {
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
      dependsOnOthers: getNumberFromStruct(sample, "sample_depends_on") === 1,
      isDiscardable: getNumberFromStruct(sample, "sample_is_depended_on") === 2,
    });
  });
  return dependencies;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} truns
 * @param {import("isobmff-inspector").ParsedBox|null} tfhd
 * @param {number|null} fallbackSampleSize
 * @returns {GopRun[]}
 */
function getGopsFromTruns(truns, tfhd, fallbackSampleSize) {
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
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | undefined} struct
 * @param {string} key
 */
function getNumberFromStruct(struct, key) {
  if (!struct) {
    return null;
  }
  const field = struct.fields.find((item) => item.key === key);
  return toNullableNumber(getFieldPrimitive(field));
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | undefined} struct
 * @param {string} key
 */
function getPrimitiveNumberFromStruct(struct, key) {
  if (!struct) {
    return null;
  }
  const field = struct.fields.find((item) => item.key === key);
  const value = getFieldPrimitive(field);
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    const converted = Number(value);
    return Number.isSafeInteger(converted) ? converted : null;
  }
  return null;
}

/**
 * @param {number} sampleFlags
 */
function isSyncSampleFlags(sampleFlags) {
  return (sampleFlags & 0x10000) === 0;
}

/**
 * @param {unknown} value
 */
function toNullableNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return null;
}

/**
 * @param {number[]} syncSampleNumbers
 * @param {number | null} sampleCount
 * @param {SampleSizeSource | null} [sampleSizes]
 * @returns {import("./read").GopRun[]}
 */
function getGopsFromSyncSamples(
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
function getGopTotalBytes(sampleSizes, startSample, sampleCount) {
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
