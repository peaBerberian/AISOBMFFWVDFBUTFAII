/**
 * @param {number} value
 */
export function numberFormat(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * @param {string} url
 * @param {[number, number|undefined]|undefined} byteRange
 * @returns {string}
 */
export function formatSegmentSourceValue(url, byteRange) {
  if (byteRange === undefined) {
    return url;
  }
  const [start, end] = byteRange;
  return `${url} [bytes=${end !== undefined ? `${start}-${end}` : `${start}-`}]`;
}
