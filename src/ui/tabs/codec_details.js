import { el, requireElementById } from "../../utils/dom.js";
import { numberFormat } from "../../utils/format.js";

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {{
 *   supplementalBoxes?: Array<import("isobmff-inspector").ParsedBox> | null,
 *   results?: Array<any> | null,
 *   remoteDeferredAnalysisAction?: {
 *     state: {
 *       available: boolean,
 *       blockedReason: string | null,
 *       pendingTrackCount: number,
 *       pendingSampleCount: number,
 *       recoveredSampleCount: number,
 *     },
 *     run: () => Promise<{
 *       state: {
 *         available: boolean,
 *         blockedReason: string | null,
 *         pendingTrackCount: number,
 *         pendingSampleCount: number,
 *         recoveredSampleCount: number,
 *       },
 *       results: Array<any>,
 *     } | null>,
 *   } | null,
 * }} [options]
 * @returns {boolean}
 */
export default function renderCodecDetails(boxes, options = {}) {
  const container = requireElementById("codec-details", HTMLElement);
  container.replaceChildren();
  if (!boxes.length) {
    return false;
  }

  let results = options.results ?? [];
  if (!results.length) {
    return false;
  }

  const state = { result: results[0] };
  const controls = el("div", "samples-controls");
  const picker = createLabeledControl("track");
  const sourceSelect = /** @type {HTMLSelectElement} */ (el("select"));
  for (const result of results) {
    const option = document.createElement("option");
    option.value = result.trackLabel;
    option.textContent = result.title;
    sourceSelect.appendChild(option);
  }
  picker.body.appendChild(sourceSelect);
  controls.appendChild(picker.wrap);
  const remoteActionState = {
    busy: false,
    error: "",
    action: options.remoteDeferredAnalysisAction ?? null,
  };
  const deferredAction = createDeferredActionControl();
  controls.appendChild(deferredAction.wrap);

  const summary = el("div", "codec-summary");
  const content = el("div", "codec-content");
  container.appendChild(controls);
  container.appendChild(summary);
  container.appendChild(content);

  sourceSelect.addEventListener("change", () => {
    state.result =
      results.find((result) => result.trackLabel === sourceSelect.value) ??
      results[0];
    render();
  });

  render();
  return true;

  async function triggerDeferredAnalysis() {
    if (!remoteActionState.action || remoteActionState.busy) {
      return;
    }
    remoteActionState.busy = true;
    remoteActionState.error = "";
    render();
    try {
      const next = await remoteActionState.action.run();
      if (!next) {
        return;
      }
      results = next.results;
      remoteActionState.action = {
        ...remoteActionState.action,
        state: next.state,
      };
      state.result =
        results.find(
          (result) => result.trackLabel === state.result.trackLabel,
        ) ?? results[0];
    } catch (err) {
      remoteActionState.error =
        err instanceof Error ? err.message : String(err);
    } finally {
      remoteActionState.busy = false;
      render();
    }
  }

  function render() {
    sourceSelect.value = state.result.trackLabel;
    sourceSelect.disabled = results.length === 1;
    updateDeferredActionControl(
      deferredAction,
      state.result,
      remoteActionState,
      triggerDeferredAnalysis,
    );
    summary.replaceChildren(renderSummary(state.result));
    content.replaceChildren();
    const merged = mergeDetailItems(state.result);
    appendIfPresent(
      content,
      renderFactGridSection("Overview", state.result.overviewFacts),
    );
    appendIfPresent(
      content,
      renderFactGridSection("Sample Analysis", state.result.sampleFacts),
    );
    appendIfPresent(
      content,
      renderSequenceSection(
        state.result.sampleSequence,
        state.result.codecFamily,
      ),
    );
    appendIfPresent(content, renderNalTypesSection(state.result.nalTypes));
    appendIfPresent(content, renderFactsSection("Details", merged.details));
    appendIfPresent(content, renderFactsSection("Issues", merged.issues, true));
  }
}

/**
 * @param {HTMLElement} parent
 * @param {HTMLElement | null} child
 */
function appendIfPresent(parent, child) {
  if (child) {
    parent.appendChild(child);
  }
}

/**
 * @param {{
 *   title: string,
 *   codecLabel: string,
 *   description: string
 * }} result
 */
function renderSummary(result) {
  const wrap = el("div", "info-summary");
  addStat(wrap, "track", result.title);
  addStat(wrap, "codec", result.codecLabel);
  addStat(wrap, "focus", result.description);
  return wrap;
}

function createDeferredActionControl() {
  const wrap = el("div", "codec-deferred-action");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "codec-deferred-button";
  const status = el("div", "codec-deferred-status");
  wrap.appendChild(button);
  wrap.appendChild(status);
  return { wrap, button, status };
}

/**
 * @param {{ wrap: HTMLElement, button: HTMLButtonElement, status: HTMLElement }} control
 * @param {any} result
 * @param {{
 *   busy: boolean,
 *   error: string,
 *   action: {
 *     state: {
 *       available: boolean,
 *       blockedReason: string | null,
 *       pendingTrackCount: number,
 *       pendingSampleCount: number,
 *       recoveredSampleCount: number,
 *     },
 *     run: () => Promise<{ state: any, results: Array<any> } | null>,
 *   } | null,
 * }} remoteActionState
 * @param {() => void} onClick
 */
function updateDeferredActionControl(
  control,
  result,
  remoteActionState,
  onClick,
) {
  const action = remoteActionState.action;
  const shouldShow =
    action &&
    (result.canDeepenPayloadRemotely ||
      Boolean(remoteActionState.error) ||
      Boolean(action.state.blockedReason));
  control.wrap.hidden = !shouldShow;
  if (!shouldShow || !action) {
    return;
  }

  control.button.disabled =
    remoteActionState.busy || !result.canDeepenPayloadRemotely;
  control.button.textContent = remoteActionState.busy
    ? "Fetching byte ranges..."
    : "Deepen payload analysis";
  control.button.onclick = onClick;

  if (remoteActionState.error) {
    control.status.textContent = remoteActionState.error;
    control.status.className =
      "codec-deferred-status codec-deferred-status-warn";
    return;
  }
  if (action.state.blockedReason) {
    control.status.textContent = action.state.blockedReason;
    control.status.className =
      "codec-deferred-status codec-deferred-status-warn";
    return;
  }
  if (remoteActionState.busy) {
    control.status.textContent = `Fetching up to ${numberFormat(action.state.pendingSampleCount)} deferred sample range(s) from the remote resource.`;
    control.status.className = "codec-deferred-status";
    return;
  }
  const trackCount = numberFormat(action.state.pendingTrackCount);
  const sampleCount = numberFormat(action.state.pendingSampleCount);
  const recoveredCount = numberFormat(action.state.recoveredSampleCount);
  control.status.textContent =
    action.state.recoveredSampleCount > 0
      ? `${recoveredCount} sample range(s) already recovered; ${sampleCount} deferred range(s) remain across ${trackCount} track(s).`
      : `${sampleCount} deferred sample range(s) remain across ${trackCount} track(s).`;
  control.status.className = "codec-deferred-status";
}

/**
 * @param {string} title
 * @param {string[]} items
 * @param {boolean} [warn=false]
 * @returns {HTMLElement | null}
 */
function renderFactsSection(title, items, warn = false) {
  if (!items.length) {
    return null;
  }
  const section = createSection(title);
  const list = el("ul", warn ? "codec-list codec-list-warn" : "codec-list");
  for (const itemText of items) {
    const item = document.createElement("li");
    item.textContent = itemText;
    list.appendChild(item);
  }
  section.body.appendChild(list);
  return section.section;
}

/**
 * @param {string} title
 * @param {Array<{ label: string, value: string, note: string | null }>} facts
 * @returns {HTMLElement | null}
 */
function renderFactGridSection(title, facts) {
  if (!facts.length) {
    return null;
  }
  const section = createSection(title);
  const grid = el("div", "codec-fact-grid");
  for (const fact of facts) {
    const card = el("div", "codec-fact-card");
    const label = el("div", "codec-fact-label");
    label.textContent = fact.label;
    const value = el("div", "codec-fact-value");
    value.textContent = fact.value;
    card.appendChild(label);
    card.appendChild(value);
    if (fact.note) {
      const note = el("div", "codec-fact-note");
      note.textContent = fact.note;
      card.appendChild(note);
    }
    grid.appendChild(card);
  }
  section.body.appendChild(grid);
  return section.section;
}

/**
 * @param {string[]} sequence
 * @param {"avc" | "hevc" | null} codecFamily
 * @returns {HTMLElement | null}
 */
function renderSequenceSection(sequence, codecFamily) {
  if (!sequence.length) {
    return null;
  }
  const section = createSection("Decode-Order Sequence");
  const summary = el("div", "codec-sequence-summary");
  summary.textContent =
    codecFamily === "avc"
      ? "First analyzed samples in decode order. `*` marks an IDR access unit."
      : "First analyzed samples in decode order, using access-unit categories.";
  const strip = el("div", "codec-sequence-strip");
  for (let index = 0; index < sequence.length; index++) {
    const item = el("span", "codec-sequence-item");
    item.textContent = sequence[index];
    item.title = `sample ${index + 1}: ${sequence[index]}`;
    strip.appendChild(item);
  }
  section.body.appendChild(summary);
  section.body.appendChild(strip);
  return section.section;
}

/**
 * @param {Array<{ label: string, count: number }>} nalTypes
 * @returns {HTMLElement | null}
 */
function renderNalTypesSection(nalTypes) {
  if (!nalTypes.length) {
    return null;
  }
  const section = createSection("NAL Types");
  const table = document.createElement("table");
  table.className = "codec-nal-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const typeHead = document.createElement("th");
  typeHead.scope = "col";
  typeHead.textContent = "NAL type";
  const countHead = document.createElement("th");
  countHead.scope = "col";
  countHead.textContent = "count";
  headerRow.appendChild(typeHead);
  headerRow.appendChild(countHead);
  thead.appendChild(headerRow);
  const tbody = document.createElement("tbody");
  for (const row of nalTypes.slice(0, 16)) {
    const tr = document.createElement("tr");
    const typeCell = document.createElement("td");
    typeCell.textContent = row.label;
    const countCell = document.createElement("td");
    countCell.textContent = numberFormat(row.count);
    tr.appendChild(typeCell);
    tr.appendChild(countCell);
    tbody.appendChild(tr);
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  section.body.appendChild(table);
  return section.section;
}

/**
 * @param {{
 *   details: string[],
 *   sampleDetails: string[],
 *   parameterSets: Array<{ label: string, details: string[] }>,
 *   issues: string[],
 * }} result
 */
function mergeDetailItems(result) {
  /** @type {string[]} */
  const details = [];
  const seenDetails = new Set();
  for (const item of [
    ...result.details,
    ...result.sampleDetails,
    ...getSpecificParameterSetDetails(result.parameterSets),
  ]) {
    if (seenDetails.has(item)) {
      continue;
    }
    seenDetails.add(item);
    details.push(item);
  }

  /** @type {string[]} */
  const issues = [];
  const seenIssues = new Set();
  for (const item of result.issues) {
    if (seenIssues.has(item)) {
      continue;
    }
    seenIssues.add(item);
    issues.push(item);
  }
  return { details, issues };
}

/**
 * @param {Array<{ label: string, details: string[] }>} parameterSets
 */
function getSpecificParameterSetDetails(parameterSets) {
  /** @type {string[]} */
  const items = [];
  for (const set of parameterSets) {
    const specificDetails = set.details.slice(2);
    if (!specificDetails.length) {
      continue;
    }
    items.push(`${set.label}: ${specificDetails.join("; ")}`);
  }
  return items;
}

/**
 * @param {string} title
 */
function createSection(title) {
  const section = /** @type {HTMLDetailsElement} */ (
    el("details", "info-section")
  );
  section.open = true;
  const summary = el("summary", "info-section-title");
  const caret = el("span", "box-caret");
  caret.setAttribute("aria-hidden", "true");
  const label = el("span", "info-section-label");
  label.textContent = title;
  summary.appendChild(caret);
  summary.appendChild(label);
  const body = el("div", "info-section-body");
  section.appendChild(summary);
  section.appendChild(body);
  return { section, body };
}

/**
 * @param {HTMLElement} parent
 * @param {string} label
 * @param {string} value
 */
function addStat(parent, label, value) {
  const item = el("div", "info-stat");
  const labelEl = el("span", "info-stat-label");
  labelEl.textContent = label;
  const valueEl = el("span", "info-stat-value");
  valueEl.textContent = value;
  item.appendChild(labelEl);
  item.appendChild(valueEl);
  parent.appendChild(item);
}

/**
 * @param {string} label
 */
function createLabeledControl(label) {
  const wrap = el("label", "samples-control");
  const title = el("span", "samples-control-label");
  title.textContent = label;
  const body = el("div", "samples-control-body");
  wrap.appendChild(title);
  wrap.appendChild(body);
  return { wrap, body };
}
