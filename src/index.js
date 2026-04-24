import { requireElementById } from "./dom.js";
import { extractSegmentsFromURL } from "./extractors/DashUrlExtractor.js";
import { extractISOBMFFSegments } from "./extractors/HlsUrlExtractor.js";
import {
  clearInspectionSource,
  setInspectionSource,
} from "./inspectionSource.js";
import ProgressBar from "./ProgressBar.js";
import { parseAndRender } from "./parse.js";
import {
  hasVisibleSegmentChooser,
  hideSegmentChooser,
  showDashSegmentChooser,
  showHlsSegmentChooser,
} from "./playlistSelection.js";
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
  const controller = beginInspectionLifecycle();
  const signal = controller.signal;
  const namedFile = /** @type {{ name?: string }} */ (file);
  setInspectionSource({
    selectedLabel: "Local file",
    selectedValue: namedFile.name || "Unnamed file",
  });
  parseAndRender(formatFileInput(file, signal), signal).finally(() => {
    finishInspectionLifecycle(controller);
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
      const controller = beginInspectionLifecycle();
      inspectRemoteUrl(trimmedUrl, controller).finally(() => {
        if (!hasVisibleSegmentChooser()) {
          finishInspectionLifecycle(controller);
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

/**
 * @returns {AbortController}
 */
function beginInspectionLifecycle() {
  currentSegmentParsingAbortController?.abort();
  hideSegmentChooser();
  currentSegmentParsingAbortController = new AbortController();
  const controller = currentSegmentParsingAbortController;
  ProgressBar.setCancelAction(() => controller.abort());
  setResultsLoading(true);
  controller.signal.addEventListener(
    "abort",
    () => {
      if (currentSegmentParsingAbortController !== controller) {
        return;
      }
      hideSegmentChooser();
      clearInspectionSource();
      setResultsLoading(false);
      ProgressBar.setCancelAction(null);
      currentSegmentParsingAbortController = null;
    },
    { once: true },
  );
  return controller;
}

/**
 * @param {AbortController} controller
 */
function finishInspectionLifecycle(controller) {
  if (currentSegmentParsingAbortController !== controller) {
    return;
  }
  hideSegmentChooser();
  setResultsLoading(false);
  ProgressBar.setCancelAction(null);
  currentSegmentParsingAbortController = null;
}

/**
 * @param {string} sourceUrl
 * @param {AbortController} controller
 */
async function inspectRemoteUrl(sourceUrl, controller) {
  const signal = controller.signal;
  const sourceKind = getRemoteSourceKind(sourceUrl);
  if (sourceKind === "dash") {
    setInspectionSource({
      selectedLabel: "DASH manifest",
      selectedValue: sourceUrl,
    });
    ProgressBar.start("loading DASH manifest…");
    ProgressBar.startEasing();
    try {
      const tree = await extractSegmentsFromURL(sourceUrl, signal);
      if (signal.aborted) {
        return;
      }
      const segmentCount = countDashSegments(tree);
      if (segmentCount === 0) {
        ProgressBar.fail("No ISOBMFF segments found in DASH manifest.");
        return;
      }
      ProgressBar.setProgress(
        1,
        `DASH manifest loaded. Choose one of ${segmentCount} segments to inspect.`,
      );
      showDashSegmentChooser(sourceUrl, tree, (segmentUrl) => {
        inspectChosenSegment(
          segmentUrl,
          controller,
          sourceUrl,
          "DASH manifest",
        );
      });
      return;
    } catch (err) {
      if (!signal.aborted) {
        const message = err instanceof Error ? err.message : err;
        ProgressBar.fail(`manifest error: ${message}`);
        throw err;
      }
      return;
    }
  }

  if (sourceKind === "hls") {
    setInspectionSource({
      selectedLabel: "HLS playlist",
      selectedValue: sourceUrl,
    });
    ProgressBar.start("loading HLS playlist…");
    ProgressBar.startEasing();
    try {
      const extraction = await extractISOBMFFSegments(sourceUrl, signal);
      if (signal.aborted) {
        return;
      }
      const segmentCount = countHlsSegments(extraction);
      if (segmentCount === 0) {
        ProgressBar.fail("No ISOBMFF segments found in HLS playlist.");
        return;
      }
      ProgressBar.setProgress(
        1,
        `HLS playlist loaded. Choose one of ${segmentCount} resources to inspect.`,
      );
      showHlsSegmentChooser(sourceUrl, extraction, (segmentUrl) => {
        inspectChosenSegment(segmentUrl, controller, sourceUrl, "HLS playlist");
      });
      return;
    } catch (err) {
      if (!signal.aborted) {
        const message = err instanceof Error ? err.message : err;
        ProgressBar.fail(`playlist error: ${message}`);
        throw err;
      }
      return;
    }
  }

  setInspectionSource({
    selectedLabel: "Remote resource",
    selectedValue: sourceUrl,
  });
  await fetchSegmentAndParse(sourceUrl, signal);
}

/**
 * @param {string} segmentUrl
 * @param {AbortController} controller
 * @param {string | null} [originUrl=null]
 * @param {string | null} [originKind=null]
 */
function inspectChosenSegment(
  segmentUrl,
  controller,
  originUrl = null,
  originKind = null,
) {
  if (
    currentSegmentParsingAbortController !== controller ||
    controller.signal.aborted
  ) {
    return;
  }
  setInspectionSource({
    selectedLabel: "Selected segment URL",
    selectedValue: segmentUrl,
    originLabel: originUrl && originKind ? `${originKind} source` : undefined,
    originValue: originUrl ?? undefined,
  });
  hideSegmentChooser();
  fetchSegmentAndParse(segmentUrl, controller.signal).finally(() => {
    finishInspectionLifecycle(controller);
  });
}

/**
 * @param {string} sourceUrl
 * @returns {"dash" | "hls" | "segment"}
 */
function getRemoteSourceKind(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl, window.location.href);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith(".mpd")) {
      return "dash";
    }
    if (pathname.endsWith(".m3u8") || pathname.endsWith(".m3u")) {
      return "hls";
    }
  } catch {
    // Leave malformed values to fetch for the existing error path.
  }
  return "segment";
}

/**
 * @param {import("./extractors/DashUrlExtractor.js").DashTree} tree
 */
function countDashSegments(tree) {
  let count = 0;
  for (let periodIndex = 0; periodIndex < tree.periods.length; periodIndex++) {
    const period = tree.periods[periodIndex];
    for (
      let adaptationIndex = 0;
      adaptationIndex < period.adaptationSets.length;
      adaptationIndex++
    ) {
      const adaptation = period.adaptationSets[adaptationIndex];
      for (
        let representationIndex = 0;
        representationIndex < adaptation.representations.length;
        representationIndex++
      ) {
        count +=
          adaptation.representations[representationIndex].segments.length;
      }
    }
  }
  return count;
}

/**
 * @param {import("./extractors/HlsUrlExtractor.js").ExtractionResult} extraction
 */
function countHlsSegments(extraction) {
  let count = 0;
  for (
    let resultIndex = 0;
    resultIndex < extraction.results.length;
    resultIndex++
  ) {
    const result = extraction.results[resultIndex];
    const seenMapKeys = new Set();
    for (
      let segmentIndex = 0;
      segmentIndex < result.segments.length;
      segmentIndex++
    ) {
      const segment = result.segments[segmentIndex];
      if (segment.map) {
        const mapKey = `${segment.map.url}:${segment.map.byteRange?.offset ?? ""}:${segment.map.byteRange?.length ?? ""}`;
        if (!seenMapKeys.has(mapKey)) {
          seenMapKeys.add(mapKey);
          count++;
        }
      }
      count++;
    }
  }
  return count;
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
