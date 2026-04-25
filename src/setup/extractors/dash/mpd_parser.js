import {
  attr,
  getAllChildrenElementWithTag,
  getFirstChildrenElementWithTag,
  inherit,
  isISOBMFF,
  numAttr,
  pad,
  parseByteRange,
  parseISO8601Duration,
} from "./utils.js";

/**
 * Parse a DASH MPD XML string into a DashTree.
 * SegmentBase representations will have `sidxPending` set.
 * to complete them asynchronously.
 *
 * @param {string}  mpdText
 * @param {string}  [mpdURL=""]
 * @param {AbortSignal} [signal]
 * @returns {import("./types").DashTree}
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

  const mpdDurationAttr = attr(mpdEl, "mediaPresentationDuration");
  const mpdDuration = parseISO8601Duration(mpdDurationAttr);
  const periodElts = getAllChildrenElementWithTag(mpdEl, "Period");

  /** @type {import("./types").PeriodTree[]} */
  const periods = [];
  const timeBoundaries = calculatePeriodTimeBoundaries(periodElts, mpdDuration);

  for (const periodEl of periodElts) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (periodEl.tagName !== "Period") {
      continue;
    }

    const periodBaseURLs = stackBaseURLs(mpdBaseURLs, ownBaseURLs(periodEl));
    const periodId = attr(periodEl, "id") ?? `period-${periods.length}`;
    const { start: periodStart, end: periodEnd } =
      timeBoundaries.get(periodEl) ?? {};

    // Period-level SegmentTemplate (inherited by AdaptationSets / Representations)
    const periodSegTpl = getFirstChildrenElementWithTag(
      periodEl,
      "SegmentTemplate",
    );

    /** @type {import("./types").AdaptationSetTree[]} */
    const adaptationSets = [];
    for (const asEl of getAllChildrenElementWithTag(
      periodEl,
      "AdaptationSet",
    )) {
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
      const asSegListEl = getFirstChildrenElementWithTag(asEl, "SegmentList");
      const asSegBaseEl = getFirstChildrenElementWithTag(asEl, "SegmentBase");

      /** @type {import("./types").RepresentationTree[]} */
      const representations = [];
      for (const repEl of getAllChildrenElementWithTag(
        asEl,
        "Representation",
      )) {
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

        const effectiveSegTplEl =
          repSegTplEl ?? asSegTpl ?? periodSegTpl ?? null;

        /** @type {import("./types").SegmentItem[]} */
        const segments = [];
        /** @type {import("./types").SidxPending|undefined} */
        let sidxPending;

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

          if (mediaTemplate) {
            if (timelineEl) {
              const periodDuration =
                periodStart !== undefined && periodEnd !== undefined
                  ? periodEnd - periodStart
                  : undefined;
              // SegmentTimeline (generally $Time$)
              const timeline = parseSegmentTimeline(timelineEl, periodDuration);
              for (let i = 0; i < timeline.length; i++) {
                const url = resolveURL(
                  baseURL,
                  expandTemplate(mediaTemplate, {
                    ...repVars,
                    number: startNumber + i,
                    time: timeline[i].t,
                  }),
                );
                if (isISOBMFF(url, repMimeType)) {
                  segments.push({ url, type: "media", isISOBMFF: true });
                }
              }
            } else if (segDur != null) {
              // No SegmentTimeline dang it! Calculate from duration
              const segmentDurationSec = segDur / timescale;

              // Anchor segment timeline to Period start
              let segmentTime = 0;
              let number = startNumber;

              if (periodEnd !== undefined && periodStart !== undefined) {
                while (true) {
                  const segmentStart = periodStart + segmentTime;

                  // Stop if segment starts at or after Period end
                  if (segmentStart >= periodEnd) {
                    break;
                  }

                  const url = resolveURL(
                    baseURL,
                    expandTemplate(mediaTemplate, {
                      ...repVars,
                      number,
                      time: segmentTime,
                    }),
                  );

                  if (isISOBMFF(url, repMimeType)) {
                    segments.push({ url, type: "media", isISOBMFF: true });
                  }

                  segmentTime += segmentDurationSec;
                  number++;
                }
              } else {
                // Period duration unknown — emit first segment only as a hint
                const url = resolveURL(
                  baseURL,
                  expandTemplate(mediaTemplate, {
                    ...repVars,
                    number: startNumber,
                    time: 0,
                  }),
                );
                if (isISOBMFF(url, repMimeType)) {
                  segments.push({ url, type: "media", isISOBMFF: true });
                }
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

          // SegmentList
        } else if (repSegListEl || asSegListEl) {
          const listEl = repSegListEl ?? asSegListEl;

          // Init
          const initEl = listEl
            ? getFirstChildrenElementWithTag(listEl, "Initialization")
            : null;
          if (initEl) {
            const src = attr(initEl, "sourceURL") ?? attr(initEl, "range");
            const url = src ? resolveURL(baseURL, src) : baseURL;
            if (url && isISOBMFF(url, repMimeType)) {
              segments.push({ url, type: "init", isISOBMFF: true });
            }
          }

          // Media segments
          const segmentUrlEls = listEl
            ? listEl.getElementsByTagName("SegmentURL")
            : [];
          for (const segURLEl of Array.from(segmentUrlEls)) {
            const media = attr(segURLEl, "media");
            const url = media ? resolveURL(baseURL, media) : baseURL;
            if (url && isISOBMFF(url, repMimeType)) {
              segments.push({ url, type: "media", isISOBMFF: true });
            }
          }

          // SegmentBase (SIDX-indexed single resource)
        } else {
          const sbEl = repSegBaseEl ?? asSegBaseEl;

          if (sbEl) {
            // Initialization
            /** @type {import("./types").SegmentItem|undefined} */
            let initSegment;
            const initEl = getFirstChildrenElementWithTag(
              sbEl,
              "Initialization",
            );
            if (initEl) {
              const src = attr(initEl, "sourceURL");
              const initURL = src ? resolveURL(baseURL, src) : baseURL;
              const initRangeAttr = attr(initEl, "range");
              const initRange =
                initRangeAttr === undefined
                  ? undefined
                  : parseByteRange(initRangeAttr);
              if (initURL && isISOBMFF(initURL, repMimeType)) {
                initSegment = {
                  url: initURL,
                  ...(initRange ? { byteRange: initRange } : {}),
                  type: /** @type {"init"} */ ("init"),
                  isISOBMFF: true,
                };
                segments.push(initSegment);
              }
            }

            // ---- SIDX location ----
            // The index resource is either a separate RepresentationIndex or
            // the media resource itself.  The byte range for the sidx box(es)
            // comes from SegmentBase@indexRange or RepresentationIndex@range.
            const riEl = getFirstChildrenElementWithTag(
              sbEl,
              "RepresentationIndex",
            );

            const indexResourceURL = riEl
              ? resolveURL(baseURL, attr(riEl, "sourceURL") ?? "")
              : baseURL;

            const indexRange =
              attr(sbEl, "indexRange") ??
              (riEl ? attr(riEl, "range") : undefined);

            const timescale = numAttr(sbEl, "timescale");

            if (indexResourceURL && isISOBMFF(indexResourceURL, repMimeType)) {
              // Defer segment enumeration
              sidxPending = {
                mediaURL: indexResourceURL,
                initSegment,
                indexRange,
                timescale,
              };
            } else if (baseURL) {
              // No usable index — whole resource as one media segment
              segments.push({ url: baseURL, type: "media", isISOBMFF: true });
            }
          } else if (baseURL) {
            // Bare BaseURL — whole file is the stream
            segments.push({ url: baseURL, type: "media", isISOBMFF: true });
          }
        }

        /** @type {import("./types").RepresentationTree} */
        const rep = {
          id: repId,
          bandwidth: repBandwidth,
          mimeType: repMimeType,
          codecs: repCodecs,
          segments,
        };
        if (sidxPending) {
          rep.sidxPending = sidxPending;
        }
        representations.push(rep);
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
      start: periodStart,
      end: periodEnd,
      adaptationSets,
    });
  }

  return { periods };
}

/**
 * @typedef {{ t: number, d: number }} SegmentInfo
 * @param {Element} timelineEl - `<SegmentTimeline>` elements in the MPD.
 * @param {number|undefined} periodDuration - Difference between the
 * corresponding Period's start and end in seconds.
 * @returns {Array<SegmentInfo>}
 */
function parseSegmentTimeline(timelineEl, periodDuration) {
  const segments = [];
  let currentTime = 0;
  for (const s of getAllChildrenElementWithTag(timelineEl, "S")) {
    const t = numAttr(s, "t");
    const d = numAttr(s, "d") ?? 0;
    const r = numAttr(s, "r") ?? 0;
    if (t !== undefined) {
      currentTime = t;
    }

    let repeatCount;
    if (r === -1) {
      if (periodDuration !== undefined && d > 0) {
        // How many segments of duration `d` fit in the remaining period time?
        const remainingTime = periodDuration - currentTime;
        repeatCount = Math.ceil(remainingTime / d) - 1;
      } else {
        // Can't compute fill-to-end without periodDuration or a valid d; emit one segment.
        repeatCount = 0;
      }
    } else {
      repeatCount = r;
    }

    for (let i = 0; i <= repeatCount; i++) {
      segments.push({ t: currentTime, d });
      currentTime += d;
    }
  }
  return segments;
}

/**
 * @typedef {{
 *   startNumber?: number;
 *   timescale?: number;
 *   duration?: number;
 *   presentationTimeOffset?: number;
 *   mediaTemplate?: string;
 *   initTemplate?: string;
 *   indexTemplate?: string;
 *   bitstreamSwitching?: string;
 * }} SegmentRelatedAttributes
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
 * We try here to construct a Map with period start+end time information.
 *
 * This is because the inventors of the DASH spec hate client-side
 * developers and thus made the `Period@start` and `Period@duration` attributes
 * potentially implicit, in which case you have to check neighboring Period
 * items. But neighboring items can also have implicit timings or not in
 * which case you should take the whole MPD limits.
 * You want more? Both, only one of them, or none can be indicated. If nonea are
 * indicated you need to both parse from the start and from the end to know what
 * the limits are.
 *
 * This a massive pain in the ass each time I do a MPD parser.
 *
 * @param {Element[]} periodElts
 * @param {number|undefined} mpdDuration
 * @returns {Map<Element, { start: number | undefined; end: number | undefined }>}
 */
function calculatePeriodTimeBoundaries(periodElts, mpdDuration) {
  /** @type {Map<Element, { start: number | undefined; end: number | undefined }>} */
  const timeMap = new Map();

  // Step 1: parse explicit values
  /**
   * @type Array<{
   *   elt: Element;
   *   start: number | undefined;
   *   explicitStart: number | undefined;
   *   explicitDuration: number | undefined;
   * }>
   */
  const periodList = periodElts.map((elt) => {
    const startAttr = attr(elt, "start");
    const durationAttr = attr(elt, "duration");

    let explicitStart;
    if (startAttr !== undefined) {
      const v = parseISO8601Duration(startAttr);
      if (v !== undefined) {
        explicitStart = v;
      } else {
        console.warn("Invalid Period@start:", startAttr);
      }
    }

    let explicitDuration;
    if (durationAttr !== undefined) {
      const v = parseISO8601Duration(durationAttr);
      if (v !== undefined) {
        explicitDuration = v;
      } else {
        console.warn("Invalid Period@duration:", durationAttr);
      }
    }

    // NOTE: `start` here is a placeholder for  when `start` will be resolved
    return { elt, start: undefined, explicitStart, explicitDuration };
  });

  // Step 2: resolve starts (left → right)
  let prevEnd;

  for (let i = 0; i < periodList.length; i++) {
    const p = periodList[i];

    let start;

    if (p.explicitStart !== undefined) {
      start = p.explicitStart;
    } else if (i === 0) {
      // First Period fallback
      start = 0;
    } else if (prevEnd !== undefined) {
      start = prevEnd;
    } else {
      console.warn("Cannot resolve Period start");
      start = undefined;
    }

    timeMap.set(p.elt, { start, end: undefined });
    p.start = start; // store for next step

    // Tentatively compute end if duration is known
    if (start !== undefined && p.explicitDuration !== undefined) {
      prevEnd = start + p.explicitDuration;
    } else {
      prevEnd = undefined;
    }
  }

  // Step 3: resolve ends (right → left)
  let nextStart;
  let nextEnd = mpdDuration;

  for (let i = periodList.length - 1; i >= 0; i--) {
    const p = periodList[i];
    const entry = timeMap.get(p.elt);

    if (!entry) {
      throw new Error("Invariant violation: missing period entry");
    }

    const { start } = entry;

    let end;

    if (start !== undefined && p.explicitDuration !== undefined) {
      end = start + p.explicitDuration;
    } else if (nextStart !== undefined) {
      end = nextStart;
    } else if (nextEnd !== undefined) {
      end = nextEnd;
    } else {
      end = undefined;
    }

    entry.end = end;

    nextStart = start;
    nextEnd = end;
  }

  return timeMap;
}

/**
 * Collect BaseURL strings from an element (not inherited)
 * @param {Element} el
 */
function ownBaseURLs(el) {
  return getAllChildrenElementWithTag(el, "BaseURL")
    .map((c) => c.textContent?.trim() ?? "")
    .filter(Boolean);
}

/**
 * Resolve a relative URL against a base
 * @param {string} base
 * @param {string} relative
 * @returns {string}
 */
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

/**
 * Stack BaseURL list: each new layer resolves against the previous chain.
 * @param {Array<string>} parentURLs
 * @param {Array<string>} childURLs
 * @returns {Array<string>}
 */
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
