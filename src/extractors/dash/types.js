/**
 * @typedef {Object} SegmentItem
 * @property {string} url
 * @property {string} [byteRange]   "first-last" inclusive; present for SIDX-derived and range-init segments
 * @property {"init"|"media"|"index"} type
 * @property {true} isISOBMFF
 */

/**
 * @typedef {Object} SidxPending
 * @property {string}      mediaURL      URL of the resource containing the sidx box
 * @property {SegmentItem} [initSegment] Already-resolved init segment (re-emitted verbatim)
 * @property {string}      [indexRange]  MPD-supplied byte range string for the sidx box(es)
 * @property {number}      [timescale]   SegmentBase@timescale hint (informational)
 */

/**
 * @typedef {Object} RepresentationTree
 * @property {string}       id
 * @property {number}       bandwidth
 * @property {string}       mimeType
 * @property {string}       codecs
 * @property {SegmentItem[]} segments
 * @property {SidxPending}  [sidxPending]
 */

/**
 * @typedef {Object} AdaptationSetTree
 * @property {string}               id
 * @property {string}               mimeType
 * @property {string}               codecs
 * @property {string}               lang
 * @property {RepresentationTree[]} representations
 */

/**
 * @typedef {Object} PeriodTree
 * @property {string}               id
 * @property {number|undefined}     start
 * @property {number|undefined}     end
 * @property {AdaptationSetTree[]}  adaptationSets
 */

/**
 * @typedef {Object} DashTree
 * @property {PeriodTree[]} periods
 */

// To enforce module detection
export {};
