import { openBoxBody } from "../tree/index.js";

const highlightedTreeRows = new WeakMap();

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
 * @param {PointerEvent} evt
 * @returns {number | null}
 */
export function getByteOffsetFromPointerEvent(evt) {
  const element = document.elementFromPoint(evt.clientX, evt.clientY);
  return getClosestByteOffset(element, evt.clientX, evt.clientY);
}

/**
 * @param {HTMLElement} treeRoot
 * @param {IndexedFieldSpan} activeField
 * @param {{ block?: ScrollLogicalPosition, highlight?: boolean, strategy?: "default" | "reveal" }} [options]
 */
export function ensureSelectedTreeFieldVisible(
  treeRoot,
  activeField,
  options = {},
) {
  const boxNode = findBoxNodeByKey(treeRoot, activeField.boxKey);
  if (!boxNode) {
    return;
  }

  openAncestorBoxes(boxNode);
  if (boxNode instanceof HTMLDetailsElement) {
    openBoxBody(boxNode);
  }

  const fieldElement = findBoxFieldElement(boxNode, activeField.id);
  if (fieldElement) {
    if (options.strategy === "reveal") {
      revealTreeRow(boxNode, fieldElement);
    } else {
      fieldElement.scrollIntoView({ block: options.block ?? "nearest" });
    }
    if (options.highlight) {
      highlightTreeRow(fieldElement);
    }
    return;
  }

  const fallbackTarget = getBoxNodeHeader(boxNode);
  if (!fallbackTarget) {
    return;
  }
  fallbackTarget.scrollIntoView({ block: options.block ?? "nearest" });
  if (options.highlight) {
    highlightTreeRow(fallbackTarget);
  }
}

/**
 * @param {unknown} target
 * @param {number} clientX
 * @param {number} clientY
 * @returns {number | null}
 */
function getClosestByteOffset(target, clientX, clientY) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const cell = target.closest(".byte-cell");
  if (!(cell instanceof HTMLElement)) {
    const row = findCandidateByteRow(target, clientY);
    if (!row) {
      return null;
    }
    const strip = findCandidateByteStrip(row, target, clientX);
    if (!strip) {
      return null;
    }
    return getClosestByteOffsetInStrip(strip, clientX);
  }
  const value = Number(cell.dataset.byteOffset);
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {HTMLElement} target
 * @param {number} clientY
 * @returns {HTMLElement | null}
 */
function findCandidateByteRow(target, clientY) {
  const ownRow = target.closest(".byte-row");
  if (
    ownRow instanceof HTMLElement &&
    !ownRow.classList.contains("byte-gap-row")
  ) {
    return ownRow;
  }

  const scrollRoot = target.closest(".byte-scroll");
  if (!(scrollRoot instanceof HTMLElement)) {
    return null;
  }

  const rows = scrollRoot.getElementsByClassName("byte-row");
  /** @type {HTMLElement | null} */
  let bestRow = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (
      !(row instanceof HTMLElement) ||
      row.classList.contains("byte-gap-row")
    ) {
      continue;
    }
    const rect = row.getBoundingClientRect();
    const distance =
      clientY < rect.top
        ? rect.top - clientY
        : clientY > rect.bottom
          ? clientY - rect.bottom
          : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRow = row;
    }
  }

  return bestDistance <= 6 ? bestRow : null;
}

/**
 * @param {HTMLElement} row
 * @param {HTMLElement} target
 * @param {number} clientX
 * @returns {HTMLElement | null}
 */
function findCandidateByteStrip(row, target, clientX) {
  const ownStrip = target.closest(".byte-hex, .byte-ascii");
  if (ownStrip instanceof HTMLElement) {
    return ownStrip;
  }

  const children = row.children;
  /** @type {HTMLElement | null} */
  let bestStrip = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (
      !(child instanceof HTMLElement) ||
      (!child.classList.contains("byte-hex") &&
        !child.classList.contains("byte-ascii"))
    ) {
      continue;
    }
    const rect = child.getBoundingClientRect();
    const distance =
      clientX < rect.left
        ? rect.left - clientX
        : clientX > rect.right
          ? clientX - rect.right
          : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStrip = child;
    }
  }

  return bestDistance === 0 ? bestStrip : null;
}

/**
 * @param {HTMLElement} strip
 * @param {number} clientX
 * @returns {number | null}
 */
function getClosestByteOffsetInStrip(strip, clientX) {
  const cells = strip.getElementsByClassName("byte-cell");
  let bestOffset = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index];
    if (!(cell instanceof HTMLElement)) {
      continue;
    }
    const value = Number(cell.dataset.byteOffset);
    if (!Number.isFinite(value)) {
      continue;
    }
    const rect = cell.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const distance = Math.abs(clientX - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = value;
    }
  }

  return bestOffset;
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
 * @param {HTMLElement} boxNode
 * @param {string} fieldId
 * @returns {HTMLElement | null}
 */
function findBoxFieldElement(boxNode, fieldId) {
  const rows = boxNode.getElementsByClassName("box-value-line");
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row instanceof HTMLElement && row.dataset.byteFieldId === fieldId) {
      return row;
    }
  }

  const boxTypes = boxNode.getElementsByClassName("box-type");
  for (let index = 0; index < boxTypes.length; index++) {
    const boxType = boxTypes[index];
    if (
      boxType instanceof HTMLElement &&
      boxType.dataset.byteFieldId === fieldId
    ) {
      return boxType;
    }
  }

  const boxSizes = boxNode.getElementsByClassName("box-size");
  for (let index = 0; index < boxSizes.length; index++) {
    const boxSize = boxSizes[index];
    if (
      boxSize instanceof HTMLElement &&
      boxSize.dataset.byteFieldId === fieldId
    ) {
      return boxSize;
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

/**
 * @param {HTMLElement} row
 */
function highlightTreeRow(row) {
  const previousTimeout = highlightedTreeRows.get(row);
  if (previousTimeout !== undefined) {
    clearTimeout(previousTimeout);
  }
  row.classList.remove("is-byte-view-reveal-target");
  void row.offsetWidth;
  row.classList.add("is-byte-view-reveal-target");
  const timeoutId = window.setTimeout(() => {
    row.classList.remove("is-byte-view-reveal-target");
    highlightedTreeRows.delete(row);
  }, 1800);
  highlightedTreeRows.set(row, timeoutId);
}

/**
 * @param {HTMLElement} boxNode
 * @param {HTMLElement} row
 */
function revealTreeRow(boxNode, row) {
  const header = getBoxNodeHeader(boxNode);
  if (!header) {
    row.scrollIntoView({ block: "start" });
    return;
  }

  header.scrollIntoView({ block: "start" });
  if (isRowStartClearlyVisible(header, row)) {
    return;
  }
  row.scrollIntoView({ block: "start" });
}

/**
 * @param {HTMLElement} boxNode
 * @returns {HTMLElement | null}
 */
function getBoxNodeHeader(boxNode) {
  if (boxNode instanceof HTMLDetailsElement) {
    const summary = boxNode.firstElementChild;
    return summary instanceof HTMLElement ? summary : null;
  }
  return boxNode;
}

/**
 * @param {HTMLElement} header
 * @param {HTMLElement} row
 * @returns {boolean}
 */
function isRowStartClearlyVisible(header, row) {
  const headerRect = header.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  return (
    rowRect.top >= headerRect.bottom && rowRect.top <= window.innerHeight - 40
  );
}
