import {
  createAbortableAsyncIterable,
  readWithAbort,
} from "../utils/abortables.js";
import { concatUint8Arrays, toUint8Array } from "../utils/bytes.js";

// TODO: Add common other file format magic numbers detection with the goal to
// provide better error message?
// Thinking especially here about: mpeg2-ts, mkv, webm, plain subtitles and a
// few image formats

const REMOTE_PROBE_BYTE_COUNT = 4096;
const DASH_CONTENT_TYPES = ["application/dash+xml", "video/vnd.mpeg.dash.mpd"];
const HLS_CONTENT_TYPES = [
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
];
const XML_CONTENT_TYPES = ["application/xml", "text/xml"];
const TEXT_CONTENT_TYPES = ["text/plain"];
const ISOBMFF_BOX_TYPES = new Set([
  "ftyp",
  "styp",
  "moov",
  "moof",
  "mdat",
  "sidx",
  "free",
  "skip",
  "wide",
  "emsg",
  "prft",
  "uuid",
]);

/**
 * @typedef {{
 *   kind: "dash" | "hls" | "segment",
 *   text: string | null,
 *   stream: AsyncIterable<Uint8Array> | null,
 * }} RemoteSourceProbe
 */

/**
 * @param {string} sourceUrl
 * @param {AbortSignal} signal
 * @returns {Promise<RemoteSourceProbe>}
 */
export async function probeRemoteSource(sourceUrl, signal) {
  const response = await fetch(sourceUrl, { signal });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    );
  }

  const contentType = normalizeContentType(
    response.headers.get("content-type"),
  );
  const prefix = await readResponsePrefix(
    response,
    REMOTE_PROBE_BYTE_COUNT,
    signal,
  );
  const kind = detectRemoteSourceKind(
    contentType,
    prefix.bytes,
    prefix.text,
    sourceUrl,
  );

  if (kind === "dash" || kind === "hls") {
    return {
      kind,
      text: await responseWithPrefixToText(prefix.bytes, prefix.reader, signal),
      stream: null,
    };
  }

  return {
    kind,
    text: null,
    stream: createPrefixedAsyncIterable(prefix.bytes, prefix.reader, signal),
  };
}

/**
 * @param {string} sourceUrl
 * @returns {"dash" | "hls" | "segment"}
 */
export function getRemoteSourceKind(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl, window.location.href);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith(".mpd")) {
      return "dash";
    }
    if (pathname.endsWith(".m3u8") || pathname.endsWith(".m3u")) {
      return "hls";
    }
  } catch {
    // Leave malformed values to fetch for the existing error path.
  }
  return "segment";
}

/**
 * @param {string | null} contentType
 */
function normalizeContentType(contentType) {
  return contentType?.split(";", 1)[0].trim().toLowerCase() ?? "";
}

/**
 * @param {Response} response
 * @param {number} maxBytes
 * @param {AbortSignal} signal
 */
async function readResponsePrefix(response, maxBytes, signal) {
  const decoder = new TextDecoder();
  const body = response.body;
  if (!body) {
    return {
      bytes: new Uint8Array(0),
      text: "",
      reader: null,
    };
  }

  const reader = body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;

  while (total < maxBytes) {
    const { done, value } = await readWithAbort(reader, signal);
    if (done) {
      break;
    }
    const chunk = toUint8Array(value);
    chunks.push(chunk);
    total += chunk.byteLength;
  }

  const bytes = concatUint8Arrays(chunks, total);
  return {
    bytes,
    text: decoder.decode(bytes),
    reader,
  };
}

/**
 * @param {string} contentType
 * @param {Uint8Array} bytes
 * @param {string} prefixText
 * @param {string} sourceUrl
 * @returns {"dash" | "hls" | "segment"}
 */
function detectRemoteSourceKind(contentType, bytes, prefixText, sourceUrl) {
  if (DASH_CONTENT_TYPES.includes(contentType)) {
    return "dash";
  }
  if (HLS_CONTENT_TYPES.includes(contentType)) {
    return "hls";
  }
  if (looksLikeDashManifest(prefixText)) {
    return "dash";
  }
  if (looksLikeHlsPlaylist(prefixText)) {
    return "hls";
  }
  if (looksLikeISOBMFF(bytes)) {
    return "segment";
  }
  if (
    XML_CONTENT_TYPES.includes(contentType) &&
    /<mpd[\s>]/i.test(prefixText)
  ) {
    return "dash";
  }
  if (
    TEXT_CONTENT_TYPES.includes(contentType) &&
    prefixText.trimStart().startsWith("#EXTM3U")
  ) {
    return "hls";
  }
  return getRemoteSourceKind(sourceUrl);
}

/**
 * @param {string} text
 */
function looksLikeDashManifest(text) {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<MPD") ||
    trimmed.startsWith("<mpd") ||
    /<mpd[\s>]/i.test(trimmed)
  );
}

/**
 * @param {string} text
 */
function looksLikeHlsPlaylist(text) {
  return text.trimStart().startsWith("#EXTM3U");
}

/**
 * @param {Uint8Array} bytes
 */
function looksLikeISOBMFF(bytes) {
  if (bytes.byteLength < 8) {
    return false;
  }
  const headerLength = getBoxHeaderLength(bytes);
  if (headerLength === null || bytes.byteLength < headerLength) {
    return false;
  }
  const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (!/^[\x20-\x7e]{4}$/.test(boxType)) {
    return false;
  }
  return ISOBMFF_BOX_TYPES.has(boxType);
}

/**
 * @param {Uint8Array} bytes
 */
function getBoxHeaderLength(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.getUint32(0);
  if (size === 0) {
    return 8;
  }
  if (size === 1) {
    return bytes.byteLength >= 16 ? 16 : null;
  }
  return size >= 8 ? 8 : null;
}

/**
 * @param {Uint8Array} prefix
 * @param {ReadableStreamDefaultReader<Uint8Array> | null} reader
 * @param {AbortSignal} signal
 * @returns {AsyncIterable<Uint8Array>}
 */
function createPrefixedAsyncIterable(prefix, reader, signal) {
  if (!reader) {
    return {
      async *[Symbol.asyncIterator]() {
        if (prefix.byteLength > 0) {
          yield prefix;
        }
      },
    };
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (prefix.byteLength > 0) {
          controller.enqueue(prefix);
        }
        while (true) {
          const { done, value } = await readWithAbort(reader, signal);
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        if (signal.aborted) {
          await reader.cancel(signal.reason).catch(() => {});
        }
        reader.releaseLock();
      }
    },
    cancel(reason) {
      return reader.cancel(reason).catch(() => {});
    },
  });

  return createAbortableAsyncIterable(stream, signal);
}

/**
 * @param {Uint8Array} prefix
 * @param {ReadableStreamDefaultReader<Uint8Array> | null} reader
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
async function responseWithPrefixToText(prefix, reader, signal) {
  const decoder = new TextDecoder();
  let text = decoder.decode(prefix, { stream: reader !== null });
  if (!reader) {
    return text;
  }

  try {
    while (true) {
      const { done, value } = await readWithAbort(reader, signal);
      if (done) {
        text += decoder.decode();
        return text;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    if (signal.aborted) {
      await reader.cancel(signal.reason).catch(() => {});
    }
    reader.releaseLock();
  }
}
