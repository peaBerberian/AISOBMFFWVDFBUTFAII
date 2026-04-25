/**
 * @typedef {Omit<import("isobmff-inspector").ParsedBox, "actualSize"> & {
 *   actualSize?: number,
 * }} BoxWithOptionalActualSize
 */

/**
 * @param {BoxWithOptionalActualSize} box
 * @returns {number}
 */
export function getAdvertisedBoxSize(box) {
  const size = Number(box.size ?? 0);
  return Number.isFinite(size) ? size : 0;
}

/**
 * @param {BoxWithOptionalActualSize} box
 * @returns {number}
 */
export function getActualBoxSize(box) {
  const actualSize = Number(box.actualSize);
  if (Number.isFinite(actualSize)) {
    return actualSize;
  }
  return getAdvertisedBoxSize(box);
}

/**
 * @param {BoxWithOptionalActualSize} box
 * @returns {boolean}
 */
export function hasDistinctActualBoxSize(box) {
  return getActualBoxSize(box) !== getAdvertisedBoxSize(box);
}
