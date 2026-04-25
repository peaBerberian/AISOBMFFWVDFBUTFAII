// We need to detect what is an ISOBMFF segment from what isn't.
// Do it with very simple regexps for now.
/** Check if an announced `mime-type` refers to an ISOBMFF */
const ISOBMFF_MIME_RE =
  /^(video|audio|application)\/(mp4|iso\.segment|mp4a-latm|mp4v-es)/i;

/** Check if a filename seems to have an ISOBMFF extension */
const ISOBMFF_EXT_RE =
  /\.(mp4|m4s|m4v|m4a|cmf[vatim]|frag|ismv|isma|cmft)(\?.*)?$/i;

/**
 * @param {Element} el
 * @param {string} tag
 * @returns {Element|null}
 */
export function getFirstChildrenElementWithTag(el, tag) {
  for (const child of Array.from(el.children)) {
    if (child.tagName === tag) {
      return child;
    }
  }
  return null;
}

/**
 * @param {Element} el
 * @param {string} tag
 * @returns {Array<Element>}
 */
export function getAllChildrenElementWithTag(el, tag) {
  const ret = [];
  for (const child of Array.from(el.children)) {
    if (child.tagName === tag) {
      ret.push(child);
    }
  }
  return ret;
}

/**
 * @param {string|undefined} dur
 * @returns {number|undefined}
 */
/**
 * @param {string|undefined} dur
 * @returns {number|undefined}
 */
export function parseISO8601Duration(dur) {
  if (!dur) {
    return undefined;
  }

  const m = dur.match(
    /^(-)?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!m) {
    return undefined;
  }

  const [, sign, y, mo, d, h, min, s] = m;

  /**
   * @param {string|undefined} v
   * @returns {number}
   */
  const toNum = (v) => (v === undefined ? 0 : Number(v));

  const total =
    toNum(y) * 31536000 +
    toNum(mo) * 2592000 +
    toNum(d) * 86400 +
    toNum(h) * 3600 +
    toNum(min) * 60 +
    toNum(s);

  return sign ? -total : total;
}

/**
 * @param {string|number|null|undefined} [value]
 * @param {number|null|undefined} [width]
 * @returns {string}
 */
export function pad(value, width) {
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
 * @param {Element} el
 * @param {string} name
 * @param {string|undefined} [fallback]
 * @returns {string|undefined}
 */
export function attr(el, name, fallback = undefined) {
  return el.hasAttribute(name) ? (el.getAttribute(name) ?? fallback) : fallback;
}

/**
 * @param {Element} el
 * @param {string} name
 * @returns {number|undefined}
 */
export function numAttr(el, name) {
  const v = attr(el, name);
  return v !== undefined ? Number(v) : undefined;
}

/**
 * @param {string} url
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isISOBMFF(url, mimeType) {
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
 * Merge attributes with priority: child > parent.
 * Only copies keys that are null/undefined in child.
 *
 * @template {Record<string, any>} T
 * @template {Record<string, any>} U
 * @param {T | null | undefined} child - The child object whose non-null/undefined values take priority
 * @param {U | null | undefined} parent - The parent object providing default values
 * @returns {Partial<T & U>} A new object with merged properties
 */
export function inherit(child, parent) {
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
 * Parse a byte-range string "first-last" into [first, last] (both inclusive).
 * @param {string} range
 * @returns {[number, number] | undefined}
 */
export function parseByteRange(range) {
  const m = range.match(/^(\d+)-(\d+)$/);
  if (!m) {
    return undefined;
  }
  return [Number(m[1]), Number(m[2])];
}
