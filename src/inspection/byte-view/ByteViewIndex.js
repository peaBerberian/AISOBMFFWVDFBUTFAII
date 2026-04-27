/**
 * @typedef {import("./ByteViewCollector.js").ByteViewRenderData} ByteViewRenderData
 */

/**
 * @typedef {{
 *   id: string,
 *   boxKey: string,
 *   boxType: string,
 *   boxPath: string[],
 *   boxOrder: number,
 *   offset: number,
 *   byteLength: number,
 *   endExclusive: number,
 *   kind: import("isobmff-inspector").ParsedField["kind"],
 *   pathLabel: string,
 *   summary: string,
 *   description: string,
 *   childIds: string[],
 * }} IndexedFieldSpan
 */

export default class ByteViewIndex {
  /** @type {ByteViewRenderData | null} */
  #data;

  /**
   * @param {ByteViewRenderData | null} data
   */
  constructor(data) {
    this.#data = data;
  }

  /**
   * @param {number} start
   * @param {number} endExclusive
   * @returns {IndexedFieldSpan | null}
   */
  findSmallestFieldContaining(start, endExclusive) {
    if (!this.#data) {
      return null;
    }
    /** @type {IndexedFieldSpan | null} */
    let best = null;
    for (let index = 0; index < this.#data.fieldSpans.length; index++) {
      const field = this.#data.fieldSpans[index];
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
   * @param {string} fieldId
   * @returns {IndexedFieldSpan | null}
   */
  getFieldById(fieldId) {
    if (!this.#data || !fieldId) {
      return null;
    }
    return this.#data.fieldsById.get(fieldId) ?? null;
  }

  /**
   * @param {number} start
   * @param {number} endExclusive
   * @returns {boolean}
   */
  isRangeFullyCaptured(start, endExclusive) {
    if (!this.#data) {
      return false;
    }
    let cursor = start;
    const spans = this.#data.capturedSpans;
    for (let index = 0; index < spans.length; index++) {
      const span = spans[index];
      if (span.endExclusive <= cursor) {
        continue;
      }
      if (span.start > cursor) {
        return false;
      }
      cursor = Math.max(cursor, span.endExclusive);
      if (cursor >= endExclusive) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {number} start
   * @param {number} endExclusive
   * @returns {boolean}
   */
  doesRangeOverlapCapturedBytes(start, endExclusive) {
    if (!this.#data || start >= endExclusive) {
      return false;
    }
    const spans = this.#data.capturedSpans;
    for (let index = 0; index < spans.length; index++) {
      const span = spans[index];
      if (span.endExclusive <= start) {
        continue;
      }
      if (span.start >= endExclusive) {
        return false;
      }
      return true;
    }
    return false;
  }
}
