import ByteViewIndex from "../../../inspection/byte-view/ByteViewIndex.js";
import { fmtBytes } from "../../../utils/bytes.js";
import { requireElementById } from "../../../utils/dom.js";
import { switchToTab } from "../tab_menu.js";
import {
  buildByteViewDescriptors,
  findRowIndexForOffset,
  formatOffset,
  getVisibleRowWindow,
  ROW_HEIGHT,
  renderVisibleByteRows,
} from "./grid.js";
import {
  ensureSelectedTreeFieldVisible,
  getByteOffsetFromPointerEvent,
} from "./tree.js";

/**
 * @typedef {import("../../../inspection/byte-view/ByteViewCollector.js").ByteViewRenderData} ByteViewRenderData
 * @typedef {import("../../../inspection/byte-view/ByteViewIndex.js").IndexedFieldSpan} IndexedFieldSpan
 * @typedef {import("./grid.js").ByteViewDescriptor} ByteViewDescriptor
 */

class ByteViewTabClass {
  #button = requireElementById("tab-button-bytes", HTMLButtonElement);
  #panel = requireElementById("tab-bytes", HTMLElement);
  #root = requireElementById("byte-view", HTMLElement);
  /** @type {HTMLElement | null} */
  #treeRoot = null;
  /** @type {ByteViewRenderData | null} */
  #data = null;
  /** @type {ByteViewIndex} */
  #index = new ByteViewIndex(null);
  /** @type {HTMLDivElement | null} */
  #byteScroll = null;
  /** @type {HTMLDivElement | null} */
  #byteRows = null;
  /** @type {HTMLElement | null} */
  #semanticPane = null;
  /** @type {HTMLDivElement | null} */
  #byteScrollStatus = null;
  #hoverFieldId = "";
  #selectedFieldId = "";
  /** @type {ByteViewDescriptor[]} */
  #descriptors = [];
  #totalRows = 0;
  /** @type {number | null} */
  #dragStartOffset = null;
  /** @type {number | null} */
  #pendingRenderFrame = null;
  /** @type {number | null} */
  #pendingStatusTimeout = null;
  #lastRenderedSignature = "";
  #lastSemanticSignature = "";
  #hasRenderedSemanticPane = false;
  #suspendPointerHover = false;

  reset() {
    this.#treeRoot = null;
    this.#data = null;
    this.#index = new ByteViewIndex(null);
    this.#byteScroll = null;
    this.#byteRows = null;
    this.#semanticPane = null;
    this.#byteScrollStatus = null;
    this.#hoverFieldId = "";
    this.#selectedFieldId = "";
    this.#descriptors = [];
    this.#totalRows = 0;
    this.#dragStartOffset = null;
    if (this.#pendingRenderFrame !== null) {
      cancelAnimationFrame(this.#pendingRenderFrame);
    }
    if (this.#pendingStatusTimeout !== null) {
      clearTimeout(this.#pendingStatusTimeout);
    }
    this.#pendingRenderFrame = null;
    this.#pendingStatusTimeout = null;
    this.#lastRenderedSignature = "";
    this.#lastSemanticSignature = "";
    this.#hasRenderedSemanticPane = false;
    this.#suspendPointerHover = false;
    this.#button.hidden = true;
    this.#panel.hidden = true;
    this.#root.replaceChildren();
  }

  /**
   * @param {ByteViewRenderData | null} data
   * @param {{ treeRoot: HTMLElement, abortSignal: AbortSignal }} options
   */
  render(data, options) {
    this.reset();
    this.#treeRoot = options.treeRoot;
    this.#data = data;
    this.#index = new ByteViewIndex(data);
    if (!data) {
      return;
    }

    this.#button.hidden = false;
    this.#panel.hidden = false;
    const layout = buildByteViewDescriptors(data.capturedSpans);
    this.#descriptors = layout.descriptors;
    this.#totalRows = layout.totalRows;
    this.#renderShell(data);
    this.#bindTreeBridge(options.abortSignal);
    this.#bindBytePane(options.abortSignal);
    this.#renderSelectionState();
  }

  /**
   * @param {ByteViewRenderData} data
   */
  #renderShell(data) {
    const wrap = document.createElement("div");
    wrap.className = "byte-view";

    if (data.captureBudgetExceeded) {
      const banner = document.createElement("div");
      banner.className = "byte-view-banner";
      banner.textContent = data.partialCaptureMessage;
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

    const scrollWrap = document.createElement("div");
    scrollWrap.className = "byte-scroll-wrap";
    const byteScroll = document.createElement("div");
    byteScroll.className = "byte-scroll";
    byteScroll.tabIndex = 0;
    const spacer = document.createElement("div");
    spacer.className = "byte-scroll-spacer";
    spacer.style.height = `${this.#totalRows * ROW_HEIGHT}px`;
    const rows = document.createElement("div");
    rows.className = "byte-rows";
    byteScroll.appendChild(spacer);
    byteScroll.appendChild(rows);
    scrollWrap.appendChild(byteScroll);
    const status = document.createElement("div");
    status.className = "byte-scroll-status";
    status.hidden = true;
    status.textContent = "Updating visible bytes…";
    scrollWrap.appendChild(status);
    leftPane.appendChild(scrollWrap);

    const rightPane = document.createElement("aside");
    rightPane.className = "byte-semantic-pane";
    panes.appendChild(leftPane);
    panes.appendChild(rightPane);
    wrap.appendChild(panes);

    this.#root.appendChild(wrap);
    this.#byteScroll = byteScroll;
    this.#byteRows = rows;
    this.#semanticPane = rightPane;
    this.#byteScrollStatus = status;
  }

  /**
   * @param {AbortSignal} abortSignal
   */
  #bindTreeBridge(abortSignal) {
    const treeRoot = this.#treeRoot;
    if (!treeRoot) {
      return;
    }

    document.addEventListener(
      "byteviewfocusrequest",
      (evt) => {
        if (!(evt instanceof CustomEvent) || !evt.detail) {
          return;
        }
        const fieldId =
          typeof evt.detail.fieldId === "string" ? evt.detail.fieldId : "";
        const field = this.#index.getFieldById(fieldId);
        if (
          !fieldId ||
          !field ||
          !this.#index.doesRangeOverlapCapturedBytes(
            field.offset,
            field.endExclusive,
          )
        ) {
          return;
        }
        this.#selectedFieldId = fieldId;
        this.#hoverFieldId = "";
        this.#suspendPointerHover = true;
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
        this.#scheduleVisibleRowsRender();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerover",
      (evt) => {
        if (this.#dragStartOffset !== null || this.#suspendPointerHover) {
          return;
        }
        const offset = getByteOffsetFromPointerEvent(evt);
        if (offset === null) {
          return;
        }
        const nextFieldId =
          this.#index.findSmallestFieldContaining(offset, offset + 1)?.id ?? "";
        if (nextFieldId === this.#hoverFieldId) {
          return;
        }
        this.#hoverFieldId = nextFieldId;
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerleave",
      () => {
        if (this.#dragStartOffset !== null || !this.#hoverFieldId) {
          return;
        }
        this.#suspendPointerHover = false;
        this.#hoverFieldId = "";
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerdown",
      (evt) => {
        const offset = getByteOffsetFromPointerEvent(evt);
        if (!(evt.target instanceof HTMLElement)) {
          return;
        }
        if (offset === null) {
          this.#clearSelection();
          return;
        }
        this.#dragStartOffset = offset;
        evt.target.setPointerCapture(evt.pointerId);
        const nextFieldId =
          this.#index.findSmallestFieldContaining(offset, offset + 1)?.id ?? "";
        if (nextFieldId === this.#hoverFieldId) {
          return;
        }
        this.#hoverFieldId = nextFieldId;
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointermove",
      (evt) => {
        if (this.#suspendPointerHover) {
          this.#suspendPointerHover = false;
          return;
        }
        if (this.#dragStartOffset === null) {
          return;
        }
        const offset = getByteOffsetFromPointerEvent(evt);
        if (offset === null) {
          return;
        }
        const nextFieldId = this.#resolveFieldForRange(
          this.#dragStartOffset,
          offset,
        );
        if (nextFieldId === this.#hoverFieldId) {
          return;
        }
        this.#hoverFieldId = nextFieldId;
        this.#renderSelectionState();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointerup",
      () => {
        this.#completeByteSelection();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "pointercancel",
      () => {
        this.#completeByteSelection();
      },
      { signal: abortSignal },
    );
    byteScroll.addEventListener(
      "keydown",
      (evt) => {
        if (evt.key !== "Escape") {
          return;
        }
        evt.preventDefault();
        this.#clearSelection();
      },
      { signal: abortSignal },
    );
    document.addEventListener(
      "tabchange",
      (evt) => {
        if (
          evt instanceof CustomEvent &&
          evt.detail &&
          evt.detail.tabName === "bytes"
        ) {
          this.#scheduleVisibleRowsRender(true);
        }
      },
      { signal: abortSignal },
    );
    window.addEventListener(
      "resize",
      () => {
        this.#scheduleVisibleRowsRender(true);
      },
      { signal: abortSignal },
    );
  }

  #renderSelectionState() {
    this.#scheduleVisibleRowsRender();
    this.#renderSemanticPane();
  }

  /**
   * @param {boolean} [force]
   */
  #scheduleVisibleRowsRender(force = false) {
    const byteScroll = this.#byteScroll;
    if (!byteScroll) {
      return;
    }
    if (!force) {
      const nextSignature = this.#getVisibleRowsSignature();
      if (nextSignature === this.#lastRenderedSignature) {
        return;
      }
    } else {
      this.#lastRenderedSignature = "";
    }
    if (this.#pendingRenderFrame !== null) {
      return;
    }

    this.#armPendingStatus();
    this.#pendingRenderFrame = requestAnimationFrame(() => {
      this.#pendingRenderFrame = null;
      this.#renderVisibleRows();
    });
  }

  #renderVisibleRows() {
    const byteScroll = this.#byteScroll;
    const byteRows = this.#byteRows;
    if (!byteScroll || !byteRows) {
      return;
    }

    const renderSignature = this.#getVisibleRowsSignature();
    if (renderSignature === this.#lastRenderedSignature) {
      this.#disarmPendingStatus();
      return;
    }

    renderVisibleByteRows({
      descriptors: this.#descriptors,
      totalRows: this.#totalRows,
      byteScroll,
      byteRows,
      hoveredField: this.#getHoveredField(),
      selectedField: this.#getSelectedField(),
    });
    this.#lastRenderedSignature = renderSignature;
    this.#disarmPendingStatus();
  }

  #renderSemanticPane() {
    const semanticPane = this.#semanticPane;
    const data = this.#data;
    if (!semanticPane || !data) {
      return;
    }

    const activeField = this.#getSemanticField();
    const semanticSignature = `${activeField?.id ?? ""}:${this.#selectedFieldId ? "selected" : "preview"}`;
    if (
      this.#hasRenderedSemanticPane &&
      semanticSignature === this.#lastSemanticSignature
    ) {
      return;
    }
    this.#lastSemanticSignature = semanticSignature;
    this.#hasRenderedSemanticPane = true;
    semanticPane.replaceChildren();

    if (!activeField) {
      const empty = document.createElement("div");
      empty.className = "byte-empty-state";
      empty.textContent =
        "Hover bytes to preview. Click to pin. Press Esc to clear.";
      semanticPane.appendChild(empty);
      return;
    }

    semanticPane.appendChild(createHeroBlock(activeField));

    if (this.#selectedFieldId) {
      semanticPane.appendChild(this.#createSelectedFieldActions());
    }

    if (
      !this.#index.isRangeFullyCaptured(
        activeField.offset,
        activeField.endExclusive,
      )
    ) {
      semanticPane.appendChild(
        createPartialCaptureNotice(
          "This field was parsed successfully, but Byte View only retained part of its raw byte span for this inspection.",
        ),
      );
    }

    // semanticPane.appendChild(
    //   createDetailBlock(
    //     "Context",
    //     activeField.boxPath.length > 0
    //       ? activeField.boxPath.join(" > ")
    //       : activeField.boxType,
    //   ),
    // );
    semanticPane.appendChild(
      createDetailBlock(
        "Byte span",
        `${formatOffset(activeField.offset)} - ${formatOffset(
          activeField.endExclusive - 1,
        )} (${fmtBytes(activeField.byteLength)})`,
      ),
    );
    // semanticPane.appendChild(createDetailBlock("Field type", activeField.kind));

    if (activeField.childIds.length > 0) {
      semanticPane.appendChild(this.#createChildrenBlock(activeField));
    }
  }

  /**
   * @param {IndexedFieldSpan} activeField
   * @returns {HTMLElement}
   */
  #createChildrenBlock(activeField) {
    const childWrap = document.createElement("div");
    childWrap.className = "byte-semantic-children";
    const label = document.createElement("div");
    label.className = "byte-semantic-label";
    label.textContent = "Children";
    childWrap.appendChild(label);

    for (let index = 0; index < activeField.childIds.length; index++) {
      const child = this.#index.getFieldById(activeField.childIds[index]);
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

    return childWrap;
  }

  /**
   * @returns {HTMLElement}
   */
  #createSelectedFieldActions() {
    const actions = document.createElement("div");
    actions.className = "byte-semantic-actions";

    const revealButton = document.createElement("button");
    revealButton.type = "button";
    revealButton.className = "byte-semantic-action-button";
    revealButton.textContent = "Reveal in tree";
    revealButton.addEventListener("click", () => {
      this.#revealSelectionInTree();
    });
    actions.appendChild(revealButton);

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "byte-semantic-action-button";
    clearButton.textContent = "Clear selection";
    clearButton.addEventListener("click", () => {
      this.#clearSelection();
    });
    actions.appendChild(clearButton);

    return actions;
  }

  #completeByteSelection() {
    if (this.#dragStartOffset === null) {
      return;
    }
    const fieldId = this.#hoverFieldId;
    this.#dragStartOffset = null;
    if (!fieldId) {
      this.#renderSelectionState();
      return;
    }
    if (fieldId === this.#selectedFieldId) {
      this.#clearSelection();
      return;
    }
    this.#selectedFieldId = fieldId;
    this.#hoverFieldId = "";
    this.#ensureSelectedTreeFieldVisible();
    this.#renderSelectionState();
  }

  #scrollSelectionIntoView() {
    const activeField = this.#getSelectedField();
    const byteScroll = this.#byteScroll;
    const data = this.#data;
    if (!activeField || !byteScroll || !data) {
      return;
    }
    if (
      !this.#index.isRangeFullyCaptured(
        activeField.offset,
        activeField.endExclusive,
      )
    ) {
      return;
    }

    const rowIndex = findRowIndexForOffset(
      this.#descriptors,
      activeField.offset,
    );
    if (rowIndex === null) {
      return;
    }
    const targetTop = Math.max(
      0,
      rowIndex * ROW_HEIGHT - byteScroll.clientHeight / 3,
    );
    byteScroll.scrollTop = targetTop;
    this.#scheduleVisibleRowsRender(true);
  }

  #ensureSelectedTreeFieldVisible() {
    const activeField = this.#getSelectedField();
    const treeRoot = this.#treeRoot;
    if (!activeField || !treeRoot) {
      return;
    }
    ensureSelectedTreeFieldVisible(treeRoot, activeField);
  }

  #revealSelectionInTree() {
    const activeField = this.#getSelectedField();
    const treeRoot = this.#treeRoot;
    if (!activeField || !treeRoot) {
      return;
    }
    switchToTab("boxes");
    ensureSelectedTreeFieldVisible(treeRoot, activeField, {
      highlight: true,
      strategy: "reveal",
    });
  }

  /**
   * @param {number} anchorOffset
   * @param {number} focusOffset
   * @returns {string}
   */
  #resolveFieldForRange(anchorOffset, focusOffset) {
    const start = Math.min(anchorOffset, focusOffset);
    const endExclusive = Math.max(anchorOffset, focusOffset) + 1;
    return (
      this.#index.findSmallestFieldContaining(start, endExclusive)?.id ?? ""
    );
  }

  /**
   * @returns {IndexedFieldSpan | null}
   */
  #getHoveredField() {
    return this.#index.getFieldById(this.#hoverFieldId);
  }

  /**
   * @returns {IndexedFieldSpan | null}
   */
  #getSelectedField() {
    return this.#index.getFieldById(this.#selectedFieldId);
  }

  /**
   * @returns {IndexedFieldSpan | null}
   */
  #getSemanticField() {
    return this.#getSelectedField() ?? this.#getHoveredField();
  }

  #clearSelection() {
    if (
      !this.#selectedFieldId &&
      !this.#hoverFieldId &&
      this.#dragStartOffset === null
    ) {
      return;
    }
    this.#selectedFieldId = "";
    this.#hoverFieldId = "";
    this.#dragStartOffset = null;
    this.#suspendPointerHover = false;
    this.#renderSelectionState();
  }

  #getVisibleRowsSignature() {
    const byteScroll = this.#byteScroll;
    if (!byteScroll) {
      return "";
    }
    const { firstRow, lastRow } = getVisibleRowWindow(
      byteScroll,
      this.#totalRows,
    );
    return [
      firstRow,
      lastRow,
      byteScroll.clientWidth,
      this.#hoverFieldId,
      this.#selectedFieldId,
    ].join(":");
  }

  #armPendingStatus() {
    const status = this.#byteScrollStatus;
    if (!status || this.#pendingStatusTimeout !== null) {
      return;
    }
    this.#pendingStatusTimeout = window.setTimeout(() => {
      this.#pendingStatusTimeout = null;
      if (this.#pendingRenderFrame === null) {
        return;
      }
      status.hidden = false;
    }, 120);
  }

  #disarmPendingStatus() {
    if (this.#pendingStatusTimeout !== null) {
      clearTimeout(this.#pendingStatusTimeout);
      this.#pendingStatusTimeout = null;
    }
    if (this.#byteScrollStatus) {
      this.#byteScrollStatus.hidden = true;
    }
  }
}

const ByteViewTab = new ByteViewTabClass();

export default ByteViewTab;

/**
 * @param {IndexedFieldSpan} field
 * @returns {HTMLElement}
 */
function createHeroBlock(field) {
  const wrap = document.createElement("div");
  wrap.className = "byte-semantic-hero";

  const context = document.createElement("div");
  context.className = "byte-semantic-context";
  context.textContent = mergeFieldContext(field);
  wrap.appendChild(context);

  const property = document.createElement("div");
  property.className = "byte-semantic-property";
  property.textContent = field.pathLabel;
  wrap.appendChild(property);

  const value = document.createElement("div");
  value.className = "byte-semantic-primary-value";
  value.textContent = field.summary || "—";
  wrap.appendChild(value);

  if (field.description) {
    const description = document.createElement("div");
    description.className = "byte-semantic-description";
    description.textContent = field.description;
    wrap.appendChild(description);
  }

  return wrap;
}

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
 * @param {string} text
 * @returns {HTMLElement}
 */
function createPartialCaptureNotice(text) {
  const wrap = document.createElement("div");
  wrap.className = "byte-semantic-partial-note";
  wrap.textContent = text;
  return wrap;
}

/**
 * @param {IndexedFieldSpan} field
 * @returns {string}
 */
function mergeFieldContext(field) {
  const path = field.boxPath.join(" > ");
  if (!path || path === field.boxType) {
    return field.boxType;
  }
  return `${field.boxType} in ${path}`;
}
