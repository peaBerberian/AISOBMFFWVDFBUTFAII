/**
 * Source-resolution side of one inspection lifecycle.
 *
 * This object translates source workflow actions (local file selected, manifest
 * loaded, segment chosen...) into inspection events. Parse state and parser
 * collection stay in `InspectionParseHandle`.
 */
export default class InspectionSourceHandle {
  #hasActiveChooser = false;
  /** @type {SourceInspectionEventListener|null} */
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
        this.#dispatchEvent({ type: "remote-probe-started" });
        break;
      case "local-file-selected":
        this.#hasActiveChooser = false;
        this.#dispatchEvent({
          type: "source",
          source: action.source,
        });
        break;
      case "manifest-loading":
        this.#dispatchEvent({
          type: "source",
          source: action.source,
        });
        this.#dispatchEvent({
          type: "manifest-load-started",
          manifestKind: action.sourceKind,
        });
        break;
      case "manifest-loaded":
        this.#dispatchEvent({
          type: "manifest-load-complete",
          manifestKind: action.sourceKind,
        });
        break;
      case "segment-choices-available":
        this.#hasActiveChooser = true;
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
        this.#dispatchEvent({
          type: "segment-list-load-started",
          sourceKind: action.sourceKind,
        });
        break;
      case "segment-list-loaded":
        this.#dispatchEvent({
          type: "segment-list-load-complete",
          sourceKind: action.sourceKind,
        });
        break;
      case "segment-list-failed":
        this.#dispatchEvent({
          type: "segment-list-load-failed",
          sourceKind: action.sourceKind,
          error: action.error,
        });
        break;
      case "segment-fetch-started":
        this.#hasActiveChooser = false;
        this.#dispatchEvent({ type: "chooser-hide" });
        this.#dispatchEvent({
          type: "source",
          source: action.source,
        });
        if (action.hasRemoteFetch) {
          this.#dispatchEvent({ type: "segment-fetch-started" });
        }
        break;
      case "source-resolution-failed":
        this.#dispatchEvent({ type: "render-clear" });
        this.error(action.error);
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
   * @param {SourceInspectionEvent} event
   */
  #dispatchEvent(event) {
    this.onEvent?.(event);
  }
}

/**
 * @typedef {Object} RemoteProbeStartedAction
 * @property {"remote-probe-started"} type
 */

/**
 * @typedef {Object} LocalFileSelectedAction
 * @property {"local-file-selected"} type
 * @property {import("./InspectionParseHandle.js").InspectionSource} source
 */

/**
 * @typedef {Object} ManifestLoadingAction
 * @property {"manifest-loading"} type
 * @property {"dash" | "hls"} sourceKind
 * @property {import("./InspectionParseHandle.js").InspectionSource} source
 */

/**
 * @typedef {Object} ManifestLoadedAction
 * @property {"manifest-loaded"} type
 * @property {"dash" | "hls"} sourceKind
 */

/**
 * @typedef {Object} SourceRemoteProbeStartedEvent
 * @property {"remote-probe-started"} type
 */

/**
 * @typedef {Object} SourceInspectionSourceEvent
 * @property {"source"} type
 * @property {import("./InspectionParseHandle.js").InspectionSource} source
 */

/**
 * @typedef {Object} SourceManifestLoadStartedEvent
 * @property {"manifest-load-started"} type
 * @property {"dash" | "hls"} manifestKind
 */

/**
 * @typedef {Object} SourceManifestLoadCompleteEvent
 * @property {"manifest-load-complete"} type
 * @property {"dash" | "hls"} manifestKind
 */

/**
 * @typedef {Object} SourceSegmentListLoadStartedEvent
 * @property {"segment-list-load-started"} type
 * @property {"dash" | "hls"} sourceKind
 */

/**
 * @typedef {Object} SourceSegmentListLoadCompleteEvent
 * @property {"segment-list-load-complete"} type
 * @property {"dash" | "hls"} sourceKind
 */

/**
 * @typedef {Object} SourceSegmentListLoadFailedEvent
 * @property {"segment-list-load-failed"} type
 * @property {"dash" | "hls"} sourceKind
 * @property {Error} error
 */

/**
 * @typedef {Object} SourceSegmentFetchStartedEvent
 * @property {"segment-fetch-started"} type
 */

/**
 * @typedef {Object} SourceInspectionErrorEvent
 * @property {"error"} type
 * @property {Error} error
 * @property {string} message
 */

/** @typedef {{ type: "chooser-hide" | "render-clear" }} SourceSimpleEvent */

/**
 * @typedef {Object} SourceInspectionDashChooserEvent
 * @property {"chooser-dash"} type
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/dash/types.js").DashTree} tree
 * @property {SegmentInspectCallback} onInspect
 * @property {(representation: import("../sources/extractors/dash/types.js").RepresentationTree) => Promise<void> | void} [onLoadRepresentation]
 */

/**
 * @typedef {Object} SourceInspectionHlsChooserEvent
 * @property {"chooser-hls"} type
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/hls/index.js").ExtractionResult} extraction
 * @property {SegmentInspectCallback} onInspect
 * @property {(result: import("../sources/extractors/hls/index.js").PlaylistResult) => Promise<void> | void} [onLoadResult]
 */

/**
 * @typedef {Object} DashSegmentChoicesAvailableAction
 * @property {"segment-choices-available"} type
 * @property {"dash"} sourceKind
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/dash/types.js").DashTree} tree
 * @property {SegmentInspectCallback} onInspect
 * @property {(representation: import("../sources/extractors/dash/types.js").RepresentationTree) => Promise<void> | void} [onLoadRepresentation]
 */

/**
 * @typedef {Object} HlsSegmentChoicesAvailableAction
 * @property {"segment-choices-available"} type
 * @property {"hls"} sourceKind
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/hls/index.js").ExtractionResult} extraction
 * @property {SegmentInspectCallback} onInspect
 * @property {(result: import("../sources/extractors/hls/index.js").PlaylistResult) => Promise<void> | void} [onLoadResult]
 */

/**
 * @typedef {Object} SegmentFetchStartedAction
 * @property {"segment-fetch-started"} type
 * @property {import("./InspectionParseHandle.js").InspectionSource} source
 * @property {boolean} hasRemoteFetch
 */

/**
 * @typedef {Object} SourceResolutionFailedAction
 * @property {"source-resolution-failed"} type
 * @property {Error} error
 */

/**
 * @typedef {(
 *   segmentUrl: string,
 *   byteRange: [number, number | undefined] | undefined,
 *   companionInit?: { url: string, byteRange: [number, number | undefined] | undefined }
 * ) => void} SegmentInspectCallback
 *
 * @typedef {{ type: "segment-list-loading" | "segment-list-loaded", sourceKind: "dash" | "hls" }} SegmentListProgressAction
 * @typedef {{ type: "segment-list-failed", sourceKind: "dash" | "hls", error: Error }} SegmentListFailedAction
 */

/**
 * @typedef {(
 *   RemoteProbeStartedAction |
 *   LocalFileSelectedAction |
 *   ManifestLoadingAction |
 *   ManifestLoadedAction |
 *   DashSegmentChoicesAvailableAction |
 *   HlsSegmentChoicesAvailableAction |
 *   SegmentListProgressAction |
 *   SegmentListFailedAction |
 *   SegmentFetchStartedAction |
 *   SourceResolutionFailedAction
 * )} SourceAction
 *
 * @typedef {(
 *   SourceRemoteProbeStartedEvent |
 *   SourceInspectionSourceEvent |
 *   SourceManifestLoadStartedEvent |
 *   SourceManifestLoadCompleteEvent |
 *   SourceSegmentListLoadStartedEvent |
 *   SourceSegmentListLoadCompleteEvent |
 *   SourceSegmentListLoadFailedEvent |
 *   SourceSegmentFetchStartedEvent |
 *   SourceInspectionErrorEvent |
 *   SourceSimpleEvent |
 *   SourceInspectionDashChooserEvent |
 *   SourceInspectionHlsChooserEvent
 * )} SourceInspectionEvent
 *
 * @typedef {(event: SourceInspectionEvent) => void} SourceInspectionEventListener
 */
