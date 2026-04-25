import { parseEvents } from "isobmff-inspector";
import ProgressBar from "./ui/ProgressBar.js";
import {
  BoxTreeNodeView,
  renderMediaInfo,
  renderSampleView,
  renderSizeChart,
  renderTreePositionMap,
  switchToTab,
} from "./ui/tabs/index.js";
import { requireElementById } from "./utils/dom.js";

const AUTO_OPEN_BOX_LIMIT = 200;
const USUAL_FIRST_BOX_TYPES = new Set([
  "ftyp",
  "styp",
  "sidx",
  "moov",
  "moof",
  "mdat",
  "free",
  "skip",
  "wide",
  "emsg",
  "prft",
  "uuid",
]);

/** Allows to clean the resource reserved to show the current parsed file. */
let currentFileAbortCtrl = new AbortController();

/**
 * @typedef {{ severity: "warning" | "error", message: string }} ParseNotice
 * @typedef {import("./utils/box_size.js").BoxWithOptionalActualSize} PendingParsedBox
 */

/**
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 * @param {AbortSignal} abortSignal
 */
export default async function parseAndRenderSegment(input, abortSignal) {
  // Walk an already-built DOM tree of <details>/<div> nodes and collect the
  // top-level box sizes for the size chart. We re-use the full parsed array
  // that accumulates during streaming.
  const topLevelBoxes = [];
  let boxCount = 0;

  const tabs = requireElementById("tabs", HTMLElement);
  const results = requireElementById("results", HTMLElement);
  const resultNotices = requireElementById("result-notices", HTMLElement);
  const wrapper = requireElementById("file-description", HTMLElement);
  const sizeChart = requireElementById("size-chart", HTMLElement);
  const mediaInfo = requireElementById("media-info", HTMLElement);
  const sampleView = requireElementById("sample-view", HTMLElement);
  const sampleTabButton = requireElementById(
    "tab-button-samples",
    HTMLButtonElement,
  );
  const sampleTabPanel = requireElementById("tab-samples", HTMLElement);

  currentFileAbortCtrl.abort();
  currentFileAbortCtrl = new AbortController();

  resultNotices.innerHTML = "";
  wrapper.innerHTML = "";
  sizeChart.innerHTML = "";
  mediaInfo.innerHTML = "";
  sampleView.innerHTML = "";
  sampleTabButton.hidden = true;
  sampleTabPanel.hidden = true;
  results.classList.remove("is-stale-loading");
  results.inert = false;
  results.setAttribute("aria-busy", "true");
  topLevelBoxes.length = 0;
  tabs.hidden = false;
  switchToTab("boxes");
  tabs.classList.add("is-reserved");
  tabs.classList.remove("is-visible");

  ProgressBar.start("parsing…");
  ProgressBar.startEasing();

  /** @type {Array<import("./ui/tabs/index.js").BoxTreeNodeView>} */
  const stack = [];
  let completed = false;
  let renderedBoxCount = 0;
  let inspectedFirstTopLevelBox = false;
  /** @type {ParseNotice | null} */
  let inputHeuristicNotice = null;

  try {
    for await (const event of parseEvents(input)) {
      if (abortSignal.aborted) {
        return;
      }

      if (event.event === "box-start") {
        const depth = event.path.length - 1;
        stack.length = depth;

        /** @type {PendingParsedBox} */
        const box = {
          type: event.type,
          size: event.size,
          offset: event.offset,
          headerSize: event.headerSize,
          sizeField: event.sizeField,
          uuid: event.uuid,
          values: [],
          issues: [],
          children: [],
        };
        if (depth === 0 && !inspectedFirstTopLevelBox) {
          inspectedFirstTopLevelBox = true;
          inputHeuristicNotice = getInputHeuristicNotice(box);
          if (inputHeuristicNotice) {
            renderParseNotice(resultNotices, inputHeuristicNotice);
          }
        }
        const shouldAutoOpen = renderedBoxCount < AUTO_OPEN_BOX_LIMIT;
        renderedBoxCount++;
        const view =
          depth === 0
            ? new BoxTreeNodeView(box, {
                autoOpen: shouldAutoOpen,
                shallow: true,
              })
            : stack[depth - 1]?.appendChildBox(box, {
                autoOpen: shouldAutoOpen,
              });
        if (!view) {
          throw new Error(`missing parent for ${event.path.join("/")}`);
        }

        if (depth === 0) {
          wrapper.appendChild(view.element);
        }
        stack[depth] = view;
        continue;
      }

      if (event.event === "box-complete") {
        boxCount++;
        let msg;
        if (boxCount !== undefined && boxCount % 5 === 0) {
          msg = `parsed ${boxCount} boxes…`;
          ProgressBar.updateStatus(msg);
        }

        const box = event.box;
        const depth = event.path.length - 1; // path includes this box's type
        const current = stack[depth];
        if (!current) {
          if (depth !== 0) {
            throw new Error(`missing started box for ${event.path.join("/")}`);
          }

          inspectedFirstTopLevelBox = true;
          inputHeuristicNotice = getIncompleteHeaderNotice(box);
          renderParseNotice(resultNotices, inputHeuristicNotice);

          const recoveredBox = {
            ...box,
            type: box.type || "(header)",
            description:
              box.description ??
              "The parser could not read a complete top-level box header.",
          };
          const view = new BoxTreeNodeView(recoveredBox, {
            autoOpen: true,
          });
          wrapper.appendChild(view.element);
          topLevelBoxes.push(recoveredBox);
          continue;
        }

        current.updateBox(box);

        if (depth === 0) {
          topLevelBoxes.push(box);
        }
      }
    }

    if (!inspectedFirstTopLevelBox) {
      inputHeuristicNotice = {
        severity: "error",
        message:
          "This input is empty, so it does not look like an ISOBMFF file.",
      };
      renderParseNotice(resultNotices, inputHeuristicNotice);
    }

    renderMediaInfo(topLevelBoxes);
    const hasSampleView = renderSampleView(topLevelBoxes);
    sampleTabButton.hidden = !hasSampleView;
    sampleTabPanel.hidden = !hasSampleView;
    renderSizeChart(topLevelBoxes);
    renderTreePositionMap(topLevelBoxes, wrapper, currentFileAbortCtrl.signal);
    tabs.classList.remove("is-reserved");
    tabs.classList.add("is-visible");
    completed = true;
  } catch (err) {
    if (abortSignal.aborted) {
      return;
    }
    tabs.hidden = true;
    tabs.classList.remove("is-reserved", "is-visible");
    const message = err instanceof Error ? err.message : err;
    ProgressBar.fail(`parse error: ${message}`);
    console.error("parse error", err);
    currentFileAbortCtrl.abort();
  } finally {
    if (!abortSignal.aborted) {
      results.setAttribute("aria-busy", "false");
    }
    if (!abortSignal.aborted && completed) {
      if (inputHeuristicNotice?.severity === "error") {
        ProgressBar.fail(
          "Input does not look like ISOBMFF; tentative result shown.",
        );
      } else {
        ProgressBar.end("File parsed with success!");
      }
    }
  }
}

/**
 * @param {HTMLElement} wrapper
 * @param {ParseNotice} notice
 */
function renderParseNotice(wrapper, notice) {
  const noticeEl = document.createElement("div");
  noticeEl.className = `parse-notice issue-list${
    notice.severity === "warning" ? " warn" : ""
  }`;
  const item = document.createElement("div");
  item.className = "issue-item";
  item.textContent = notice.message;
  noticeEl.appendChild(item);
  wrapper.appendChild(noticeEl);
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {ParseNotice}
 */
function getIncompleteHeaderNotice(box) {
  const parserIssue = box.issues.find((issue) => issue.severity === "error");
  return {
    severity: "error",
    message: parserIssue
      ? `This input does not start with a complete ISOBMFF box header. ${parserIssue.message} The result below is tentative.`
      : "This input does not start with a complete ISOBMFF box header. The result below is tentative.",
  };
}

/**
 * This is intentionally a UI heuristic, not parser validation. It catches
 * common wrong inputs early while still letting the parser show any tentative
 * structure it can recover.
 * @param {PendingParsedBox} box
 * @returns {ParseNotice | null}
 */
function getInputHeuristicNotice(box) {
  if (!/^[\x20-\x7e]{4}$/.test(box.type)) {
    return {
      severity: "error",
      message:
        "The first top-level box type is not a printable four-character code, so this input is unlikely to be ISOBMFF. The result below is tentative.",
    };
  }

  if (box.size !== 0 && box.size < box.headerSize) {
    return null;
  }

  if (!USUAL_FIRST_BOX_TYPES.has(box.type)) {
    return {
      severity: "error",
      message: `The first top-level box is "${box.type}", which is not a usual ISOBMFF entry box. This input may not be ISOBMFF; the result below is tentative.`,
    };
  }

  return null;
}
