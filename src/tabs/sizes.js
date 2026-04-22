import { el, esc, fmtBytes } from "./utils";

const CHART_COLORS = [
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
const MAP_MARKER_WIDTH_PX = 4;

/** @typedef {"order" | "rank" | "type" | "depth" | "container" | "size" | "filePct" | "nonMdatPct"} SizeSortKey */
/** @typedef {"asc" | "desc"} SortDirection */
/** @typedef {"file" | "excluding-mdat"} SizeMapScale */
/**
 * @typedef {{
 *   box: import("isobmff-inspector").ParsedBox,
 *   depth: number,
 *   color: string,
 *   path: string,
 *   order: number,
 *   rank: number,
 *   size: number,
 *   filePct: number,
 *   nonMdatPct: number,
 *   container: number,
 *   previousSortIndex: number,
 *   isNonMdatExcluded: boolean,
 * }} SizeRow
 */
/**
 * @typedef {{
 *   row: SizeRow,
 *   depth: number,
 *   startPct: number,
 *   widthPct: number,
 *   marker: boolean,
 * }} SizeMapNode
 */
/**
 * @typedef {{
 *   row: SizeRow,
 *   size: number,
 *   label: string,
 * }} SizeOverviewSegment
 */

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {number} depth
 * @param {WeakMap<import("isobmff-inspector").ParsedBox, string>} colors
 * @param {Array<Omit<SizeRow, "rank" | "size" | "filePct" | "nonMdatPct" | "container" | "previousSortIndex" | "isNonMdatExcluded">>} out
 * @param {string} path
 */
function flattenBoxes(boxes, depth, colors, out, path = "") {
  boxes.forEach((box, index) => {
    const color =
      colors.get(box) ?? CHART_COLORS[(depth + index) % CHART_COLORS.length];
    const boxPath = `${path}/${box.type}[${index}]`;
    out.push({ box, depth, color, path: boxPath, order: out.length + 1 });
    if (box.children?.length) {
      flattenBoxes(box.children, depth + 1, colors, out, boxPath);
    }
  });
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 */
function sumExcludedShareBoxes(boxes) {
  return boxes.reduce((sum, box) => {
    const ownSize = EXCLUDED_SHARE_BOX_TYPES.has(box.type)
      ? Number(box.size ?? 0)
      : 0;
    return sum + ownSize + sumExcludedShareBoxes(box.children ?? []);
  }, 0);
}

/**
 * @param {number} pct
 */
function fmtPct(pct) {
  if (pct === 0) {
    return "0%";
  }
  if (pct < 0.01) {
    return "<0.01%";
  }
  if (pct < 1) {
    return `${pct.toFixed(2)}%`;
  }
  return `${pct.toFixed(1)}%`;
}

/**
 * @param {SizeSortKey} sortKey
 * @param {SortDirection} direction
 * @param {Array<SizeRow>} rows
 */
function sortSizeRows(sortKey, direction, rows) {
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let delta = 0;
    if (sortKey === "type") {
      delta = a.box.type.localeCompare(b.box.type);
    } else if (sortKey === "depth") {
      delta = a.depth - b.depth;
    } else if (sortKey === "container") {
      delta = a.container - b.container;
    } else {
      delta = a[sortKey] - b[sortKey];
    }
    return delta * dir || a.previousSortIndex - b.previousSortIndex;
  });
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {number}
 */
function getBoxSize(box) {
  return Number(box.size ?? 0);
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {number}
 */
function getOwnBoxSize(box) {
  const childrenSize = (box.children ?? []).reduce(
    (sum, child) => sum + getBoxSize(child),
    0,
  );
  return Math.max(0, getBoxSize(box) - childrenSize);
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @param {SizeMapScale} scale
 * @returns {number}
 */
function getMapBoxSize(box, scale) {
  const size = getBoxSize(box);
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
 * @param {SizeMapScale} scale
 */
function getMapTotalSize(boxes, scale) {
  return boxes.reduce((sum, box) => sum + getMapBoxSize(box, scale), 0);
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {WeakMap<import("isobmff-inspector").ParsedBox, SizeRow>} rowsByBox
 * @param {Array<SizeOverviewSegment>} out
 */
function collectOwnSizeSegments(boxes, rowsByBox, out) {
  for (const box of boxes) {
    if (EXCLUDED_SHARE_BOX_TYPES.has(box.type)) {
      continue;
    }
    const row = rowsByBox.get(box);
    const ownSize = getOwnBoxSize(box);
    if (row && ownSize > 0) {
      out.push({
        row,
        size: ownSize,
        label: box.children?.length ? `${box.type} own bytes` : box.type,
      });
    }
    if (box.children?.length) {
      collectOwnSizeSegments(box.children, rowsByBox, out);
    }
  }
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {SizeMapScale} scale
 * @param {WeakMap<import("isobmff-inspector").ParsedBox, SizeRow>} rowsByBox
 * @param {number} depth
 * @param {number} startPct
 * @param {number} parentWidthPct
 * @param {Array<SizeMapNode>} out
 */
function layoutSizeMap(
  boxes,
  scale,
  rowsByBox,
  depth,
  startPct,
  parentWidthPct,
  out,
) {
  const total = getMapTotalSize(boxes, scale);
  let cursor = startPct;
  for (const box of boxes) {
    const row = rowsByBox.get(box);
    const mapSize = getMapBoxSize(box, scale);
    const widthPct = total > 0 ? (mapSize / total) * parentWidthPct : 0;
    const marker =
      scale === "excluding-mdat" && EXCLUDED_SHARE_BOX_TYPES.has(box.type);
    if (row && (widthPct > 0 || marker)) {
      out.push({
        row,
        depth,
        startPct: cursor,
        widthPct,
        marker,
      });
    }
    if (box.children?.length && widthPct > 0) {
      layoutSizeMap(
        box.children,
        scale,
        rowsByBox,
        depth + 1,
        cursor,
        widthPct,
        out,
      );
    }
    cursor += widthPct;
  }
}

/**
 * @param {SizeRow} row
 * @param {boolean} showNonMdatShare
 */
function getRowDetail(row, showNonMdatShare) {
  const details = [
    `${row.path}`,
    `${fmtBytes(row.size)}`,
    `${fmtPct(row.filePct)} of file`,
  ];
  if (showNonMdatShare) {
    details.push(
      row.isNonMdatExcluded
        ? "excluded from excluding mdat scale"
        : `${fmtPct(row.nonMdatPct)} excluding mdat`,
    );
  }
  return details.join(" - ");
}

/**
 * @param {string} title
 */
function createSizeSection(title) {
  const section = /** @type {HTMLDetailsElement} */ (
    el("details", "size-section")
  );
  section.open = true;
  const summary = el("summary", "size-section-title");
  const caret = el("span", "box-caret");
  caret.setAttribute("aria-hidden", "true");
  const label = el("span", "size-section-label");
  label.textContent = title;
  summary.appendChild(caret);
  summary.appendChild(label);
  const body = el("div", "size-section-body");
  section.appendChild(summary);
  section.appendChild(body);
  return { section, body };
}

/**
 * @param {string} label
 * @param {SizeMapScale} scale
 * @param {string} ariaLabel
 */
function createScaleButton(label, scale, ariaLabel) {
  const button = /** @type {HTMLButtonElement} */ (
    el("button", "size-scale-button")
  );
  button.type = "button";
  button.textContent = label;
  button.dataset.scale = scale;
  button.setAttribute("aria-label", ariaLabel);
  return button;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 */
export default function renderSizeChart(boxes) {
  const container = document.getElementById("size-chart");
  if (!container || !boxes.length) {
    return;
  }

  const total = boxes.reduce((s, b) => s + Number(b.size ?? 0), 0) || 1;
  const sorted = [...boxes].sort(
    (a, b) => Number(b.size ?? 0) - Number(a.size ?? 0),
  );
  const colors = new WeakMap();
  sorted.forEach((box, index) => {
    colors.set(box, CHART_COLORS[index % CHART_COLORS.length]);
  });
  /** @type {Array<Omit<SizeRow, "rank" | "size" | "filePct" | "nonMdatPct" | "container" | "previousSortIndex" | "isNonMdatExcluded">>} */
  const flattenedRows = [];
  flattenBoxes(boxes, 0, colors, flattenedRows);
  const rowsBySize = [...flattenedRows].sort((a, b) => {
    const sizeDelta = Number(b.box.size ?? 0) - Number(a.box.size ?? 0);
    return sizeDelta || a.order - b.order;
  });
  const largestBox = sorted[0];
  const largestPct = largestBox ? Number(largestBox.size ?? 0) / total : 0;
  const excludedShareBytes = sumExcludedShareBoxes(boxes);
  const nonMdatTotal = Math.max(0, total - excludedShareBytes);
  const showNonMdatShare = excludedShareBytes > 0 && nonMdatTotal > 0;
  const rankByBox = new WeakMap();
  rowsBySize.forEach((row, index) => {
    rankByBox.set(row.box, index + 1);
  });
  /** @type {Array<SizeRow>} */
  const rows = flattenedRows.map((row) => {
    const size = Number(row.box.size ?? 0);
    const isNonMdatExcluded = EXCLUDED_SHARE_BOX_TYPES.has(row.box.type);
    return {
      ...row,
      rank: rankByBox.get(row.box) ?? row.order,
      size,
      filePct: (size / total) * 100,
      nonMdatPct:
        isNonMdatExcluded || nonMdatTotal === 0
          ? 0
          : (size / nonMdatTotal) * 100,
      container: row.box.children?.length ? 1 : 0,
      previousSortIndex: row.order - 1,
      isNonMdatExcluded,
    };
  });
  const rowsByBox = new WeakMap();
  rows.forEach((row) => {
    rowsByBox.set(row.box, row);
  });
  /** @type {SizeMapScale} */
  let mapScale = "file";
  /** @type {SizeRow | null} */
  let activeMapRow = null;
  /** @type {HTMLButtonElement[]} */
  const scaleButtons = [];

  container.innerHTML = "";

  const overviewSection = createSizeSection("overview");
  container.appendChild(overviewSection.section);
  const summary = el(
    "div",
    `size-summary${showNonMdatShare ? "" : " size-summary-no-excluded"}`,
  );
  summary.innerHTML = `
    <div class="size-stat">
      <span class="size-stat-label">total</span>
      <span class="size-stat-value">${esc(fmtBytes(total))}</span>
    </div>
    <div class="size-stat">
      <span class="size-stat-label">boxes</span>
      <span class="size-stat-value">${flattenedRows.length}</span>
    </div>
    <div class="size-stat">
      <span class="size-stat-label">largest</span>
      <span class="size-stat-value">${largestBox ? `${esc(largestBox.type)} ${fmtPct(largestPct * 100)}` : "n/a"}</span>
    </div>
    ${
      showNonMdatShare
        ? `<div class="size-stat">
      <span class="size-stat-label">excluding mdat</span>
      <span class="size-stat-value">${esc(fmtBytes(nonMdatTotal))}</span>
    </div>`
        : ""
    }
  `;
  overviewSection.body.appendChild(summary);

  const overviewControls = el("div", "size-scale-controls");
  if (showNonMdatShare) {
    const overviewFileScaleButton = createScaleButton(
      "top-level file",
      "file",
      "Show top-level boxes across the whole file",
    );
    const overviewExcludingMdatButton = createScaleButton(
      "metadata breakdown",
      "excluding-mdat",
      "Show non-mdat bytes broken down by box",
    );
    scaleButtons.push(overviewFileScaleButton, overviewExcludingMdatButton);
    overviewControls.appendChild(overviewFileScaleButton);
    overviewControls.appendChild(overviewExcludingMdatButton);
    overviewSection.body.appendChild(overviewControls);
  }

  const bar = el("div", "size-bar");
  bar.setAttribute("aria-hidden", "true");
  overviewSection.body.appendChild(bar);

  const scaleNote = el("div", "size-scale-note");
  scaleNote.textContent = showNonMdatShare
    ? "top-level file shows whole-file composition; metadata breakdown removes mdat and splits the remaining bytes by leaf boxes and container overhead."
    : "metadata breakdown splits file bytes by leaf boxes and container overhead.";
  overviewSection.body.appendChild(scaleNote);

  const mapSection = createSizeSection("ordered box map");
  container.appendChild(mapSection.section);
  const mapWrap = el("div", "size-map-wrap");
  const mapHeader = el("div", "size-map-header");
  const mapControls = el("div", "size-scale-controls");
  if (showNonMdatShare) {
    const mapFileScaleButton = createScaleButton(
      "whole file scale",
      "file",
      "Use whole file scale",
    );
    const mapExcludingMdatButton = createScaleButton(
      "without mdat scale",
      "excluding-mdat",
      "Use scale excluding mdat",
    );
    scaleButtons.push(mapFileScaleButton, mapExcludingMdatButton);
    mapControls.appendChild(mapFileScaleButton);
    mapControls.appendChild(mapExcludingMdatButton);
    mapHeader.appendChild(mapControls);
  }
  mapWrap.appendChild(mapHeader);
  const mapViewport = el("div", "size-map-viewport");
  const map = el("div", "size-map");
  map.setAttribute("aria-label", "Ordered box map");
  mapViewport.appendChild(map);
  mapWrap.appendChild(mapViewport);
  const mapDetails = el("div", "size-map-details");
  mapDetails.setAttribute("aria-live", "polite");
  mapDetails.setAttribute("aria-atomic", "true");
  mapDetails.textContent =
    "Hover or select a box to inspect its size and path.";
  mapWrap.appendChild(mapDetails);
  mapSection.body.appendChild(mapWrap);

  // Legend rows
  const tableSection = createSizeSection("box size table");
  container.appendChild(tableSection.section);
  const legend = el("div", "size-legend");
  legend.setAttribute("role", "grid");
  legend.setAttribute("aria-label", "Box sizes");
  tableSection.body.appendChild(legend);

  /**
   * @param {SizeRow | null} row
   */
  function setActiveMapRow(row) {
    activeMapRow = activeMapRow?.box === row?.box ? null : row;
    renderSizeMap();
    renderLegend();
  }

  /**
   * @param {SizeRow} row
   */
  function isActiveMapRow(row) {
    return activeMapRow?.box === row.box;
  }

  function updateScaleButtons() {
    for (const button of scaleButtons) {
      button.setAttribute(
        "aria-pressed",
        mapScale === button.dataset.scale ? "true" : "false",
      );
    }
  }

  /**
   * @param {SizeMapScale} scale
   */
  function setMapScale(scale) {
    mapScale = scale;
    activeMapRow = null;
    renderOverviewBar();
    renderSizeMap();
    renderLegend();
  }

  for (const button of scaleButtons) {
    button.addEventListener("click", () => {
      const scale = button.dataset.scale;
      if (scale === "file" || scale === "excluding-mdat") {
        setMapScale(scale);
      }
    });
  }

  function renderOverviewBar() {
    updateScaleButtons();
    bar.innerHTML = "";
    /** @type {Array<SizeOverviewSegment>} */
    const segments = [];
    const showOverviewBreakdown =
      mapScale === "excluding-mdat" || !showNonMdatShare;
    if (!showOverviewBreakdown) {
      for (const box of sorted) {
        const row = rowsByBox.get(box);
        if (row) {
          segments.push({ row, size: getBoxSize(box), label: box.type });
        }
      }
    }
    if (showOverviewBreakdown) {
      collectOwnSizeSegments(boxes, rowsByBox, segments);
      segments.sort((a, b) => b.size - a.size || a.row.order - b.row.order);
    }
    const scaleTotal =
      segments.reduce((sum, segment) => sum + segment.size, 0) || 1;
    segments.forEach((segment, i) => {
      const { row, size } = segment;
      if (size <= 0) {
        return;
      }
      const pct = (size / scaleTotal) * 100;
      const seg = el("div", "size-bar-seg");
      seg.style.width = `${pct}%`;
      seg.style.background = row.color ?? CHART_COLORS[i % CHART_COLORS.length];
      seg.title = `${segment.label}: ${fmtBytes(size)} (${pct.toFixed(1)}%)`;
      bar.appendChild(seg);
    });
  }

  function renderSizeMap() {
    updateScaleButtons();
    map.innerHTML = "";
    /** @type {Array<SizeMapNode>} */
    const nodes = [];
    layoutSizeMap(boxes, mapScale, rowsByBox, 0, 0, 100, nodes);
    const maxDepth = nodes.reduce(
      (depth, node) => Math.max(depth, node.depth),
      0,
    );
    map.style.setProperty("--size-map-rows", String(maxDepth + 1));
    map.classList.toggle("size-map-with-selection", activeMapRow !== null);
    for (const node of nodes) {
      const block = /** @type {HTMLButtonElement} */ (
        el(
          "button",
          `size-map-box${node.marker ? " size-map-marker" : ""}${
            isActiveMapRow(node.row) ? " active" : ""
          }`,
        )
      );
      block.type = "button";
      block.title = getRowDetail(node.row, showNonMdatShare);
      block.setAttribute(
        "aria-label",
        getRowDetail(node.row, showNonMdatShare),
      );
      block.setAttribute(
        "aria-pressed",
        isActiveMapRow(node.row) ? "true" : "false",
      );
      block.style.setProperty("--map-color", node.row.color);
      block.style.setProperty("--map-left", `${node.startPct}%`);
      block.style.setProperty("--map-width", `${node.widthPct}%`);
      block.style.setProperty("--map-top", String(node.depth));
      block.style.setProperty("--map-marker-width", `${MAP_MARKER_WIDTH_PX}px`);
      block.innerHTML = `<span>${esc(node.row.box.type)}</span>`;
      block.addEventListener("mouseenter", () => {
        mapDetails.textContent = getRowDetail(node.row, showNonMdatShare);
      });
      block.addEventListener("mouseleave", () => {
        mapDetails.textContent = activeMapRow
          ? getRowDetail(activeMapRow, showNonMdatShare)
          : "Hover or select a box to inspect its size and path.";
      });
      block.addEventListener("focus", () => {
        mapDetails.textContent = getRowDetail(node.row, showNonMdatShare);
      });
      block.addEventListener("blur", () => {
        mapDetails.textContent = activeMapRow
          ? getRowDetail(activeMapRow, showNonMdatShare)
          : "Hover or select a box to inspect its size and path.";
      });
      block.addEventListener("click", () => setActiveMapRow(node.row));
      map.appendChild(block);
    }
    mapDetails.textContent = activeMapRow
      ? getRowDetail(activeMapRow, showNonMdatShare)
      : "Hover or select a box to inspect its size and path.";
  }

  /** @type {{ key: SizeSortKey, label: string, title: string, defaultDirection: SortDirection }[]} */
  const columns = [
    {
      key: "order",
      label: "#",
      title: "Parsed box order in depth-first file order.",
      defaultDirection: "asc",
    },
    {
      key: "rank",
      label: "rank",
      title: "Size rank, with 1 being the largest rendered box.",
      defaultDirection: "asc",
    },
    {
      key: "type",
      label: "box",
      title: "Box type.",
      defaultDirection: "asc",
    },
    {
      key: "depth",
      label: "level",
      title: "Top-level boxes are level 0; child boxes increase from there.",
      defaultDirection: "asc",
    },
    {
      key: "container",
      label: "container",
      title: "Whether this box contains child boxes.",
      defaultDirection: "desc",
    },
    {
      key: "size",
      label: "size",
      title: "Box size in bytes, formatted for display.",
      defaultDirection: "desc",
    },
    {
      key: "filePct",
      label: "file share",
      title: "Percent of the complete file represented by this box.",
      defaultDirection: "desc",
    },
  ];
  if (showNonMdatShare) {
    columns.push({
      key: "nonMdatPct",
      label: "excluding mdat",
      title:
        "Percent of the file after subtracting mdat boxes. mdat rows are excluded from this value.",
      defaultDirection: "desc",
    });
  }

  /** @type {{ key: SizeSortKey, direction: SortDirection }} */
  let sortState = { key: "rank", direction: "asc" };
  /** @type {Array<SizeRow>} */
  let visibleRows = sortSizeRows(sortState.key, sortState.direction, rows);

  function applySort() {
    visibleRows = sortSizeRows(
      sortState.key,
      sortState.direction,
      visibleRows.map((row, index) => ({
        ...row,
        previousSortIndex: index,
      })),
    );
  }

  function renderLegend() {
    legend.innerHTML = "";
    const header = el(
      "div",
      `size-row size-row-head${showNonMdatShare ? "" : " size-row-no-excluded"}`,
    );
    header.setAttribute("role", "row");
    for (const column of columns) {
      const button = /** @type {HTMLButtonElement} */ (
        el("button", `size-head-btn size-head-${column.key}`)
      );
      button.type = "button";
      button.setAttribute("role", "columnheader");
      button.title = column.title;
      button.dataset.sort = column.key;
      button.textContent =
        sortState.key === column.key
          ? `${column.label} ${sortState.direction === "asc" ? "↑" : "↓"}`
          : column.label;
      button.setAttribute(
        "aria-pressed",
        sortState.key === column.key ? "true" : "false",
      );
      button.addEventListener("click", () => {
        sortState =
          sortState.key === column.key
            ? {
                key: column.key,
                direction: sortState.direction === "asc" ? "desc" : "asc",
              }
            : { key: column.key, direction: column.defaultDirection };
        applySort();
        renderLegend();
      });
      header.appendChild(button);
    }
    legend.appendChild(header);

    for (const rowData of visibleRows) {
      const { box: b, depth, color, path } = rowData;
      const row = el(
        "div",
        `size-row${showNonMdatShare ? "" : " size-row-no-excluded"}${
          isActiveMapRow(rowData) ? " active" : ""
        }`,
      );
      row.tabIndex = 0;
      row.setAttribute("role", "row");
      row.setAttribute("aria-label", getRowDetail(rowData, showNonMdatShare));
      row.setAttribute(
        "aria-selected",
        isActiveMapRow(rowData) ? "true" : "false",
      );
      row.title = path;
      row.style.setProperty("--box-color", color);
      row.style.setProperty(
        "--file-width",
        `${Math.max(0, Math.min(100, rowData.filePct))}%`,
      );
      row.style.setProperty(
        "--non-mdat-width",
        `${Math.max(0, Math.min(100, rowData.nonMdatPct))}%`,
      );
      row.innerHTML = `
      <span class="size-order">${rowData.order}</span>
      <span class="size-rank">${rowData.rank}</span>
      <span class="size-type">${esc(b.type)}</span>
      <span class="size-depth">${depth === 0 ? "top-level" : `child level ${depth}`}</span>
      <span class="size-container">${rowData.container ? "yes" : "no"}</span>
      <span class="size-bytes">${esc(fmtBytes(b.size))}</span>
      <div class="size-scale-cell size-scale-file">
        <span class="size-scale-kind">file share</span>
        <span class="size-pct">${fmtPct(rowData.filePct)}</span>
        <div class="size-track size-track-file"><div class="size-fill"></div></div>
      </div>
      ${
        showNonMdatShare
          ? `<div class="size-scale-cell size-scale-non-mdat${rowData.isNonMdatExcluded ? " size-scale-excluded" : ""}">
        <span class="size-scale-kind">excluding mdat</span>
        <span class="size-pct">${rowData.isNonMdatExcluded ? "excluded" : fmtPct(rowData.nonMdatPct)}</span>
        <div class="size-track size-track-non-mdat"><div class="size-fill"></div></div>
      </div>`
          : ""
      }
    `;
      for (const cell of Array.from(row.children)) {
        cell.setAttribute("role", "gridcell");
      }
      row.addEventListener("click", () => setActiveMapRow(rowData));
      row.addEventListener("keydown", (evt) => {
        if (evt.key !== "Enter" && evt.key !== " ") {
          return;
        }
        evt.preventDefault();
        setActiveMapRow(rowData);
      });
      legend.appendChild(row);
    }
  }

  renderOverviewBar();
  renderSizeMap();
  renderLegend();
}
