import { parseSegmentWithoutRender } from "../inspection/parseInspectionStream.js";
import { createAbortableAsyncIterable } from "../utils/abortables.js";

/**
 * @param {string} url
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {AbortSignal} signal
 * @returns {Promise<{ input: AsyncIterable<Uint8Array>, totalBytes: number | null }>}
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
  const totalBytes = getResponseByteLength(r.headers, byteRange);
  if (r.body) {
    return {
      input: createAbortableAsyncIterable(r.body, signal),
      totalBytes,
    };
  }
  return {
    input: {
      async *[Symbol.asyncIterator]() {
        yield new Uint8Array(await r.arrayBuffer());
      },
    },
    totalBytes,
  };
}

/**
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined }} segment
 * @param {AbortSignal} signal
 * @returns {Promise<{ boxes: Array<import("isobmff-inspector").ParsedBox> }>}
 */
async function loadSupplementalInitMetadata(segment, signal) {
  const { input } = await fetchSegmentInput(
    segment.url,
    segment.byteRange,
    signal,
  );
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
 *   segmentTotalBytes: number | null;
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
      : Promise.resolve({ input, totalBytes: inferByteRangeLength(byteRange) });
  return fetchProm.then((segmentInput) => {
    const supplementalMetadataPromise = companionInit
      ? loadSupplementalInitMetadata(companionInit, signal)
      : Promise.resolve(null);
    return {
      segmentData: segmentInput.input,
      segmentTotalBytes: segmentInput.totalBytes,
      companionDataPromise: supplementalMetadataPromise,
    };
  });
}

/**
 * @param {Headers} headers
 * @param {[number, number|undefined]|undefined} byteRange
 * @returns {number | null}
 */
function getResponseByteLength(headers, byteRange) {
  const contentRange = headers.get("content-range");
  const rangeLength = parseContentRangeLength(contentRange);
  if (rangeLength !== null) {
    return rangeLength;
  }
  const contentLength = headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return inferByteRangeLength(byteRange);
}

/**
 * @param {string | null} contentRange
 * @returns {number | null}
 */
function parseContentRangeLength(contentRange) {
  const match = contentRange?.match(/^bytes\s+(\d+)-(\d+)\//i);
  if (!match) {
    return null;
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return end - start + 1;
}

/**
 * @param {[number, number|undefined]|undefined} byteRange
 * @returns {number | null}
 */
function inferByteRangeLength(byteRange) {
  if (byteRange === undefined) {
    return null;
  }
  const [start, end] = byteRange;
  if (end === undefined || end < start) {
    return null;
  }
  return end - start + 1;
}
