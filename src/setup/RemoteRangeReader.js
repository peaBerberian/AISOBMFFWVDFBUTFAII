import { createAbortableAsyncIterable } from "../utils/abortables.js";

/**
 * @param {string} url
 * @param {[number, number|undefined]|undefined} baseByteRange
 * @param {AbortSignal} signal
 * @returns {(start: number, endExclusive: number) => AsyncIterable<Uint8Array>}
 */
export function createRemoteRangeReader(url, baseByteRange, signal) {
  const baseStart = baseByteRange?.[0] ?? 0;
  const baseEndInclusive = baseByteRange?.[1];

  return (start, endExclusive) =>
    fetchRemoteRange(
      url,
      baseStart,
      baseEndInclusive,
      start,
      endExclusive,
      signal,
    );
}

/**
 * @param {string} url
 * @param {number} baseStart
 * @param {number|undefined} baseEndInclusive
 * @param {number} start
 * @param {number} endExclusive
 * @param {AbortSignal} signal
 * @returns {AsyncIterable<Uint8Array>}
 */
function fetchRemoteRange(
  url,
  baseStart,
  baseEndInclusive,
  start,
  endExclusive,
  signal,
) {
  return {
    async *[Symbol.asyncIterator]() {
      if (endExclusive <= start) {
        return;
      }

      const absoluteStart = baseStart + start;
      const absoluteEndInclusive = baseStart + endExclusive - 1;
      if (
        baseEndInclusive !== undefined &&
        absoluteEndInclusive > baseEndInclusive
      ) {
        throw new Error(
          "requested codec-analysis span exceeds the originally inspected byte range",
        );
      }

      const response = await fetch(url, {
        signal,
        headers: {
          Range: `bytes=${absoluteStart}-${absoluteEndInclusive}`,
        },
      });
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (response.status === 200) {
        await response.body?.cancel().catch(() => {});
        const err = new Error(
          "server responded with the full resource instead of a partial byte range",
        );
        err.name = "RangeNotSupportedError";
        throw err;
      }
      if (response.status !== 206) {
        const errMsg = `HTTP ${response.status}${
          response.statusText ? ` ${response.statusText}` : ""
        }`;
        throw new Error(`fetch error: ${errMsg}`);
      }
      if (!response.body) {
        throw new Error("remote range response had no body");
      }
      yield* createAbortableAsyncIterable(response.body, signal);
    },
  };
}
