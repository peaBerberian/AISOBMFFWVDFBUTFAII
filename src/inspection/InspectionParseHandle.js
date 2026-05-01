import { deriveInspectionProjections } from "../post-process/projections.js";
import InspectionParseCollector from "./InspectionParseCollector.js";

/**
 * Parse side of one inspection lifecycle.
 *
 * Parse-time details are owned by `InspectionParseCollector`; this object keeps
 * lifecycle state, cancellation, notices, and completed result data together.
 */
export default class InspectionParseHandle {
  #controller = new AbortController();
  #isCurrentCallback;
  /** @type {InspectionEventListener|null} */
  onEvent = null;
  /** @type {Array<InspectionNotice>} */
  #notices = [];
  /** @type {import("./InspectionParseCollector.js").default | null} */
  #parseCollector = null;
  /** @type {boolean[]} */
  #startedParserBoxesByDepth = [];
  #parsedBoxCount = 0;
  #hasInputHeuristicError = false;
  /** @type {Array<import("isobmff-inspector").ParsedBox>} */
  #topLevelBoxes = [];
  /** @type {InspectionResult["supplementalMetadata"]} */
  #supplementalMetadata = null;
  /** @type {Array<any> | null} */
  #codecDetailsResults = null;
  /** @type {import("./byte-view/ByteViewCollector.js").ByteViewRenderData | null} */
  #byteViewData = null;
  /** @type {import("../post-process/projections.js").InspectionProjections | null} */
  #projections = null;

  /**
   * @param {{ isCurrent: (inspection: InspectionParseHandle) => boolean }} options
   */
  constructor(options) {
    this.#isCurrentCallback = options.isCurrent;
  }

  get controller() {
    return this.#controller;
  }

  get notices() {
    return this.#notices.slice();
  }

  get topLevelBoxes() {
    return this.#topLevelBoxes;
  }

  get supplementalMetadata() {
    return this.#supplementalMetadata;
  }

  get codecDetailsResults() {
    return this.#codecDetailsResults;
  }

  get byteViewData() {
    return this.#byteViewData;
  }

  get projections() {
    return this.#projections;
  }

  /**
   * @returns {boolean}
   */
  isCurrent() {
    return this.#isCurrentCallback(this);
  }

  // TODO: Remove the need for that step?
  /**
   * @param {{ inputTotalBytes?: number | null }} [options]
   */
  signalParseBegin(options = {}) {
    this.#dispatchEvent({ type: "render-initialize" });
    const inputTotalBytes = options.inputTotalBytes ?? null;
    this.reportStatus({
      message: "parsing…",
      progress:
        typeof inputTotalBytes === "number" && inputTotalBytes > 0
          ? { phase: "parse", loadedBytes: 0, totalBytes: inputTotalBytes }
          : { phase: "parse", indeterminate: true },
    });
  }

  /**
   * @param {Error} error
   */
  signalParseError(error) {
    this.#dispatchEvent({ type: "render-clear" });
    this.#dispatchEvent({ type: "render-failed" });
    this.failInspection(error);
  }

  // TODO: Remove the need for that step?
  signalParseSuccess() {
    this.#dispatchEvent({ type: "render-finish-request" });
  }

  /**
   * @param {InspectionNotice} notice
   */
  addNotice(notice) {
    this.#notices.push(notice);
    if (notice.severity === "error") {
      this.#hasInputHeuristicError = true;
    }
    this.#dispatchEvent({ type: "notice", notice });
  }

  /**
   * @param {{ boxes: Array<import("isobmff-inspector").ParsedBox> } | null} supplementalMetadata
   */
  prepareParseCollector(supplementalMetadata) {
    this.#supplementalMetadata = supplementalMetadata;
    this.#parseCollector = new InspectionParseCollector({
      supplementalBoxes: supplementalMetadata?.boxes ?? [],
    });
    this.#startedParserBoxesByDepth.length = 0;
    this.#parsedBoxCount = 0;
    this.#hasInputHeuristicError = false;
  }

  /**
   * @param {import("../utils/box_size.js").BoxWithOptionalActualSize} box
   * @param {number} depth
   * @param {string[]} path
   */
  onParserBoxStart(box, depth, path) {
    const notice = this.#requireParseCollector().onBoxStart(box, depth);
    this.#startedParserBoxesByDepth.length = depth;
    this.#startedParserBoxesByDepth[depth] = true;
    if (notice) {
      this.addNotice(notice);
    }
    this.#dispatchEvent({ type: "parser-box-start", box, depth, path });
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {number} depth
   * @param {string[]} path
   */
  onParserBoxComplete(box, depth, path) {
    this.#parsedBoxCount++;
    if (this.#parsedBoxCount % 5 === 0) {
      this.reportStatus({
        message: `parsed ${this.#parsedBoxCount} boxes…`,
      });
    }
    const wasStarted = this.#startedParserBoxesByDepth[depth] === true;
    this.#startedParserBoxesByDepth.length = depth;
    if (!wasStarted && depth !== 0) {
      throw new Error(`Unrecoverable invalidity for box ${path.join("/")}`);
    }
    const completion = this.#requireParseCollector().onBoxComplete(box, depth, {
      path,
      started: wasStarted,
    });
    if (!wasStarted && completion.notice) {
      this.addNotice(completion.notice);
    }
    this.#dispatchEvent({
      type: "parser-box-complete",
      box: wasStarted ? box : completion.box,
      depth,
      path,
      renderMode: wasStarted ? "complete-started" : "append-standalone",
    });
  }

  addEmptyInputNotice() {
    const notice = this.#requireParseCollector().getEmptyInputNotice();
    if (notice) {
      this.addNotice(notice);
    }
  }

  /**
   * @param {import("isobmff-inspector").BoxPayloadChunkInfo} info
   * @param {Uint8Array} bytes
   */
  onMdatPayload(info, bytes) {
    this.#requireParseCollector().onMdatPayload(info, bytes);
  }

  /**
   * @param {number} absoluteOffset
   * @param {Uint8Array} bytes
   */
  captureByteViewInputChunk(absoluteOffset, bytes) {
    this.#requireParseCollector().captureByteViewInputChunk(
      absoluteOffset,
      bytes,
    );
  }

  /**
   * @param {(start: number, endExclusive: number) => AsyncIterable<Uint8Array>} readRange
   * @param {AbortSignal} abortSignal
   */
  async completeLocalFileAnalysis(readRange, abortSignal) {
    this.reportStatus({
      message: "deepening codec analysis by reading back…",
      progress: { phase: "analyze", indeterminate: true },
    });
    await this.#requireParseCollector().completeLocalFileAnalysis(
      readRange,
      abortSignal,
    );
  }

  /**
   * @param {InspectionResult} result
   * @param {{ tentative?: boolean }} [options]
   */
  complete(result, options = {}) {
    this.#topLevelBoxes = result.topLevelBoxes;
    this.#supplementalMetadata = result.supplementalMetadata;
    this.#codecDetailsResults = result.codecDetailsResults;
    this.#byteViewData = result.byteViewData;
    this.#projections = result.projections;
    this.#dispatchEvent({
      type: "result",
      result,
      tentative: options.tentative ?? false,
    });
  }

  completeFromParseCollector() {
    this.reportStatus({
      message: "rendering results…",
      progress: { phase: "render", ratio: 0.5 },
    });
    const parseCollector = this.#requireParseCollector();
    const topLevelBoxes = parseCollector.getTopLevelBoxes();
    const supplementalMetadata = this.#supplementalMetadata;
    this.complete(
      {
        topLevelBoxes,
        supplementalMetadata,
        codecDetailsResults: parseCollector.getCodecDetailsResults(
          supplementalMetadata?.boxes ?? [],
        ),
        byteViewData: parseCollector.getByteViewRenderData(),
        projections: deriveInspectionProjections(topLevelBoxes, {
          supplementalMetadata,
        }),
      },
      {
        tentative: this.#hasInputHeuristicError,
      },
    );
  }

  abort() {
    this.#controller.abort();
  }

  /**
   * @param {InspectionStatusInput} status
   */
  reportStatus(status) {
    this.#dispatchEvent({
      type: "status",
      message: status.message,
      state: status.state ?? "update",
      easing: status.easing,
      progress: status.progress,
    });
  }

  /**
   * @param {Error} error
   */
  failInspection(error) {
    this.#dispatchEvent({ type: "error", error, message: error.message });
  }

  /**
   * @param {InspectionEvent} event
   */
  #dispatchEvent(event) {
    this.onEvent?.(event);
  }

  #requireParseCollector() {
    if (!this.#parseCollector) {
      throw new Error("Inspection parse collector has not been prepared.");
    }
    return this.#parseCollector;
  }
}

/**
 * @typedef InspectionNotice
 * @property {"warning"|"error"} severity
 * @property {string} message
 */

/**
 * @typedef {"start" | "update" | "success" | "warning" | "error"} InspectionStatusState
 */

/**
 * @typedef {"probe" | "manifest" | "resolve" | "parse" | "analyze" | "render"} InspectionProgressPhase
 */

/**
 * @typedef {Object} InspectionProgressInput
 * @property {InspectionProgressPhase} phase
 * @property {number} [ratio]
 * @property {number} [loadedBytes]
 * @property {number} [totalBytes]
 * @property {boolean} [indeterminate]
 */

/**
 * @typedef {Object} InspectionResult
 * @property {Array<import("isobmff-inspector").ParsedBox>} topLevelBoxes
 * @property {{ boxes: Array<import("isobmff-inspector").ParsedBox> } | null} supplementalMetadata
 * @property {Array<any> | null} codecDetailsResults
 * @property {import("./byte-view/ByteViewCollector.js").ByteViewRenderData | null} byteViewData
 * @property {import("../post-process/projections.js").InspectionProjections} projections
 */

/**
 * @typedef {Object} InspectionSource
 * @property {string} selectedLabel
 * @property {string} selectedValue
 * @property {string} [originLabel]
 * @property {string} [originValue]
 * @property {Array<{ label: string, value: string }>} [extraSources]
 */

/**
 * @typedef {Object} InspectionStatusEvent
 * @property {"status"} type
 * @property {string} message
 * @property {InspectionStatusState} state
 * @property {boolean} [easing]
 * @property {InspectionProgressInput} [progress]
 */

/**
 * @typedef {Object} InspectionNoticeEvent
 * @property {"notice"} type
 * @property {InspectionNotice} notice
 */

/**
 * @typedef {Object} InspectionParserBoxStartEvent
 * @property {"parser-box-start"} type
 * @property {import("../utils/box_size.js").BoxWithOptionalActualSize} box
 * @property {number} depth
 * @property {string[]} path
 */

/**
 * @typedef {Object} InspectionParserBoxCompleteEvent
 * @property {"parser-box-complete"} type
 * @property {import("isobmff-inspector").ParsedBox} box
 * @property {number} depth
 * @property {string[]} path
 * @property {"complete-started" | "append-standalone"} renderMode
 */

/**
 * @typedef {Object} InspectionResultEvent
 * @property {"result"} type
 * @property {InspectionResult} result
 * @property {boolean} tentative
 */

/**
 * @typedef {Object} InspectionErrorEvent
 * @property {"error"} type
 * @property {Error} error
 * @property {string} message
 */

/**
 * @typedef {Object} InspectionSourceEvent
 * @property {"source"} type
 * @property {InspectionSource} source
 */

/**
 * @typedef {Object} InspectionDashChooserEvent
 * @property {"chooser-dash"} type
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/dash/types.js").DashTree} tree
 * @property {SegmentInspectCallback} onInspect
 * @property {(representation: import("../sources/extractors/dash/types.js").RepresentationTree) => Promise<void> | void} [onLoadRepresentation]
 */

/**
 * @typedef {Object} InspectionHlsChooserEvent
 * @property {"chooser-hls"} type
 * @property {string} sourceUrl
 * @property {import("../sources/extractors/hls/index.js").ExtractionResult} extraction
 * @property {SegmentInspectCallback} onInspect
 * @property {(result: import("../sources/extractors/hls/index.js").PlaylistResult) => Promise<void> | void} [onLoadResult]
 */

/**
 * @typedef {Object} InspectionStatusInput
 * @property {string} message
 * @property {InspectionStatusState} [state]
 * @property {boolean} [easing]
 * @property {InspectionProgressInput} [progress]
 */

/**
/**
 * @typedef {(
 *   segmentUrl: string,
 *   byteRange: [number, number | undefined] | undefined,
 *   companionInit?: { url: string, byteRange: [number, number | undefined] | undefined }
 * ) => void} SegmentInspectCallback
 *
 * @typedef {{ type: "chooser-hide" }} InspectionChooserHideEvent
 * @typedef {{ type: "render-initialize" | "render-clear" | "render-finish-request" | "render-failed" }} InspectionRenderEvent
 */

/**
 * @typedef {(
 *   InspectionStatusEvent |
 *   InspectionNoticeEvent |
 *   InspectionParserBoxStartEvent |
 *   InspectionParserBoxCompleteEvent |
 *   InspectionResultEvent |
 *   InspectionErrorEvent |
 *   InspectionSourceEvent |
 *   InspectionChooserHideEvent |
 *   InspectionDashChooserEvent |
 *   InspectionHlsChooserEvent |
 *   InspectionRenderEvent
 * )} InspectionEvent
 *
 * @typedef {(event: InspectionEvent) => void} InspectionEventListener
 */
