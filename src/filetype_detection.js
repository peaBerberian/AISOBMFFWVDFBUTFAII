import {
  createAbortableAsyncIterable,
  readWithAbort,
} from "./utils/abortables.js";
import { concatUint8Arrays, toUint8Array } from "./utils/bytes.js";

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
  const unsupportedFormat = detectKnownUnsupportedFormat(prefix.bytes);

  if (kind === "dash" || kind === "hls") {
    return {
      kind,
      text: await responseWithPrefixToText(prefix.bytes, prefix.reader, signal),
      stream: null,
    };
  }
  if (unsupportedFormat !== null) {
    throw new Error(
      `Detected ${unsupportedFormat}, which is not an ISOBMFF resource supported by this app.`,
    );
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
 * @param {Blob} file
 * @param {AbortSignal} signal
 * @returns {Promise<string | null>}
 */
export async function detectKnownUnsupportedLocalFile(file, signal) {
  const prefix = await readBlobPrefix(file, REMOTE_PROBE_BYTE_COUNT, signal);
  return detectKnownUnsupportedFormat(prefix.bytes);
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
 * @param {Blob} blob
 * @param {number} maxBytes
 * @param {AbortSignal} signal
 * @returns {Promise<{ bytes: Uint8Array }>}
 */
async function readBlobPrefix(blob, maxBytes, signal) {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const chunk = blob.slice(0, maxBytes);
  const buffer = await chunk.arrayBuffer();
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  return {
    bytes: new Uint8Array(buffer),
  };
}

/**
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
function detectKnownUnsupportedFormat(bytes) {
  if (looksLikePng(bytes)) {
    return "a PNG image";
  }
  if (looksLikeJpeg(bytes)) {
    return "a JPEG image";
  }
  if (looksLikePdf(bytes)) {
    return "a PDF document";
  }
  if (looksLikeMpeg2TransportStream(bytes)) {
    return "an MPEG-2 transport stream";
  }

  const ebmlFormat = detectEbmlFormat(bytes);
  if (ebmlFormat !== null) {
    return ebmlFormat;
  }

  return null;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
function detectEbmlFormat(bytes) {
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== 0x1a ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0xdf ||
    bytes[3] !== 0xa3
  ) {
    return null;
  }

  const prefixText = new TextDecoder().decode(bytes);
  if (prefixText.includes("webm")) {
    return "a WebM file";
  }
  if (prefixText.includes("matroska")) {
    return "a Matroska / MKV file";
  }
  return "an EBML container such as WebM or Matroska";
}

/**
 * @param {Uint8Array} bytes
 */
function looksLikePng(bytes) {
  return (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/**
 * @param {Uint8Array} bytes
 */
function looksLikeJpeg(bytes) {
  return (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

/**
 * @param {Uint8Array} bytes
 */
function looksLikePdf(bytes) {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/**
 * @param {Uint8Array} bytes
 */
function looksLikeMpeg2TransportStream(bytes) {
  if (bytes.byteLength < 188 * 2) {
    return false;
  }

  let syncCount = 0;
  for (let offset = 0; offset < bytes.byteLength; offset += 188) {
    if (bytes[offset] !== 0x47) {
      break;
    }
    syncCount++;
    if (syncCount >= 2) {
      return true;
    }
  }
  return false;
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
