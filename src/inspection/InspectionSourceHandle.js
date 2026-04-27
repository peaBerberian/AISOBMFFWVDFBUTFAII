/**
 * Source-resolution side of one inspection lifecycle.
 *
 * This object translates source workflow actions (local file selected, manifest
 * loaded, segment chosen...) into inspection events. Parse state and parser
 * collection stay in `InspectionParseHandle`.
 */
export default class InspectionSourceHandle {
  #hasActiveChooser = false;
  /** @type {import("./InspectionParseHandle.js").InspectionEventListener|null} */
  onEvent = null;

  get hasActiveChooser() {
    return this.#hasActiveChooser;
  }

  /**
   * @param {SourceAction} action
   */
  dispatch(action) {
    switch (action.type) {
      case "remote-probe-started":
        this.#reportStatus(action.status);
        break;
      case "local-file-selected":
        this.#hasActiveChooser = false;
        this.#dispatchEvent({
          type: "source",
          source: action.source,
        });
        this.#reportStatus(action.status);
        break;
      case "manifest-loading":
        this.#dispatchEvent({
          type: "source",
          source: action.source,
        });
        this.#reportStatus(action.status);
        break;
      case "segment-choices-available":
        this.#hasActiveChooser = true;
        this.#reportStatus(action.status);
        this.#dispatchEvent({ type: "render-clear" });
        if (action.sourceKind === "dash") {
          this.#dispatchEvent({
            type: "chooser-dash",
            sourceUrl: action.sourceUrl,
            tree: action.tree,
            onInspect: action.onInspect,
            onLoadRepresentation: action.onLoadRepresentation,
          });
        } else {
          this.#dispatchEvent({
            type: "chooser-hls",
            sourceUrl: action.sourceUrl,
            extraction: action.extraction,
            onInspect: action.onInspect,
            onLoadResult: action.onLoadResult,
          });
        }
        break;
      case "segment-list-loading":
      case "segment-list-loaded":
      case "segment-list-failed":
        this.#reportStatus(action.status);
        break;
      case "segment-fetch-started":
        this.#hasActiveChooser = false;
        this.#dispatchEvent({ type: "chooser-hide" });
        this.#dispatchEvent({
          type: "source",
          source: action.source,
        });
        if (action.status) {
          this.#reportStatus(action.status);
        }
        break;
      case "source-resolution-failed":
        this.#dispatchEvent({ type: "render-clear" });
        this.error(action.error);
        if (action.status) {
          this.#reportStatus(action.status);
        }
        break;
    }
  }

  /**
   * @param {Error} error
   */
  error(error) {
    this.#dispatchEvent({ type: "error", error, message: error.message });
  }

  /**
   * @param {import("./InspectionParseHandle.js").InspectionStatusInput} status
   */
  #reportStatus(status) {
    this.#dispatchEvent({
      type: "status",
      message: status.message,
      state: status.state ?? "update",
      easing: status.easing,
    });
  }

  /**
   * @param {import("./InspectionParseHandle.js").InspectionEvent} event
   */
  #dispatchEvent(event) {
    this.onEvent?.(event);
  }
}

/**
 * @typedef {Object} RemoteProbeStartedAction
 * @property {"remote-probe-started"} type
 * @property {import("./InspectionParseHandle.js").InspectionStatusInput} status
 */

/**
 * @typedef {Object} LocalFileSelectedAction
 * @property {"local-file-selected"} type
 * @property {import("./InspectionParseHandle.js").InspectionSource} source
 * @property {import("./InspectionParseHandle.js").InspectionStatusInput} status
 */

/**
 * @typedef {Object} ManifestLoadingAction
 * @property {"manifest-loading"} type
 * @property {import("./InspectionParseHandle.js").InspectionSource} source
 * @property {import("./InspectionParseHandle.js").InspectionStatusInput} status
 */

/**
 * @typedef {Object} DashSegmentChoicesAvailableAction
 * @property {"segment-choices-available"} type
 * @property {"dash"} sourceKind
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/dash/types.js").DashTree} tree
 * @property {SegmentInspectCallback} onInspect
 * @property {(representation: import("../sources/extractors/dash/types.js").RepresentationTree) => Promise<void> | void} [onLoadRepresentation]
 * @property {import("./InspectionParseHandle.js").InspectionStatusInput} status
 */

/**
 * @typedef {Object} HlsSegmentChoicesAvailableAction
 * @property {"segment-choices-available"} type
 * @property {"hls"} sourceKind
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/hls/index.js").ExtractionResult} extraction
 * @property {SegmentInspectCallback} onInspect
 * @property {(result: import("../sources/extractors/hls/index.js").PlaylistResult) => Promise<void> | void} [onLoadResult]
 * @property {import("./InspectionParseHandle.js").InspectionStatusInput} status
 */

/**
 * @typedef {Object} SegmentFetchStartedAction
 * @property {"segment-fetch-started"} type
 * @property {import("./InspectionParseHandle.js").InspectionSource} source
 * @property {import("./InspectionParseHandle.js").InspectionStatusInput} [status]
 */

/**
 * @typedef {Object} SourceResolutionFailedAction
 * @property {"source-resolution-failed"} type
 * @property {Error} error
 * @property {import("./InspectionParseHandle.js").InspectionStatusInput} [status]
 */

/**
 * @typedef {(
 *   segmentUrl: string,
 *   byteRange: [number, number | undefined] | undefined,
 *   companionInit?: { url: string, byteRange: [number, number | undefined] | undefined }
 * ) => void} SegmentInspectCallback
 *
 * @typedef {{ type: "segment-list-loading" | "segment-list-failed" | "segment-list-loaded", status: import("./InspectionParseHandle.js").InspectionStatusInput }} SegmentListStatusAction
 */

/**
 * @typedef {(
 *   RemoteProbeStartedAction |
 *   LocalFileSelectedAction |
 *   ManifestLoadingAction |
 *   DashSegmentChoicesAvailableAction |
 *   HlsSegmentChoicesAvailableAction |
 *   SegmentListStatusAction |
 *   SegmentFetchStartedAction |
 *   SourceResolutionFailedAction
 * )} SourceAction
 */
