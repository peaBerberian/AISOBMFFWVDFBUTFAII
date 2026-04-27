import { fmtBytes } from "../../../utils/bytes";

export const BYTES_PER_ROW = 16;
export const ROW_HEIGHT = 24;
export const OVERSCAN_ROWS = 12;

/**
 * @param {HTMLDivElement} byteScroll
 * @param {number} totalRows
 * @returns {{ firstRow: number, lastRow: number }}
 */
export function getVisibleRowWindow(byteScroll, totalRows) {
  const viewportHeight = byteScroll.clientHeight;
  const firstRow = Math.max(
    0,
    Math.floor(byteScroll.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  );
  const lastRow = Math.min(
    totalRows,
    Math.ceil((byteScroll.scrollTop + viewportHeight) / ROW_HEIGHT) +
      OVERSCAN_ROWS,
  );
  return { firstRow, lastRow };
}

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
 *   boxOrder: number,
 *   offset: number,
 *   byteLength: number,
 *   endExclusive: number,
 *   pathLabel: string,
 *   summary: string,
 *   description: string,
 *   childIds: string[],
 * }} IndexedFieldSpan
 */

/**
 * @typedef {{
 *   kind: "gap",
 *   rowStart: number,
 *   rowEnd: number,
 *   start: number,
 *   endExclusive: number,
 * } | {
 *   kind: "segment",
 *   rowStart: number,
 *   rowEnd: number,
 *   start: number,
 *   endExclusive: number,
 *   bytes: Uint8Array,
 * }} ByteViewDescriptor
 */

/**
 * @param {CapturedByteSpan[]} spans
 * @returns {{ descriptors: ByteViewDescriptor[], totalRows: number }}
 */
export function buildByteViewDescriptors(spans) {
  /** @type {ByteViewDescriptor[]} */
  const descriptors = [];
  let totalRows = 0;
  let previousEnd = -1;

  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    if (span.start > previousEnd && previousEnd >= 0) {
      descriptors.push({
        kind: "gap",
        rowStart: totalRows,
        rowEnd: totalRows + 1,
        start: previousEnd,
        endExclusive: span.start,
      });
      totalRows += 1;
    }

    const rowCount = Math.ceil(span.bytes.byteLength / BYTES_PER_ROW);
    descriptors.push({
      kind: "segment",
      rowStart: totalRows,
      rowEnd: totalRows + rowCount,
      start: span.start,
      endExclusive: span.endExclusive,
      bytes: span.bytes,
    });
    totalRows += rowCount;
    previousEnd = span.endExclusive;
  }

  return { descriptors, totalRows };
}

/**
 * @param {{
 *   descriptors: ByteViewDescriptor[],
 *   totalRows: number,
 *   byteScroll: HTMLDivElement,
 *   byteRows: HTMLDivElement,
 *   hoveredField: IndexedFieldSpan | null,
 *   selectedField: IndexedFieldSpan | null,
 * }} options
 */
export function renderVisibleByteRows(options) {
  const {
    descriptors,
    totalRows,
    byteScroll,
    byteRows,
    hoveredField,
    selectedField,
  } = options;

  const { firstRow, lastRow } = getVisibleRowWindow(byteScroll, totalRows);

  byteRows.replaceChildren();
  byteRows.style.transform = `translateY(${firstRow * ROW_HEIGHT}px)`;
  if (firstRow >= lastRow) {
    return;
  }

  let descriptorIndex = findDescriptorIndex(descriptors, firstRow);
  for (let rowIndex = firstRow; rowIndex < lastRow; rowIndex++) {
    while (
      descriptorIndex < descriptors.length &&
      rowIndex >= descriptors[descriptorIndex].rowEnd
    ) {
      descriptorIndex++;
    }
    const descriptor = descriptors[descriptorIndex];
    if (!descriptor) {
      break;
    }
    byteRows.appendChild(
      renderByteRow(descriptor, rowIndex, { hoveredField, selectedField }),
    );
  }
}

/**
 * @param {ByteViewDescriptor[]} descriptors
 * @param {number} offset
 * @returns {number | null}
 */
export function findRowIndexForOffset(descriptors, offset) {
  for (let index = 0; index < descriptors.length; index++) {
    const descriptor = descriptors[index];
    if (descriptor.kind !== "segment") {
      continue;
    }
    if (offset < descriptor.start || offset >= descriptor.endExclusive) {
      continue;
    }
    return (
      descriptor.rowStart +
      Math.floor((offset - descriptor.start) / BYTES_PER_ROW)
    );
  }
  return null;
}

/**
 * @param {ByteViewDescriptor} descriptor
 * @param {number} rowIndex
 * @param {{
 *   hoveredField: IndexedFieldSpan | null,
 *   selectedField: IndexedFieldSpan | null,
 * }} state
 * @returns {HTMLElement}
 */
function renderByteRow(descriptor, rowIndex, state) {
  if (descriptor.kind === "gap") {
    const row = document.createElement("div");
    row.className = "byte-row byte-gap-row";
    row.textContent = `… gap of ${fmtBytes(descriptor.endExclusive - descriptor.start)} …`;
    return row;
  }

  const relativeRow = rowIndex - descriptor.rowStart;
  const relativeStart = relativeRow * BYTES_PER_ROW;
  const slice = descriptor.bytes.subarray(
    relativeStart,
    relativeStart + BYTES_PER_ROW,
  );
  const rowOffset = descriptor.start + relativeStart;

  const row = document.createElement("div");
  row.className = "byte-row";

  const offset = document.createElement("div");
  offset.className = "byte-offset";
  offset.textContent = formatOffset(rowOffset);
  row.appendChild(offset);

  row.appendChild(renderByteCellStrip(slice, rowOffset, "hex", state));
  row.appendChild(renderByteCellStrip(slice, rowOffset, "ascii", state));
  return row;
}

/**
 * @param {Uint8Array} slice
 * @param {number} rowOffset
 * @param {"hex" | "ascii"} mode
 * @param {{
 *   hoveredField: IndexedFieldSpan | null,
 *   selectedField: IndexedFieldSpan | null,
 * }} state
 * @returns {HTMLElement}
 */
function renderByteCellStrip(slice, rowOffset, mode, state) {
  const wrap = document.createElement("div");
  wrap.className = mode === "hex" ? "byte-hex" : "byte-ascii";
  appendByteHighlightOverlays(wrap, slice.length, rowOffset, state);

  for (let index = 0; index < BYTES_PER_ROW; index++) {
    const cell = document.createElement("span");
    cell.className = "byte-cell";
    if (index < slice.length) {
      const byteOffset = rowOffset + index;
      const byteValue = slice[index];
      cell.dataset.byteOffset = String(byteOffset);
      cell.textContent =
        mode === "hex"
          ? byteValue.toString(16).padStart(2, "0")
          : byteValue >= 0x20 && byteValue <= 0x7e
            ? String.fromCharCode(byteValue)
            : ".";
      applyByteHighlightClass(cell, byteOffset, state);
    } else {
      cell.classList.add("is-empty");
      cell.textContent = mode === "hex" ? "  " : " ";
    }
    wrap.appendChild(cell);
  }
  return wrap;
}

/**
 * @param {HTMLElement} wrap
 * @param {number} sliceLength
 * @param {number} rowOffset
 * @param {{
 *   hoveredField: IndexedFieldSpan | null,
 *   selectedField: IndexedFieldSpan | null,
 * }} state
 */
function appendByteHighlightOverlays(wrap, sliceLength, rowOffset, state) {
  const ranges = buildHighlightRanges(sliceLength, rowOffset, state);
  for (let index = 0; index < ranges.length; index++) {
    const range = ranges[index];
    const overlay = document.createElement("span");
    overlay.className = `byte-highlight-overlay is-${range.kind}`;
    overlay.style.setProperty(
      "--byte-highlight-accent",
      getBoxAccentColor(range.boxOrder),
    );
    overlay.style.left = getHighlightInset(range.startIndex);
    overlay.style.width = getHighlightWidth(
      range.endIndexExclusive - range.startIndex,
    );
    wrap.appendChild(overlay);
  }
}

/**
 * @param {HTMLElement} cell
 * @param {number} byteOffset
 * @param {{
 *   hoveredField: IndexedFieldSpan | null,
 *   selectedField: IndexedFieldSpan | null,
 * }} state
 */
function applyByteHighlightClass(cell, byteOffset, state) {
  const { selectedField, hoveredField } = state;
  if (
    selectedField &&
    byteOffset >= selectedField.offset &&
    byteOffset < selectedField.endExclusive
  ) {
    cell.classList.add("is-field-selected");
    return;
  }
  if (
    hoveredField &&
    byteOffset >= hoveredField.offset &&
    byteOffset < hoveredField.endExclusive
  ) {
    cell.classList.add("is-field-hovered");
  }
}

/**
 * @param {number} sliceLength
 * @param {number} rowOffset
 * @param {{
 *   hoveredField: IndexedFieldSpan | null,
 *   selectedField: IndexedFieldSpan | null,
 * }} state
 * @returns {Array<{ startIndex: number, endIndexExclusive: number, kind: "selected" | "hovered", boxOrder: number }>}
 */
function buildHighlightRanges(sliceLength, rowOffset, state) {
  /** @type {Array<{ startIndex: number, endIndexExclusive: number, kind: "selected" | "hovered", boxOrder: number }>} */
  const ranges = [];
  /** @type {"selected" | "hovered" | ""} */
  let currentKind = "";
  let currentBoxOrder = -1;
  let currentStart = -1;

  for (let index = 0; index < sliceLength; index++) {
    const byteOffset = rowOffset + index;
    const nextHighlight = getByteHighlight(byteOffset, state);
    const nextKind = nextHighlight.kind;
    const nextBoxOrder = nextHighlight.boxOrder;
    if (nextKind === currentKind && nextBoxOrder === currentBoxOrder) {
      continue;
    }
    if (currentKind) {
      ranges.push({
        startIndex: currentStart,
        endIndexExclusive: index,
        kind: currentKind,
        boxOrder: currentBoxOrder,
      });
    }
    currentKind = nextKind;
    currentBoxOrder = nextBoxOrder;
    currentStart = nextKind ? index : -1;
  }

  if (currentKind) {
    ranges.push({
      startIndex: currentStart,
      endIndexExclusive: sliceLength,
      kind: currentKind,
      boxOrder: currentBoxOrder,
    });
  }

  return ranges;
}

/**
 * @param {number} byteOffset
 * @param {{
 *   hoveredField: IndexedFieldSpan | null,
 *   selectedField: IndexedFieldSpan | null,
 * }} state
 * @returns {{ kind: "selected" | "hovered" | "", boxOrder: number }}
 */
function getByteHighlight(byteOffset, state) {
  const { selectedField, hoveredField } = state;
  if (
    selectedField &&
    byteOffset >= selectedField.offset &&
    byteOffset < selectedField.endExclusive
  ) {
    return {
      kind: "selected",
      boxOrder: selectedField.boxOrder,
    };
  }
  if (
    hoveredField &&
    byteOffset >= hoveredField.offset &&
    byteOffset < hoveredField.endExclusive
  ) {
    return {
      kind: "hovered",
      boxOrder: hoveredField.boxOrder,
    };
  }
  return {
    kind: "",
    boxOrder: -1,
  };
}

/**
 * @param {number} startIndex
 * @returns {string}
 */
function getHighlightInset(startIndex) {
  if (startIndex <= 0) {
    return "0";
  }
  return `calc((${startIndex} * (100% + 4px)) / ${BYTES_PER_ROW})`;
}

/**
 * @param {number} count
 * @returns {string}
 */
function getHighlightWidth(count) {
  if (count >= BYTES_PER_ROW) {
    return "100%";
  }
  return `calc((${count} * (100% + 4px)) / ${BYTES_PER_ROW} - 4px)`;
}

/**
 * @param {number} boxOrder
 * @returns {string}
 */
function getBoxAccentColor(boxOrder) {
  const palette = [
    "var(--color-accent-blue)",
    "var(--color-accent-green)",
    "var(--color-accent-orange)",
    "var(--color-accent-purple)",
  ];
  return (
    palette[((boxOrder % palette.length) + palette.length) % palette.length] ??
    "var(--color-accent-blue)"
  );
}

/**
 * @param {ByteViewDescriptor[]} descriptors
 * @param {number} rowIndex
 * @returns {number}
 */
function findDescriptorIndex(descriptors, rowIndex) {
  let low = 0;
  let high = descriptors.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const descriptor = descriptors[mid];
    if (rowIndex < descriptor.rowStart) {
      high = mid - 1;
    } else if (rowIndex >= descriptor.rowEnd) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, low - 1);
}

/**
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function formatOffset(value) {
  const offset = Number(value);
  return `0x${offset.toString(16).padStart(8, "0")}`;
}
