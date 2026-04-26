import { setInspectionSource } from "../ui/InspectionSourceElement.js";
import ProgressBar from "../ui/ProgressBar.js";
import { createAbortableAsyncIterable } from "../utils/abortables.js";
import { requireElementById } from "../utils/dom.js";
import {
  beginInspectionLifecycle,
  finishInspectionLifecycle,
} from "./InspectionLifecycle.js";
import { parseAndRenderSegment } from "./parseSegment.js";

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
export function parseLocalFile(file) {
  const run = beginInspectionLifecycle();
  const signal = run.controller.signal;
  const namedFile = /** @type {{ name?: string }} */ (file);

  ProgressBar.start("Loading local file...");
  ProgressBar.startEasing();
  setInspectionSource({
    selectedLabel: "Local file",
    selectedValue: namedFile.name || "Unnamed file",
  });
  parseAndRenderSegment(formatFileInput(file, signal), run).finally(() => {
    finishInspectionLifecycle(run);
  });
}

/**
 * @param {DataTransfer | null} dataTransfer
 * @returns {boolean}
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

/**
 * Wire up the file <input> element. Hides the UI element if the File API is
 * unavailable.
 * @param {(file: Blob) => void} onFile
 */
export function initializeFileReaderInput(onFile) {
  if (window.File && window.FileReader && window.Uint8Array) {
    const fileInput = requireElementById("file-input", HTMLInputElement);
    fileInput.addEventListener("change", () => {
      const files = fileInput.files;
      if (!files?.length) {
        return;
      }
      onFile(files[0]);
    });
  } else {
    requireElementById("choices-local-segment", HTMLElement).style.display =
      "none";
    requireElementById("choices-separator", HTMLElement).style.display = "none";
  }
}

/**
 * Wire up drag-and-drop file handling.
 * @param {(file: Blob) => void} onFile
 */
export function initializeFileDrop(onFile) {
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
      onFile(file);
    }
  });
}

/**
 * Wire up the URL input field and example-source buttons.
 *
 * @param {(
 *   url: string,
 *   companionInit?: { url: string, byteRange: [number, number|undefined]|undefined }
 * ) => void} onUrl
 */
export function initializeUrlInput(onUrl) {
  if (!("fetch" in window) || !("Uint8Array" in window)) {
    requireElementById("choices-separator", HTMLElement).style.display = "none";
    requireElementById("choices-url-segment", HTMLElement).style.display =
      "none";
    return;
  }

  const urlInput = requireElementById("url-input", HTMLInputElement);

  /**
   * @param {string} url
   * @param {{ url: string, byteRange: [number, number|undefined]|undefined }|undefined} companionInit
   */
  const triggerInspect = (url, companionInit = undefined) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return;
    }
    urlInput.value = trimmedUrl;
    onUrl(trimmedUrl, companionInit);
  };

  const onUrlClick = () => triggerInspect(urlInput.value);

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
  for (let i = 0; i < exampleButtons.length; i++) {
    const button = exampleButtons[i];
    button.addEventListener("click", () => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      const companionInitUrl = button.dataset.exampleCompanionInitUrl?.trim();
      triggerInspect(
        button.dataset.exampleUrl ?? "",
        companionInitUrl
          ? { url: companionInitUrl, byteRange: undefined }
          : undefined,
      );
    });
  }
}
