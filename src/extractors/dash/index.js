/**
 * dash-mpd-extractor.js
 * Extracts ISOBMFF segment URLs from a DASH MPD (XML string or URL).
 *
 * Supports:
 *  - SegmentTemplate with $Number$ / $Time$ / $Bandwidth$ / $RepresentationID$
 *  - SegmentList (explicit SegmentURL elements)
 *  - SegmentBase (single-resource; SIDX-based; fetches + parses the sidx box to
 *    derive individual media segment byte ranges)
 *  - BaseURL inheritance and stacking
 *  - Period / AdaptationSet / Representation attribute inheritance
 *  - Multiple Periods
 *
 * Two-phase API
 * -------------
 * parseMPD()    – synchronous; builds the tree.  SegmentBase representations
 *                 that need SIDX resolution carry a `sidxPending` descriptor
 *                 instead of fully-populated `segments`.
 * resolveSIDX() – async; walks the tree, fetches every pending SIDX byte-range,
 *                 parses the box(es), and replaces `sidxPending` with real
 *                 byte-range segments.  All representations are resolved in
 *                 parallel.
 *
 * The convenience entry-points extractSegmentsFromURL / extractSegmentsFromString
 * call both phases automatically.
 *
 * @returns {Promise<DashTree>}
 *
 * DashTree      = { periods: Period[] }
 * Period        = { id, start, duration, adaptationSets: AdaptationSet[] }
 * AdaptationSet = { id, mimeType, codecs, lang, representations: Representation[] }
 * Representation= { id, bandwidth, mimeType, codecs,
 *                   segments: Segment[],
 *                   sidxPending?: SidxPending }
 * Segment       = { url, byteRange?, isISOBMFF, type: "init"|"media"|"index" }
 * SidxPending   = { mediaURL, initSegment?, indexRange?, timescale? }
 *
 * Only segments where isISOBMFF === true are included in `segments`.
 */

import { parseMPD } from "./mpd_parser.js";
import { resolveSIDX } from "./sidx.js";

/**
 * Fetch a DASH MPD from a URL, parse it, and return the segment URL tree.
 *
 * @param {string} mpdURL
 * @param {AbortSignal} [signal]
 * @returns {Promise<import("./types").DashTree>}
 */
export async function extractSegmentsFromURL(mpdURL, signal) {
  const res = await fetch(mpdURL, { signal });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch MPD: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const text = await res.text();
  const tree = parseMPD(text, mpdURL, signal);
  // XXX TODO:
  return resolveSIDX(tree, signal);
}

/**
 * Parse a DASH MPD from an XML string.
 *
 * @param {string} mpdText
 * @param {string} [baseURL]   Used to resolve relative URLs within the MPD
 * @param {AbortSignal} [signal]
 * @returns {Promise<import("./types").DashTree>}
 */
export async function extractSegmentsFromString(mpdText, baseURL = "", signal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const tree = parseMPD(mpdText, baseURL, signal);
  // XXX TODO:
  return resolveSIDX(tree, signal);
}
