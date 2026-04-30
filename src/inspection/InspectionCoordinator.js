import InspectionResultsView from "../ui/InspectionResultsView.js";
import {
  clearInspectionSource,
  setInspectionSource,
} from "../ui/InspectionSourceElement.js";
import {
  hideSegmentChooser,
  showDashSegmentChooser,
  showHlsSegmentChooser,
} from "../ui/PlaylistSegmentChooser.js";
import ProgressBar from "../ui/ProgressBar.js";
import InspectionParseHandle from "./InspectionParseHandle.js";
import InspectionSourceHandle from "./InspectionSourceHandle.js";

const PROGRESS_PHASE_RANGES = {
  probe: [0, 0.1],
  manifest: [0.1, 0.25],
  resolve: [0.25, 0.35],
  parse: [0.35, 0.88],
  analyze: [0.88, 0.94],
  render: [0.94, 0.98],
};

/**
 * Per-inspection app state. Only one inspection may be current at a time.
 *
 * @typedef {Object} InspectionHandles
 * @property {InspectionParseHandle} parseHandle
 * @property {InspectionSourceHandle} sourceHandle
 */

class InspectionCoordinatorClass {
  /** @type {{ parseHandle: InspectionParseHandle; sourceHandle: InspectionSourceHandle }|null} */
  #currentInspection = null;

  /**
   * @returns {InspectionHandles}
   */
  begin() {
    this.#currentInspection?.parseHandle?.abort();
    hideSegmentChooser();
    const parseHandle = new InspectionParseHandle({
      isCurrent: this.isCurrent.bind(this),
    });
    const sourceHandle = new InspectionSourceHandle();
    this.#currentInspection = { parseHandle, sourceHandle };
    parseHandle.onEvent = (event) => {
      if (this.#currentInspection?.parseHandle !== parseHandle) {
        return;
      }
      this.#handleInspectionEvent(event);
    };
    sourceHandle.onEvent = (event) => {
      if (this.#currentInspection?.sourceHandle !== sourceHandle) {
        return;
      }
      this.#handleInspectionEvent(event);
    };
    ProgressBar.bindAbortController(parseHandle.controller);
    InspectionResultsView.setLoading(true);
    parseHandle.controller.signal.addEventListener(
      "abort",
      () => {
        if (this.#currentInspection?.parseHandle !== parseHandle) {
          return;
        }
        hideSegmentChooser();
        clearInspectionSource();
        InspectionResultsView.clear();
        InspectionResultsView.setLoading(false);
        ProgressBar.bindAbortController(null);
        this.#currentInspection = null;
      },
      { once: true },
    );
    return {
      parseHandle,
      sourceHandle,
    };
  }

  /**
   * @param {InspectionParseHandle} parseHandle
   */
  finish(parseHandle) {
    if (this.#currentInspection?.parseHandle !== parseHandle) {
      return;
    }
    hideSegmentChooser();
    InspectionResultsView.setLoading(false);
    ProgressBar.bindAbortController(null);
    this.#currentInspection = null;
  }

  /**
   * @param {InspectionParseHandle} parseHandle
   * @returns {boolean}
   */
  isCurrent(parseHandle) {
    return this.#currentInspection?.parseHandle === parseHandle;
  }

  /**
   * @param {import("./InspectionParseHandle.js").InspectionEvent} event
   */
  #handleInspectionEvent(event) {
    switch (event.type) {
      case "status":
        this.#applyProgressStatus(event);
        break;
      case "notice":
        InspectionResultsView.renderNotice(event.notice);
        break;
      case "source":
        setInspectionSource(event.source);
        break;
      case "chooser-hide":
        hideSegmentChooser();
        break;
      case "chooser-dash":
        showDashSegmentChooser(
          event.sourceUrl,
          event.tree,
          event.onInspect,
          event.onLoadRepresentation,
        );
        break;
      case "chooser-hls":
        showHlsSegmentChooser(
          event.sourceUrl,
          event.extraction,
          event.onInspect,
          event.onLoadResult,
        );
        break;
      case "render-initialize":
        InspectionResultsView.initializeForNewRender();
        break;
      case "render-clear":
        InspectionResultsView.clear();
        break;
      case "render-finish-request":
        InspectionResultsView.finishRequest();
        break;
      case "render-failed":
        InspectionResultsView.finalizeFailedRender();
        break;
      case "parser-box-start":
        InspectionResultsView.renderBoxTreeStart(
          event.box,
          event.depth,
          event.path,
        );
        break;
      case "parser-box-complete":
        this.#renderCompletedParserBox(event);
        break;
      case "result":
        InspectionResultsView.renderFullResults(event.result);
        if (event.tentative) {
          ProgressBar.fail(
            "Input does not look like ISOBMFF; tentative result shown.",
          );
        } else {
          ProgressBar.end("File parsed with success!");
        }
        break;
      case "error":
        ProgressBar.fail(event.message);
        break;
    }
  }

  /**
   * @param {Extract<import("./InspectionParseHandle.js").InspectionEvent, { type: "parser-box-complete" }>} event
   */
  #renderCompletedParserBox(event) {
    if (event.renderMode === "complete-started") {
      const wasStarted = InspectionResultsView.completeStartedBox(
        event.box,
        event.depth,
      );
      if (!wasStarted) {
        throw new Error(
          `Unrecoverable invalidity for box ${event.path.join("/")}`,
        );
      }
      return;
    }
    InspectionResultsView.appendStandaloneTopLevelBox(event.box);
  }

  /**
   * @param {Extract<import("./InspectionParseHandle.js").InspectionEvent, { type: "status" }>} event
   */
  #applyProgressStatus(event) {
    switch (event.state) {
      case "start":
        ProgressBar.start(event.message);
        this.#applyProgressEstimate(event);
        if (event.easing && !event.progress) {
          ProgressBar.startEasing();
        }
        break;
      case "success":
        ProgressBar.end(event.message);
        break;
      case "warning":
        ProgressBar.cancel(event.message);
        break;
      case "error":
        ProgressBar.fail(event.message);
        break;
      case "update":
        ProgressBar.updateStatus(event.message);
        this.#applyProgressEstimate(event);
        break;
    }
  }

  /**
   * @param {Extract<import("./InspectionParseHandle.js").InspectionEvent, { type: "status" }>} event
   */
  #applyProgressEstimate(event) {
    const progress = event.progress;
    if (!progress) {
      return;
    }
    const ratio = getProgressRatio(progress);
    if (ratio === null) {
      return;
    }
    ProgressBar.setProgress(ratio, undefined);
  }
}

const InspectionCoordinator = new InspectionCoordinatorClass();

export default InspectionCoordinator;

/**
 * @param {import("./InspectionParseHandle.js").InspectionProgressInput} progress
 * @returns {number | null}
 */
function getProgressRatio(progress) {
  const range = PROGRESS_PHASE_RANGES[progress.phase];
  if (!range) {
    return null;
  }
  const [start, end] = range;
  if (
    typeof progress.loadedBytes === "number" &&
    typeof progress.totalBytes === "number" &&
    progress.totalBytes > 0
  ) {
    const byteRatio = Math.max(
      0,
      Math.min(progress.loadedBytes / progress.totalBytes, 1),
    );
    return start + (end - start) * byteRatio;
  }
  if (typeof progress.ratio === "number") {
    return start + (end - start) * Math.max(0, Math.min(progress.ratio, 1));
  }
  return progress.indeterminate ? end : start;
}
