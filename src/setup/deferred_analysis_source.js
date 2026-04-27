import { createAbortableAsyncIterable } from "../utils/abortables.js";
import { createLocalRangeReader } from "./LocalFileReader.js";

/**
 * @typedef {{
 *   available: boolean,
 *   blockedReason: string | null,
 *   pendingTrackCount: number,
 *   pendingSampleCount: number,
 *   recoveredSampleCount: number,
 * }} DeferredAnalysisState
 *
 * @typedef {{
 *   state: DeferredAnalysisState,
 *   results: Array<any>,
 * } | null} DeferredAnalysisRunResult
 *
 * @typedef {{
 *   state: DeferredAnalysisState,
 *   triggerLabel?: string,
 *   run: () => Promise<DeferredAnalysisRunResult>,
 * }} DeferredAnalysisAction
 *
 * @typedef {{
 *   mode: "automatic" | "manual",
 *   triggerLabel?: string,
 *   progressMessage: string,
 *   successMessage: string,
 *   createRangeReader: (signal: AbortSignal) => ((
 *     start: number,
 *     endExclusive: number,
 *   ) => AsyncIterable<Uint8Array>),
 *   mapErrorToBlockedReason?: ((err: unknown) => string | null) | undefined,
 * }} DeferredAnalysisSource
 */

/**
 * @param {Blob} file
 * @returns {DeferredAnalysisSource}
 */
export function createLocalDeferredAnalysisSource(file) {
  return {
    mode: "automatic",
    progressMessage: "Deepening codec analysis from deferred byte spans…",
    successMessage: "File parsed with success!",
    createRangeReader(signal) {
      return createLocalRangeReader(file, signal);
    },
  };
}

/**
 * @param {string} url
 * @param {[number, number|undefined]|undefined} baseByteRange
 * @returns {DeferredAnalysisSource}
 */
export function createRemoteDeferredAnalysisSource(url, baseByteRange) {
  const baseStart = baseByteRange?.[0] ?? 0;
  const baseEndInclusive = baseByteRange?.[1];

  return {
    mode: "manual",
    triggerLabel: "Deepen payload analysis",
    progressMessage: "Fetching deferred codec byte spans…",
    successMessage: "Codec details deepened with deferred byte reads.",
    createRangeReader(signal) {
      return (start, endExclusive) =>
        fetchRemoteRange(
          url,
          baseStart,
          baseEndInclusive,
          start,
          endExclusive,
          signal,
        );
    },
    mapErrorToBlockedReason(err) {
      if (
        err instanceof Error &&
        "name" in err &&
        err.name === "RangeNotSupportedError"
      ) {
        return "Deferred payload analysis is unavailable because this server did not honor the requested HTTP byte range.";
      }
      return null;
    },
  };
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
