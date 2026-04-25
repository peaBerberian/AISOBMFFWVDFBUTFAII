/**
 * @param {number} n
 */
export function fmtBytes(n) {
  const b = Number(n);
  if (!Number.isFinite(b)) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let value = b;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  if (unitIndex === 0) {
    return `${b} B`;
  }
  return `${value.toFixed(unitIndex === 1 ? 1 : 2)} ${units[unitIndex]}`;
}
