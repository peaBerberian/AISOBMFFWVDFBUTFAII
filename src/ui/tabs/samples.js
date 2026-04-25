import deriveMediaInfo, {
  getSampleKindTitle,
} from "../../post-process/index.js";
import { el, requireElementById } from "../../utils/dom.js";
import { numberFormat } from "../../utils/format.js";
import { fmtBytes } from "./utils.js";

const DEFAULT_SAMPLE_COUNT = 200;
const MAX_RENDERED_SAMPLE_COUNT = 5000;
/**
 * @typedef {keyof Pick<
 *   import("../../post-process/index.js").SampleRow,
 *   | "index"
 *   | "dts"
 *   | "pts"
 *   | "duration"
 *   | "size"
 *   | "isSync"
 *   | "sampleDependsOn"
 *   | "sampleIsDependedOn"
 *   | "sampleHasRedundancy"
 *   | "kind"
 * >} SampleSortKey
 */
/** @type {{ key: SampleSortKey, label: string, shortLabel?: string, width: string }[]} */
const SAMPLE_COLUMNS = [
  { key: "index", label: "sample", width: "9ch" },
  { key: "dts", label: "dts", width: "18ch" },
  { key: "pts", label: "pts", width: "18ch" },
  { key: "duration", label: "duration", width: "18ch" },
  { key: "size", label: "size", width: "12ch" },
  { key: "isSync", label: "sync", shortLabel: "sync", width: "9ch" },
  {
    key: "sampleDependsOn",
    label: "depends on",
    shortLabel: "dep",
    width: "8ch",
  },
  {
    key: "sampleIsDependedOn",
    label: "depended on",
    shortLabel: "used",
    width: "9ch",
  },
  {
    key: "sampleHasRedundancy",
    label: "redundancy",
    shortLabel: "red",
    width: "8ch",
  },
  { key: "kind", label: "class", width: "14ch" },
];

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @returns {boolean}
 */
export default function renderSampleView(boxes) {
  const container = requireElementById("sample-view", HTMLElement);
  container.innerHTML = "";
  if (!boxes.length) {
    return false;
  }

  const info = deriveMediaInfo(boxes);
  if (!info.sampleViews.length) {
    return false;
  }

  /** @type {{
   *   view: import("../../post-process/index.js").SampleView,
   *   start: number,
   *   count: number,
   *   sortKey: SampleSortKey,
   *   sortDirection: "asc" | "desc",
   *   renderedRows: import("../../post-process/index.js").SampleRow[],
   *   activeRow: import("../../post-process/index.js").SampleRow | null,
   *   previewRow: import("../../post-process/index.js").SampleRow | null,
   * }} */
  const state = {
    view: info.sampleViews[0],
    start: 1,
    count: Math.min(DEFAULT_SAMPLE_COUNT, info.sampleViews[0].totalSamples),
    sortKey: "index",
    sortDirection: "asc",
    renderedRows: [],
    activeRow: null,
    previewRow: null,
  };

  const controls = el("div", "samples-controls");
  const picker = createLabeledControl("source");
  const sourceSelect = /** @type {HTMLSelectElement} */ (el("select"));
  info.sampleViews.forEach((view) => {
    const option = document.createElement("option");
    option.value = view.id;
    option.textContent = view.label;
    sourceSelect.appendChild(option);
  });
  picker.body.appendChild(sourceSelect);
  controls.appendChild(picker.wrap);

  const startControl = createLabeledControl("start");
  const startInput = /** @type {HTMLInputElement} */ (el("input"));
  startInput.type = "number";
  startInput.min = "1";
  startInput.step = "1";
  startControl.body.appendChild(startInput);
  controls.appendChild(startControl.wrap);

  const countControl = createLabeledControl("count");
  const countInput = /** @type {HTMLInputElement} */ (el("input"));
  countInput.type = "number";
  countInput.min = "1";
  countInput.max = String(MAX_RENDERED_SAMPLE_COUNT);
  countInput.step = "1";
  countControl.body.appendChild(countInput);
  controls.appendChild(countControl.wrap);

  const summary = el("div", "samples-summary");
  const tableWrap = el("div", "samples-table-wrap");
  const table = /** @type {HTMLTableElement} */ (el("table", "samples-table"));
  const colgroup = document.createElement("colgroup");
  SAMPLE_COLUMNS.forEach((column) => {
    const col = document.createElement("col");
    col.style.width = column.width;
    colgroup.appendChild(col);
  });
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  SAMPLE_COLUMNS.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    const button = /** @type {HTMLButtonElement} */ (
      el(
        "button",
        `samples-sort-button${isSampleNumericColumn(column.key) ? " is-numeric" : ""}`,
      )
    );
    button.type = "button";
    button.textContent =
      state.sortKey === column.key
        ? `${column.shortLabel ?? column.label} ${state.sortDirection === "asc" ? "↑" : "↓"}`
        : (column.shortLabel ?? column.label);
    button.title = column.label;
    button.setAttribute(
      "aria-label",
      state.sortKey === column.key
        ? `${column.label}, sorted ${state.sortDirection}`
        : `${column.label}, sortable`,
    );
    button.setAttribute(
      "aria-pressed",
      state.sortKey === column.key ? "true" : "false",
    );
    button.addEventListener("click", () => {
      if (state.sortKey === column.key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = column.key;
        state.sortDirection = "asc";
      }
      renderRows();
    });
    th.appendChild(button);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  const tbody = document.createElement("tbody");
  table.appendChild(colgroup);
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  container.appendChild(controls);
  container.appendChild(summary);
  container.appendChild(tableWrap);

  const updateRange = () => {
    state.start = clampInteger(
      startInput.valueAsNumber,
      1,
      Math.max(1, state.view.totalSamples),
      1,
    );
    state.count = clampInteger(
      countInput.valueAsNumber,
      1,
      Math.min(MAX_RENDERED_SAMPLE_COUNT, state.view.totalSamples),
      Math.min(DEFAULT_SAMPLE_COUNT, state.view.totalSamples),
    );
    syncInputs();
    state.activeRow = null;
    state.previewRow = null;
    renderRows();
  };

  const changeView = () => {
    state.view =
      info.sampleViews.find((view) => view.id === sourceSelect.value) ??
      info.sampleViews[0];
    state.start = 1;
    state.count = Math.min(DEFAULT_SAMPLE_COUNT, state.view.totalSamples);
    syncInputs();
    state.activeRow = null;
    state.previewRow = null;
    renderRows();
  };

  sourceSelect.addEventListener("change", changeView);
  startInput.addEventListener("input", updateRange);
  countInput.addEventListener("input", updateRange);

  syncInputs();
  renderRows();
  return true;

  function syncInputs() {
    sourceSelect.value = state.view.id;
    sourceSelect.disabled = info.sampleViews.length === 1;
    startInput.max = String(Math.max(1, state.view.totalSamples));
    startInput.value = String(state.start);
    countInput.max = String(
      Math.min(MAX_RENDERED_SAMPLE_COUNT, state.view.totalSamples),
    );
    countInput.value = String(state.count);
  }

  function renderRows() {
    const rows = state.view.getRows(state.start, state.count);
    const rangeEnd = rows.length
      ? rows[rows.length - 1].index
      : Math.min(state.start, state.view.totalSamples);
    state.renderedRows = sortRows(
      rows,
      state.sortKey,
      state.sortDirection,
      state.renderedRows,
    );
    const tickContexts = createUnknownTickContexts(state.renderedRows);
    const activeRow = state.activeRow;
    const previewRow = state.previewRow;

    if (
      activeRow &&
      !state.renderedRows.some(
        (row) => getSampleRowId(row) === getSampleRowId(activeRow),
      )
    ) {
      state.activeRow = null;
    }
    if (
      previewRow &&
      !state.renderedRows.some(
        (row) => getSampleRowId(row) === getSampleRowId(previewRow),
      )
    ) {
      state.previewRow = null;
    }

    renderSummary(
      summary,
      state.view,
      rangeEnd,
      state.sortKey,
      state.sortDirection,
      state.start,
      tickContexts,
    );
    syncHeaderButtons();
    tbody.replaceChildren(
      ...state.renderedRows.map((row) =>
        renderRow(row, state, state.view.timescale, tickContexts),
      ),
    );
  }

  /**
   * @param {import("../../post-process/index.js").SampleRow | null} row
   */
  function setActiveRow(row) {
    state.activeRow =
      state.activeRow &&
      row &&
      getSampleRowId(state.activeRow) === getSampleRowId(row)
        ? null
        : row;
    syncRowHighlights();
  }

  /**
   * @param {import("../../post-process/index.js").SampleRow | null} row
   */
  function setPreviewRow(row) {
    state.previewRow = row;
    syncRowHighlights();
  }

  function syncRowHighlights() {
    for (let index = 0; index < tbody.rows.length; index++) {
      const row = tbody.rows[index];
      if (!(row instanceof HTMLTableRowElement)) {
        continue;
      }
      const rowId = row.dataset.sampleRowId;
      const isActive =
        rowId != null &&
        state.activeRow != null &&
        rowId === getSampleRowId(state.activeRow);
      const isPreview =
        rowId != null &&
        state.previewRow != null &&
        rowId === getSampleRowId(state.previewRow);
      row.classList.toggle("active", isActive);
      row.classList.toggle("preview", isPreview);
      row.setAttribute("aria-selected", isActive ? "true" : "false");
    }
  }

  function syncHeaderButtons() {
    const buttons = headerRow.getElementsByClassName("samples-sort-button");
    for (let index = 0; index < buttons.length; index++) {
      const button = buttons[index];
      if (!(button instanceof HTMLButtonElement)) {
        continue;
      }
      const column = SAMPLE_COLUMNS[index];
      if (!column) {
        continue;
      }
      const isActive = state.sortKey === column.key;
      button.textContent = isActive
        ? `${column.shortLabel ?? column.label} ${state.sortDirection === "asc" ? "↑" : "↓"}`
        : (column.shortLabel ?? column.label);
      button.title = column.label;
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute(
        "aria-label",
        isActive
          ? `${column.label}, sorted ${state.sortDirection}`
          : `${column.label}, sortable`,
      );
    }
  }

  /**
   * @param {import("../../post-process/index.js").SampleRow} row
   * @param {number | null} timescale
   * @param {UnknownTickContexts} tickContexts
   * @param {{
   *   activeRow: import("../../post-process/index.js").SampleRow | null,
   *   previewRow: import("../../post-process/index.js").SampleRow | null,
   * }} stateRef
   */
  function renderRow(row, stateRef, timescale, tickContexts) {
    const item = document.createElement("tr");
    item.className = "sample-row";
    item.tabIndex = 0;
    item.dataset.sampleRowId = getSampleRowId(row);
    item.setAttribute(
      "aria-label",
      getSampleDetailText(row, timescale, tickContexts),
    );
    item.title = getSampleDetailText(row, timescale, tickContexts);
    const dts = formatTickValue(row.dts, timescale, tickContexts.dts);
    const pts = formatTickValue(row.pts, timescale, tickContexts.pts);
    const duration = formatTickValue(
      row.duration,
      timescale,
      tickContexts.duration,
    );
    const cells = [
      createSampleCell(
        "index",
        numberFormat(row.index),
        undefined,
        "is-numeric is-key",
      ),
      createSampleCell("dts", dts.text, dts.title, "is-numeric"),
      createSampleCell("pts", pts.text, pts.title, "is-numeric"),
      createSampleCell("duration", duration.text, duration.title, "is-numeric"),
      createSampleCell(
        "size",
        row.size != null ? fmtBytes(row.size) : "?",
        row.size != null ? `${numberFormat(row.size)} bytes` : undefined,
        "is-numeric",
      ),
      createSampleCell("isSync", formatBoolean(row.isSync)),
      createSampleCell(
        "sampleDependsOn",
        formatDependencyCode(row.sampleDependsOn),
      ),
      createSampleCell(
        "sampleIsDependedOn",
        formatDependencyCode(row.sampleIsDependedOn),
      ),
      createSampleCell(
        "sampleHasRedundancy",
        formatDependencyCode(row.sampleHasRedundancy),
      ),
      createSampleCell(
        "kind",
        row.kind,
        getSampleKindTitle(row.kind),
        "is-kind",
      ),
    ];
    cells.forEach((cell) => {
      item.appendChild(cell);
    });
    item.addEventListener("click", () => setActiveRow(row));
    item.addEventListener("mouseenter", () => setPreviewRow(row));
    item.addEventListener("mouseleave", () => setPreviewRow(null));
    item.addEventListener("focus", () => setPreviewRow(row));
    item.addEventListener("blur", () => setPreviewRow(null));
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      setActiveRow(row);
    });
    if (
      stateRef.activeRow &&
      getSampleRowId(stateRef.activeRow) === getSampleRowId(row)
    ) {
      item.classList.add("active");
      item.setAttribute("aria-selected", "true");
    }
    if (
      stateRef.previewRow &&
      getSampleRowId(stateRef.previewRow) === getSampleRowId(row)
    ) {
      item.classList.add("preview");
    }
    return item;
  }
}

/**
 * @param {HTMLElement} container
 * @param {import("../../post-process/index.js").SampleView} view
 * @param {number} rangeEnd
 * @param {SampleSortKey} sortKey
 * @param {"asc" | "desc"} sortDirection
 * @param {number} rangeStart
 * @param {UnknownTickContexts} tickContexts
 */
function renderSummary(
  container,
  view,
  rangeEnd,
  sortKey,
  sortDirection,
  rangeStart,
  tickContexts,
) {
  const stats = el("div", "samples-summary-stats");
  stats.appendChild(createSummaryStat("source", view.label));
  stats.appendChild(
    createSummaryStat("total", `${numberFormat(view.totalSamples)} samples`),
  );
  stats.appendChild(
    createSummaryStat(
      "range",
      `${numberFormat(rangeStart)}-${numberFormat(rangeEnd)}`,
    ),
  );
  stats.appendChild(
    createSummaryStat(
      "sort",
      `${getColumnLabel(sortKey)} ${sortDirection === "asc" ? "ascending" : "descending"}`,
    ),
  );
  if (view.timescale) {
    stats.appendChild(
      createSummaryStat("timescale", `${numberFormat(view.timescale)} ticks/s`),
    );
  } else if (
    tickContexts.dts.sharedPrefix ||
    tickContexts.pts.sharedPrefix ||
    tickContexts.duration.sharedPrefix
  ) {
    stats.appendChild(createSummaryStat("ticks", "shared prefixes elided"));
  }
  const note = el("div", "samples-summary-note");
  note.textContent = view.note || "Hover or select a sample to inspect it.";
  container.replaceChildren(stats, note);
}

/**
 * @param {string} label
 * @param {string} value
 */
function createSummaryStat(label, value) {
  const stat = el("div", "samples-stat");
  const title = el("span", "samples-stat-label");
  title.textContent = label;
  const body = el("span", "samples-stat-value");
  body.textContent = value;
  stat.appendChild(title);
  stat.appendChild(body);
  return stat;
}

/**
 * @param {SampleSortKey} column
 * @param {string} value
 * @param {string} [title]
 * @param {string} [extraClassName]
 */
function createSampleCell(column, value, title, extraClassName = "") {
  const td = el(
    "td",
    `sample-cell sample-cell-${column}${extraClassName ? ` ${extraClassName}` : ""}`,
  );
  td.textContent = value;
  if (title) {
    td.title = title;
  }
  return td;
}

/**
 * @param {string} label
 */
function createLabeledControl(label) {
  const wrap = el("label", "samples-control");
  const caption = el("span", "samples-control-label");
  caption.textContent = label;
  const body = el("span", "samples-control-body");
  wrap.appendChild(caption);
  wrap.appendChild(body);
  return { wrap, body };
}

/**
 * @param {SampleSortKey} key
 */
function isSampleNumericColumn(key) {
  return (
    key === "index" ||
    key === "dts" ||
    key === "pts" ||
    key === "duration" ||
    key === "size"
  );
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampInteger(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * @param {boolean | null} value
 */
function formatBoolean(value) {
  if (value == null) {
    return "?";
  }
  return value ? "yes" : "no";
}

/**
 * @param {number | null} value
 */
function formatDependencyCode(value) {
  if (value == null || value === 0) {
    return "?";
  }
  if (value === 1) {
    return "yes";
  }
  if (value === 2) {
    return "no";
  }
  return String(value);
}

/**
 * @param {number} value
 */
function formatSeconds(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }
  if (Math.abs(value) < 1) {
    return `${(value * 1000).toFixed(3)} ms`;
  }
  return `${value.toFixed(Math.abs(value) < 10 ? 3 : 1)} s`;
}

/**
 * @param {number | null} value
 * @param {number | null} timescale
 * @param {UnknownTickContext} unknownTickContext
 */
function formatTickValue(value, timescale, unknownTickContext) {
  if (value == null) {
    return { text: "?", title: undefined };
  }
  if (!timescale) {
    const fullDigits = formatFullInteger(value);
    const strippedValue = stripSharedPrefix(fullDigits, unknownTickContext);
    return {
      text: `${strippedValue} tk`,
      title:
        unknownTickContext.sharedPrefix.length > 0
          ? `${numberFormat(value)} ticks`
          : `${numberFormat(value)} ticks`,
    };
  }
  return {
    text: formatSeconds(value / timescale),
    title: `${numberFormat(value)} ticks (${formatSeconds(value / timescale)})`,
  };
}

/**
 * @param {number} value
 */
function formatFullInteger(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${String(Math.abs(Math.trunc(value)))}`;
}

/**
 * @typedef {{
 *   sharedPrefix: string,
 * }} UnknownTickContext
 *
 * @typedef {{
 *   dts: UnknownTickContext,
 *   pts: UnknownTickContext,
 *   duration: UnknownTickContext,
 * }} UnknownTickContexts
 */

/**
 * @param {import("../../post-process/index.js").SampleRow[]} rows
 * @returns {UnknownTickContexts}
 */
function createUnknownTickContexts(rows) {
  return {
    dts: createUnknownTickContext(rows.map((row) => row.dts)),
    pts: createUnknownTickContext(rows.map((row) => row.pts)),
    duration: createUnknownTickContext(rows.map((row) => row.duration)),
  };
}

/**
 * @param {Array<number | null>} values
 * @returns {UnknownTickContext}
 */
function createUnknownTickContext(values) {
  const digits = values
    .filter((value) => value != null)
    .map((value) => formatFullInteger(value));
  if (digits.length < 2) {
    return { sharedPrefix: "" };
  }
  const sharedPrefix = getSharedPrefix(digits);
  if (sharedPrefix.length < 4) {
    return { sharedPrefix: "" };
  }
  const shortestLength = digits.reduce(
    (min, value) => Math.min(min, value.length),
    digits[0]?.length ?? 0,
  );
  if (sharedPrefix.length >= shortestLength - 2) {
    return { sharedPrefix: "" };
  }
  return { sharedPrefix };
}

/**
 * @param {string} value
 * @param {UnknownTickContext} context
 */
function stripSharedPrefix(value, context) {
  if (!context.sharedPrefix || !value.startsWith(context.sharedPrefix)) {
    return formatUnknownTickFallback(value);
  }
  const stripped = value.slice(context.sharedPrefix.length);
  if (stripped.length <= 8) {
    return `…${stripped}`;
  }
  return `…${stripped.slice(0, 8)}`;
}

/**
 * @param {string} value
 */
function formatUnknownTickFallback(value) {
  if (value.length <= 9) {
    return value;
  }
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * @param {string[]} values
 */
function getSharedPrefix(values) {
  if (!values.length) {
    return "";
  }
  let prefix = values[0] ?? "";
  for (let index = 1; index < values.length && prefix; index++) {
    const candidate = values[index] ?? "";
    let nextLength = 0;
    const limit = Math.min(prefix.length, candidate.length);
    while (nextLength < limit && prefix[nextLength] === candidate[nextLength]) {
      nextLength++;
    }
    prefix = prefix.slice(0, nextLength);
  }
  return prefix;
}

/**
 * @param {SampleSortKey} key
 */
function getColumnLabel(key) {
  return SAMPLE_COLUMNS.find((column) => column.key === key)?.label ?? key;
}

/**
 * @param {import("../../post-process/index.js").SampleRow | null} row
 * @param {number | null} timescale
 * @param {UnknownTickContexts} tickContexts
 */
function getSampleDetailText(row, timescale, tickContexts) {
  if (!row) {
    return "Hover or select a sample to inspect timing, size, and dependency details.";
  }
  const dts = formatTickValue(row.dts, timescale, tickContexts.dts);
  const pts = formatTickValue(row.pts, timescale, tickContexts.pts);
  const duration = formatTickValue(
    row.duration,
    timescale,
    tickContexts.duration,
  );
  return [
    `sample ${numberFormat(row.index)}`,
    `class ${row.kind}`,
    `size ${row.size != null ? fmtBytes(row.size) : "?"}`,
    `dts ${dts.text}`,
    `pts ${pts.text}`,
    `duration ${duration.text}`,
    `sync ${formatBoolean(row.isSync)}`,
    `depends on ${formatDependencyCode(row.sampleDependsOn)}`,
    `depended on ${formatDependencyCode(row.sampleIsDependedOn)}`,
    `redundancy ${formatDependencyCode(row.sampleHasRedundancy)}`,
  ].join(" - ");
}

/**
 * @param {import("../../post-process/index.js").SampleRow[]} rows
 * @param {SampleSortKey} sortKey
 * @param {"asc" | "desc"} sortDirection
 * @param {import("../../post-process/index.js").SampleRow[]} previousRows
 * @returns {import("../../post-process/index.js").SampleRow[]}
 */
function sortRows(rows, sortKey, sortDirection, previousRows) {
  const previousOrder = new Map(
    previousRows.map((row, index) => [getSampleRowId(row), index]),
  );
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const comparison = compareSampleValues(left[sortKey], right[sortKey]);
    if (comparison !== 0) {
      return comparison * direction;
    }
    const leftIndex = previousOrder.get(getSampleRowId(left));
    const rightIndex = previousOrder.get(getSampleRowId(right));
    if (leftIndex != null && rightIndex != null) {
      return leftIndex - rightIndex;
    }
    if (leftIndex != null) {
      return -1;
    }
    if (rightIndex != null) {
      return 1;
    }
    return left.index - right.index;
  });
}

/**
 * @param {string | number | boolean | null} left
 * @param {string | number | boolean | null} right
 */
function compareSampleValues(left, right) {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

/**
 * @param {import("../../post-process/index.js").SampleRow} row
 */
function getSampleRowId(row) {
  return String(row.index);
}
