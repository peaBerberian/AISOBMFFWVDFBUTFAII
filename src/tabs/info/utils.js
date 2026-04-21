/**
 * @param {number} value
 */
export function numberFormat(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** @typedef {"sync" | "reordered" | "discardable" | "dependent" | "non-sync" | "unknown"} SampleClass */

/**
 * @param {SampleClass} kind
 * @returns {string}
 */
export function getSampleKindTitle(kind) {
  switch (kind) {
    case "sync":
      return "sync/random-access sample";
    case "reordered":
      return "presentation-reordered sample";
    case "discardable":
      return "dependency flags say no other sample depends on it";
    case "dependent":
      return "dependency flags say it depends on other samples";
    case "non-sync":
      return "known non-sync sample";
    default:
      return "unknown from container metadata";
  }
}
/**
 * @param {SampleClass} kind
 * @returns {string}
 */
export function getSampleKindLabel(kind) {
  switch (kind) {
    case "sync":
      return "S";
    case "reordered":
      return "R";
    case "discardable":
      return "x";
    case "dependent":
      return "d";
    case "non-sync":
      return "N";
    default:
      return "?";
  }
}

/**
 * @param {{
 *   isSync?: boolean,
 *   isReordered?: boolean,
 *   isExplicitNonSync?: boolean,
 *   dependsOnOthers?: boolean,
 *   isDiscardable?: boolean,
 * }} flags
 * @returns {SampleClass}
 */
export function classifySample(flags) {
  if (flags.isSync) {
    return "sync";
  }
  if (flags.isReordered) {
    return "reordered";
  }
  if (flags.isDiscardable) {
    return "discardable";
  }
  if (flags.dependsOnOthers) {
    return "dependent";
  }
  if (flags.isExplicitNonSync) {
    return "non-sync";
  }
  return "unknown";
}

/**
 * @returns {Record<import("./utils").SampleClass, number>}
 */
export function createSampleCounts() {
  return {
    sync: 0,
    reordered: 0,
    discardable: 0,
    dependent: 0,
    "non-sync": 0,
    unknown: 0,
  };
}
