import { getAdvertisedBoxSize } from "./box_size.js";

/**
 * @param {import("../utils/box_size.js").BoxWithOptionalActualSize} box
 * @returns {string}
 */
export function getByteViewBoxKey(box) {
  const offset = Number(box.offset);
  const size = getAdvertisedBoxSize(box);
  if (!Number.isFinite(offset) || !Number.isFinite(size)) {
    return "";
  }
  return `${offset}:${size}:${box.type}`;
}

/**
 * @param {import("../utils/box_size.js").BoxWithOptionalActualSize} box
 * @param {number[]} pathIndices
 * @returns {string}
 */
export function getByteViewFieldId(box, pathIndices) {
  const boxKey = getByteViewBoxKey(box);
  if (!boxKey || pathIndices.length === 0) {
    return "";
  }
  return `${boxKey}|${pathIndices.join(".")}`;
}

/**
 * @param {unknown} field
 * @returns {boolean}
 */
export function hasByteViewSpan(field) {
  const locatedField = /** @type {{ offset?: number, byteLength?: number }} */ (
    field
  );
  return (
    typeof field === "object" &&
    field !== null &&
    Number.isFinite(Number(locatedField.offset)) &&
    Number.isFinite(Number(locatedField.byteLength)) &&
    Number(locatedField.byteLength) > 0
  );
}
