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

const PROGRESS_SESSION_KIND = {
  probe: "probe",
  manifest: "manifest",
  segmentList: "segment-list",
  segmentFetch: "segment-fetch",
  parse: "parse",
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
  /** @type {(typeof PROGRESS_SESSION_KIND)[keyof typeof PROGRESS_SESSION_KIND] | null} */
  #progressSession = null;

  /**
   * @returns {InspectionHandles}
   */
  begin() {
    this.#currentInspection?.parseHandle?.abort();
    this.#progressSession = null;
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
        this.#progressSession = null;
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
    this.#progressSession = null;
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
   * @param {(
   *   import("./InspectionParseHandle.js").ParseInspectionEvent |
   *   import("./InspectionSourceHandle.js").SourceInspectionEvent
   * )} event
   */
  #handleInspectionEvent(event) {
    switch (event.type) {
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
      case "remote-probe-started":
        this.#startProgressSession(
          PROGRESS_SESSION_KIND.probe,
          "Probing remote source…",
        );
        this.#setPhaseProgress("probe", { indeterminate: true });
        break;
      case "manifest-load-started":
        this.#startProgressSession(
          PROGRESS_SESSION_KIND.manifest,
          `Loading ${getManifestLabel(event.manifestKind)}…`,
        );
        this.#setPhaseProgress("manifest", { indeterminate: true });
        break;
      case "manifest-load-complete":
        this.#endProgressSession(
          `${getManifestLabel(event.manifestKind)} loaded.`,
        );
        break;
      case "segment-list-load-started":
        this.#startProgressSession(
          PROGRESS_SESSION_KIND.segmentList,
          `Loading ${getSegmentListLabel(event.sourceKind)}...`,
        );
        this.#setPhaseProgress("resolve", { indeterminate: true });
        break;
      case "segment-list-load-complete":
        this.#endProgressSession(
          `${getSegmentListLabel(event.sourceKind)} loaded`,
        );
        break;
      case "segment-list-load-failed":
        this.#progressSession = null;
        ProgressBar.fail(
          `${getSegmentListErrorLabel(event.sourceKind)} error: ${event.error.message}`,
        );
        break;
      case "segment-fetch-started":
        this.#startProgressSession(
          PROGRESS_SESSION_KIND.segmentFetch,
          "Fetching segment...",
        );
        this.#setPhaseProgress("resolve", { indeterminate: true });
        break;
      case "parse-started":
        this.#handleParseStarted(event);
        break;
      case "parse-byte-progress":
        this.#setPhaseProgress("parse", {
          loadedBytes: event.loadedBytes,
          totalBytes: event.totalBytes,
        });
        break;
      case "parse-box-count-updated":
        ProgressBar.updateStatus(`parsed ${event.boxCount} boxes…`);
        break;
      case "analysis-started":
        ProgressBar.updateStatus("deepening codec analysis by reading back…");
        this.#setPhaseProgress("analyze", { indeterminate: true });
        break;
      case "render-started":
        ProgressBar.updateStatus("rendering results…");
        this.#setPhaseProgress("render", { ratio: 0.5 });
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
          this.#progressSession = null;
          ProgressBar.fail(
            "Input does not look like ISOBMFF; tentative result shown.",
          );
        } else {
          this.#progressSession = null;
          ProgressBar.end("File parsed with success!");
        }
        break;
      case "error":
        this.#progressSession = null;
        ProgressBar.fail(event.message);
        break;
    }
  }

  /**
   * @param {Extract<import("./InspectionParseHandle.js").ParseInspectionEvent, { type: "parser-box-complete" }>} event
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
   * @param {Extract<import("./InspectionParseHandle.js").ParseInspectionEvent, { type: "parse-started" }>} event
   */
  #handleParseStarted(event) {
    if (this.#progressSession === PROGRESS_SESSION_KIND.segmentFetch) {
      ProgressBar.updateStatus("parsing…");
    } else {
      this.#startProgressSession(PROGRESS_SESSION_KIND.parse, "parsing…");
    }
    this.#setPhaseProgress("parse", {
      loadedBytes: 0,
      totalBytes: event.inputTotalBytes,
      indeterminate: !(
        typeof event.inputTotalBytes === "number" && event.inputTotalBytes > 0
      ),
    });
  }

  /**
   * @param {(typeof PROGRESS_SESSION_KIND)[keyof typeof PROGRESS_SESSION_KIND]} sessionKind
   * @param {string} message
   */
  #startProgressSession(sessionKind, message) {
    this.#progressSession = sessionKind;
    ProgressBar.start(message);
  }

  /**
   * @param {string} message
   */
  #endProgressSession(message) {
    this.#progressSession = null;
    ProgressBar.end(message);
  }

  /**
   * @param {keyof typeof PROGRESS_PHASE_RANGES} phase
   * @param {{ ratio?: number, loadedBytes?: number, totalBytes?: number | null, indeterminate?: boolean }} progress
   */
  #setPhaseProgress(phase, progress) {
    const ratio = getProgressRatio(phase, progress);
    if (ratio === null) {
      return;
    }
    ProgressBar.setProgress(ratio, undefined);
  }
}

const InspectionCoordinator = new InspectionCoordinatorClass();

export default InspectionCoordinator;

/**
 * @param {keyof typeof PROGRESS_PHASE_RANGES} phase
 * @param {{ ratio?: number, loadedBytes?: number, totalBytes?: number | null, indeterminate?: boolean }} progress
 * @returns {number | null}
 */
function getProgressRatio(phase, progress) {
  const range = PROGRESS_PHASE_RANGES[phase];
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

/**
 * @param {"dash" | "hls"} manifestKind
 * @returns {string}
 */
function getManifestLabel(manifestKind) {
  return manifestKind === "dash" ? "DASH manifest" : "HLS playlist";
}

/**
 * @param {"dash" | "hls"} sourceKind
 * @returns {string}
 */
function getSegmentListLabel(sourceKind) {
  return sourceKind === "dash" ? "DASH segment list" : "HLS segment list";
}

/**
 * @param {"dash" | "hls"} sourceKind
 * @returns {string}
 */
function getSegmentListErrorLabel(sourceKind) {
  return sourceKind === "dash" ? "segment list" : "playlist";
}
