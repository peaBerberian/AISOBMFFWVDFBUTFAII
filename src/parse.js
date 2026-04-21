import { parseEvents } from "isobmff-inspector";
import ProgressBar from "./ProgressBar.js";
import { BoxTreeNodeView, renderSizeChart } from "./tabs";

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
  const wrapper = document.getElementById("file-description");
  wrapper.innerHTML = "";
  topLevelBoxes.length = 0;
  tabs.style.display = "none";

  ProgressBar.start("parsing…");
  ProgressBar.startEasing();

  /** @type {Array<import("./tabs").BoxTreeNodeView>} */
  const stack = [];
  let completed = false;

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
        const view =
          depth === 0
            ? new BoxTreeNodeView(box, { shallow: true })
            : stack[depth - 1]?.appendChildBox(box);
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
    tabs.style.display = "flex";
    completed = true;
  } catch (err) {
    if (abortSignal.aborted) {
      return;
    }
    ProgressBar.fail(`parse error: ${err?.message ?? err}`);
    console.error("parse error", err);
  } finally {
    if (!abortSignal.aborted && completed) {
      ProgressBar.end("File parsed with success!");
    }
  }
}
