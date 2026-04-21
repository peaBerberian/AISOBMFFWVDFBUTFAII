import { parseEvents } from "isobmff-inspector";
import ProgressBar from "./ProgressBar.js";
import { renderBoxTree, renderSizeChart } from "./tabs";

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

  /** @type {Array<{ element: HTMLElement, childWrap: HTMLElement | null }>} */
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

        const parent = depth === 0 ? wrapper : stack[depth - 1]?.childWrap;
        if (!parent) {
          throw new Error(`missing parent for ${event.path.join("/")}`);
        }

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
        const element = renderBoxTree(box, /* shallow = */ true);
        parent.appendChild(element);
        stack[depth] = {
          element,
          childWrap: /** @type {HTMLElement | null} */ (
            element.querySelector(":scope > .box-children")
          ),
        };
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

        const element = renderBoxTree(box, /* shallow = */ true);
        const oldChildWrap = current.childWrap;
        const newChildWrap = /** @type {HTMLElement | null} */ (
          element.querySelector(":scope > .box-children")
        );
        if (oldChildWrap && newChildWrap) {
          while (oldChildWrap.firstChild) {
            newChildWrap.appendChild(oldChildWrap.firstChild);
          }
        }
        current.element.replaceWith(element);
        stack[depth] = { element, childWrap: newChildWrap };

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
