import { parseMPD } from "./mpd_parser.js";

export { resolveIndexForRepresentation } from "./sidx.js";

/**
 * Fetch a DASH MPD from a URL and return the parsed tree without resolving
 * pending SIDX-backed representations.
 *
 * @param {string} mpdURL
 * @param {AbortSignal} [signal]
 * @returns {Promise<import("./types").DashTree>}
 */
export async function parseMPDFromURL(mpdURL, signal) {
  const res = await fetch(mpdURL, { signal });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch MPD: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const text = await res.text();
  return parseMPDFromString(text, mpdURL, signal);
}

/**
 * Parse a DASH MPD from an XML string without resolving pending
 * SIDX-backed representations.
 *
 * @param {string} mpdText
 * @param {string} [baseURL]
 * @param {AbortSignal} [signal]
 * @returns {import("./types").DashTree}
 */
export function parseMPDFromString(mpdText, baseURL = "", signal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  return parseMPD(mpdText, baseURL, signal);
}
