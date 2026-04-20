import { parseEvents } from "isobmff-inspector";
import { buildBoxEl, renderSizeChart } from "./renderer.js";
import ProgressBar from "./ProgressBar.js";

const statusLineElt = document.getElementById("status-line");

/**
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 */
async function parseAndRender(input) {
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

  const progressBar = new ProgressBar();
  progressBar.start("parsing…");
  progressBar.startEasing();

  /** @type {Array<{ element: HTMLElement, childWrap: HTMLElement | null }>} */
  const stack = [];

  try {
    for await (const event of parseEvents(input)) {
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
        const element = buildBoxEl(box, /* shallow = */ true);
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
          progressBar.updateStatus(msg);
        }

        const box = event.box;
        const depth = event.path.length - 1; // path includes this box's type
        const current = stack[depth];
        if (!current) {
          throw new Error(`missing started box for ${event.path.join("/")}`);
        }

        const element = buildBoxEl(box, /* shallow = */ true);
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
  } catch (err) {
    // XXX TODO: integrate to progress bar (e.g. to a red progressbar)
    setStatus(`parse error: ${err?.message ?? err}`);
    console.error("parse error", err);
  } finally {
    progressBar.end("File parsed with success!");
  }
}

if (window.File && window.FileReader && window.Uint8Array) {
  document.getElementById("file-input").addEventListener("change", (evt) => {
    const fileInputElt = /** @type {HTMLInputElement | null} */ (evt.target);
    const files = fileInputElt.files;
    if (!files?.length) {
      return;
    }
    parseAndRender(files[0]);
  });
} else {
  document.getElementById("choices-local-segment").style.display = "none";
  document.getElementById("choices-separator").style.display = "none";
}

if (window.fetch && window.Uint8Array) {
  function fetchAndParse() {
    const url = /** @type {HTMLInputElement} */ (
      document.getElementById("url-input")
    ).value.trim();
    if (!url) {
      return;
    }
    fetch(url)
      .then((r) => parseAndRender(r))
      .catch((err) => {
        // XXX TODO: How to make that part of the progress bar experience?
        setStatus(`fetch error: ${err?.message ?? err}`);
      });
  }

  document
    .getElementById("url-button")
    .addEventListener("click", fetchAndParse);
  document.getElementById("url-input").addEventListener("keypress", (evt) => {
    if ((evt.keyCode || evt.which) === 13) {
      fetchAndParse();
    }
  });
} else {
  document.getElementById("choices-separator").style.display = "none";
  document.getElementById("choices-url-segment").style.display = "none";
}

const tabElts = document.getElementsByClassName("tab");
for (let tabIdx = 0; tabIdx < tabElts.length; tabIdx++) {
  const tabEl = /** @type {HTMLElement} */ (tabElts[tabIdx]);
  tabEl.addEventListener("click", () => {
    for (let innerTabIdx = 0; innerTabIdx < tabElts.length; innerTabIdx++) {
      const innerTab = tabElts[innerTabIdx];
      if (innerTab !== tabEl) {
        innerTab.classList.remove("active");
      }
    }
    const tabPanelElts = document.getElementsByClassName("tab-panel");
    for (
      let tabPanelIdx = 0;
      tabPanelIdx < tabPanelElts.length;
      tabPanelIdx++
    ) {
      const tabPanel = tabPanelElts[tabPanelIdx];
      tabPanel.classList.remove("active");
    }
    tabEl.classList.add("active");
    document.getElementById(`tab-${tabEl.dataset.tab}`).classList.add("active");
  });
}

/**
 * TODO: Move to ProgressBar?
 * @param {string} msg
 */
function setStatus(msg) {
  statusLineElt.textContent = msg;
  statusLineElt.style.visibility = msg ? "visible" : "hidden";
}
