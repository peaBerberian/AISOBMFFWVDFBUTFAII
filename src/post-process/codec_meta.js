import { numberFormat } from "../utils/format.js";
import {
  getBooleanField,
  getField,
  getFieldPrimitive,
  getNumberField,
  getPrimitiveNumberFromStruct,
  getStringField,
  getStructArrayField,
  numberToFourCC,
} from "./box_access.js";
import {
  formatHevcConstraintString,
  formatNumber,
  formatTicksWithTime,
} from "./format.js";

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
const PROTECTION_SCHEME_NAMES = new Map([
  ["cenc", "AES-CTR"],
  ["cbc1", "AES-CBC"],
  ["cens", "subsample AES-CTR"],
  ["cbcs", "pattern AES-CBC"],
  ["piff", "PIFF"],
]);
const HEVC_PROFILE_SPACE_LETTERS = ["", "A", "B", "C"];

export const VIDEO_SAMPLE_ENTRY_TYPES = new Set([
  "av01",
  "avc1",
  "avc3",
  "encv",
  "hev1",
  "hvc1",
  "vp08",
  "vp09",
]);
export const AUDIO_SAMPLE_ENTRY_TYPES = new Set([
  "ac-3",
  "alac",
  "enca",
  "ec-3",
  "fLaC",
  "mp4a",
  "Opus",
]);
export const TEXT_SAMPLE_ENTRY_TYPES = new Set([
  "stpp",
  "tx3g",
  "vttc",
  "wvtt",
]);

/**
 * @param {string | null | undefined} codecType
 * @param {{
 *   avcC: import("isobmff-inspector").ParsedBox | null,
 *   hvcC: import("isobmff-inspector").ParsedBox | null,
 * }} configBoxes
 */
export function getCodecString(codecType, { avcC, hvcC }) {
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
 * @param {number} value
 */
function toTwoDigitHex(value) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * @param {string | undefined} sampleEntryType
 * @param {string | null} originalFormat
 * @param {{
 *   avcC: import("isobmff-inspector").ParsedBox | null,
 *   hvcC: import("isobmff-inspector").ParsedBox | null,
 * }} configBoxes
 */
export function getCodecLabel(sampleEntryType, originalFormat, configBoxes) {
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
export function isProtectedSampleEntry(sampleEntryType) {
  return sampleEntryType === "encv" || sampleEntryType === "enca";
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 */
export function getHandlerType(box) {
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
export function normalizeTrackKind(handlerType, sampleEntryType) {
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
export function getDimensions(sampleEntry, tkhd) {
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
export function getAudioDescription(sampleEntry) {
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
export function getLanguage(mdhd) {
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
export function getPixelAspectRatio(pasp) {
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
export function getColorDescription(colr) {
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
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} schm
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} tenc
 */
export function getEncryptionDetails(schm, tenc) {
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
export function getEditListDetails(elst, timescale) {
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
 * @param {string} value
 */
function formatUuidLikeHex(value) {
  const normalized = value.replace(/[^0-9A-Fa-f]/g, "").toLowerCase();
  if (normalized.length !== 32) {
    return value;
  }
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}
