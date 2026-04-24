/**
 * Walk a DashTree and resolve all `sidxPending` entries in parallel,
 * replacing each with fully-populated `segments`.
 * Safe to call on a tree that has no pending SIDX entries (no-op).
 *
 * @param {import("./types").DashTree} tree
 * @param {AbortSignal} [signal]
 * @returns {Promise<import("./types").DashTree>}
 */
export async function resolveSIDX(tree, signal) {
  /** @type {Promise<void>[]} */
  const tasks = [];

  for (const period of tree.periods) {
    for (const as of period.adaptationSets) {
      for (const rep of as.representations) {
        if (!rep.sidxPending) {
          continue;
        }
        const pending = rep.sidxPending;
        tasks.push(
          resolveSidxPending(pending, signal).then((segs) => {
            rep.segments = segs;
            delete rep.sidxPending;
          }),
        );
      }
    }
  }
  await Promise.all(tasks);
  return tree;
}

/**
 * Parse a byte-range string "first-last" into [first, last] (both inclusive).
 * @param {string} range
 * @returns {[number, number] | undefined}
 */
function parseByteRange(range) {
  const m = range.match(/^(\d+)-(\d+)$/);
  if (!m) {
    return undefined;
  }
  return [Number(m[1]), Number(m[2])];
}

/**
 * Format an inclusive byte range as an HTTP Range / MPD byteRange string.
 * @param {number} first
 * @param {number} last
 * @returns {string}
 */
function formatRange(first, last) {
  return `${first}-${last}`;
}

/**
 * Read a big-endian unsigned 32-bit integer.
 * @param {DataView} view
 * @param {number} offset
 * @returns {number}
 */
function readU32(view, offset) {
  return view.getUint32(offset, false);
}

/**
 * Read a big-endian unsigned 64-bit integer as a JS number.
 * Precision is sufficient for files up to ~8 PiB; adequate for all real media.
 * @param {DataView} view
 * @param {number} offset
 * @returns {number}
 */
function readU64(view, offset) {
  const hi = view.getUint32(offset, false);
  const lo = view.getUint32(offset + 4, false);
  return hi * 0x1_0000_0000 + lo;
}

/**
 * @typedef {{
 *   referenceType: number,
 *   size: number,
 *   duration: number,
 *   startsWithSAP: boolean,
 * }} SidxReference
 *
 * @typedef {{
 *   timescale: number,
 *   earliestPresentationTime: number,
 *   firstOffset: number,
 *   references: SidxReference[],
 *   boxStart: number,
 *   boxEnd: number,
 * }} SidxBox
 */

/**
 * Parse one `sidx` box from a DataView at the given offset.
 *
 * sidx layout:
 *   4  box_size
 *   4  box_type  ('sidx' = 0x73696478)
 *   1  version  (0 or 1)
 *   3  flags
 *   4  reference_ID
 *   4  timescale
 *   v0: 4 earliest_presentation_time + 4 first_offset
 *   v1: 8 earliest_presentation_time + 8 first_offset
 *   2  reserved
 *   2  reference_count
 *   per reference (12 bytes):
 *     1b reference_type + 31b referenced_size
 *     32b subsegment_duration
 *     1b starts_with_SAP + 3b SAP_type + 28b SAP_delta_time
 *
 * @param {DataView} view
 * @param {number} offset  byte offset within view where this box starts
 * @returns {SidxBox}
 */
function parseSidxBox(view, offset) {
  const boxSize = readU32(view, offset);
  const boxType = readU32(view, offset + 4);

  if (boxType !== 0x73696478 /* 'sidx' */) {
    throw new Error(
      `Expected sidx box, got 0x${boxType.toString(16).padStart(8, "0")} at offset ${offset}`,
    );
  }

  const version = view.getUint8(offset + 8);
  const timescale = readU32(view, offset + 16); // bytes 8=ver, 9-11=flags, 12-15=ref_ID, 16-19=timescale

  let earliestPresentationTime, firstOffset, pos;
  if (version === 0) {
    earliestPresentationTime = readU32(view, offset + 20);
    firstOffset = readU32(view, offset + 24);
    pos = offset + 28;
  } else {
    earliestPresentationTime = readU64(view, offset + 20);
    firstOffset = readU64(view, offset + 28);
    pos = offset + 36;
  }

  // 2 bytes reserved, 2 bytes reference_count
  const referenceCount = view.getUint16(pos + 2, false);
  pos += 4;

  /** @type {SidxReference[]} */
  const references = [];
  for (let i = 0; i < referenceCount; i++) {
    const word0 = readU32(view, pos);
    const word1 = readU32(view, pos + 4);
    const word2 = readU32(view, pos + 8);
    references.push({
      referenceType: (word0 >>> 31) & 0x1,
      size: word0 & 0x7fff_ffff,
      duration: word1,
      startsWithSAP: ((word2 >>> 31) & 0x1) === 1,
    });
    pos += 12;
  }

  return {
    timescale,
    earliestPresentationTime,
    firstOffset,
    references,
    boxStart: offset,
    boxEnd: offset + boxSize,
  };
}

/**
 * Scan an ArrayBuffer for all top-level `sidx` boxes, starting at `startOffset`.
 * Walks the box list sequentially; stops on a zero-size box or truncated data.
 *
 * @param {ArrayBuffer} buffer
 * @param {number} [startOffset=0]
 * @returns {SidxBox[]}
 */
function parseSidxBoxes(buffer, startOffset = 0) {
  const view = new DataView(buffer);
  /** @type {SidxBox[]} */
  const result = [];
  let offset = startOffset;

  while (offset + 8 <= buffer.byteLength) {
    const boxSize = readU32(view, offset);
    const boxType = readU32(view, offset + 4);
    if (boxSize === 0) {
      break; // extends to EOF — skip
    }
    if (offset + boxSize > buffer.byteLength) {
      break; // truncated
    }

    if (boxType === 0x73696478 /* 'sidx' */) {
      result.push(parseSidxBox(view, offset));
    }
    offset += boxSize;
  }

  return result;
}

/**
 * Convert parsed sidx boxes into absolute byte ranges for media segments.
 *
 * The absolute position of each segment is computed as:
 *   segmentsStart = absoluteBoxStart + (lastBoxEnd - absoluteBoxStart) + firstOffset
 *                 = absoluteBoxStart of the first box
 *                   + total bytes occupied by all sidx boxes in this chain
 *                   + firstOffset declared in the last sidx box
 *
 * References with referenceType === 1 (sub-sidx) are skipped — they should
 * themselves appear as parsed boxes in `boxes` when the fetch covered them.
 * References with referenceType === 0 (media) produce one byte-range entry.
 *
 * @param {SidxBox[]} boxes         all sidx boxes found in the fetched buffer
 * @param {number} absoluteBoxStart absolute byte offset of the *first* sidx box in the file
 * @returns {Array<[number, number]>} [firstByte, lastByte] inclusive, absolute
 */
function sidxBoxesToByteRanges(boxes, absoluteBoxStart) {
  if (!boxes.length) {
    return [];
  }

  /** @type {Array<[number, number]>} */
  const ranges = [];

  // Segments begin right after the last sidx box's end (relative to
  // absoluteBoxStart) plus the firstOffset declared in that box.
  const lastBox = boxes[boxes.length - 1];
  const sidxRegionBytes = lastBox.boxEnd; // relative to buffer start (0-based within buffer)
  let cursor = absoluteBoxStart + sidxRegionBytes + lastBox.firstOffset;

  // Collect media references from all boxes.  In a chained-sidx layout each
  // sub-sidx box's references cover a sub-range; for simplicity we process
  // them linearly (the file order and reference order are aligned).
  for (const box of boxes) {
    for (const ref of box.references) {
      if (ref.referenceType === 0) {
        // Media segment
        ranges.push([cursor, cursor + ref.size - 1]);
      }
      // Both media and sub-sidx references consume `ref.size` bytes
      cursor += ref.size;
    }
  }

  return ranges;
}

/**
 * Fetch a byte range from a URL using an HTTP Range request.
 * @param {string} url
 * @param {number} first  inclusive
 * @param {number} last   inclusive
 * @param {AbortSignal} [signal]
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchRange(url, first, last, signal) {
  const res = await fetch(url, {
    signal,
    headers: { Range: `bytes=${first}-${last}` },
  });
  // 206 Partial Content is the success status for range requests.
  // Some servers return 200 with the full body when the range covers the file.
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} fetching range ${first}-${last} of ${url}`,
    );
  }
  return res.arrayBuffer();
}

/**
 * Fetch the bytes indicated by a "first-last" range string, or the whole
 * resource if rangeStr is undefined.
 *
 * Returns the buffer together with the absolute byte offset at which it starts
 * within the original resource (needed to translate parsed box offsets back to
 * file-absolute positions).
 *
 * @param {string} url
 * @param {string|undefined} rangeStr  e.g. "0-999"
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ buffer: ArrayBuffer, absoluteStart: number }>}
 */
async function fetchBufferForRange(url, rangeStr, signal) {
  if (rangeStr) {
    const parsed = parseByteRange(rangeStr);
    if (!parsed) {
      throw new Error(`Malformed byte range in MPD: "${rangeStr}"`);
    }
    const [first, last] = parsed;
    const buffer = await fetchRange(url, first, last, signal);
    return { buffer, absoluteStart: first };
  }

  // No explicit range — do a speculative fetch of the first 64 KiB.
  // sidx boxes in well-formed DASH content appear before the media data, so
  // they are nearly always within the first few kilobytes.
  const PROBE_SIZE = 65536;
  const buffer = await fetchRange(url, 0, PROBE_SIZE - 1, signal);
  return { buffer, absoluteStart: 0 };
}

// ---------------------------------------------------------------------------
// SIDX resolution (async)
// ---------------------------------------------------------------------------

/**
 * Resolve the SIDX boxes for one representation and return its SegmentItem[].
 *
 * @param {import("./types").SidxPending} pending
 * @param {AbortSignal} [signal]
 * @returns {Promise<import("./types").SegmentItem[]>}
 */
async function resolveSidxPending(pending, signal) {
  /** @type {import("./types").SegmentItem[]} */
  const segments = [];

  // The init segment was already parsed synchronously; include it verbatim.
  if (pending.initSegment) {
    segments.push(pending.initSegment);
  }

  const { mediaURL, indexRange } = pending;

  let buffer, absoluteStart;
  try {
    ({ buffer, absoluteStart } = await fetchBufferForRange(
      mediaURL,
      indexRange,
      signal,
    ));
  } catch (err) {
    // Network failure — degrade gracefully to a whole-resource segment.
    console.warn(
      `[dash-mpd] SIDX fetch failed for ${mediaURL}: ${err}. Falling back to full-resource segment.`,
    );
    segments.push({ url: mediaURL, type: "media", isISOBMFF: true });
    return segments;
  }

  const boxes = parseSidxBoxes(buffer, 0);

  if (!boxes.length) {
    // No sidx found — the resource is not segmented or the sidx is beyond the
    // probe window; emit the whole resource as a single media segment.
    segments.push({ url: mediaURL, type: "media", isISOBMFF: true });
    return segments;
  }

  const byteRanges = sidxBoxesToByteRanges(boxes, absoluteStart);

  if (!byteRanges.length) {
    segments.push({ url: mediaURL, type: "media", isISOBMFF: true });
    return segments;
  }

  for (const [first, last] of byteRanges) {
    segments.push({
      url: mediaURL,
      byteRange: formatRange(first, last),
      type: "media",
      isISOBMFF: true,
    });
  }

  return segments;
}
