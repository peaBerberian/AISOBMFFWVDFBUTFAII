import { numberFormat } from "../utils/format.js";
import { getFieldPrimitive, toNullableNumber } from "./box_access.js";

/**
 * @param {number} value
 */
export function formatDuration(value) {
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
export function formatTickFieldValue(field, timescale) {
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
export function formatTicksWithTime(ticks, timescale) {
  const tickLabel = `${numberFormat(ticks)} ticks`;
  if (!timescale) {
    return tickLabel;
  }
  return `${tickLabel} (${formatDuration(ticks / timescale)})`;
}

/**
 * @param {number} value
 */
export function formatByteSize(value) {
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
export function formatFrameRate(value) {
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
export function formatBitrate(bitsPerSecond) {
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
export function formatChromaFormat(value) {
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
export function formatAvcLevel(level) {
  return (level / 10).toFixed(1);
}

/**
 * @param {number} level
 */
export function formatHevcLevel(level) {
  return (level / 30).toFixed(1);
}

/**
 * @param {number} value
 */
export function formatHevcConstantFrameRate(value) {
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
export function formatAvcProfile(value) {
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
export function formatNumber(value) {
  if (Number.isInteger(value)) {
    return numberFormat(value);
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/**
 * @param {number} ratio
 */
export function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(ratio < 0.01 ? 2 : 1)}%`;
}

/**
 * @param {number | null} value
 */
export function formatHevcConstraintString(value) {
  if (value == null) {
    return null;
  }
  const hex = value.toString(16).toUpperCase().padStart(12, "0");
  const trimmed = hex.replace(/(00)+$/, "");
  return trimmed || "0";
}
