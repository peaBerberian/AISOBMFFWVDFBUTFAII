import { parseSegmentWithoutRender } from "../inspection/parseInspectionStream.js";
import { createAbortableAsyncIterable } from "../utils/abortables.js";

/**
 * @param {string} url
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {AbortSignal} signal
 * @returns {Promise<AsyncIterable<Uint8Array>>}
 */
async function fetchSegmentInput(url, byteRange, signal) {
  /** @type {HeadersInit} */
  const headers = {};
  if (byteRange !== undefined) {
    const [start, end] = byteRange;
    headers.Range =
      end !== undefined ? `bytes=${start}-${end}` : `bytes=${start}-`;
  }
  const r = await fetch(url, { signal, headers });
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (!r.ok) {
    const errMsg = `HTTP ${r.status}${r.statusText ? ` ${r.statusText}` : ""}`;
    throw new Error(`fetch error: ${errMsg}`);
  }
  if (r.body) {
    return createAbortableAsyncIterable(r.body, signal);
  }
  return {
    async *[Symbol.asyncIterator]() {
      yield new Uint8Array(await r.arrayBuffer());
    },
  };
}

/**
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined }} segment
 * @param {AbortSignal} signal
 * @returns {Promise<{ boxes: Array<import("isobmff-inspector").ParsedBox> }>}
 */
async function loadSupplementalInitMetadata(segment, signal) {
  const input = await fetchSegmentInput(segment.url, segment.byteRange, signal);
  const boxes = await parseSegmentWithoutRender(input, signal);
  return { boxes };
}

/**
 * Fetch a remote segment and optional companion initialization metadata.
 *
 * @param {string|AsyncIterable<Uint8Array>} input
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {{
 *   url: string,
 *   byteRange: [number, number|undefined]|undefined
 * }|undefined} companionInit
 * @param {AbortSignal} signal
 * @returns {Promise<{
 *   segmentData: AsyncIterable<Uint8Array>;
 *   companionDataPromise: Promise<{ boxes: Array<import("isobmff-inspector").ParsedBox> } | null>
 * }>}
 */
export default function fetchRemoteSegment(
  input,
  byteRange,
  companionInit,
  signal,
) {
  const fetchProm =
    typeof input === "string"
      ? fetchSegmentInput(input, byteRange, signal)
      : Promise.resolve(input);
  return fetchProm.then((segmentInput) => {
    const supplementalMetadataPromise = companionInit
      ? loadSupplementalInitMetadata(companionInit, signal)
      : Promise.resolve(null);
    return {
      segmentData: segmentInput,
      companionDataPromise: supplementalMetadataPromise,
    };
  });
}
