import {
  getActualBoxSize,
  getAdvertisedBoxSize,
  hasDistinctActualBoxSize,
} from "../../box_size.js";
import { el } from "../../dom.js";
import { fmtBytes } from "../utils.js";
import { getBoxNodeKey, openBoxBody } from "./BoxTreeNodeView.js";

const TREE_MAP_COLORS = [
  "#1F6FB8",
  "#147D64",
  "#B45120",
  "#9A6700",
  "#7445D1",
  "#B83F6A",
  "#5F7F16",
  "#B91C1C",
  "#6F6E69",
];

const EXCLUDED_SHARE_BOX_TYPES = new Set(["mdat"]);
const NARROW_LAYOUT_MEDIA = "(max-width: 760px)";
const MIN_SEGMENT_HEIGHT_PX = 2;
const PANEL_BOTTOM_MARGIN_PX = 12;
const MIN_MAP_HEIGHT_PX = 180;
const NARROW_MAP_HEIGHT_PX = 220;

/** @typedef {"file" | "excluding-mdat"} TreeMapScale */
/**
 * @typedef {{
 *   box: import("isobmff-inspector").ParsedBox,
 *   key: string,
 *   depth: number,
 *   color: string,
 *   path: string,
 *   size: number,
 *   offset: number,
 *   end: number,
 *   headerSize: number,
 *   filePct: number,
 *   nonMdatPct: number,
 *   isNonMdatExcluded: boolean,
 * }} TreeMapRow
 */
/**
 * @typedef {{
 *   row: TreeMapRow,
 *   startPct: number,
 *   heightPct: number,
 *   marker: boolean,
 * }} TreeMapNode
 */

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {HTMLElement} treeRoot
 * @param {AbortSignal} abortSignal
 */
export function renderTreePositionMap(boxes, treeRoot, abortSignal) {
  const rows = flattenBoxes(boxes);
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const showNonMdatShare = rows.some((row) => row.isNonMdatExcluded);
  const layout = ensureTreeMapLayout(treeRoot);
  const { panel, summary, details, viewport, map, treePane, content } = layout;
  const mediaQuery = window.matchMedia(NARROW_LAYOUT_MEDIA);

  summary.innerHTML = "";
  details.textContent = "";
  map.innerHTML = "";
  panel.hidden = rows.length === 0;
  treePane.classList.toggle("tree-pane-with-map", rows.length > 0);
  viewport.hidden = rows.length === 0;
  content.hidden = rows.length === 0;

  abortSignal.addEventListener("abort", () => {
    clearTreeMapState(treeRoot);
  });

  if (rows.length === 0) {
    return;
  }

  /** @type {TreeMapScale} */
  let mapScale =
    showNonMdatShare &&
    rows.some((row) => row.box.type === "mdat" && row.filePct >= 30)
      ? "excluding-mdat"
      : "file";
  let isCollapsed = mediaQuery.matches;
  let currentKey = "";
  /** @type {Array<{ key: string, element: HTMLButtonElement }>} */
  const mapElements = [];

  const controls = el("div", "tree-position-controls");
  summary.appendChild(controls);

  const toggleButton = /** @type {HTMLButtonElement} */ (
    el("button", "tree-position-toggle")
  );
  toggleButton.type = "button";
  controls.appendChild(toggleButton);

  /** @type {HTMLButtonElement[]} */
  const scaleButtons = [];
  if (showNonMdatShare) {
    const scaleToggleButton = createScaleToggleButton();
    scaleButtons.push(scaleToggleButton);
    controls.appendChild(scaleToggleButton);
  }

  /**
   * @returns {HTMLButtonElement}
   */
  function createScaleToggleButton() {
    const button = /** @type {HTMLButtonElement} */ (
      el("button", "tree-position-scale")
    );
    button.type = "button";
    button.addEventListener(
      "click",
      () => {
        mapScale = mapScale === "file" ? "excluding-mdat" : "file";
        renderMap();
        syncUi();
      },
      { signal: abortSignal },
    );
    return button;
  }

  /**
   * @param {boolean} collapsed
   */
  function setCollapsed(collapsed) {
    isCollapsed = collapsed;
    panel.classList.toggle("tree-position-panel-collapsed", collapsed);
    toggleButton.textContent = collapsed ? "↓" : "↑";
    toggleButton.title = collapsed ? "Show ruler" : "Hide ruler";
    toggleButton.setAttribute(
      "aria-label",
      collapsed ? "Show ruler" : "Hide ruler",
    );
    toggleButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggleButton.dataset.state = collapsed ? "collapsed" : "expanded";
    updateMapHeight();
  }

  /**
   * @param {string} key
   */
  function setCurrentKey(key) {
    currentKey = key;
    syncUi();
  }

  function syncUi() {
    const row = rowsByKey.get(currentKey) ?? null;
    details.textContent = row ? getRowDetail(row) : getIdleDetail();
    for (const button of scaleButtons) {
      const isExcludingMdat = mapScale === "excluding-mdat";
      button.textContent = isExcludingMdat ? "+m" : "-m";
      button.title = isExcludingMdat
        ? "Switch to whole file scale"
        : "Switch to scale without mdat";
      button.setAttribute(
        "aria-label",
        isExcludingMdat
          ? "Switch to whole file scale"
          : "Switch to scale without mdat",
      );
      button.setAttribute("aria-pressed", isExcludingMdat ? "true" : "false");
    }

    map.classList.toggle("tree-position-map-with-current", currentKey !== "");

    for (const { key, element } of mapElements) {
      const isCurrent = currentKey !== "" && key === currentKey;
      element.classList.toggle("is-current", isCurrent);
      element.setAttribute("aria-pressed", isCurrent ? "true" : "false");
    }

    syncTreeHighlights(treeRoot, currentKey);
  }

  function renderMap() {
    map.innerHTML = "";
    mapElements.length = 0;

    /** @type {Array<TreeMapNode>} */
    const nodes = [];
    const fileTotal = getFileTotalSize(boxes);
    if (mapScale === "file") {
      for (const row of rows) {
        nodes.push({
          row,
          startPct: row.filePct <= 0 ? 0 : (row.offset / fileTotal) * 100,
          heightPct: row.filePct,
          marker: false,
        });
      }
    } else {
      layoutExcludingMdatNodes(boxes, rowsByKey, 0, 100, nodes);
    }

    const maxDepth = rows.reduce((depth, row) => Math.max(depth, row.depth), 0);
    map.style.setProperty("--tree-map-max-depth", String(maxDepth + 1));

    for (const node of nodes) {
      if (node.heightPct <= 0 && !node.marker) {
        continue;
      }
      const block = /** @type {HTMLButtonElement} */ (
        el(
          "button",
          `tree-position-block${node.marker ? " tree-position-block-marker" : ""}`,
        )
      );
      block.type = "button";
      block.style.setProperty("--tree-map-top", `${node.startPct}%`);
      block.style.setProperty("--tree-map-height", `${node.heightPct}%`);
      block.style.setProperty("--tree-map-depth", String(node.row.depth));
      block.style.setProperty("--tree-map-color", node.row.color);
      block.style.setProperty(
        "--tree-map-min-height",
        `${MIN_SEGMENT_HEIGHT_PX}px`,
      );
      block.dataset.boxKey = node.row.key;
      block.setAttribute("aria-label", getRowDetail(node.row));
      block.title = getRowDetail(node.row);
      block.addEventListener(
        "mouseenter",
        () => {
          setCurrentKey(node.row.key);
        },
        { signal: abortSignal },
      );
      block.addEventListener(
        "focus",
        () => {
          setCurrentKey(node.row.key);
        },
        { signal: abortSignal },
      );
      block.addEventListener(
        "click",
        () => {
          focusTreeNode(treeRoot, node.row.key);
          setCurrentKey(node.row.key);
        },
        { signal: abortSignal },
      );
      map.appendChild(block);
      mapElements.push({ key: node.row.key, element: block });
    }
    updateMapHeight();
  }

  function updateMapHeight() {
    if (mediaQuery.matches) {
      map.style.setProperty(
        "--tree-position-map-height",
        `${NARROW_MAP_HEIGHT_PX}px`,
      );
      return;
    }

    const summaryHeight = summary.offsetHeight;
    const detailsHeight = details.offsetHeight;
    const contentStyle = window.getComputedStyle(content);
    const paddingTop = parseFloat(contentStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(contentStyle.paddingBottom) || 0;
    const rowGap = parseFloat(contentStyle.rowGap || contentStyle.gap) || 0;
    const chromeHeight =
      summaryHeight + detailsHeight + paddingTop + paddingBottom + rowGap;
    const nextHeight = Math.max(
      MIN_MAP_HEIGHT_PX,
      window.innerHeight - 12 - PANEL_BOTTOM_MARGIN_PX - chromeHeight,
    );
    map.style.setProperty(
      "--tree-position-map-height",
      `${Math.floor(nextHeight)}px`,
    );
  }

  toggleButton.addEventListener(
    "click",
    () => {
      setCollapsed(!isCollapsed);
    },
    { signal: abortSignal },
  );

  mediaQuery.addEventListener(
    "change",
    (event) => {
      if (!currentKey) {
        setCollapsed(event.matches);
      }
      updateMapHeight();
    },
    { signal: abortSignal },
  );

  window.addEventListener("resize", updateMapHeight, {
    signal: abortSignal,
  });
  window.addEventListener("scroll", updateMapHeight, {
    signal: abortSignal,
    passive: true,
  });

  treeRoot.addEventListener(
    "mouseover",
    (event) => {
      setCurrentKey(findTreeBoxKey(event.target, treeRoot));
    },
    { signal: abortSignal },
  );

  treeRoot.addEventListener(
    "mouseleave",
    () => {
      setCurrentKey("");
    },
    { signal: abortSignal },
  );

  treeRoot.addEventListener(
    "focusin",
    (event) => {
      setCurrentKey(findTreeBoxKey(event.target, treeRoot));
    },
    { signal: abortSignal },
  );

  treeRoot.addEventListener(
    "focusout",
    (event) => {
      if (!containsNode(treeRoot, event.relatedTarget)) {
        setCurrentKey("");
      }
    },
    { signal: abortSignal },
  );

  treeRoot.addEventListener(
    "click",
    (event) => {
      setCurrentKey(findTreeBoxKey(event.target, treeRoot));
    },
    { signal: abortSignal },
  );

  setCollapsed(isCollapsed);
  renderMap();
  syncUi();
  updateMapHeight();

  abortSignal.addEventListener("abort", () => {
    panel.hidden = true;
    content.hidden = true;
    viewport.hidden = true;
    map.innerHTML = "";
    details.textContent = "";
    treePane.classList.remove("tree-pane-with-map");
    clearTreeMapState(treeRoot);
  });
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {number}
 */
function getFileTotalSize(boxes) {
  let total = 0;
  for (const box of boxes) {
    const end = Number(box.offset ?? 0) + getActualBoxSize(box);
    total = Math.max(total, end);
  }
  if (total > 0) {
    return total;
  }
  return boxes.reduce((sum, box) => sum + getActualBoxSize(box), 0);
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {Array<TreeMapRow>}
 */
function flattenBoxes(boxes) {
  const fileTotal = Math.max(getFileTotalSize(boxes), 1);
  const nonMdatTotal = Math.max(getBoxesTotalSize(boxes, "excluding-mdat"), 1);
  /** @type {Array<TreeMapRow>} */
  const out = [];

  /**
   * @param {Array<import("isobmff-inspector").ParsedBox>} children
   * @param {number} depth
   * @param {string} path
   */
  function visit(children, depth, path = "") {
    children.forEach((box, index) => {
      const size = getActualBoxSize(box);
      const offset = Number(box.offset ?? 0);
      const rowPath = `${path}/${box.type}[${index}]`;
      const key = getBoxNodeKey(box);
      const nonMdatSize = getMapBoxSize(box, "excluding-mdat");
      out.push({
        box,
        key,
        depth,
        color: TREE_MAP_COLORS[(depth + index) % TREE_MAP_COLORS.length],
        path: rowPath,
        size,
        offset,
        end: offset + size,
        headerSize: Number(box.headerSize ?? 0),
        filePct: (size / fileTotal) * 100,
        nonMdatPct: (nonMdatSize / nonMdatTotal) * 100,
        isNonMdatExcluded: EXCLUDED_SHARE_BOX_TYPES.has(box.type),
      });
      if (box.children?.length) {
        visit(box.children, depth + 1, rowPath);
      }
    });
  }

  visit(boxes, 0);
  return out.filter((row) => row.key !== "");
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {Map<string, TreeMapRow>} rowsByKey
 * @param {number} startPct
 * @param {number} parentHeightPct
 * @param {Array<TreeMapNode>} out
 */
function layoutExcludingMdatNodes(
  boxes,
  rowsByKey,
  startPct,
  parentHeightPct,
  out,
) {
  const total = getBoxesTotalSize(boxes, "excluding-mdat");
  let cursor = startPct;
  for (const box of boxes) {
    const row = rowsByKey.get(getBoxNodeKey(box));
    const boxSize = getMapBoxSize(box, "excluding-mdat");
    const heightPct = total > 0 ? (boxSize / total) * parentHeightPct : 0;
    const marker = EXCLUDED_SHARE_BOX_TYPES.has(box.type);
    if (row) {
      out.push({ row, startPct: cursor, heightPct, marker });
    }
    if (box.children?.length && heightPct > 0) {
      layoutExcludingMdatNodes(box.children, rowsByKey, cursor, heightPct, out);
    }
    cursor += heightPct;
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @param {TreeMapScale} scale
 * @returns {number}
 */
function getMapBoxSize(box, scale) {
  const size = getActualBoxSize(box);
  if (scale === "file") {
    return size;
  }
  if (EXCLUDED_SHARE_BOX_TYPES.has(box.type)) {
    return 0;
  }
  return Math.max(0, size - sumExcludedShareBoxes(box.children ?? []));
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {number}
 */
function sumExcludedShareBoxes(boxes) {
  return boxes.reduce((sum, box) => {
    const ownSize = EXCLUDED_SHARE_BOX_TYPES.has(box.type)
      ? getActualBoxSize(box)
      : 0;
    return sum + ownSize + sumExcludedShareBoxes(box.children ?? []);
  }, 0);
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {TreeMapScale} scale
 * @returns {number}
 */
function getBoxesTotalSize(boxes, scale) {
  return boxes.reduce((sum, box) => sum + getMapBoxSize(box, scale), 0);
}

/**
 * @param {TreeMapRow} row
 * @returns {string}
 */
function getRowDetail(row) {
  if (hasDistinctActualBoxSize(row.box)) {
    return `${row.box.type} (${fmtBytes(row.size)} actual, ${fmtBytes(getAdvertisedBoxSize(row.box))} announced)`;
  }
  return `${row.box.type} (${fmtBytes(row.size)})`;
}

/**
 * @returns {string}
 */
function getIdleDetail() {
  return "No box selected";
}

// /**
//  * @param {number} pct
//  * @returns {string}
//  */
// function fmtPct(pct) {
//   if (pct === 0) {
//     return "0%";
//   }
//   if (pct < 0.01) {
//     return "<0.01%";
//   }
//   if (pct < 1) {
//     return `${pct.toFixed(2)}%`;
//   }
//   return `${pct.toFixed(1)}%`;
// }

/**
 * @param {HTMLElement} treeRoot
 * @returns {{
 *   panel: HTMLElement,
 *   summary: HTMLElement,
 *   details: HTMLElement,
 *   viewport: HTMLElement,
 *   map: HTMLElement,
 *   treePane: HTMLElement,
 *   content: HTMLElement,
 * }}
 */
function ensureTreeMapLayout(treeRoot) {
  const parent = treeRoot.parentElement;
  if (!parent) {
    throw new Error("tree root is missing its parent element");
  }

  if (
    parent instanceof HTMLElement &&
    parent.classList.contains("tree-pane-content")
  ) {
    const treePane = parent;
    const layout = treePane.parentElement;
    if (!layout) {
      throw new Error("tree map layout is missing");
    }
    const panel = /** @type {HTMLElement | null} */ (layout.children.item(1));
    if (!panel) {
      throw new Error("tree map panel is missing");
    }
    const summary = /** @type {HTMLElement | null} */ (panel.firstElementChild);
    const content = /** @type {HTMLElement | null} */ (panel.children.item(1));
    const viewport = /** @type {HTMLElement | null} */ (
      content?.firstElementChild
    );
    const map = /** @type {HTMLElement | null} */ (viewport?.firstElementChild);
    const details = /** @type {HTMLElement | null} */ (
      content?.children.item(1)
    );
    if (!summary || !details || !viewport || !map || !content) {
      throw new Error("tree map layout is incomplete");
    }
    return { panel, summary, details, viewport, map, treePane, content };
  }

  const layout = el("div", "tree-pane-layout");
  const treePane = el("div", "tree-pane-content");
  const panel = el("section", "tree-position-panel");
  const summary = el("div", "tree-position-summary");
  const content = el("div", "tree-position-content");
  const viewport = el("div", "tree-position-viewport");
  const map = el("div", "tree-position-map");
  const details = el("div", "tree-position-details");

  map.setAttribute("aria-label", "Tree box position ruler");
  details.setAttribute("aria-live", "polite");
  details.setAttribute("aria-atomic", "true");

  parent.insertBefore(layout, treeRoot);
  layout.appendChild(treePane);
  layout.appendChild(panel);
  treePane.appendChild(treeRoot);
  panel.appendChild(summary);
  panel.appendChild(content);
  content.appendChild(viewport);
  viewport.appendChild(map);
  content.appendChild(details);

  return { panel, summary, details, viewport, map, treePane, content };
}

/**
 * @param {EventTarget | null} target
 * @param {HTMLElement} treeRoot
 * @returns {string}
 */
function findTreeBoxKey(target, treeRoot) {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== treeRoot) {
    if (node.classList.contains("box-node")) {
      return node.dataset.boxKey ?? "";
    }
    node = node.parentElement;
  }
  if (node === treeRoot && treeRoot.classList.contains("box-node")) {
    return treeRoot.dataset.boxKey ?? "";
  }
  return "";
}

/**
 * @param {HTMLElement} treeRoot
 * @param {string} currentKey
 */
function syncTreeHighlights(treeRoot, currentKey) {
  const nodes = treeRoot.getElementsByClassName("box-node");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i);
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    const key = node.dataset.boxKey ?? "";
    const isCurrent = currentKey !== "" && key === currentKey;
    node.classList.toggle("is-map-current", isCurrent);
    node.classList.remove("is-map-active", "is-map-preview");
  }
}

/**
 * @param {HTMLElement} treeRoot
 * @param {string} key
 */
function focusTreeNode(treeRoot, key) {
  const nodes = treeRoot.getElementsByClassName("box-node");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i);
    if (!(node instanceof HTMLElement) || node.dataset.boxKey !== key) {
      continue;
    }
    openAncestorBoxes(node, treeRoot);
    /** @type {HTMLElement} */
    let scrollTarget = node;
    if (node instanceof HTMLDetailsElement) {
      openBoxBody(node);
      const summary = node.firstElementChild;
      if (summary instanceof HTMLElement) {
        scrollTarget = summary;
      }
    }
    scrollTarget.scrollIntoView({ block: "start" });
    try {
      scrollTarget.focus({ preventScroll: true });
    } catch {
      scrollTarget.focus();
    }
    return;
  }
}

/**
 * @param {HTMLElement} node
 * @param {HTMLElement} treeRoot
 */
function openAncestorBoxes(node, treeRoot) {
  let current = node.parentElement;
  while (current && current !== treeRoot) {
    if (current instanceof HTMLDetailsElement) {
      openBoxBody(current);
    }
    current = current.parentElement;
  }
}

/**
 * @param {HTMLElement} treeRoot
 */
function clearTreeMapState(treeRoot) {
  syncTreeHighlights(treeRoot, "");
}

/**
 * @param {HTMLElement} root
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function containsNode(root, target) {
  if (!(target instanceof Node)) {
    return false;
  }
  return root.contains(target);
}
