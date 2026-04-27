/**
 * @param {AsyncIterable<Uint8Array>} input
 * @param {(absoluteOffset: number, bytes: Uint8Array) => void} onChunk
 * @returns {AsyncIterable<Uint8Array>}
 */
export function trackByteInput(input, onChunk) {
  return {
    async *[Symbol.asyncIterator]() {
      let absoluteOffset = 0;
      for await (const chunk of input) {
        onChunk(absoluteOffset, chunk);
        absoluteOffset += chunk.byteLength;
        yield chunk;
      }
    },
  };
}
