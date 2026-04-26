import { requireElementById } from "../../utils/dom.js";
import { switchToTab } from "./tab_menu.js";
import { openBoxBody } from "./tree/index.js";
import { fmtBytes } from "./utils.js";

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 24;
const OVERSCAN_ROWS = 12;

/**
 * @typedef {import("../../setup/ByteViewSession.js").default} ByteViewSession
 */

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
 *   pathLabel: string,
 *   summary: string,
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

class ByteViewTabClass {
  #button = requireElementById("tab-button-bytes", HTMLButtonElement);
  #panel = requireElementById("tab-bytes", HTMLElement);
  #root = requireElementById("byte-view", HTMLElement);
  /** @type {HTMLElement | null} */
  #treeRoot = null;
  /** @type {ByteViewSession | null} */
  #session = null;
  /** @type {HTMLDivElement | null} */
  #byteScroll = null;
  /** @type {HTMLDivElement | null} */
  #byteRows = null;
  /** @type {HTMLElement | null} */
  #semanticPane = null;
  #hoverFieldId = "";
  #selectedFieldId = "";
  /** @type {ByteViewDescriptor[]} */
  #descriptors = [];
  #totalRows = 0;
  /** @type {number | null} */
  #dragStartOffset = null;

  reset() {
    this.#treeRoot = null;
    this.#session = null;
    this.#byteScroll = null;
    this.#byteRows = null;
    this.#semanticPane = null;
    this.#hoverFieldId = "";
    this.#selectedFieldId = "";
    this.#descriptors = [];
    this.#totalRows = 0;
    this.#dragStartOffset = null;
    this.#button.hidden = true;
    this.#panel.hidden = true;
    this.#root.replaceChildren();
  }

  /**
   * @param {ByteViewSession | null} session
   * @param {{ treeRoot: HTMLElement, abortSignal: AbortSignal }} options
   */
  render(session, options) {
    this.reset();
    this.#treeRoot = options.treeRoot;
    this.#session = session;
    if (!session?.hasCapturedBytes()) {
      return;
    }

    this.#button.hidden = false;
    this.#panel.hidden = false;
    this.#buildDescriptors(session.getCapturedSpans());
    this.#renderShell(session);
    this.#bindTreeBridge(options.abortSignal);
    this.#bindBytePane(options.abortSignal);
    this.#renderVisibleRows();
    this.#renderSemanticPane();
  }

  /**
   * @param {ByteViewSession} session
   */
  #renderShell(session) {
    const wrap = document.createElement("div");
    wrap.className = "byte-view";

    if (session.captureBudgetExceeded()) {
      const banner = document.createElement("div");
      banner.className = "byte-view-banner";
      banner.textContent = session.getPartialCaptureMessage();
      wrap.appendChild(banner);
    }

    const panes = document.createElement("div");
    panes.className = "byte-view-panes";

    const leftPane = document.createElement("section");
    leftPane.className = "byte-pane";

    const paneHeader = document.createElement("div");
    paneHeader.className = "byte-pane-header";
    paneHeader.textContent = "Captured bytes";
    leftPane.appendChild(paneHeader);

    const byteScroll = document.createElement("div");
    byteScroll.className = "byte-scroll";
    const spacer = document.createElement("div");
    spacer.className = "byte-scroll-spacer";
    spacer.style.height = `${this.#totalRows * ROW_HEIGHT}px`;
    const rows = document.createElement("div");
    rows.className = "byte-rows";
    byteScroll.appendChild(spacer);
    byteScroll.appendChild(rows);
    leftPane.appendChild(byteScroll);

    const rightPane = document.createElement("aside");
    rightPane.className = "byte-semantic-pane";
    panes.appendChild(leftPane);
    panes.appendChild(rightPane);
    wrap.appendChild(panes);

    this.#root.appendChild(wrap);
    this.#byteScroll = byteScroll;
    this.#byteRows = rows;
    this.#semanticPane = rightPane;
  }

  /**
   * @param {CapturedByteSpan[]} spans
   */
  #buildDescriptors(spans) {
    this.#descriptors = [];
    this.#totalRows = 0;
    let previousEnd = -1;

    for (let index = 0; index < spans.length; index++) {
      const span = spans[index];
      if (span.start > previousEnd && previousEnd >= 0) {
        this.#descriptors.push({
          kind: "gap",
          rowStart: this.#totalRows,
          rowEnd: this.#totalRows + 1,
          start: previousEnd,
          endExclusive: span.start,
        });
        this.#totalRows += 1;
      }

      const rowCount = Math.ceil(span.bytes.byteLength / BYTES_PER_ROW);
      this.#descriptors.push({
        kind: "segment",
        rowStart: this.#totalRows,
        rowEnd: this.#totalRows + rowCount,
        start: span.start,
        endExclusive: span.endExclusive,
        bytes: span.bytes,
      });
      this.#totalRows += rowCount;
      previousEnd = span.endExclusive;
    }
  }

  /**
   * @param {AbortSignal} abortSignal
   */
  #bindTreeBridge(abortSignal) {
    const treeRoot = this.#treeRoot;
    if (!treeRoot) {
      return;
    }

    treeRoot.addEventListener(
      "pointerover",
      (evt) => {
        const row = getClosestFieldRow(evt.target);
        this.#hoverFieldId = row?.dataset.byteFieldId ?? "";
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    treeRoot.addEventListener(
      "pointerleave",
      () => {
        this.#hoverFieldId = "";
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    treeRoot.addEventListener(
      "click",
      (evt) => {
        const row = getClosestFieldRow(evt.target);
        const fieldId = row?.dataset.byteFieldId ?? "";
        if (!fieldId) {
          return;
        }
        evt.preventDefault();
        this.#selectedFieldId = fieldId;
        this.#hoverFieldId = "";
        switchToTab("bytes");
        this.#scrollSelectionIntoView();
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
  }

  /**
   * @param {AbortSignal} abortSignal
   */
  #bindBytePane(abortSignal) {
    const byteScroll = this.#byteScroll;
    if (!byteScroll) {
      return;
    }

    byteScroll.addEventListener(
      "scroll",
      () => {
        this.#renderVisibleRows();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerover",
      (evt) => {
        if (this.#dragStartOffset !== null) {
          return;
        }
        const offset = getByteOffsetFromPointerEvent(evt);
        if (offset === null) {
          return;
        }
        this.#hoverFieldId =
          this.#session?.findSmallestFieldContaining(offset, offset + 1)?.id ??
          "";
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerleave",
      () => {
        if (this.#dragStartOffset !== null) {
          return;
        }
        this.#hoverFieldId = "";
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerdown",
      (evt) => {
        const offset = getByteOffsetFromPointerEvent(evt);
        if (offset === null || !(evt.target instanceof HTMLElement)) {
          return;
        }
        this.#dragStartOffset = offset;
        evt.target.setPointerCapture(evt.pointerId);
        this.#hoverFieldId =
          this.#session?.findSmallestFieldContaining(offset, offset + 1)?.id ??
          "";
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointermove",
      (evt) => {
        if (this.#dragStartOffset === null) {
          return;
        }
        const offset = getByteOffsetFromPointerEvent(evt);
        if (offset === null) {
          return;
        }
        this.#hoverFieldId = this.#resolveFieldForRange(
          this.#dragStartOffset,
          offset,
        );
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerup",
      (evt) => {
        if (this.#dragStartOffset === null) {
          return;
        }
        const offset = getByteOffsetFromPointerEvent(evt);
        const fieldId =
          offset === null
            ? this.#hoverFieldId
            : this.#resolveFieldForRange(this.#dragStartOffset, offset);
        this.#dragStartOffset = null;
        if (!fieldId) {
          this.#hoverFieldId = "";
          this.#renderSelectionState();
          return;
        }
        this.#selectedFieldId = fieldId;
        this.#hoverFieldId = "";
        this.#ensureSelectedTreeFieldVisible();
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
  }

  #renderVisibleRows() {
    const byteScroll = this.#byteScroll;
    const byteRows = this.#byteRows;
    if (!byteScroll || !byteRows || !this.#session) {
      return;
    }

    const viewportHeight = byteScroll.clientHeight;
    const firstRow = Math.max(
      0,
      Math.floor(byteScroll.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
    );
    const lastRow = Math.min(
      this.#totalRows,
      Math.ceil((byteScroll.scrollTop + viewportHeight) / ROW_HEIGHT) +
        OVERSCAN_ROWS,
    );

    byteRows.replaceChildren();
    byteRows.style.transform = `translateY(${firstRow * ROW_HEIGHT}px)`;
    if (firstRow >= lastRow) {
      return;
    }

    let descriptorIndex = findDescriptorIndex(this.#descriptors, firstRow);
    for (let rowIndex = firstRow; rowIndex < lastRow; rowIndex++) {
      while (
        descriptorIndex < this.#descriptors.length &&
        rowIndex >= this.#descriptors[descriptorIndex].rowEnd
      ) {
        descriptorIndex++;
      }
      const descriptor = this.#descriptors[descriptorIndex];
      if (!descriptor) {
        break;
      }
      byteRows.appendChild(this.#renderRow(descriptor, rowIndex));
    }
  }

  /**
   * @param {ByteViewDescriptor} descriptor
   * @param {number} rowIndex
   * @returns {HTMLElement}
   */
  #renderRow(descriptor, rowIndex) {
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

    const hex = document.createElement("div");
    hex.className = "byte-hex";
    for (let index = 0; index < BYTES_PER_ROW; index++) {
      const cell = document.createElement("span");
      cell.className = "byte-cell";
      if (index < slice.length) {
        const byteOffset = rowOffset + index;
        const byteValue = slice[index];
        cell.dataset.byteOffset = String(byteOffset);
        cell.textContent = byteValue.toString(16).padStart(2, "0");
        applyByteHighlightClass(cell, byteOffset, {
          hoveredField: this.#getHoveredField(),
          selectedField: this.#getSelectedField(),
        });
      } else {
        cell.classList.add("is-empty");
        cell.textContent = "  ";
      }
      hex.appendChild(cell);
    }
    row.appendChild(hex);

    const ascii = document.createElement("div");
    ascii.className = "byte-ascii";
    for (let index = 0; index < BYTES_PER_ROW; index++) {
      const cell = document.createElement("span");
      cell.className = "byte-cell";
      if (index < slice.length) {
        const byteOffset = rowOffset + index;
        const byteValue = slice[index];
        cell.dataset.byteOffset = String(byteOffset);
        cell.textContent =
          byteValue >= 0x20 && byteValue <= 0x7e
            ? String.fromCharCode(byteValue)
            : ".";
        applyByteHighlightClass(cell, byteOffset, {
          hoveredField: this.#getHoveredField(),
          selectedField: this.#getSelectedField(),
        });
      } else {
        cell.classList.add("is-empty");
        cell.textContent = " ";
      }
      ascii.appendChild(cell);
    }
    row.appendChild(ascii);
    return row;
  }

  #renderSelectionState() {
    this.#renderVisibleRows();
    this.#renderSemanticPane();
    this.#updateTreeHighlight();
  }

  #renderSemanticPane() {
    const semanticPane = this.#semanticPane;
    const session = this.#session;
    if (!semanticPane || !session) {
      return;
    }

    semanticPane.replaceChildren();
    const activeField = this.#getSemanticField();

    const header = document.createElement("div");
    header.className = "byte-semantic-header";
    header.textContent = "Selected region";
    semanticPane.appendChild(header);

    if (!activeField) {
      const empty = document.createElement("div");
      empty.className = "byte-empty-state";
      empty.textContent =
        "Click a field in the box tree or select captured bytes to inspect their raw span.";
      semanticPane.appendChild(empty);
      return;
    }

    const captured = this.#isRangeFullyCaptured(
      activeField.offset,
      activeField.endExclusive,
    );
    if (!captured) {
      const missing = document.createElement("div");
      missing.className = "byte-view-banner";
      missing.textContent =
        "This field was parsed, but its full byte span was not captured for this session.";
      semanticPane.appendChild(missing);
    }

    semanticPane.appendChild(
      createDetailBlock("Current box", activeField.boxType),
    );
    semanticPane.appendChild(
      createDetailBlock("Enclosing path", activeField.boxPath.join(" > ")),
    );
    semanticPane.appendChild(
      createDetailBlock("Field path", activeField.pathLabel),
    );
    semanticPane.appendChild(
      createDetailBlock("Summary", activeField.summary || "—"),
    );
    semanticPane.appendChild(
      createDetailBlock(
        "Byte span",
        `${formatOffset(activeField.offset)} - ${formatOffset(
          activeField.endExclusive - 1,
        )} (${fmtBytes(activeField.byteLength)})`,
      ),
    );

    if (activeField.childIds.length > 0) {
      const childWrap = document.createElement("div");
      childWrap.className = "byte-semantic-children";
      const label = document.createElement("div");
      label.className = "byte-semantic-label";
      label.textContent = "Children";
      childWrap.appendChild(label);
      for (let index = 0; index < activeField.childIds.length; index++) {
        const child = session.getFieldById(activeField.childIds[index]);
        if (!child) {
          continue;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "byte-child-button";
        button.textContent = `${child.pathLabel}  ${child.summary}`;
        button.addEventListener("click", () => {
          this.#selectedFieldId = child.id;
          this.#hoverFieldId = "";
          this.#scrollSelectionIntoView();
          this.#ensureSelectedTreeFieldVisible();
          this.#renderSelectionState();
        });
        childWrap.appendChild(button);
      }
      semanticPane.appendChild(childWrap);
    }
  }

  #updateTreeHighlight() {
    const treeRoot = this.#treeRoot;
    const activeField = this.#getSemanticField();
    if (!treeRoot) {
      return;
    }

    const rows = treeRoot.getElementsByClassName("box-value-line");
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!(row instanceof HTMLElement)) {
        continue;
      }
      const fieldId = row.dataset.byteFieldId ?? "";
      row.classList.toggle(
        "is-byte-selected",
        fieldId === this.#selectedFieldId,
      );
      row.classList.toggle(
        "is-byte-hovered",
        fieldId !== this.#selectedFieldId && fieldId === this.#hoverFieldId,
      );
    }

    const boxes = treeRoot.getElementsByClassName("box-node");
    for (let index = 0; index < boxes.length; index++) {
      const box = boxes[index];
      if (!(box instanceof HTMLElement)) {
        continue;
      }
      box.classList.toggle(
        "is-byte-box-selected",
        !!activeField && box.dataset.boxKey === activeField.boxKey,
      );
    }
  }

  #scrollSelectionIntoView() {
    const activeField = this.#getSelectedField();
    const byteScroll = this.#byteScroll;
    if (!activeField || !byteScroll) {
      return;
    }
    if (
      !this.#isRangeFullyCaptured(activeField.offset, activeField.endExclusive)
    ) {
      return;
    }

    const rowIndex = this.#findRowIndexForOffset(activeField.offset);
    if (rowIndex === null) {
      return;
    }
    const targetTop = Math.max(
      0,
      rowIndex * ROW_HEIGHT - byteScroll.clientHeight / 3,
    );
    byteScroll.scrollTop = targetTop;
    this.#renderVisibleRows();
  }

  #ensureSelectedTreeFieldVisible() {
    const activeField = this.#getSelectedField();
    const treeRoot = this.#treeRoot;
    if (!activeField || !treeRoot) {
      return;
    }

    const boxNode = findBoxNodeByKey(treeRoot, activeField.boxKey);
    if (!boxNode) {
      return;
    }

    openAncestorBoxes(boxNode);
    if (boxNode instanceof HTMLDetailsElement) {
      openBoxBody(boxNode);
    }

    const rows = boxNode.getElementsByClassName("box-value-line");
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (
        row instanceof HTMLElement &&
        row.dataset.byteFieldId === activeField.id
      ) {
        row.scrollIntoView({ block: "nearest" });
        break;
      }
    }
  }

  /**
   * @param {number} anchorOffset
   * @param {number} focusOffset
   * @returns {string}
   */
  #resolveFieldForRange(anchorOffset, focusOffset) {
    const session = this.#session;
    if (!session) {
      return "";
    }
    const start = Math.min(anchorOffset, focusOffset);
    const endExclusive = Math.max(anchorOffset, focusOffset) + 1;
    return session.findSmallestFieldContaining(start, endExclusive)?.id ?? "";
  }

  /**
   * @returns {IndexedFieldSpan | null}
   */
  #getHoveredField() {
    if (!this.#session || !this.#hoverFieldId) {
      return null;
    }
    return this.#session.getFieldById(this.#hoverFieldId);
  }

  /**
   * @returns {IndexedFieldSpan | null}
   */
  #getSelectedField() {
    if (!this.#session || !this.#selectedFieldId) {
      return null;
    }
    return this.#session.getFieldById(this.#selectedFieldId);
  }

  /**
   * @returns {IndexedFieldSpan | null}
   */
  #getSemanticField() {
    return this.#getSelectedField() ?? this.#getHoveredField();
  }

  /**
   * @param {number} start
   * @param {number} endExclusive
   * @returns {boolean}
   */
  #isRangeFullyCaptured(start, endExclusive) {
    const session = this.#session;
    if (!session) {
      return false;
    }
    let cursor = start;
    const spans = session.getCapturedSpans();
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
   * @param {number} offset
   * @returns {number | null}
   */
  #findRowIndexForOffset(offset) {
    for (let index = 0; index < this.#descriptors.length; index++) {
      const descriptor = this.#descriptors[index];
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
}

const ByteViewTab = new ByteViewTabClass();

export default ByteViewTab;

/**
 * @param {string} label
 * @param {string | number} value
 * @returns {HTMLElement}
 */
function createDetailBlock(label, value) {
  const wrap = document.createElement("div");
  wrap.className = "byte-semantic-block";
  const labelEl = document.createElement("div");
  labelEl.className = "byte-semantic-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("div");
  valueEl.className = "byte-semantic-value";
  valueEl.textContent = String(value);
  wrap.appendChild(labelEl);
  wrap.appendChild(valueEl);
  return wrap;
}

/**
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
function formatOffset(value) {
  const offset = Number(value);
  return `0x${offset.toString(16).padStart(8, "0")}`;
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
 * @param {unknown} target
 * @returns {HTMLElement | null}
 */
function getClosestFieldRow(target) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const row = target.closest(".box-value-line");
  return row instanceof HTMLElement ? row : null;
}

/**
 * @param {unknown} target
 * @returns {number | null}
 */
function getClosestByteOffset(target) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const cell = target.closest(".byte-cell");
  if (!(cell instanceof HTMLElement)) {
    return null;
  }
  const value = Number(cell.dataset.byteOffset);
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {PointerEvent} evt
 * @returns {number | null}
 */
function getByteOffsetFromPointerEvent(evt) {
  const element = document.elementFromPoint(evt.clientX, evt.clientY);
  return getClosestByteOffset(element);
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
 * @param {HTMLElement} root
 * @param {string} boxKey
 * @returns {HTMLElement | null}
 */
function findBoxNodeByKey(root, boxKey) {
  const nodes = root.getElementsByClassName("box-node");
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node instanceof HTMLElement && node.dataset.boxKey === boxKey) {
      return node;
    }
  }
  return null;
}

/**
 * @param {HTMLElement} element
 */
function openAncestorBoxes(element) {
  let current = element.parentElement;
  while (current) {
    if (
      current instanceof HTMLDetailsElement &&
      current.classList.contains("box-node")
    ) {
      openBoxBody(current);
    }
    current = current.parentElement;
  }
}
