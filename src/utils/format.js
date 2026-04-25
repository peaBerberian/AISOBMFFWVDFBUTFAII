/**
 * @param {number} value
 */
export function numberFormat(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
