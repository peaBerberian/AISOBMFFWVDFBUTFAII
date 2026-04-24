/**
 * dash-mpd-extractor.js
 * Extracts ISOBMFF segment URLs from a DASH MPD (XML string or URL).
 *
 * Supports:
 *  - SegmentTemplate with $Number$ / $Time$ / $Bandwidth$ / $RepresentationID$
 *  - SegmentList (explicit SegmentURL elements)
 *  - SegmentBase (single-resource; SIDX-based; returns the media resource URL)
 *  - BaseURL inheritance and stacking
 *  - Period / AdaptationSet / Representation attribute inheritance
 *  - Multiple Periods
 *
 * @returns {Promise<DashTree>} resolving to the object tree described below
 *
 * DashTree   = { periods: Period[] }
 * Period     = { id, start, duration, adaptationSets: AdaptationSet[] }
 * AdaptationSet = { id, mimeType, codecs, lang, adaptationSets: Representation[] }
 * Representation = { id, bandwidth, mimeType, codecs, segments: Segment[] }
 * Segment    = { url: string, isISOBMFF: boolean, type: "init"|"media"|"index" }
 *
 * Only segments where isISOBMFF === true are included in `segments`.
 */

const ISOBMFF_MIME_RE =
  /^(video|audio|application)\/(mp4|iso\.segment|mp4a-latm|mp4v-es|dash\+xml)/i;
const ISOBMFF_EXT_RE =
  /\.(mp4|m4s|m4v|m4a|cmf[vatim]|frag|ismv|isma|cmft)(\?.*)?$/i;

/**
 * @param {string} url
 * @param {string} mimeType
 * @returns {boolean}
 */
function isISOBMFF(url, mimeType) {
  if (mimeType && ISOBMFF_MIME_RE.test(mimeType)) {
    return true;
  }
  if (url && ISOBMFF_EXT_RE.test(url.split("?")[0])) {
    return true;
  }
  // MP4/fMP4 containers are the DASH default; if no contrary evidence assume true
  return true;
}

/**
 * @param {Element} el
 * @param {string} name
 * @param {string|undefined} [fallback]
 * @returns {string|undefined}
 */
function attr(el, name, fallback = undefined) {
  return el.hasAttribute(name) ? el.getAttribute(name) ?? fallback : fallback;
}

/**
 * @param {Element} el
 * @param {string} name
 * @param {number|undefined} [fallback]
 * @returns {number|undefined}
 */
function numAttr(el, name, fallback = undefined) {
  const v = attr(el, name);
  return v !== undefined ? Number(v) : fallback;
}

/** Collect BaseURL strings from an element (not inherited)
 * @param {Element} el
 */
function ownBaseURLs(el) {
  return [...Array.from(el.children)]
    .filter((c) => c.tagName === "BaseURL")
    .map((c) => c.textContent?.trim() ?? "")
    .filter(Boolean);
}

/** Resolve a relative URL against a base
 * @param {string} base
 * @param {string} relative
 * @returns {string}
 * */
function resolveURL(base, relative) {
  if (!relative) {
    return base || "";
  }
  if (/^https?:\/\//i.test(relative)) {
    return relative;
  }
  if (!base) {
    return relative;
  }
  try {
    return new URL(relative, base).href;
  } catch {
    // Fallback: simple string join
    return base.replace(/\/?$/, "/") + relative.replace(/^\//, "");
  }
}

/** Stack BaseURL list: each new layer resolves against the previous chain.
 * @param {Array<string>} parentURLs
 * @param {Array<string>} childURLs
 * @returns {Array<string>}
 * */
function stackBaseURLs(parentURLs, childURLs) {
  if (!childURLs.length) {
    return parentURLs.length ? parentURLs : [""];
  }
  if (!parentURLs.length) {
    return childURLs;
  }
  // Produce cartesian product resolved URLs (usually just one each)
  const out = [];
  for (const p of parentURLs) {
    for (const c of childURLs) {
      out.push(resolveURL(p, c));
    }
  }
  return out;
}

/**
 * @param {string} template
 * @param {{ id?: string; bandwidth?: number; number?: number; time?: number }} vars
 * @returns {string}
 */
function expandTemplate(template, vars) {
  return template
    .replace(/\$RepresentationID\$/g, vars.id ?? "")
    .replace(/\$Bandwidth(%0(\d+)d)?\$/g, (_, _fmt, w) =>
      pad(vars.bandwidth, w),
    )
    .replace(/\$Number(%0(\d+)d)?\$/g, (_, _fmt, w) => pad(vars.number, w))
    .replace(/\$Time(%0(\d+)d)?\$/g, (_, _fmt, w) => pad(vars.time, w))
    .replace(/\$\$/g, "$");
}

/**
 * @param {string|number|null|undefined} [value]
 * @param {number|null|undefined} [width]
 * @returns {string}
 */
function pad(value, width) {
  if (value == null) {
    return "";
  }
  const s = String(value);
  if (!width) {
    return s;
  }
  return s.padStart(Number(width), "0");
}

/**
 * @typedef SegmentInfo
 * @property {number} t
 * @property {number} d
 */

/**
 * @param {Element} timelineEl
 * @returns {Array<SegmentInfo>}
 */
function parseSegmentTimeline(timelineEl) {
  const segments = [];
  let currentTime = 0;
  for (const s of Array.from(timelineEl.children)) {
    if (s.tagName !== "S") {
      continue;
    }
    const t = numAttr(s, "t");
    const d = numAttr(s, "d") ?? 0;
    const r = numAttr(s, "r", 0);
    if (t !== undefined) {
      currentTime = t;
    }
    const repeatCount = r === undefined || r < 0 ? 0 : r; // r=-1 means "fill to end"; treat as 0 extra for now
    for (let i = 0; i <= repeatCount; i++) {
      segments.push({ t: currentTime, d });
      currentTime += d;
    }
  }
  return segments;
}

/**
 * Merge attributes with priority: child > parent.
 * Only copies keys that are null/undefined in child.
 *
 * @template {Record<string, any>} T
 * @template {Record<string, any>} U
 * @param {T | null | undefined} child - The child object whose non-null/undefined values take priority
 * @param {U | null | undefined} parent - The parent object providing default values
 * @returns {Partial<T & U>} A new object with merged properties
 */
function inherit(child, parent) {
  /** @type {Record<string, any>} */
  const out = parent ? { ...parent } : {};
  if (child) {
    for (const [k, v] of Object.entries(child)) {
      if (v !== null && v !== undefined) {
        out[k] = v;
      }
    }
  }
  return /** @type {Partial<T & U>} */ (out);
}

/**
 * @typedef SegmentRelatedAttributes
 * @property {number|undefined} startNumber
 * @property {number|undefined} timescale
 * @property {number|undefined} duration
 * @property {number|undefined} presentationTimeOffset
 * @property {string|undefined} mediaTemplate
 * @property {string|undefined} initTemplate
 * @property {string|undefined} indexTemplate
 * @property {string|undefined} bitstreamSwitching
 */

/**
 * Extract common segment-addressing attributes from an element.
 * @param {Element} el
 * @returns {SegmentRelatedAttributes}
 */
function extractSegmentAttrs(el) {
  return {
    startNumber: numAttr(el, "startNumber"),
    timescale: numAttr(el, "timescale"),
    duration: numAttr(el, "duration"), // segment duration in timescale units
    presentationTimeOffset: numAttr(el, "presentationTimeOffset"),
    mediaTemplate: attr(el, "media"),
    initTemplate: attr(el, "initialization"),
    indexTemplate: attr(el, "index"),
    bitstreamSwitching: attr(el, "bitstreamSwitching"),
  };
}

/**
 * Parse a DASH MPD XML string and extract ISOBMFF segment URLs.
 *
 * @param {string}  mpdText   Raw MPD XML string
 * @param {string}  [mpdURL=""]  URL the MPD was fetched from (for resolving relative URLs)
 * @param {AbortSignal} [signal]
 * @returns {DashTree}
 */
export function parseMPD(mpdText, mpdURL = "", signal) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mpdText, "application/xml");

  const parseError = doc.getElementsByTagName("parsererror");
  if (parseError.length) {
    throw new Error(
      `MPD XML parse error: ${parseError[0].textContent?.slice(0, 200)}`,
    );
  }

  const mpdEl = doc.documentElement;
  if (!mpdEl || !/^MPD$/i.test(mpdEl.localName)) {
    throw new Error("Document root is not an MPD element");
  }

  const mpdBaseURLs = stackBaseURLs(mpdURL ? [mpdURL] : [], ownBaseURLs(mpdEl));

  /** @type {PeriodTree[]} */
  const periods = [];
  for (const periodEl of Array.from(mpdEl.children)) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (periodEl.tagName !== "Period") {
      continue;
    }

    const periodBaseURLs = stackBaseURLs(mpdBaseURLs, ownBaseURLs(periodEl));
    const periodId = attr(periodEl, "id") ?? `period-${periods.length}`;
    const periodStart = attr(periodEl, "start");
    const periodDuration = attr(periodEl, "duration");

    // Period-level SegmentTemplate (inherited by AdaptationSets / Representations)
    const periodSegTpl = getFirstChildrenElementWithTag(
      periodEl,
      "SegmentTemplate",
    );

    /** @type {AdaptationSetTree[]} */
    const adaptationSets = [];
    for (const asEl of Array.from(periodEl.children)) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (asEl.tagName !== "AdaptationSet") {
        continue;
      }

      const asBaseURLs = stackBaseURLs(periodBaseURLs, ownBaseURLs(asEl));
      const asMimeType = attr(asEl, "mimeType") ?? "";
      const asCodecs = attr(asEl, "codecs") ?? "";
      const asLang = attr(asEl, "lang") ?? "";
      const asId = attr(asEl, "id") ?? `as-${adaptationSets.length}`;

      // AdaptationSet-level SegmentTemplate
      const asSegTpl = getFirstChildrenElementWithTag(asEl, "SegmentTemplate");

      /** @type {RepresentationTree[]} */
      const representations = [];
      for (const repEl of Array.from(asEl.children)) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        if (repEl.tagName !== "Representation") {
          continue;
        }

        const repId = attr(repEl, "id") ?? `rep-${representations.length}`;
        const repBandwidth = numAttr(repEl, "bandwidth") ?? 0;
        const repMimeType = attr(repEl, "mimeType") ?? asMimeType;
        const repCodecs = attr(repEl, "codecs") ?? asCodecs;
        const repBaseURLs = stackBaseURLs(asBaseURLs, ownBaseURLs(repEl));

        const baseURL = repBaseURLs[0] ?? "";

        // Find the effective SegmentTemplate / SegmentList / SegmentBase
        // Priority: Representation > AdaptationSet > Period
        const repSegTplEl = getFirstChildrenElementWithTag(
          repEl,
          "SegmentTemplate",
        );
        const repSegListEl = getFirstChildrenElementWithTag(
          repEl,
          "SegmentList",
        );
        const repSegBaseEl = getFirstChildrenElementWithTag(
          repEl,
          "SegmentBase",
        );
        const asSegListEl = getFirstChildrenElementWithTag(asEl, "SegmentList");
        const asSegBaseEl = getFirstChildrenElementWithTag(asEl, "SegmentBase");

        const effectiveSegTplEl =
          repSegTplEl ?? asSegTpl ?? periodSegTpl ?? null;

        /**
         * @type Array<SegmentItem>
         */
        const segments = [];
        /** @type {{ id?: string; bandwidth?: number }} */
        const repVars = { id: repId, bandwidth: repBandwidth };

        if (effectiveSegTplEl) {
          // Merge attributes: period → adaptationSet → representation
          const periodAttrs = periodSegTpl
            ? extractSegmentAttrs(periodSegTpl)
            : null;
          const asAttrs = asSegTpl ? extractSegmentAttrs(asSegTpl) : null;
          const repAttrs = repSegTplEl
            ? extractSegmentAttrs(repSegTplEl)
            : null;
          const tplAttrs = inherit(inherit(repAttrs, asAttrs), periodAttrs);

          // Fill defaults
          const timescale = tplAttrs.timescale ?? 1;
          const startNumber = tplAttrs.startNumber ?? 1;
          const segDur = tplAttrs.duration; // may be undefined if timeline is used

          // Find SegmentTimeline — prefer Representation-level, then AS, then Period
          const timelineEl =
            repSegTplEl?.getElementsByTagName("SegmentTimeline")?.[0] ??
            asSegTpl?.getElementsByTagName("SegmentTimeline")?.[0] ??
            periodSegTpl?.getElementsByTagName("SegmentTimeline")?.[0] ??
            null;

          const mediaTemplate = tplAttrs.mediaTemplate;
          const initTemplate = tplAttrs.initTemplate;
          const indexTemplate = tplAttrs.indexTemplate;

          // Init segment
          if (initTemplate) {
            const url = resolveURL(
              baseURL,
              expandTemplate(initTemplate, repVars),
            );
            if (isISOBMFF(url, repMimeType)) {
              segments.push({ url, type: "init", isISOBMFF: true });
            }
          }

          if (!mediaTemplate) {
            // Nothing to enumerate — skip
          } else if (timelineEl) {
            // Time-based with SegmentTimeline ($Time$)
            const timeline = parseSegmentTimeline(timelineEl);
            for (let i = 0; i < timeline.length; i++) {
              const { t } = timeline[i];
              const url = resolveURL(
                baseURL,
                expandTemplate(mediaTemplate, {
                  ...repVars,
                  number: startNumber + i,
                  time: t,
                }),
              );
              if (isISOBMFF(url, repMimeType)) {
                segments.push({ url, type: "media", isISOBMFF: true });
              }
            }
          } else if (segDur != null) {
            // Number-based with uniform segment duration
            // We enumerate as many as we can derive from the period duration
            const periodDurSec = parseDuration(periodDuration);
            if (periodDurSec != null && periodDurSec > 0) {
              const segDurSec = segDur / timescale;
              const count = Math.ceil(periodDurSec / segDurSec);
              for (let i = 0; i < count; i++) {
                const number = startNumber + i;
                const time = i * segDur;
                const url = resolveURL(
                  baseURL,
                  expandTemplate(mediaTemplate, { ...repVars, number, time }),
                );
                if (isISOBMFF(url, repMimeType)) {
                  segments.push({ url, type: "media", isISOBMFF: true });
                }
              }
            } else {
              // Period duration unknown — emit the template itself as a hint with startNumber
              const url = resolveURL(
                baseURL,
                expandTemplate(mediaTemplate, {
                  ...repVars,
                  number: startNumber,
                  time: 0,
                }),
              );
              if (isISOBMFF(url, repMimeType)) {
                segments.push({
                  url,
                  type: "media",
                  isISOBMFF: true,
                  // note: "first-only:duration-unknown",
                });
              }
            }
          }

          // Index segment (rare)
          if (indexTemplate) {
            const url = resolveURL(
              baseURL,
              expandTemplate(indexTemplate, repVars),
            );
            if (isISOBMFF(url, repMimeType)) {
              segments.push({ url, type: "index", isISOBMFF: true });
            }
          }
        } else if (repSegListEl || asSegListEl) {
          const listEl = repSegListEl ?? asSegListEl;

          // Init
          const initEl = listEl
            ? getFirstChildrenElementWithTag(listEl, "Initialization")
            : null;
          if (initEl) {
            const src =
              attr(initEl, "sourceURL") ?? attr(initEl, "range") ?? undefined;
            const url = src ? resolveURL(baseURL, src) : baseURL;
            if (url && isISOBMFF(url, repMimeType)) {
              segments.push({ url, type: "init", isISOBMFF: true });
            }
          }

          // Media segments
          const segmentUrlList = listEl
            ? listEl.getElementsByTagName("SegmentURL")
            : [];
          for (const segURLEl of Array.from(segmentUrlList)) {
            const media = attr(segURLEl, "media");
            const url = media ? resolveURL(baseURL, media) : baseURL;
            if (url && isISOBMFF(url, repMimeType)) {
              segments.push({ url, type: "media", isISOBMFF: true });
            }
          }
        } else {
          const sbEl = repSegBaseEl ?? asSegBaseEl;
          if (sbEl) {
            // Initialization
            const initEl = getFirstChildrenElementWithTag(
              sbEl,
              "Initialization",
            );
            if (initEl) {
              const src = attr(initEl, "sourceURL") ?? undefined;
              const url = src ? resolveURL(baseURL, src) : baseURL;
              if (url && isISOBMFF(url, repMimeType)) {
                segments.push({ url, type: "init", isISOBMFF: true });
              }
            }
            // RepresentationIndex (sidx pointer)
            const riEl = getFirstChildrenElementWithTag(
              sbEl,
              "RepresentationIndex",
            );
            if (riEl) {
              const src = attr(riEl, "sourceURL");
              if (src) {
                const url = resolveURL(baseURL, src);
                if (isISOBMFF(url, repMimeType)) {
                  segments.push({ url, type: "index", isISOBMFF: true });
                }
              }
            }
            // The media resource itself (sidx-indexed)
            if (baseURL && isISOBMFF(baseURL, repMimeType)) {
              segments.push({
                url: baseURL,
                type: "media",
                isISOBMFF: true,
                // note: "sidx-indexed",
              });
            }
          } else if (baseURL) {
            // Bare BaseURL — the whole file is the stream
            if (isISOBMFF(baseURL, repMimeType)) {
              segments.push({
                url: baseURL,
                type: "media",
                isISOBMFF: true,
                // note: "bare-baseurl",
              });
            }
          }
        }

        representations.push({
          id: repId,
          bandwidth: repBandwidth,
          mimeType: repMimeType,
          codecs: repCodecs,
          segments,
        });
      }

      adaptationSets.push({
        id: asId,
        mimeType: asMimeType,
        codecs: asCodecs,
        lang: asLang,
        representations,
      });
    }

    periods.push({
      id: periodId,
      start: periodStart ?? "",
      duration: periodDuration ?? "",
      adaptationSets,
    });
  }

  return { periods };
}

/**
 * @param {string | undefined} dur
 * @returns {number|undefined}
 */
function parseDuration(dur) {
  if (!dur) {
    return undefined;
  }
  const m = dur.match(
    /^-?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!m) {
    return undefined;
  }
  const [, y = 0, mo = 0, d = 0, h = 0, min = 0, s = 0] = m.map(Number);
  return y * 31536000 + mo * 2592000 + d * 86400 + h * 3600 + min * 60 + s;
}

/**
 * Fetch a DASH MPD from a URL, parse it, and return the segment URL tree.
 *
 * @param {string} mpdURL
 * @param {AbortSignal} [signal]
 * @returns {Promise<DashTree>}
 */
export async function extractSegmentsFromURL(mpdURL, signal) {
  const res = await fetch(mpdURL, { signal });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch MPD: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const text = await res.text();
  return parseMPD(text, mpdURL, signal);
}

/**
 * Parse a DASH MPD from an XML string.
 *
 * @param {string} mpdText
 * @param {string} [baseURL]   Used to resolve relative URLs within the MPD
 * @param {AbortSignal} [signal]
 * @returns {Promise<DashTree>}  (wraps parseMPD in a promise for API consistency)
 */
export async function extractSegmentsFromString(
  mpdText,
  baseURL = "",
  signal,
) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  return parseMPD(mpdText, baseURL, signal);
}

/**
 * Flatten the segment tree into a simple array of ISOBMFF URLs.
 *
 * @param {DashTree} tree
 * @returns {string[]}
 */
export function flattenISOBMFFUrls(tree) {
  const urls = [];
  for (const period of tree.periods) {
    for (const as of period.adaptationSets) {
      for (const rep of as.representations) {
        for (const seg of rep.segments) {
          if (seg.isISOBMFF) {
            urls.push(seg.url);
          }
        }
      }
    }
  }
  return urls;
}

/**
 * @param {Element} el
 * @param {string} tag
 * @returns {Element|null}
 */
function getFirstChildrenElementWithTag(el, tag) {
  for (const child of Array.from(el.children)) {
    if (child.tagName === tag) {
      return child;
    }
  }
  return null;
}

/**
 * @typedef {Object} SegmentItem
 * @property {string} url
 * @property {"init"|"media"|"index"} type
 * @property {true} isISOBMFF
 */

/**
 * @typedef {Object} RepresentationTree
 * @property {string} id
 * @property {number} bandwidth
 * @property {string} mimeType
 * @property {SegmentItem[]} segments
 * @property {string} codecs
 */

/**
 * @typedef {Object} AdaptationSetTree
 * @property {string} id
 * @property {string} mimeType
 * @property {string} lang
 * @property {RepresentationTree[]} representations
 * @property {string} codecs
 */

/**
 * @typedef {Object} PeriodTree
 * @property {string} id
 * @property {string} start
 * @property {string} duration
 * @property {AdaptationSetTree[]} adaptationSets
 */

/**
 * @typedef {Object} DashTree
 * @property {PeriodTree[]} periods
 */
