import { el, esc, fmtBytes } from "./utils";

const CHART_COLORS = [
  "#378ADD",
  "#1D9E75",
  "#D85A30",
  "#BA7517",
  "#8B5CF6",
  "#D4537E",
  "#639922",
  "#E24B4A",
  "#888780",
];

const EXCLUDED_SHARE_BOX_TYPES = new Set(["mdat"]);

/** @typedef {"order" | "rank" | "type" | "depth" | "container" | "size" | "filePct" | "nonMdatPct"} SizeSortKey */
/** @typedef {"asc" | "desc"} SortDirection */
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

  container.innerHTML = "";

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
  container.appendChild(summary);

  // Stacked bar
  const bar = el("div", "size-bar");
  sorted.forEach((b, i) => {
    const pct = (Number(b.size ?? 0) / total) * 100;
    const seg = el("div", "size-bar-seg");
    seg.style.width = `${pct}%`;
    seg.style.background = CHART_COLORS[i % CHART_COLORS.length];
    seg.title = `${b.type}: ${fmtBytes(b.size)} (${pct.toFixed(1)}%)`;
    bar.appendChild(seg);
  });
  container.appendChild(bar);

  const scaleNote = el("div", "size-scale-note");
  scaleNote.textContent = showNonMdatShare
    ? "file share is percent of the whole file; excluding mdat is percent of the file after subtracting mdat boxes."
    : "file share is percent of the whole file.";
  container.appendChild(scaleNote);

  // Legend rows
  const legend = el("div", "size-legend");
  container.appendChild(legend);

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
    for (const column of columns) {
      const button = /** @type {HTMLButtonElement} */ (
        el("button", `size-head-btn size-head-${column.key}`)
      );
      button.type = "button";
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
        `size-row${showNonMdatShare ? "" : " size-row-no-excluded"}`,
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
      legend.appendChild(row);
    }
  }

  renderLegend();
}
