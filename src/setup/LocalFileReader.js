import {
  createAbortableAsyncIterable,
  throwIfAborted,
} from "../utils/abortables.js";

/**
 * Wrap a local file as a reading-oriented source that can both feed the
 * progressive parser and later provide targeted range rereads.
 */
export default class LocalFileReader {
  #file;
  #signal;

  /**
   * @param {Blob} file
   * @param {AbortSignal} signal
   */
  constructor(file, signal) {
    this.#file = file;
    this.#signal = signal;
  }

  /**
   * @returns {import("isobmff-inspector").ISOBMFFInput}
   */
  toParserInput() {
    const streamableFile = /** @type {{ stream?: Blob["stream"] }} */ (
      this.#file
    );
    if (typeof streamableFile.stream !== "function") {
      return this.#file;
    }
    return createAbortableAsyncIterable(
      streamableFile.stream.call(this.#file),
      this.#signal,
    );
  }

  /**
   * @param {number} start
   * @param {number} endExclusive
   * @returns {AsyncIterable<Uint8Array>}
   */
  readRange(start, endExclusive) {
    return createBlobChunkIterable(
      this.#file.slice(start, endExclusive),
      this.#signal,
    );
  }
}

/**
 * @param {Blob} blob
 * @param {AbortSignal} signal
 * @returns {AsyncIterable<Uint8Array>}
 */
function createBlobChunkIterable(blob, signal) {
  const streamableBlob = /** @type {{ stream?: Blob["stream"] }} */ (blob);
  if (typeof streamableBlob.stream === "function") {
    return createAbortableAsyncIterable(
      streamableBlob.stream.call(blob),
      signal,
    );
  }
  return {
    async *[Symbol.asyncIterator]() {
      throwIfAborted(signal);
      const buffer = await blob.arrayBuffer();
      throwIfAborted(signal);
      yield new Uint8Array(buffer);
    },
  };
}
