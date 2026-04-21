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

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {number} depth
 * @param {WeakMap<import("isobmff-inspector").ParsedBox, string>} colors
 * @param {Array<{ box: import("isobmff-inspector").ParsedBox, depth: number, color: string }>} out
 */
function flattenBoxes(boxes, depth, colors, out) {
  boxes.forEach((box, index) => {
    const color =
      colors.get(box) ?? CHART_COLORS[(depth + index) % CHART_COLORS.length];
    out.push({ box, depth, color });
    if (box.children?.length) {
      flattenBoxes(box.children, depth + 1, colors, out);
    }
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
  /** @type {Array<{ box: import("isobmff-inspector").ParsedBox, depth: number, color: string }>} */
  const rows = [];
  flattenBoxes(boxes, 0, colors, rows);

  container.innerHTML = "";

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

  // Legend rows
  const legend = el("div", "size-legend");
  rows.forEach(({ box: b, depth, color }) => {
    const pct = (Number(b.size ?? 0) / total) * 100;
    const row = el("div", "size-row");
    row.style.setProperty("--box-depth", String(depth));
    row.innerHTML = `
      <span class="size-pct">${pct.toFixed(1)}%</span>
      <div class="size-track"><div class="size-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="size-type">${esc(b.type)}</span>
      <span class="size-depth">${depth === 0 ? "top-level" : `child level ${depth}`}</span>
      <span class="size-bytes">${esc(fmtBytes(b.size))}</span>
    `;
    legend.appendChild(row);
  });
  container.appendChild(legend);
}
