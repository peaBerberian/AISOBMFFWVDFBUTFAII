/**
 * Parses M3U / M3U8 playlists and returns the URLs of all ISOBMFF (MP4/fMP4/CMAF)
 * segments, grouped by Variant / Media rendition with their associated attributes.
 *
 * @module hls-isobmff-extractor
 */

/**
 * The detected kind of playlist.
 * @typedef {'plain' | 'master' | 'media'} PlaylistKind
 */

/**
 * A resolved byte-range request, as expressed by EXT-X-BYTERANGE / EXT-X-MAP.
 * @typedef {{
 *   offset: number,
 *   length: number
 * }} ByteRange
 */

/**
 * A single segment that has been identified as an ISOBMFF resource.
 * @typedef {{
 *   url: string,
 *   byteRange: ByteRange | null,
 *   duration: number | null,
 *   title: string | null,
 *   discontinuity: boolean,
 *   map: { url: string, byteRange: ByteRange | null } | null
 * }} ISOBMFFSegment
 */

/**
 * Attributes carried by an EXT-X-STREAM-INF tag (Variant Stream).
 * All keys are optional / nullable – only what the playlist declares is populated.
 * @typedef {{
 *   bandwidth: number | null,
 *   averageBandwidth: number | null,
 *   codecs: string | null,
 *   resolution: string | null,
 *   frameRate: number | null,
 *   hdcpLevel: string | null,
 *   allowedCpc: string | null,
 *   videoRange: string | null,
 *   stableVariantId: string | null,
 *   audio: string | null,
 *   video: string | null,
 *   subtitles: string | null,
 *   closedCaptions: string | null,
 *   pathwayId: string | null,
 *   [key: string]: string | number | null
 * }} VariantAttributes
 */

/**
 * Attributes carried by an EXT-X-MEDIA tag (Alternative Rendition).
 * @typedef {{
 *   type: string | null,
 *   groupId: string | null,
 *   language: string | null,
 *   assocLanguage: string | null,
 *   name: string | null,
 *   stableRenditionId: string | null,
 *   default: boolean,
 *   autoselect: boolean,
 *   forced: boolean,
 *   instreamId: string | null,
 *   characteristics: string | null,
 *   channels: string | null,
 *   uri: string | null,
 *   [key: string]: string | boolean | null
 * }} MediaAttributes
 */

/**
 * The result for a single Variant Stream (video + muxed).
 * @typedef {{
 *   kind: 'variant',
 *   playlistUrl: string,
 *   attributes: VariantAttributes,
 *   segments: ISOBMFFSegment[]
 * }} VariantResult
 */

/**
 * The result for a single Alternative Rendition (audio, subtitles, …).
 * @typedef {{
 *   kind: 'media',
 *   playlistUrl: string,
 *   attributes: MediaAttributes,
 *   segments: ISOBMFFSegment[]
 * }} MediaResult
 */

/**
 * The result for a plain (non-HLS) M3U playlist or a bare media playlist
 * that has no parent master playlist context.
 * @typedef {{
 *   kind: 'plain' | 'media',
 *   playlistUrl: string,
 *   segments: ISOBMFFSegment[]
 * }} SimpleResult
 */

/**
 * Discriminated union of all result shapes.
 * @typedef {VariantResult | MediaResult | SimpleResult} PlaylistResult
 */

/**
 * Top-level return value of {@link extractISOBMFFSegments}.
 * @typedef {{
 *   playlistKind: PlaylistKind,
 *   results: PlaylistResult[]
 * }} ExtractionResult
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Absolute-URL resolution that works for both http(s) and blob URLs. */
const resolveUrl = (
  /** @type {string} */ base,
  /** @type {string} */ relative,
) => {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
};

/**
 * Parse a quoted-string-or-unquoted attribute value map from an HLS tag line.
 * e.g. `BANDWIDTH=1280000,CODECS="avc1.42c01e,mp4a.40.2",RESOLUTION=1280x720`
 * @param {string} attrString
 * @returns {Map<string, string>}
 */
const parseAttributeList = (attrString) => {
  /** @type {Map<string, string>} */
  const map = new Map();
  // Regex: KEY=VALUE where VALUE is either "quoted" or unquoted-no-comma
  const re = /([A-Z0-9_-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/g;
  let m;
  while ((m = re.exec(attrString)) !== null) {
    const key = m[1];
    let value = m[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
};

/**
 * Parse EXT-X-BYTERANGE value: `<length>[@<offset>]`
 * @param {string} value
 * @param {number} [previousEnd] - the byte offset where the previous range ended (for chained ranges)
 * @returns {ByteRange}
 */
const parseByteRange = (value, previousEnd = 0) => {
  const [lenStr, offStr] = value.split("@");
  const length = parseInt(lenStr, 10);
  const offset = offStr !== undefined ? parseInt(offStr, 10) : previousEnd;
  return { length, offset };
};

/**
 * Detect whether a segment URL (or its initialization section) is ISOBMFF.
 * Heuristics (in order of reliability):
 *   1. CODECS attribute contains known ISO Base Media codec strings.
 *   2. File extension is .mp4 / .m4s / .m4v / .m4a / .cmfv / .cmfa / .cmft / .fmp4
 *   3. No extension that is definitively NOT ISOBMFF (.ts, .aac, .ac3, .ec3, .vtt, .webvtt, .ttml).
 *
 * Because we cannot sniff bytes in a pure parser, we use conservative extension matching.
 * @param {string} url
 * @param {string | null} [codecs]
 * @returns {boolean}
 */
const isLikelyISOBMFF = (url, codecs) => {
  // Known ISOBMFF codecs (ISO Base Media codec strings)
  if (codecs) {
    // avc1, hev1, hvc1, av01, mp4a, ec-3, ac-3, fLaC, Opus, vp09 → all carried in ISOBMFF
    // Note: these are also the codecs used in WebM (vp8/vp9), but in HLS context → ISOBMFF
    if (
      /\b(avc[134]|hev1|hvc1|av01|dvh[1e]|dvav|mp4a|ec-3|ac-3|flac|opus|vp09)\b/i.test(
        codecs,
      )
    ) {
      return true;
    }
  }

  // Strip query string for extension detection
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url.split("?")[0];
  }
  const ext = (path.match(/\.([a-z0-9]+)$/i) ?? [])[1]?.toLowerCase() ?? "";

  // Explicit ISOBMFF extensions
  if (/^(mp4|m4s|m4v|m4a|m4f|cmfv|cmfa|cmft|fmp4|cmaf|mov)$/.test(ext))
    return true;

  // Explicit non-ISOBMFF extensions → reject
  if (
    /^(ts|aac|ac3|ec3|mp3|vtt|webvtt|ttml|dfxp|srt|ass|ssa|flac|ogg|webm)$/.test(
      ext,
    )
  )
    return false;

  // No extension or unknown extension → assume ISOBMFF (modern HLS defaults to fMP4)
  return true;
};

// ---------------------------------------------------------------------------
// Line-level parsers
// ---------------------------------------------------------------------------

/**
 * @param {Map<string, string>} attrs
 * @returns {VariantAttributes}
 */
const buildVariantAttributes = (attrs) => ({
  bandwidth: attrs.has("BANDWIDTH")
    ? parseInt(/** @type {string} */ (attrs.get("BANDWIDTH")), 10)
    : null,
  averageBandwidth: attrs.has("AVERAGE-BANDWIDTH")
    ? parseInt(/** @type {string} */ (attrs.get("AVERAGE-BANDWIDTH")), 10)
    : null,
  codecs: attrs.get("CODECS") ?? null,
  resolution: attrs.get("RESOLUTION") ?? null,
  frameRate: attrs.has("FRAME-RATE")
    ? parseFloat(/** @type {string} */ (attrs.get("FRAME-RATE")))
    : null,
  hdcpLevel: attrs.get("HDCP-LEVEL") ?? null,
  allowedCpc: attrs.get("ALLOWED-CPC") ?? null,
  videoRange: attrs.get("VIDEO-RANGE") ?? null,
  stableVariantId: attrs.get("STABLE-VARIANT-ID") ?? null,
  audio: attrs.get("AUDIO") ?? null,
  video: attrs.get("VIDEO") ?? null,
  subtitles: attrs.get("SUBTITLES") ?? null,
  closedCaptions: attrs.get("CLOSED-CAPTIONS") ?? null,
  pathwayId: attrs.get("PATHWAY-ID") ?? null,
});

/**
 * @param {Map<string, string>} attrs
 * @returns {MediaAttributes}
 */
const buildMediaAttributes = (attrs) => ({
  type: attrs.get("TYPE") ?? null,
  groupId: attrs.get("GROUP-ID") ?? null,
  language: attrs.get("LANGUAGE") ?? null,
  assocLanguage: attrs.get("ASSOC-LANGUAGE") ?? null,
  name: attrs.get("NAME") ?? null,
  stableRenditionId: attrs.get("STABLE-RENDITION-ID") ?? null,
  default: attrs.get("DEFAULT") === "YES",
  autoselect: attrs.get("AUTOSELECT") === "YES",
  forced: attrs.get("FORCED") === "YES",
  instreamId: attrs.get("INSTREAM-ID") ?? null,
  characteristics: attrs.get("CHARACTERISTICS") ?? null,
  channels: attrs.get("CHANNELS") ?? null,
  uri: attrs.get("URI") ?? null,
});

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

/**
 * Fetch a playlist text, throwing on network / HTTP errors.
 * @param {string} url
 * @param {AbortSignal | null | undefined} signal
 * @returns {Promise<string>}
 */
const fetchPlaylist = async (url, signal) => {
  const response = await fetch(url, signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching playlist: ${url}`);
  }
  const text = await response.text();
  return text;
};

// ---------------------------------------------------------------------------
// Playlist detection
// ---------------------------------------------------------------------------

/**
 * Determine playlist kind from its raw text.
 * @param {string} text
 * @returns {PlaylistKind}
 */
const detectPlaylistKind = (text) => {
  if (!text.trimStart().startsWith("#EXTM3U")) {
    return "plain";
  }
  if (/#EXT-X-STREAM-INF/.test(text)) return "master";
  if (/#EXTINF/.test(text) || /#EXT-X-TARGETDURATION/.test(text))
    return "media";
  // Master with only I-Frame or session playlists (no STREAM-INF)
  if (/#EXT-X-I-FRAME-STREAM-INF/.test(text)) return "master";
  // Fallback: treat as plain
  return "plain";
};

// ---------------------------------------------------------------------------
// Media playlist parser (segments)
// ---------------------------------------------------------------------------

/**
 * Parse a Media Playlist text and return ISOBMFF segments.
 * Handles:
 *   - EXT-X-MAP (initialization section)
 *   - EXT-X-BYTERANGE on both map and segments
 *   - EXT-X-DISCONTINUITY
 *   - EXTINF duration & title
 * @param {string} text  Raw playlist text
 * @param {string} baseUrl  Absolute URL of the playlist (for relative resolution)
 * @param {string | null} [variantCodecs]  CODECS from the master STREAM-INF (if available)
 * @returns {ISOBMFFSegment[]}
 */
const parseMediaPlaylist = (text, baseUrl, variantCodecs) => {
  const lines = text.split(/\r?\n/);

  /** @type {ISOBMFFSegment[]} */
  const segments = [];

  /** @type {{ url: string, byteRange: ByteRange | null } | null} */
  let currentMap = null;
  /** @type {ByteRange | null} */
  let pendingByteRange = null;
  /** @type {number} */
  let byteRangeEnd = 0; // tracks implicit offset for chained byte ranges
  /** @type {number | null} */
  let pendingDuration = null;
  /** @type {string | null} */
  let pendingTitle = null;
  /** @type {boolean} */
  let pendingDiscontinuity = false;

  // For map byte-range chaining (separate offset tracker)
  /** @type {number} */
  let mapByteRangeEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === "#EXTM3U") continue;

    // EXT-X-MAP
    if (line.startsWith("#EXT-X-MAP:")) {
      const attrs = parseAttributeList(line.slice("#EXT-X-MAP:".length));
      const mapUri = attrs.get("URI");
      if (!mapUri) continue;
      const mapUrl = resolveUrl(baseUrl, mapUri);
      /** @type {ByteRange | null} */
      let mapRange = null;
      if (attrs.has("BYTERANGE")) {
        mapRange = parseByteRange(
          /** @type {string} */ (attrs.get("BYTERANGE")),
          mapByteRangeEnd,
        );
        mapByteRangeEnd = mapRange.offset + mapRange.length;
      }
      currentMap = { url: mapUrl, byteRange: mapRange };
      continue;
    }

    // EXT-X-BYTERANGE
    if (line.startsWith("#EXT-X-BYTERANGE:")) {
      pendingByteRange = parseByteRange(
        line.slice("#EXT-X-BYTERANGE:".length),
        byteRangeEnd,
      );
      continue;
    }

    // EXT-X-DISCONTINUITY
    if (line === "#EXT-X-DISCONTINUITY") {
      pendingDiscontinuity = true;
      continue;
    }

    // EXTINF
    if (line.startsWith("#EXTINF:")) {
      const rest = line.slice("#EXTINF:".length);
      const commaIdx = rest.indexOf(",");
      if (commaIdx === -1) {
        pendingDuration = parseFloat(rest);
        pendingTitle = null;
      } else {
        pendingDuration = parseFloat(rest.slice(0, commaIdx));
        pendingTitle = rest.slice(commaIdx + 1).trim() || null;
      }
      continue;
    }

    // Skip other tags
    if (line.startsWith("#")) continue;

    // Segment URI line
    const segUrl = resolveUrl(baseUrl, line);

    // Determine byte range (EXTINF-paired inline byterange appears in some encoders as
    // the next #EXT-X-BYTERANGE before the URI – already captured in pendingByteRange).
    /** @type {ByteRange | null} */
    const byteRange = pendingByteRange;
    if (byteRange) {
      byteRangeEnd = byteRange.offset + byteRange.length;
    }

    // ISOBMFF check – use variant codecs hint if available
    const codecs = variantCodecs ?? null;
    if (isLikelyISOBMFF(segUrl, codecs)) {
      /** @type {ISOBMFFSegment} */
      const seg = {
        url: segUrl,
        byteRange,
        duration: pendingDuration,
        title: pendingTitle,
        discontinuity: pendingDiscontinuity,
        map: currentMap,
      };
      segments.push(seg);
    }

    // Reset per-segment state
    pendingByteRange = null;
    pendingDuration = null;
    pendingTitle = null;
    pendingDiscontinuity = false;
  }

  return segments;
};

// ---------------------------------------------------------------------------
// Plain M3U parser (fallback)
// ---------------------------------------------------------------------------

/**
 * Parse a plain M3U playlist (no HLS tags) and return ISOBMFF URLs.
 * @param {string} text
 * @param {string} baseUrl
 * @returns {ISOBMFFSegment[]}
 */
const parsePlainPlaylist = (text, baseUrl) => {
  /** @type {ISOBMFFSegment[]} */
  const segments = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const url = resolveUrl(baseUrl, line);
    if (isLikelyISOBMFF(url, null)) {
      segments.push({
        url,
        byteRange: null,
        duration: null,
        title: null,
        discontinuity: false,
        map: null,
      });
    }
  }
  return segments;
};

// ---------------------------------------------------------------------------
// Master playlist parser
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   variantUrl: string,
 *   attributes: VariantAttributes
 * }} VariantEntry
 */

/**
 * @typedef {{
 *   attributes: MediaAttributes
 * }} MediaEntry
 */

/**
 * Parse a Master Playlist and collect Variant Streams and Media Renditions.
 * @param {string} text
 * @param {string} baseUrl
 * @returns {{ variants: VariantEntry[], media: MediaEntry[] }}
 */
const parseMasterPlaylist = (text, baseUrl) => {
  const lines = text.split(/\r?\n/);

  /** @type {VariantEntry[]} */
  const variants = [];
  /** @type {MediaEntry[]} */
  const media = [];

  /** @type {VariantAttributes | null} */
  let pendingVariantAttrs = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const attrs = parseAttributeList(line.slice("#EXT-X-STREAM-INF:".length));
      pendingVariantAttrs = buildVariantAttributes(attrs);
      continue;
    }

    if (line.startsWith("#EXT-X-MEDIA:")) {
      const attrs = parseAttributeList(line.slice("#EXT-X-MEDIA:".length));
      media.push({ attributes: buildMediaAttributes(attrs) });
      continue;
    }

    // Skip I-Frame playlists (they reference the same segments via byte ranges,
    // already covered by the media playlist parser)
    if (line.startsWith("#EXT-X-I-FRAME-STREAM-INF:")) {
      continue;
    }

    if (line.startsWith("#")) continue;

    // URI line following EXT-X-STREAM-INF
    if (pendingVariantAttrs !== null) {
      variants.push({
        variantUrl: resolveUrl(baseUrl, line),
        attributes: pendingVariantAttrs,
      });
      pendingVariantAttrs = null;
      continue;
    }
  }

  return { variants, media };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an M3U / M3U8 playlist (fetched from `playlistUrl`) and return all
 * ISOBMFF segment URLs grouped by Variant / Media rendition.
 *
 * The function:
 *  1. Fetches the root playlist.
 *  2. Detects its kind (plain / master / media).
 *  3. For a **master** playlist:
 *     - Fetches every Variant Stream playlist in parallel.
 *     - Fetches every Alternative Rendition playlist that has a URI, in parallel.
 *     - Returns one {@link VariantResult} per variant and one {@link MediaResult}
 *       per media rendition.
 *  4. For a **media** playlist: returns a single {@link SimpleResult}.
 *  5. For a **plain** M3U:  returns a single {@link SimpleResult}.
 *
 * @param {string} playlistUrl  Absolute URL of the root playlist.
 * @param {AbortSignal} [signal]  Optional AbortSignal to cancel in-flight fetches.
 * @returns {Promise<ExtractionResult>}
 * @throws {Error} If the fetch fails, the playlist is malformed in a way that
 *                 prevents parsing, or the signal is aborted.
 */
export const extractISOBMFFSegments = async (playlistUrl, signal) => {
  // ── 1. Fetch root playlist ────────────────────────────────────────────────
  const rootText = await fetchPlaylist(playlistUrl, signal);
  const kind = detectPlaylistKind(rootText);

  // ── 2. Plain M3U ─────────────────────────────────────────────────────────
  if (kind === "plain") {
    const segments = parsePlainPlaylist(rootText, playlistUrl);
    /** @type {SimpleResult} */
    const result = { kind: "plain", playlistUrl, segments };
    return { playlistKind: "plain", results: [result] };
  }

  // ── 3. Bare Media Playlist ────────────────────────────────────────────────
  if (kind === "media") {
    const segments = parseMediaPlaylist(rootText, playlistUrl, null);
    /** @type {SimpleResult} */
    const result = { kind: "media", playlistUrl, segments };
    return { playlistKind: "media", results: [result] };
  }

  // ── 4. Master Playlist ────────────────────────────────────────────────────
  const { variants, media } = parseMasterPlaylist(rootText, playlistUrl);

  if (variants.length === 0 && media.length === 0) {
    throw new Error("Master playlist contains no renditions.");
  }

  // Fetch all child playlists in parallel
  const variantPromises = variants.map(async (v) => {
    const text = await fetchPlaylist(v.variantUrl, signal);
    const segments = parseMediaPlaylist(
      text,
      v.variantUrl,
      v.attributes.codecs,
    );
    /** @type {VariantResult} */
    const res = {
      kind: "variant",
      playlistUrl: v.variantUrl,
      attributes: v.attributes,
      segments,
    };
    return res;
  });

  const mediaPromises = media
    .filter((m) => m.attributes.uri != null)
    .map(async (m) => {
      const mediaUrl = resolveUrl(
        playlistUrl,
        /** @type {string} */ (m.attributes.uri),
      );
      const text = await fetchPlaylist(mediaUrl, signal);
      const segments = parseMediaPlaylist(text, mediaUrl, null);
      /** @type {MediaResult} */
      const res = {
        kind: "media",
        playlistUrl: mediaUrl,
        attributes: m.attributes,
        segments,
      };
      return res;
    });

  /** @type {(VariantResult | MediaResult)[]} */
  const allResults = await Promise.all([...variantPromises, ...mediaPromises]);

  return { playlistKind: "master", results: allResults };
};

/**
 * Convenience helper: flatten an {@link ExtractionResult} into a deduplicated
 * array of ISOBMFF segment URLs (ignoring grouping).
 *
 * @param {ExtractionResult} result
 * @returns {string[]}
 */
export const flattenSegmentUrls = (result) => {
  const seen = new Set();
  /** @type {string[]} */
  const urls = [];
  for (const r of result.results) {
    for (const seg of r.segments) {
      if (!seen.has(seg.url)) {
        seen.add(seg.url);
        urls.push(seg.url);
      }
    }
  }
  return urls;
};
