import { parseEvents } from "isobmff-inspector";
import { buildBoxEl, renderSizeChart } from "./renderer.js";

const wrapper = document.getElementById("file-description");
const progressBar = document.getElementById("progress-bar");
const statusLine = document.getElementById("status-line");
const tabs = document.getElementById("tabs");

/**
 * @param {string} msg
 */
function setStatus(msg) {
  statusLine.textContent = msg;
  statusLine.style.visibility = msg ? "visible" : "hidden";
}

let fadeTimeout = null;
let resetTimeout = null;

function clearPending() {
  clearTimeout(fadeTimeout);
  clearTimeout(resetTimeout);
  progressBar.style.transition = "none";
  progressBar.style.opacity = "1";
}

function startProgress() {
  clearPending();
  progressBar.style.width = "5%";
  // Re-enable width transition only
  progressBar.style.transition = "width 0.3s ease";
}

function endProgress() {
  clearPending();
  progressBar.style.width = "100%";
  progressBar.style.backgroundColor = "#65bf77";

  // Wait for fill, then fade
  fadeTimeout = setTimeout(() => {
    progressBar.style.transition = "opacity 0.5s ease";
    progressBar.style.opacity = "0";

    resetTimeout = setTimeout(() => {
      progressBar.style.backgroundColor = "transparent";
      progressBar.style.opacity = "1";
    }, 500);
  }, 1000);
}

// Walk an already-built DOM tree of <details>/<div> nodes and collect the
// top-level box sizes for the size chart. We re-use the full parsed array
// that accumulates during streaming.
const topLevelBoxes = [];

/**
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 */
async function parseAndRender(input) {
  wrapper.innerHTML = "";
  topLevelBoxes.length = 0;
  tabs.style.display = "none";
  startProgress();
  setStatus("parsing…");

  let boxCount = 0;
  /** @type {Array<{ element: HTMLElement, childWrap: HTMLElement | null }>} */
  const stack = [];

  try {
    for await (const event of parseEvents(input)) {
      if (event.event === "box-start") {
        boxCount++;
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

        if (boxCount % 5 === 0) {
          setStatus(`parsed ${boxCount} boxes…`);
        }
        continue;
      }

      if (event.event === "box-complete") {
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
    setStatus(`parse error: ${err?.message ?? err}`);
    console.error("parse error", err);
  } finally {
    setStatus("File parsed with success!");
    endProgress();
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
      .catch((err) => setStatus(`fetch error: ${err?.message ?? err}`));
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

document.querySelectorAll(".tab").forEach((tab) => {
  const tabEl = /** @type {HTMLElement} */ (tab);
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.remove("active");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.remove("active");
    });
    tabEl.classList.add("active");
    document.getElementById(`tab-${tabEl.dataset.tab}`).classList.add("active");
  });
});
