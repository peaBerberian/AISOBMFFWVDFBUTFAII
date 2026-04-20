/**
 * @param {string|number|bigint} s
 */
const esc = (s) => {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(s)));
  return d.innerHTML;
};

/**
 * @param {number} n
 */
function fmtBytes(n) {
  const b = Number(n);
  if (b < 1024) {
    return `${b} B`;
  }
  if (b < 1_048_576) {
    return `${(b / 1024).toFixed(1)} KB`;
  }
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

/**
 * @param {string} tag
 * @param {string=} cls
 * @param {string=} html
 * @returns {HTMLElement}
 */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) {
    e.className = cls;
  }
  if (html) {
    e.innerHTML = html;
  }
  return e;
}

/**
 * @param {import("isobmff-inspector").ParsedField | null} f
 * @returns {HTMLElement}
 */
function renderValue(f) {
  if (f == null) {
    return el("span", "vv-null", "null");
  }

  // Primitive shortcut (shouldn't happen in full format but guard anyway)
  if (typeof f !== "object") {
    const s = el("span", typeof f === "string" ? "vv-str" : "vv-num");
    s.textContent = typeof f === "string" ? `"${f}"` : String(f);
    return s;
  }

  switch (f.kind) {
    case "number":
    case "bigint": {
      const s = el("span", "vv-num");
      s.textContent = String(f.value);
      return s;
    }

    case "string": {
      const s = el("span", "vv-str");
      s.textContent = `"${f.value}"`;
      return s;
    }

    case "boolean": {
      const s = el("span", "vv-bool");
      s.textContent = String(f.value);
      return s;
    }

    case "null": {
      return el("span", "vv-null", "null");
    }

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
      for (const flag of f.flags ?? []) {
        const chip = el("span", `flag-chip${flag.value ? " on" : ""}`);
        chip.textContent = flag.key;
        wrap.appendChild(chip);
      }
      if (!f.flags?.length) {
        wrap.textContent = "—";
      }
      return wrap;
    }

    case "bits": {
      const wrap = el("div", "bits-row");
      for (const b of f.fields ?? []) {
        const part = el("span", "bits-field");
        part.innerHTML = `${esc(b.key)}=<span>${esc(b.value)}</span>`;
        wrap.appendChild(part);
      }
      return wrap;
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
      // Generic struct → nested table
      const tbl = /** @type {HTMLTableElement} */ (el("table", "values-table"));
      for (const sf of f.fields ?? []) {
        const row = tbl.insertRow();
        row.insertCell().className = "vk";
        row.cells[0].textContent = sf.key;
        row.insertCell().appendChild(renderValue(sf));
      }
      return tbl;
    }

    case "array": {
      if (!f.items?.length) {
        const s = el("span", "vv-null");
        s.textContent = "[]";
        return s;
      }
      // Fast path: all numeric → single line
      if (f.items.every((i) => i.kind === "number" || i.kind === "bigint")) {
        const s = el("span", "vv-num");
        s.textContent = `[${f.items.map((i) => i.value).join(", ")}]`;
        return s;
      }
      const wrap = el("div");
      f.items.forEach((item, idx) => {
        const row = el("div", "arr-item");
        const lbl = el("span", "arr-label");
        lbl.textContent = `[${idx}] `;
        row.appendChild(lbl);
        row.appendChild(renderValue(item));
        wrap.appendChild(row);
      });
      return wrap;
    }
  }
}

/**
 * Builds a DOM element for one box.
 * Container boxes (with `children`) get a `<details>` so they can be
 * collapsed. Leaf boxes get a flat `<div>`.
 *
 * When `shallow` is true (streaming mode) the children array on the box
 * object is ignored — the caller appends child elements directly into the
 * returned element's child container.
 * @param {import("isobmff-inspector").ParsedBox} box
 */
export function buildBoxEl(box, shallow = false) {
  const hasValues = box.values?.length > 0;
  const hasChildren = !shallow && box.children?.length > 0;
  const hasContent =
    hasValues || hasChildren || box.description || box.issues?.length;

  // Issue indicator dot
  const makeDot = () => {
    if (!box.issues?.length) {
      return null;
    }
    const dot = el("span");
    const isWarnOnly = box.issues.every((i) => i.severity === "warning");
    dot.className = `box-issue-dot${isWarnOnly ? " warn" : ""}`;
    return dot;
  };

  // Header content (shared between <summary> and flat <div>)
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

  // Body: description + values table + issues
  const makeBody = () => {
    const body = el("div", "box-body");

    if (box.description) {
      const desc = el("div", "box-desc");
      desc.textContent = box.description;
      body.appendChild(desc);
    }

    if (hasValues) {
      const tbl = /** @type {HTMLTableElement} */ (el("table", "values-table"));
      for (const v of box.values) {
        const row = tbl.insertRow();
        row.className = "box-value-line";
        const keyCell = row.insertCell();
        keyCell.className = "vk";
        keyCell.textContent = v.key;
        if (v.description) {
          keyCell.title = v.description;
        }
        const valCell = row.insertCell();
        valCell.appendChild(renderValue(v));
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
    const div = el("div", "leaf-box");
    const caret = el("span", "box-caret");
    caret.textContent = "";
    caret.style.opacity = "0";
    div.appendChild(caret);
    div.appendChild(makeHeader());
    return div;
  }

  const det = document.createElement("details");
  det.open = true;

  const summary = document.createElement("summary");
  const caret = el("span", "box-caret");
  caret.setAttribute("aria-hidden", "true");
  summary.appendChild(caret);
  summary.appendChild(makeHeader());
  det.appendChild(summary);

  if (hasContent) {
    det.appendChild(makeBody());
  }

  // Child container — in streaming mode the caller appends into this div
  const childWrap = el("div", "box-children");
  det.appendChild(childWrap);

  // Non-streaming: populate children immediately
  if (hasChildren) {
    for (const child of box.children) {
      childWrap.appendChild(buildBoxEl(child, false));
    }
  }

  return det;
}

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
export function renderSizeChart(boxes) {
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

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} [arr=[]]
 */
export default function render(arr = []) {
  const wrapper = document.getElementById("file-description");
  wrapper.innerHTML = "";
  for (const box of arr) {
    wrapper.appendChild(buildBoxEl(box, false));
  }
}
