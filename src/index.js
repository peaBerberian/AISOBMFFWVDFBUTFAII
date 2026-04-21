import ProgressBar from "./ProgressBar.js";
import { parseAndRender } from "./parse.js";
import { initializeTabNavigation } from "./tabs";
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

/**
 * Dim existing results while a newly requested file is being loaded. Once the
 * parser starts rendering the new file, parseAndRender clears this state.
 * @param {boolean} isLoading
 */
function setResultsLoading(isLoading) {
  const results = document.getElementById("results");
  if (!results) {
    return;
  }
  results.classList.toggle("is-stale-loading", isLoading);
  results.inert = isLoading;
  results.setAttribute("aria-busy", isLoading ? "true" : "false");
}

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
    document.getElementById("file-input").addEventListener("change", (evt) => {
      const fileInputElt = /** @type {HTMLInputElement | null} */ (evt.target);
      const files = fileInputElt.files;
      if (!files?.length) {
        return;
      }
      parseLocalFile(files[0]);
    });
  } else {
    document.getElementById("choices-local-segment").style.display = "none";
    document.getElementById("choices-separator").style.display = "none";
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

  const dropOverlay = document.getElementById("drop-overlay");
  if (!dropOverlay) {
    return;
  }

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
    if (!dataTransferHasFiles(evt.dataTransfer)) {
      return;
    }
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "copy";
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
    if (!dataTransferHasFiles(evt.dataTransfer)) {
      return;
    }
    evt.preventDefault();
    const [file] = Array.from(evt.dataTransfer.files);
    hideDropTarget();
    if (file) {
      parseLocalFile(file);
    }
  });
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
      setResultsLoading(true);
      fetchSegmentAndParse(url, signal).finally(() => {
        if (currentSegmentParsingAbortController === controller) {
          setResultsLoading(false);
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
