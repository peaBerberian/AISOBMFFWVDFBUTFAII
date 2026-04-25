import {
  parseMPDFromString,
  parseMPDFromURL,
  resolveIndexForRepresentation,
} from "./extractors/dash/index.js";
import {
  extractISOBMFFPlaylistMetadata,
  extractISOBMFFPlaylistMetadataFromString,
  resolveMediaPlaylist,
} from "./extractors/hls/index.js";
import {
  detectKnownUnsupportedLocalFile,
  probeRemoteSource,
} from "./filetype_detection.js";
import parseAndRenderSegment from "./parseAndRenderSegment.js";
import InspectionResultsView from "./ui/InspectionResultsView.js";
import {
  clearInspectionSource,
  setInspectionSource,
} from "./ui/InspectionSourceElement.js";
import {
  hasVisibleSegmentChooser,
  hideSegmentChooser,
  showDashSegmentChooser,
  showHlsSegmentChooser,
} from "./ui/PlaylistSegmentChooser.js";
import ProgressBar from "./ui/ProgressBar.js";
import { initializeTabNavigation } from "./ui/tabs/index.js";
import { createAbortableAsyncIterable } from "./utils/abortables.js";
import { requireElementById } from "./utils/dom.js";

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
 * Fetch the mp4 file's URL and run our parser on it.
 * Can be aborted at any time with the given `AbortSignal`.
 * @param {string} url
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
async function fetchSegmentAndParse(url, byteRange, signal) {
  ProgressBar.start("fetching…");
  ProgressBar.startEasing();
  try {
    /** @type HeadersInit */
    const headers = {};
    if (byteRange !== undefined) {
      const [start, end] = byteRange;
      headers.Range =
        end !== undefined ? `bytes=${start}-${end}` : `bytes=${start}-`;
    }
    const r = await fetch(url, { signal, headers });
    if (signal.aborted) {
      return;
    }
    if (!r.ok) {
      const errMsg = `HTTP ${r.status}${r.statusText ? ` ${r.statusText}` : ""}`;
      ProgressBar.fail(`fetch error: ${errMsg}`);
      return;
    }
    return parseAndRenderSegment(
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
async function parseLocalFile(file) {
  const controller = beginInspectionLifecycle();
  const signal = controller.signal;
  const namedFile = /** @type {{ name?: string }} */ (file);
  setInspectionSource({
    selectedLabel: "Local file",
    selectedValue: namedFile.name || "Unnamed file",
  });
  try {
    const unsupportedFormat = await detectKnownUnsupportedLocalFile(
      file,
      signal,
    );
    if (signal.aborted) {
      return;
    }
    if (unsupportedFormat !== null) {
      ProgressBar.fail(
        `file error: detected ${unsupportedFormat}, not an ISOBMFF file`,
      );
      return;
    }
    await parseAndRenderSegment(formatFileInput(file, signal), signal);
  } catch (err) {
    if (!signal.aborted) {
      const message = err instanceof Error ? err.message : err;
      ProgressBar.fail(`file error: ${message}`);
      throw err;
    }
  } finally {
    finishInspectionLifecycle(controller);
  }
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
  InspectionResultsView.setLoading(true);
  controller.signal.addEventListener(
    "abort",
    () => {
      if (currentSegmentParsingAbortController !== controller) {
        return;
      }
      hideSegmentChooser();
      clearInspectionSource();
      InspectionResultsView.setLoading(false);
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
  InspectionResultsView.setLoading(false);
  ProgressBar.setCancelAction(null);
  currentSegmentParsingAbortController = null;
}

/**
 * @param {string} sourceUrl
 * @param {AbortController} controller
 */
async function inspectRemoteUrl(sourceUrl, controller) {
  const signal = controller.signal;
  let probe;
  try {
    probe = await probeRemoteSource(sourceUrl, signal);
  } catch (err) {
    if (!signal.aborted) {
      const message = err instanceof Error ? err.message : err;
      ProgressBar.fail(`fetch error: ${message}`);
      throw err;
    }
    return;
  }
  if (signal.aborted) {
    return;
  }
  const sourceKind = probe.kind;
  if (sourceKind === "dash") {
    setInspectionSource({
      selectedLabel: "DASH manifest",
      selectedValue: sourceUrl,
    });
    ProgressBar.start("loading DASH manifest…");
    ProgressBar.startEasing();
    try {
      const tree =
        probe.text !== null
          ? parseMPDFromString(probe.text, sourceUrl, signal)
          : await parseMPDFromURL(sourceUrl, signal);
      if (signal.aborted) {
        return;
      }
      const representationCount = countDashChoices(tree);
      if (representationCount === 0) {
        ProgressBar.fail("No ISOBMFF segments found in DASH manifest.");
        return;
      }
      ProgressBar.end(
        "DASH manifest loaded. Choose a representation to inspect or load on demand.",
      );
      InspectionResultsView.clear();
      const renderDashChooser = () => {
        showDashSegmentChooser(
          sourceUrl,
          tree,
          (segmentUrl, byteRange) => {
            inspectChosenSegment(
              segmentUrl,
              byteRange,
              controller,
              sourceUrl,
              "DASH manifest",
            );
          },
          async (representation) => {
            ProgressBar.start("loading DASH segment list...");
            ProgressBar.startEasing();
            try {
              await resolveIndexForRepresentation(representation, signal);
              if (signal.aborted) {
                return;
              }
              ProgressBar.end("DASH segment list loaded.");
              renderDashChooser();
            } catch (err) {
              if (!signal.aborted) {
                const message = err instanceof Error ? err.message : err;
                ProgressBar.fail(`segment list error: ${message}`);
                throw err;
              }
            }
          },
        );
      };
      renderDashChooser();
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
      const extraction =
        probe.text !== null
          ? extractISOBMFFPlaylistMetadataFromString(probe.text, sourceUrl)
          : await extractISOBMFFPlaylistMetadata(sourceUrl, signal);
      if (signal.aborted) {
        return;
      }
      const resultCount = countHlsChoices(extraction);
      if (resultCount === 0) {
        ProgressBar.fail("No ISOBMFF segments found in HLS playlist.");
        return;
      }
      ProgressBar.end(
        "HLS playlist loaded. Choose a stream to inspect or load on demand.",
      );
      InspectionResultsView.clear();
      const renderHlsChooser = () => {
        showHlsSegmentChooser(
          sourceUrl,
          extraction,
          (segmentUrl, byteRange) => {
            inspectChosenSegment(
              segmentUrl,
              byteRange,
              controller,
              sourceUrl,
              "HLS playlist",
            );
          },
          async (result) => {
            ProgressBar.start("loading HLS segment list...");
            ProgressBar.startEasing();
            try {
              await resolveMediaPlaylist(result, signal);
              if (signal.aborted) {
                return;
              }
              ProgressBar.end("HLS segment list loaded.");
              renderHlsChooser();
            } catch (err) {
              if (!signal.aborted) {
                const message = err instanceof Error ? err.message : err;
                ProgressBar.fail(`playlist error: ${message}`);
                throw err;
              }
            }
          },
        );
      };
      renderHlsChooser();
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
  if (probe.stream !== null) {
    ProgressBar.start("fetching…");
    ProgressBar.startEasing();
    await parseAndRenderSegment(probe.stream, signal);
    return;
  }
  await fetchSegmentAndParse(sourceUrl, undefined, signal);
}

/**
 * @param {string} segmentUrl
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {AbortController} controller
 * @param {string | null} [originUrl=null]
 * @param {string | null} [originKind=null]
 */
function inspectChosenSegment(
  segmentUrl,
  byteRange,
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

  // TODO: Insert byte-range here?
  setInspectionSource({
    selectedLabel: "Selected segment URL",
    selectedValue: segmentUrl,
    originLabel: originUrl && originKind ? `${originKind} source` : undefined,
    originValue: originUrl ?? undefined,
  });
  hideSegmentChooser();
  fetchSegmentAndParse(segmentUrl, byteRange, controller.signal).finally(() => {
    finishInspectionLifecycle(controller);
  });
}

/**
 * @param {import("./extractors/dash/types.js").DashTree} tree
 */
function countDashChoices(tree) {
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
        const representation = adaptation.representations[representationIndex];
        if (
          representation.segments.length > 0 ||
          representation.sidxPending !== undefined
        ) {
          count++;
        }
      }
    }
  }
  return count;
}

/**
 * @param {import("./extractors/hls/index.js").ExtractionResult} extraction
 */
function countHlsChoices(extraction) {
  let count = 0;
  for (
    let resultIndex = 0;
    resultIndex < extraction.results.length;
    resultIndex++
  ) {
    const result = extraction.results[resultIndex];
    if (result.segments === null) {
      count++;
      continue;
    }
    const seenMapKeys = new Set();
    for (
      let segmentIndex = 0;
      segmentIndex < result.segments.length;
      segmentIndex++
    ) {
      const segment = result.segments[segmentIndex];
      if (segment.map) {
        const mapKey = `${segment.map.url}:${segment.map.byteRange?.[0] ?? ""}:${segment.map.byteRange?.[1] ?? ""}`;
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
