/**
 * @param {Uint8Array[]} chunks
 * @param {number} totalLength
 * @returns {Uint8Array}
 */
export function concatUint8Arrays(chunks, totalLength) {
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

/**
 * Convert `isobmff-inspector`'s input into an `Uint8Array`.
 * @param {import("isobmff-inspector").ISOBMFFByteChunk} chunk
 * @returns {Uint8Array}
 */
export function toUint8Array(chunk) {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }
  return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
}

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
