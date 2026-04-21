import { parseEvents } from "isobmff-inspector";
import ProgressBar from "./ProgressBar.js";
import { BoxTreeNodeView, renderSizeChart, switchToTab } from "./tabs";

const AUTO_OPEN_BOX_LIMIT = 400;

/**
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 * @param {AbortSignal} abortSignal
 */
export async function parseAndRender(input, abortSignal) {
  // Walk an already-built DOM tree of <details>/<div> nodes and collect the
  // top-level box sizes for the size chart. We re-use the full parsed array
  // that accumulates during streaming.
  const topLevelBoxes = [];
  let boxCount = 0;
  const tabs = document.getElementById("tabs");
  const results = document.getElementById("results");
  const wrapper = document.getElementById("file-description");
  const sizeChart = document.getElementById("size-chart");
  wrapper.innerHTML = "";
  sizeChart.innerHTML = "";
  if (results) {
    results.classList.remove("is-stale-loading");
    results.inert = false;
    results.setAttribute("aria-busy", "true");
  }
  topLevelBoxes.length = 0;
  tabs.hidden = false;
  switchToTab("boxes");
  tabs.classList.add("is-reserved");
  tabs.classList.remove("is-visible");

  ProgressBar.start("parsing…");
  ProgressBar.startEasing();

  /** @type {Array<import("./tabs").BoxTreeNodeView>} */
  const stack = [];
  let completed = false;
  let renderedBoxCount = 0;

  try {
    for await (const event of parseEvents(input)) {
      if (abortSignal.aborted) {
        return;
      }

      if (event.event === "box-start") {
        const depth = event.path.length - 1;
        stack.length = depth;

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
          throw new Error(`missing started box for ${event.path.join("/")}`);
        }

        current.updateBox(box);

        if (depth === 0) {
          topLevelBoxes.push(box);
        }
      }
    }

    renderSizeChart(topLevelBoxes);
    tabs.classList.remove("is-reserved");
    tabs.classList.add("is-visible");
    completed = true;
  } catch (err) {
    if (abortSignal.aborted) {
      return;
    }
    tabs.hidden = true;
    tabs.classList.remove("is-reserved", "is-visible");
    ProgressBar.fail(`parse error: ${err?.message ?? err}`);
    console.error("parse error", err);
  } finally {
    if (!abortSignal.aborted) {
      results?.setAttribute("aria-busy", "false");
    }
    if (!abortSignal.aborted && completed) {
      ProgressBar.end("File parsed with success!");
    }
  }
}
