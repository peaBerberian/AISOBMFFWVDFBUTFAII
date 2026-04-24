import { el, esc } from "../../dom.js";
import { fmtBytes } from "../utils.js";
import {
  getPsshPreviewField,
  getPsshSystemIdLabel,
  renderPsshPreviewField,
} from "./pssh/index.js";

const AUTO_OPEN_FIELD_LIMIT = 80;
const COLLAPSIBLE_TEXT_LIMIT = 160;
const VALUE_RENDER_BATCH_SIZE = 200;
/**
 * Some Box's details, containing their parsed content, are collapsed by default
 * and not even present in the DOM.
 * This is for performance reasons as a few metadata boxes could become huge.
 *
 * As such this map link the corresponding `HTMLDetailElement` to the code that
 * both insert the DOM and open the detail element.
 *
 * Once the detail has been opened, the entry is removed.
 * @type {WeakMap<HTMLDetailsElement, () => void>}
 */
const lazyBoxBodies = new WeakMap();

/**
 * View abstraction for one rendered box-tree node.
 */
export default class BoxTreeNodeView {
  /** @type {HTMLElement} */
  #element;
  /** @type {HTMLElement | null} */
  #childContainer;

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {{ autoOpen?: boolean, shallow?: boolean }} options
   */
  constructor(box, options = {}) {
    const { element, childContainer } = renderBoxTreeNode(box, options);
    this.#element = element;
    this.#childContainer = childContainer;
  }

  /**
   * @returns {HTMLElement}
   */
  get element() {
    return this.#element;
  }

  /**
   * Creates, attaches, and returns a child box view.
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {{ autoOpen?: boolean }} options
   * @returns {BoxTreeNodeView}
   */
  appendChildBox(box, options = {}) {
    if (!this.#childContainer) {
      throw new Error(
        `box ${box.type} cannot be appended without a child container`,
      );
    }

    const view = new BoxTreeNodeView(box, {
      autoOpen: this.#isOpen() && (options.autoOpen ?? true),
      shallow: true,
    });
    this.#childContainer.appendChild(view.element);
    return view;
  }

  /**
   * Updates this node from newer box data while preserving attached child views.
   * @param {import("isobmff-inspector").ParsedBox} box
   */
  updateBox(box) {
    const { element, childContainer } = renderBoxTreeNode(box, {
      autoOpen: this.#isOpen() && shouldAutoOpenBox(box),
      shallow: true,
    });

    if (this.#childContainer?.firstChild && !childContainer) {
      throw new Error(
        `box ${box.type} cannot preserve children without a child container`,
      );
    }

    if (this.#childContainer && childContainer) {
      while (this.#childContainer.firstChild) {
        childContainer.appendChild(this.#childContainer.firstChild);
      }
    }

    this.#element.replaceWith(element);
    this.#element = element;
    this.#childContainer = childContainer;
  }

  /**
   * @returns {boolean}
   */
  #isOpen() {
    return this.#element instanceof HTMLDetailsElement
      ? this.#element.open
      : false;
  }
}

/**
 * Builds a DOM element for one box and returns the child container created for
 * it, when one exists.
 *
 * Container boxes (with `children`) get a `<details>` so they can be
 * collapsed. Leaf boxes get a flat `<div>`.
 *
 * When `shallow` is true (streaming mode) the children array on the box
 * object is ignored — the caller appends child elements directly into the
 * returned element's child container.
 * @param {import("isobmff-inspector").ParsedBox} box
 * @param {{ autoOpen?: boolean, shallow?: boolean }} options
 * @returns {{ element: HTMLElement, childContainer: HTMLElement | null }}
 */
function renderBoxTreeNode(box, options = {}) {
  const shallow = options.shallow ?? false;
  const displayFields = getDisplayFields(box);
  const hasValues = displayFields.length > 0;
  const hasChildren = !shallow && (box.children?.length ?? 0) > 0;
  const hasContent =
    hasValues || hasChildren || box.description || box.issues?.length;
  const autoOpen = options.autoOpen ?? shouldAutoOpen(box);

  const makeDot = () => {
    if (!box.issues?.length) {
      return null;
    }
    const dot = el("span");
    const isWarnOnly = box.issues.every((i) => i.severity === "warning");
    dot.className = `box-issue-dot${isWarnOnly ? " warn" : ""}`;
    dot.setAttribute("role", "img");
    dot.setAttribute(
      "aria-label",
      isWarnOnly ? "Box has warnings" : "Box has errors",
    );
    return dot;
  };

  const makeHeader = () => {
    const header = el("span", "box-header");
    const typeSpan = el("span", "box-type");
    typeSpan.textContent = box.type;
    header.appendChild(typeSpan);
    if (box.name) {
      const nameSpan = el("span", "box-name");
      nameSpan.textContent = box.name;
      header.appendChild(nameSpan);
    }
    const sizeSpan = el("span", "box-size");
    sizeSpan.textContent = fmtBytes(box.size);
    header.appendChild(sizeSpan);
    const dot = makeDot();
    if (dot) {
      header.appendChild(dot);
    }
    return header;
  };

  const makeBody = () => {
    const body = el("div", "box-body");

    if (box.description) {
      const desc = el("div", "box-desc");
      desc.textContent = box.description;
      body.appendChild(desc);
    }

    if (hasValues) {
      const tbl = /** @type {HTMLTableElement} */ (el("table", "values-table"));
      for (const v of displayFields) {
        const row = tbl.insertRow();
        row.className = "box-value-line";
        const keyCell = row.insertCell();
        renderKeyCell(keyCell, v);
        const valCell = row.insertCell();
        valCell.appendChild(renderValue(v, { box }));
      }
      body.appendChild(tbl);
    }

    if (box.issues?.length) {
      const isWarnOnly = box.issues.every((i) => i.severity === "warning");
      const issueEl = el("div", `issue-list${isWarnOnly ? " warn" : ""}`);
      for (const issue of box.issues) {
        const item = el("div", "issue-item");
        item.textContent = issue.message;
        issueEl.appendChild(item);
      }
      body.appendChild(issueEl);
    }

    return body;
  };

  if (!hasContent && !box.children) {
    const div = el("div", "leaf-box box-node");
    assignBoxNodeMetadata(div, box);
    div.tabIndex = -1;
    const caret = el("span", "box-caret");
    caret.textContent = "";
    caret.style.opacity = "0";
    div.appendChild(caret);
    div.appendChild(makeHeader());
    return { element: div, childContainer: null };
  }

  const det = document.createElement("details");
  det.className = "box-node";
  assignBoxNodeMetadata(det, box);
  det.open = autoOpen;

  const summary = document.createElement("summary");
  summary.className = "box-node-header";
  const caret = el("span", "box-caret");
  caret.setAttribute("aria-hidden", "true");
  summary.appendChild(caret);
  summary.appendChild(makeHeader());
  det.appendChild(summary);

  const childContainer = el("div", "box-children");
  det.appendChild(childContainer);

  if (hasContent) {
    const insertBody = () => {
      if (hasDirectChildWithClass(det, "box-body")) {
        return;
      }
      det.insertBefore(makeBody(), childContainer);
    };

    if (det.open) {
      insertBody();
    } else {
      lazyBoxBodies.set(det, insertBody);
      det.addEventListener(
        "toggle",
        () => {
          if (det.open) {
            openBoxBody(det);
          }
        },
        { once: true },
      );
    }
  }

  if (hasChildren) {
    for (const child of box.children ?? []) {
      childContainer.appendChild(
        new BoxTreeNodeView(child, { shallow: false }).element,
      );
    }
  }

  return { element: det, childContainer };
}

/**
 * @param {HTMLElement} element
 * @param {import("isobmff-inspector").ParsedBox} box
 */
function assignBoxNodeMetadata(element, box) {
  const key = getBoxNodeKey(box);
  if (key) {
    element.dataset.boxKey = key;
  } else {
    delete element.dataset.boxKey;
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {string}
 */
export function getBoxNodeKey(box) {
  const offset = Number(box.offset);
  const size = Number(box.size);
  if (!Number.isFinite(offset) || !Number.isFinite(size)) {
    return "";
  }
  return `${offset}:${size}:${box.type}`;
}

/**
 * Opens a rendered box-node `<details>` and inserts its lazy body if needed.
 * @param {HTMLDetailsElement} details
 */
export function openBoxBody(details) {
  details.open = true;
  const insertBody = lazyBoxBodies.get(details);
  if (!insertBody) {
    return;
  }
  insertBody();
  lazyBoxBodies.delete(details);
}

/**
 * @typedef {import("./pssh/index.js").PsshPreviewField} PsshPreviewField
 */

/**
 * @param {import("isobmff-inspector").ParsedField | PsshPreviewField | null} f
 * @param {{ box?: import("isobmff-inspector").ParsedBox }} [options]
 * @returns {HTMLElement}
 */
function renderValue(f, options = {}) {
  if (f == null) {
    return el("span", "vv-null", "null");
  }

  if ("kind" in f && f.kind === "pssh-preview") {
    return renderPsshPreviewField(f, renderBytesValue);
  }

  if (typeof f !== "object") {
    const s = el("span", typeof f === "string" ? "vv-str" : "vv-num");
    s.textContent = typeof f === "string" ? `"${f}"` : String(f);
    return s;
  }

  const psshSystemIdInfo = getRenderedPsshSystemIdInfo(f, options.box);
  if (psshSystemIdInfo) {
    return renderPsshSystemIdValue(
      psshSystemIdInfo.value,
      psshSystemIdInfo.label,
    );
  }

  switch (f.kind) {
    case "number":
    case "bigint": {
      const s = el("span", "vv-num");
      s.textContent = String(f.value);
      return s;
    }

    case "bytes": {
      return renderBytesValue(f.value, { className: "vv-str" });
    }
    case "string": {
      return renderStringValue(f.value, { className: "vv-str" });
    }

    case "boolean": {
      const s = el("span", "vv-bool");
      s.textContent = String(f.value);
      return s;
    }

    case "null":
      return el("span", "vv-null", "null");

    case "fixed-point": {
      const wrap = el("span", "vv-fp");
      const num = el("span", "vv-fp-val");
      num.textContent = String(f.value);
      const fmt = el("span", "vv-fp-fmt");
      fmt.textContent = ` ${f.format} fixed`;
      if (f.signed === false) {
        fmt.textContent += ", unsigned";
      }
      wrap.appendChild(num);
      wrap.appendChild(fmt);
      return wrap;
    }

    case "date": {
      const wrap = el("div", "vv-date");
      if (f.date) {
        const human = el("span", "vv-date-human");
        human.textContent = f.date;
        wrap.appendChild(human);
      }
      const raw = el("span", "vv-date-raw");
      raw.textContent = `raw ${f.value} · epoch ${f.epoch ?? "??"} · unit ${f.unit ?? "?"}`;
      wrap.appendChild(raw);
      return wrap;
    }

    case "flags": {
      const wrap = el("div", "flags-grid");
      const flags = f.flags ?? [];
      if (!flags.length) {
        wrap.textContent = "—";
        return wrap;
      }
      return renderIncrementalCollection({
        container: wrap,
        itemCount: flags.length,
        itemLabel: "flags",
        appendRange(start, end) {
          for (let index = start; index < end; index++) {
            const flag = flags[index];
            const chip = el("span", `flag-chip${flag.value ? " on" : ""}`);
            chip.textContent = flag.key;
            wrap.appendChild(chip);
          }
        },
      });
    }

    case "bits": {
      const wrap = el("div", "bits-row");
      const bitFields = f.fields ?? [];
      return renderIncrementalCollection({
        container: wrap,
        itemCount: bitFields.length,
        itemLabel: "bit fields",
        appendRange(start, end) {
          for (let index = start; index < end; index++) {
            const b = bitFields[index];
            const part = el("span", "bits-field");
            part.innerHTML = `${esc(b.key)}=<span>${esc(b.value)}</span>`;
            wrap.appendChild(part);
          }
        },
      });
    }

    case "struct": {
      if (f.layout === "matrix-3x3") {
        const grid = el("div", "matrix-grid");
        for (const cell of f.fields ?? []) {
          const c = el("span");
          const value = /** @type {{ value?: unknown }} */ (cell).value;
          c.textContent = value != null ? String(value) : "—";
          grid.appendChild(c);
        }
        return grid;
      }
      if (f.layout === "iso-639-2-t") {
        const lang = (f.fields ?? []).find((x) => x.key === "language");
        const s = el("span", "vv-str");
        const value = lang
          ? /** @type {{ value?: unknown }} */ (lang).value
          : null;
        s.textContent = value != null ? `"${value}"` : "—";
        return s;
      }
      const tbl = /** @type {HTMLTableElement} */ (el("table", "values-table"));
      const structFields = f.fields ?? [];
      return renderIncrementalCollection({
        container: tbl,
        itemCount: structFields.length,
        itemLabel: "fields",
        appendRange(start, end) {
          for (let index = start; index < end; index++) {
            const sf = structFields[index];
            const row = tbl.insertRow();
            renderKeyCell(row.insertCell(), sf);
            row.insertCell().appendChild(renderValue(sf, options));
          }
        },
      });
    }

    case "array": {
      if (!f.items?.length) {
        const s = el("span", "vv-null");
        s.textContent = "[]";
        return s;
      }
      if (
        f.items.length <= VALUE_RENDER_BATCH_SIZE &&
        f.items.every((i) => i.kind === "number" || i.kind === "bigint")
      ) {
        const s = el("span", "vv-num");
        s.textContent = `[${f.items.map((i) => i.value).join(", ")}]`;
        return s;
      }
      const wrap = el("div");
      return renderIncrementalCollection({
        container: wrap,
        itemCount: f.items.length,
        itemLabel: "items",
        appendRange(start, end) {
          for (let index = start; index < end; index++) {
            const item = f.items[index];
            const row = el("div", "arr-item");
            const lbl = el("span", "arr-label");
            lbl.textContent = `[${index}] `;
            row.appendChild(lbl);
            row.appendChild(renderValue(item, options));
            wrap.appendChild(row);
          }
        },
      });
    }
  }
}

/**
 * @param {{
 *   container: HTMLElement,
 *   itemCount: number,
 *   itemLabel: string,
 *   appendRange: (start: number, end: number) => void,
 * }} options
 * @returns {HTMLElement}
 */
function renderIncrementalCollection(options) {
  const { container, itemCount, itemLabel, appendRange } = options;
  if (itemCount <= VALUE_RENDER_BATCH_SIZE) {
    appendRange(0, itemCount);
    return container;
  }

  const wrapper = el("div", "vv-limited-block");
  wrapper.appendChild(container);

  const controls = el("div", "vv-more-controls");
  const button = /** @type {HTMLButtonElement} */ (
    el("button", "vv-more-button")
  );
  button.type = "button";
  const status = el("span", "vv-more-status");
  controls.appendChild(button);
  controls.appendChild(status);
  wrapper.appendChild(controls);

  let renderedCount = 0;

  const updateControls = () => {
    const remainingCount = itemCount - renderedCount;
    if (remainingCount <= 0) {
      controls.remove();
      return;
    }

    const nextBatchSize = Math.min(VALUE_RENDER_BATCH_SIZE, remainingCount);
    button.textContent = `Show ${nextBatchSize} more`;
    status.textContent = `${remainingCount} ${itemLabel} remaining`;
  };

  const renderNextBatch = () => {
    const nextCount = Math.min(
      itemCount,
      renderedCount + VALUE_RENDER_BATCH_SIZE,
    );
    appendRange(renderedCount, nextCount);
    renderedCount = nextCount;
    updateControls();
  };

  button.addEventListener("click", renderNextBatch);
  renderNextBatch();
  return wrapper;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {Array<import("isobmff-inspector").ParsedBoxValue | PsshPreviewField>}
 */
function getDisplayFields(box) {
  /** @type {Array<import("isobmff-inspector").ParsedBoxValue | PsshPreviewField>} */
  const values = [...(box.values ?? [])];
  if (box.type !== "pssh") {
    return values;
  }

  const preview = getPsshPreviewField(box);
  if (preview) {
    values.push(preview);
  }
  return values;
}

/**
 * @param {string} value
 * @param {{ className: string, forceExpanded?: boolean, preserveWhitespace?: boolean }} options
 * @returns {HTMLElement}
 */
function renderStringValue(value, options) {
  const text = `"${value}"`;
  return outputPotentiallyLongString(text, options);
}

/**
 * @param {string} value
 * @param {{ className: string, forceExpanded?: boolean, preserveWhitespace?: boolean }} options
 * @returns {HTMLElement}
 */
function renderBytesValue(value, options) {
  const text = `${value}`;
  return outputPotentiallyLongString(text, options);
}

/**
 * @param {import("isobmff-inspector").ParsedField} field
 * @param {import("isobmff-inspector").ParsedBox | undefined} box
 * @returns {{ value: string, label: string } | null}
 */
function getRenderedPsshSystemIdInfo(field, box) {
  if (
    box?.type !== "pssh" ||
    !("key" in field) ||
    field.key !== "systemID" ||
    !("value" in field) ||
    typeof field.value !== "string"
  ) {
    return null;
  }
  const label = getPsshSystemIdLabel(field.value);
  if (!label) {
    return null;
  }
  return { value: field.value, label };
}

/**
 * @param {string} value
 * @param {string} label
 * @returns {HTMLElement}
 */
function renderPsshSystemIdValue(value, label) {
  const wrap = el("div", "pssh-system-id");
  wrap.appendChild(renderBytesValue(value, { className: "vv-str" }));
  const chip = el("span", "pssh-system-id-label");
  chip.textContent = label;
  wrap.appendChild(chip);
  return wrap;
}

/**
 * @param {string} text
 * @param {{ className: string, forceExpanded?: boolean, preserveWhitespace?: boolean }} options
 * @returns {HTMLElement}
 */
function outputPotentiallyLongString(text, options) {
  if (options.forceExpanded || text.length <= COLLAPSIBLE_TEXT_LIMIT) {
    const s = el(
      "span",
      `${options.className}${options.preserveWhitespace ? " vv-pre" : ""}`,
    );
    s.textContent = text;
    return s;
  }

  const details = document.createElement("details");
  details.className = "vv-collapsible";
  const summary = document.createElement("summary");
  summary.className = "vv-collapsible-summary";
  summary.textContent = `${text.slice(0, COLLAPSIBLE_TEXT_LIMIT)}…`;
  details.appendChild(summary);
  const body = el(
    "div",
    `vv-collapsible-body ${options.className}${options.preserveWhitespace ? " vv-pre" : ""}`,
  );
  body.textContent = text;
  details.appendChild(body);
  return details;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {boolean}
 */
function shouldAutoOpenBox(box) {
  return shouldAutoOpen(box);
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {boolean}
 */
function shouldAutoOpen(box) {
  if (countFields(box.values ?? []) > AUTO_OPEN_FIELD_LIMIT) {
    return false;
  }
  return true;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedField>} fields
 * @returns {number}
 */
function countFields(fields) {
  let count = 0;
  for (const field of fields) {
    count++;
    switch (field.kind) {
      case "array":
        count += countFields(field.items ?? []);
        break;
      case "bits":
        count += field.fields?.length ?? 0;
        break;
      case "struct":
        count += countFields(field.fields ?? []);
        break;
    }
  }
  return count;
}

/**
 * @param {HTMLTableCellElement} cell
 * @param {{ key: string, description?: string }} field
 */
function renderKeyCell(cell, field) {
  cell.className = "vk";

  const key = el("span", "property-key");
  const keyText = el("span", "property-key-text");
  keyText.textContent = field.key;
  key.appendChild(keyText);

  if (field.description) {
    const help = /** @type {HTMLButtonElement} */ (
      el("button", "property-help")
    );
    help.type = "button";
    help.textContent = "i";
    help.setAttribute("aria-label", `${field.key}: ${field.description}`);
    help.setAttribute("aria-describedby", "property-help-tooltip");
    help.dataset.description = field.description;
    help.addEventListener("pointerenter", () => showPropertyTooltip(help));
    help.addEventListener("pointerleave", hidePropertyTooltip);
    help.addEventListener("focus", () => showPropertyTooltip(help));
    help.addEventListener("blur", hidePropertyTooltip);
    help.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") {
        hidePropertyTooltip();
        help.blur();
      }
    });
    key.appendChild(help);
  }

  cell.appendChild(key);
}

/** @type {HTMLButtonElement | null} */
let activeTooltipTarget = null;

/**
 * @returns {HTMLElement}
 */
function getPropertyTooltip() {
  let tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    tooltip = el("div", "property-tooltip");
    tooltip.id = "property-help-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

/**
 * @param {HTMLButtonElement} target
 */
function showPropertyTooltip(target) {
  const description = target.dataset.description;
  if (!description) {
    return;
  }

  activeTooltipTarget = target;
  const tooltip = getPropertyTooltip();
  tooltip.textContent = description;
  tooltip.setAttribute("aria-hidden", "false");
  tooltip.classList.add("is-visible");
  positionPropertyTooltip(target, tooltip);
}

function hidePropertyTooltip() {
  activeTooltipTarget = null;
  const tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    return;
  }
  tooltip.classList.remove("is-visible");
  tooltip.setAttribute("aria-hidden", "true");
}

/**
 * @param {HTMLButtonElement} target
 * @param {HTMLElement} tooltip
 */
function positionPropertyTooltip(target, tooltip) {
  const margin = 8;
  const gap = 14;
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  left = Math.max(
    margin,
    Math.min(left, viewportWidth - tooltipRect.width - margin),
  );

  let top = targetRect.top - tooltipRect.height - gap;
  if (top < margin) {
    top = targetRect.bottom + gap;
  }
  if (top + tooltipRect.height > viewportHeight - margin) {
    top = Math.max(margin, viewportHeight - tooltipRect.height - margin);
  }

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

window.addEventListener("scroll", () => {
  if (!activeTooltipTarget) {
    return;
  }
  const tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    return;
  }
  positionPropertyTooltip(activeTooltipTarget, tooltip);
});

window.addEventListener("resize", () => {
  if (!activeTooltipTarget) {
    return;
  }
  const tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    return;
  }
  positionPropertyTooltip(activeTooltipTarget, tooltip);
});

/**
 * @param {HTMLElement} element
 * @param {string} className
 */
function hasDirectChildWithClass(element, className) {
  for (let childIdx = 0; childIdx < element.children.length; childIdx++) {
    const child = element.children[childIdx];
    if (child.classList.contains(className)) {
      return true;
    }
  }
  return false;
}
