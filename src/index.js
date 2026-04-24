import { requireElementById } from "./dom.js";
import ProgressBar from "./ProgressBar.js";
import { parseAndRender } from "./parse.js";
import { initializeTabNavigation } from "./tabs/index.js";
import { createAbortableAsyncIterable } from "./utils.js";

/**
 * AbortController linked to the current segment/file parsing process.
 * Only one parsing process maximum can take place at a time.
 * @type AbortController | null
 */
let currentSegmentParsingAbortController = null;

initializeFileReaderInput();
initializeFileDrop();
initializeUrlInput();
initializeTabNavigation();
initializeGithubStars();

/**
 * Dim existing results while a newly requested file is being loaded. Once the
 * parser starts rendering the new file, parseAndRender clears this state.
 * @param {boolean} isLoading
 */
function setResultsLoading(isLoading) {
  const results = requireElementById("results", HTMLElement);
  results.classList.toggle("is-stale-loading", isLoading);
  results.inert = isLoading;
  results.setAttribute("aria-busy", isLoading ? "true" : "false");
}

/**
 * Fetch the mp4 file's URL and run our parser on it.
 * Can be aborted at any time with the given `AbortSignal`.
 * @param {string} url
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
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
      const message = err instanceof Error ? err.message : err;
      ProgressBar.fail(`fetch error: ${message}`);
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
  const streamableFile = /** @type {{ stream?: Blob["stream"] }} */ (file);
  if (typeof streamableFile.stream === "function") {
    return createAbortableAsyncIterable(streamableFile.stream(), signal);
  }
  return file;
}

/**
 * Parse a local file while preserving the app's single active parse lifecycle.
 * @param {Blob} file
 */
function parseLocalFile(file) {
  currentSegmentParsingAbortController?.abort();
  currentSegmentParsingAbortController = new AbortController();
  const controller = currentSegmentParsingAbortController;
  const signal = currentSegmentParsingAbortController.signal;
  ProgressBar.setCancelAction(() => controller.abort());
  setResultsLoading(true);
  parseAndRender(formatFileInput(file, signal), signal).finally(() => {
    if (currentSegmentParsingAbortController === controller) {
      setResultsLoading(false);
      currentSegmentParsingAbortController = null;
    }
  });
}

function initializeFileReaderInput() {
  if (window.File && window.FileReader && window.Uint8Array) {
    const fileInput = requireElementById("file-input", HTMLInputElement);
    fileInput.addEventListener("change", () => {
      const files = fileInput.files;
      if (!files?.length) {
        return;
      }
      parseLocalFile(files[0]);
    });
  } else {
    requireElementById("choices-local-segment", HTMLElement).style.display =
      "none";
    requireElementById("choices-separator", HTMLElement).style.display = "none";
  }
}

/**
 * @param {DataTransfer | null} dataTransfer
 */
function dataTransferHasFiles(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.types) {
    return Array.from(dataTransfer.types).includes("Files");
  }
  return dataTransfer.files.length > 0;
}

function initializeFileDrop() {
  if (!window.File || !window.FileReader || !window.Uint8Array) {
    return;
  }

  const dropOverlay = requireElementById("drop-overlay", HTMLElement);

  let dragDepth = 0;

  const showDropTarget = () => {
    dropOverlay.hidden = false;
  };

  const hideDropTarget = () => {
    dragDepth = 0;
    dropOverlay.hidden = true;
  };

  document.addEventListener("dragenter", (evt) => {
    if (!dataTransferHasFiles(evt.dataTransfer)) {
      return;
    }
    evt.preventDefault();
    dragDepth += 1;
    showDropTarget();
  });

  document.addEventListener("dragover", (evt) => {
    const dataTransfer = evt.dataTransfer;
    if (dataTransfer === null || !dataTransferHasFiles(dataTransfer)) {
      return;
    }
    evt.preventDefault();
    dataTransfer.dropEffect = "copy";
    showDropTarget();
  });

  document.addEventListener("dragleave", (evt) => {
    if (!dataTransferHasFiles(evt.dataTransfer)) {
      return;
    }
    dragDepth -= 1;
    if (dragDepth <= 0) {
      hideDropTarget();
    }
  });

  document.addEventListener("drop", (evt) => {
    const dataTransfer = evt.dataTransfer;
    if (dataTransfer === null || !dataTransferHasFiles(dataTransfer)) {
      return;
    }
    evt.preventDefault();
    const [file] = Array.from(dataTransfer.files);
    hideDropTarget();
    if (file) {
      parseLocalFile(file);
    }
  });
}

function initializeUrlInput() {
  if ("fetch" in window && "Uint8Array" in window) {
    const urlInput = requireElementById("url-input", HTMLInputElement);

    /**
     * @param {string} url
     */
    function inspectUrl(url) {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        return;
      }
      urlInput.value = trimmedUrl;
      currentSegmentParsingAbortController?.abort();
      currentSegmentParsingAbortController = new AbortController();
      const controller = currentSegmentParsingAbortController;
      const signal = controller.signal;
      ProgressBar.setCancelAction(() => controller.abort());
      setResultsLoading(true);
      fetchSegmentAndParse(trimmedUrl, signal).finally(() => {
        if (currentSegmentParsingAbortController === controller) {
          setResultsLoading(false);
          currentSegmentParsingAbortController = null;
        }
      });
    }

    function onUrlClick() {
      inspectUrl(urlInput.value);
    }

    requireElementById("url-button", HTMLButtonElement).addEventListener(
      "click",
      onUrlClick,
    );
    urlInput.addEventListener("keypress", (evt) => {
      if ((evt.keyCode || evt.which) === 13) {
        onUrlClick();
      }
    });
    const exampleButtons = document.getElementsByClassName(
      "example-source-button",
    );
    for (let buttonIdx = 0; buttonIdx < exampleButtons.length; buttonIdx++) {
      const button = exampleButtons[buttonIdx];
      button.addEventListener("click", () => {
        if (!(button instanceof HTMLElement)) {
          return;
        }
        inspectUrl(button.dataset.exampleUrl ?? "");
      });
    }
  } else {
    requireElementById("choices-separator", HTMLElement).style.display = "none";
    requireElementById("choices-url-segment", HTMLElement).style.display =
      "none";
  }
}

function initializeGithubStars() {
  if (!("fetch" in window)) {
    return;
  }
  const starsElt = requireElementById("github-stars", HTMLElement);

  const fetchStars = async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/peaBerberian/AISOBMFFWVDFBUTFAII",
        {
          headers: {
            Accept: "application/vnd.github+json",
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
      // Keep the project link unobtrusive if GitHub is unavailable.
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fetchStars);
  } else {
    globalThis.setTimeout(fetchStars, 1000);
  }
}
