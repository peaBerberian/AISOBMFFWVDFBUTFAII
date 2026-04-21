import ProgressBar from "./ProgressBar.js";
import { parseAndRender } from "./parse.js";
import { createAbortableAsyncIterable } from "./utils.js";

/**
 * AbortController linked to the current segment/file parsing process.
 * Only one parsing process maximum can take place at a time.
 * @type AbortController | null
 */
let currentSegmentParsingAbortController = null;

initializeFileReaderInput();
initializeUrlInput();
initializeTabNavigation();
initializeGithubStars();

/**
 * Fetch the mp4 file's URL and run our parser on it.
 * Can be aborted at any time with the given `AbortSignal`.
 * @param {string} url
 * @param {AbortSignal} signal
 * @returns {Promise}
 */
async function fetchSegmentAndParse(url, signal) {
  ProgressBar.start("fetching…");
  ProgressBar.startEasing();
  try {
    const r = await fetch(url, { signal });
    if (signal.aborted) {
      return;
    }
    if (!r.ok) {
      const errMsg = `HTTP ${r.status}${r.statusText ? ` ${r.statusText}` : ""}`;
      ProgressBar.fail(`fetch error: ${errMsg}`);
      return;
    }
    return parseAndRender(
      r.body ? createAbortableAsyncIterable(r.body, signal) : r,
      signal,
    );
  } catch (err) {
    if (!signal.aborted) {
      ProgressBar.fail(`fetch error: ${err?.message ?? err}`);
      throw err;
    }
  }
}

/**
 * Try to format the given file to the best abstraction for the job.
 * @param {Blob} file
 * @param {AbortSignal} signal
 * @returns {import("isobmff-inspector").ISOBMFFInput}
 */
function formatFileInput(file, signal) {
  if (typeof file.stream === "function") {
    return createAbortableAsyncIterable(file.stream(), signal);
  }
  return file;
}

function initializeFileReaderInput() {
  if (window.File && window.FileReader && window.Uint8Array) {
    document.getElementById("file-input").addEventListener("change", (evt) => {
      const fileInputElt = /** @type {HTMLInputElement | null} */ (evt.target);
      const files = fileInputElt.files;
      if (!files?.length) {
        return;
      }
      currentSegmentParsingAbortController?.abort();
      currentSegmentParsingAbortController = new AbortController();
      const controller = currentSegmentParsingAbortController;
      const signal = currentSegmentParsingAbortController.signal;
      ProgressBar.setCancelAction(() => controller.abort());
      parseAndRender(formatFileInput(files[0], signal), signal).finally(() => {
        if (currentSegmentParsingAbortController === controller) {
          currentSegmentParsingAbortController = null;
        }
      });
    });
  } else {
    document.getElementById("choices-local-segment").style.display = "none";
    document.getElementById("choices-separator").style.display = "none";
  }
}

function initializeUrlInput() {
  if (window.fetch && window.Uint8Array) {
    function onUrlClick() {
      const url = /** @type {HTMLInputElement} */ (
        document.getElementById("url-input")
      ).value.trim();
      if (!url) {
        return;
      }
      currentSegmentParsingAbortController?.abort();
      currentSegmentParsingAbortController = new AbortController();
      const controller = currentSegmentParsingAbortController;
      const signal = controller.signal;
      ProgressBar.setCancelAction(() => controller.abort());
      fetchSegmentAndParse(url, signal).finally(() => {
        if (currentSegmentParsingAbortController === controller) {
          currentSegmentParsingAbortController = null;
        }
      });
    }

    document.getElementById("url-button").addEventListener("click", onUrlClick);
    document.getElementById("url-input").addEventListener("keypress", (evt) => {
      if ((evt.keyCode || evt.which) === 13) {
        onUrlClick();
      }
    });
  } else {
    document.getElementById("choices-separator").style.display = "none";
    document.getElementById("choices-url-segment").style.display = "none";
  }
}

function initializeTabNavigation() {
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
      document
        .getElementById(`tab-${tabEl.dataset.tab}`)
        .classList.add("active");
    });
  }
}

function initializeGithubStars() {
  const starsElt = document.getElementById("github-stars");
  if (!starsElt || !window.fetch) {
    return;
  }

  const fetchStars = async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/peaBerberian/AISOBMFFWVDFBUTFAII",
        {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
          },
        },
      );
      if (!response.ok) {
        return;
      }

      const repository = await response.json();
      if (typeof repository.stargazers_count !== "number") {
        return;
      }

      starsElt.textContent = new Intl.NumberFormat(undefined, {
        notation: repository.stargazers_count >= 1000 ? "compact" : "standard",
      }).format(repository.stargazers_count);
      starsElt.hidden = false;
    } catch {
      // Keep the project links unobtrusive if GitHub is unavailable.
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fetchStars);
  } else {
    globalThis.setTimeout(fetchStars, 1000);
  }
}
