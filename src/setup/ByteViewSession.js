import { fmtBytes } from "../ui/tabs/utils.js";
import {
  getByteViewBoxKey,
  getByteViewFieldId,
  hasByteViewSpan,
} from "../utils/byte_view.js";

const DEFAULT_CAPTURE_LIMIT = 10 * 1024 * 1024;

/**
 * @typedef {{
 *   start: number,
 *   endExclusive: number,
 *   bytes: Uint8Array,
 * }} CapturedByteSpan
 */

/**
 * @typedef {{
 *   id: string,
 *   boxKey: string,
 *   boxType: string,
 *   boxPath: string[],
 *   offset: number,
 *   byteLength: number,
 *   endExclusive: number,
 *   kind: import("isobmff-inspector").ParsedField["kind"],
 *   key: string,
 *   pathLabel: string,
 *   summary: string,
 *   parentId: string | null,
 *   childIds: string[],
 * }} IndexedFieldSpan
 */

export default class ByteViewSession {
  #captureLimit;
  /** @type {CapturedByteSpan[]} */
  #capturedSpans = [];
  #capturedBytes = 0;
  #captureBudgetExceeded = false;
  /** @type {Map<string, IndexedFieldSpan>} */
  #fieldsById = new Map();
  /** @type {IndexedFieldSpan[]} */
  #fieldSpans = [];

  /**
   * @param {{ captureLimit?: number }} [options]
   */
  constructor(options = {}) {
    this.#captureLimit = options.captureLimit ?? DEFAULT_CAPTURE_LIMIT;
  }

  /**
   * @param {number} absoluteOffset
   * @param {Uint8Array} chunk
   */
  captureInputChunk(absoluteOffset, chunk) {
    if (chunk.byteLength === 0) {
      return;
    }

    const remaining = this.#captureLimit - this.#capturedBytes;
    if (remaining <= 0) {
      this.#captureBudgetExceeded = true;
      return;
    }

    const retainedLength = Math.min(chunk.byteLength, remaining);
    if (retainedLength < chunk.byteLength) {
      this.#captureBudgetExceeded = true;
    }
    if (retainedLength <= 0) {
      return;
    }

    const retained = chunk.slice(0, retainedLength);
    this.#capturedSpans.push({
      start: absoluteOffset,
      endExclusive: absoluteOffset + retained.byteLength,
      bytes: retained,
    });
    this.#capturedBytes += retained.byteLength;
  }

  /**
   * @param {number} start
   * @param {number} endExclusive
   */
  excludeByteRange(start, endExclusive) {
    if (start >= endExclusive || this.#capturedSpans.length === 0) {
      return;
    }

    /** @type {CapturedByteSpan[]} */
    const nextSpans = [];
    let nextCapturedBytes = 0;

    for (let index = 0; index < this.#capturedSpans.length; index++) {
      const span = this.#capturedSpans[index];
      if (endExclusive <= span.start || start >= span.endExclusive) {
        nextSpans.push(span);
        nextCapturedBytes += span.bytes.byteLength;
        continue;
      }

      if (start > span.start) {
        const leftLength = start - span.start;
        const leftBytes = span.bytes.slice(0, leftLength);
        nextSpans.push({
          start: span.start,
          endExclusive: start,
          bytes: leftBytes,
        });
        nextCapturedBytes += leftBytes.byteLength;
      }

      if (endExclusive < span.endExclusive) {
        const rightStart = endExclusive;
        const rightOffset = rightStart - span.start;
        const rightBytes = span.bytes.slice(rightOffset);
        nextSpans.push({
          start: rightStart,
          endExclusive: span.endExclusive,
          bytes: rightBytes,
        });
        nextCapturedBytes += rightBytes.byteLength;
      }
    }

    this.#capturedSpans = nextSpans;
    this.#capturedBytes = nextCapturedBytes;
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {string[]} boxPath
   */
  onBoxComplete(box, boxPath) {
    this.#indexBoxFields(box, boxPath);
  }

  hasCapturedBytes() {
    return this.#capturedSpans.length > 0;
  }

  captureBudgetExceeded() {
    return this.#captureBudgetExceeded;
  }

  getCaptureLimit() {
    return this.#captureLimit;
  }

  /**
   * @returns {CapturedByteSpan[]}
   */
  getCapturedSpans() {
    return this.#capturedSpans;
  }

  /**
   * @param {string} fieldId
   * @returns {IndexedFieldSpan | null}
   */
  getFieldById(fieldId) {
    return this.#fieldsById.get(fieldId) ?? null;
  }

  /**
   * @param {number} start
   * @param {number} endExclusive
   * @returns {IndexedFieldSpan | null}
   */
  findSmallestFieldContaining(start, endExclusive) {
    /** @type {IndexedFieldSpan | null} */
    let best = null;
    for (let index = 0; index < this.#fieldSpans.length; index++) {
      const field = this.#fieldSpans[index];
      if (field.offset > start || field.endExclusive < endExclusive) {
        continue;
      }
      if (
        best === null ||
        field.byteLength < best.byteLength ||
        (field.byteLength === best.byteLength && field.offset > best.offset)
      ) {
        best = field;
      }
    }
    return best;
  }

  /**
   * @returns {string}
   */
  getPartialCaptureMessage() {
    return `Byte View retained up to ${fmtBytes(this.#captureLimit)} of non-mdat metadata bytes for this inspection. Some fields are outside the capture budget and cannot be shown here.`;
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {string[]} boxPath
   */
  #indexBoxFields(box, boxPath) {
    const boxKey = getByteViewBoxKey(box);
    if (!boxKey) {
      return;
    }
    this.#indexBoxHeaderFields(box, boxPath, boxKey);

    /**
     * @param {import("isobmff-inspector").ParsedField} field
     * @param {number[]} pathIndices
     * @param {string[]} pathSegments
     * @param {string | null} parentId
     */
    const visitField = (field, pathIndices, pathSegments, parentId) => {
      let fieldId = "";
      if (hasByteViewSpan(field)) {
        fieldId = getByteViewFieldId(box, pathIndices);
        if (fieldId) {
          const indexedField = {
            id: fieldId,
            boxKey,
            boxType: box.type,
            boxPath: boxPath.slice(),
            offset: Number(field.offset),
            byteLength: Number(field.byteLength),
            endExclusive: Number(field.offset) + Number(field.byteLength),
            kind: field.kind,
            key: pathSegments.at(-1) ?? "",
            pathLabel: joinPathSegments(pathSegments),
            summary: summarizeField(field),
            parentId,
            childIds: [],
          };
          this.#fieldsById.set(fieldId, indexedField);
          this.#fieldSpans.push(indexedField);
          if (parentId) {
            this.#fieldsById.get(parentId)?.childIds.push(fieldId);
          }
        }
      }

      if (field.kind === "struct") {
        const structFields = field.fields ?? [];
        for (let index = 0; index < structFields.length; index++) {
          const child = structFields[index];
          visitField(
            child,
            pathIndices.concat(index),
            pathSegments.concat(child.key),
            fieldId || parentId,
          );
        }
      } else if (field.kind === "array") {
        const items = field.items ?? [];
        for (let index = 0; index < items.length; index++) {
          const child = items[index];
          visitField(
            child,
            pathIndices.concat(index),
            pathSegments.concat(`[${index}]`),
            fieldId || parentId,
          );
        }
      }
    };

    const values = box.values ?? [];
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      visitField(value, [index], [value.key], null);
    }
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {string[]} boxPath
   * @param {string} boxKey
   */
  #indexBoxHeaderFields(box, boxPath, boxKey) {
    const boxOffset = Number(box.offset);
    const sizeFieldLength =
      box.sizeField === "largeSize" ? 8 : box.sizeField === "size" ? 4 : 4;
    this.#registerSyntheticField({
      id: `${boxKey}|header.size`,
      box,
      boxKey,
      boxPath,
      offset: boxOffset,
      byteLength: sizeFieldLength,
      key: "box_size",
      pathLabel: "header.box_size",
      summary:
        box.sizeField === "extendsToEnd"
          ? "extends to end of file"
          : `${fmtBytes(box.size)} (${box.size})`,
    });
    this.#registerSyntheticField({
      id: `${boxKey}|header.type`,
      box,
      boxKey,
      boxPath,
      offset: boxOffset + sizeFieldLength,
      byteLength: 4,
      key: "box_type",
      pathLabel: "header.box_type",
      summary: box.type,
    });
  }

  /**
   * @param {{
   *   id: string,
   *   box: import("isobmff-inspector").ParsedBox,
   *   boxKey: string,
   *   boxPath: string[],
   *   offset: number,
   *   byteLength: number,
   *   key: string,
   *   pathLabel: string,
   *   summary: string,
   * }} field
   */
  #registerSyntheticField(field) {
    /** @type {IndexedFieldSpan} */
    const indexedField = {
      id: field.id,
      boxKey: field.boxKey,
      boxType: field.box.type,
      boxPath: field.boxPath.slice(),
      offset: field.offset,
      byteLength: field.byteLength,
      endExclusive: field.offset + field.byteLength,
      kind: /** @type {import("isobmff-inspector").ParsedField["kind"]} */ (
        "bytes"
      ),
      key: field.key,
      pathLabel: field.pathLabel,
      summary: field.summary,
      parentId: null,
      childIds: [],
    };
    this.#fieldsById.set(field.id, indexedField);
    this.#fieldSpans.push(indexedField);
  }
}

/**
 * @param {string[]} pathSegments
 * @returns {string}
 */
function joinPathSegments(pathSegments) {
  let label = "";
  for (let index = 0; index < pathSegments.length; index++) {
    const segment = pathSegments[index];
    if (!segment) {
      continue;
    }
    if (segment.startsWith("[")) {
      label += segment;
    } else if (!label) {
      label = segment;
    } else {
      label += `.${segment}`;
    }
  }
  return label;
}

/**
 * @param {import("isobmff-inspector").ParsedField} field
 * @returns {string}
 */
function summarizeField(field) {
  switch (field.kind) {
    case "number":
    case "bigint":
      return String(field.value);
    case "string":
    case "bytes":
      return truncateSummary(field.value);
    case "boolean":
      return field.value ? "true" : "false";
    case "null":
      return "null";
    case "fixed-point":
      return `${field.value} (${field.format})`;
    case "date":
      return field.date ?? String(field.value);
    case "bits":
    case "flags":
      return `0x${field.value.toString(16)}`;
    case "struct":
      return `${field.fields?.length ?? 0} fields`;
    case "array":
      return `${field.items?.length ?? 0} items`;
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function truncateSummary(value) {
  return value.length > 64 ? `${value.slice(0, 64)}…` : value;
}
