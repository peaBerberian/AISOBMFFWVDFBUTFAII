import deriveCodecDetails, {
  CodecDetailsCoordinator,
} from "../post-process/codec-details/index.js";
import ByteViewCollector from "./byte-view/ByteViewCollector.js";

const USUAL_FIRST_BOX_TYPES = new Set([
  "ftyp",
  "styp",
  "sidx",
  "moov",
  "moof",
  "mdat",
  "free",
  "skip",
  "wide",
  "emsg",
  "prft",
  "uuid",
]);

/**
 * Collects parser-stream facts that need to survive parsing.
 *
 * For example media segment may contain a huge amount of media data we may
 * not want to keep all in memory. Feature-specific collectors decide what
 * small slices of streaming data should be kept for completed inspection views.
 */
export default class InspectionParseCollector {
  #byteViewCollector;
  #codecCoordinator;
  /** @type {Array<import("isobmff-inspector").ParsedBox>} */
  #topLevelBoxes = [];
  #strictFirstBoxValidation;
  #recoverIncompleteTopLevelBoxes;
  #inspectedFirstTopLevelBox = false;
  #openTopLevelBox = false;

  /**
   * @param {{
   *   supplementalBoxes?: Array<import("isobmff-inspector").ParsedBox> | null,
   *   strictFirstBoxValidation?: boolean,
   *   recoverIncompleteTopLevelBoxes?: boolean,
   * }} [options]
   */
  constructor(options = {}) {
    this.#byteViewCollector = new ByteViewCollector();
    this.#codecCoordinator = new CodecDetailsCoordinator(options);
    this.#strictFirstBoxValidation = options.strictFirstBoxValidation ?? false;
    this.#recoverIncompleteTopLevelBoxes =
      options.recoverIncompleteTopLevelBoxes ?? true;
  }

  /**
   * @param {{
   *   type: string,
   *   offset: number,
   *   headerSize: number,
   *   size: number,
   * }} box
   * @param {number} depth
   * @returns {null | { severity: "warning" | "error", message: string }}
   */
  onBoxStart(box, depth) {
    if (depth !== 0) {
      return null;
    }
    this.#openTopLevelBox = true;
    if (!this.#inspectedFirstTopLevelBox) {
      this.#inspectedFirstTopLevelBox = true;
      if (this.#strictFirstBoxValidation) {
        validateFirstBox(box);
      } else {
        const notice = getInputHeuristicNotice(box);
        if (notice) {
          return notice;
        }
      }
    }
    this.#codecCoordinator.onTopLevelBoxStart(box);
    return null;
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {number} depth
   * @param {{ started?: boolean, path?: string[] }} [options]
   * @returns {{
   *   box: import("isobmff-inspector").ParsedBox,
   *   notice: null | { severity: "warning" | "error", message: string },
   * }}
   */
  onBoxComplete(box, depth, options = {}) {
    if (depth !== 0) {
      this.#byteViewCollector.onBoxComplete(box, options.path ?? [box.type]);
      return { box, notice: null };
    }
    const started = options.started ?? this.#openTopLevelBox;
    this.#openTopLevelBox = false;
    let completedBox = box;
    let notice = null;
    if (!started) {
      if (!this.#recoverIncompleteTopLevelBoxes) {
        throwIncompleteHeader(box);
      }
      notice = getIncompleteHeaderNotice(box);
      completedBox = createRecoveredTopLevelBox(box);
    }
    this.#topLevelBoxes.push(completedBox);
    this.#codecCoordinator.onTopLevelBoxComplete(completedBox);
    this.#byteViewCollector.onBoxComplete(
      completedBox,
      options.path ?? [box.type],
    );
    return { box: completedBox, notice };
  }

  /**
   * @param {import("isobmff-inspector").BoxPayloadChunkInfo} info
   * @param {Uint8Array} bytes
   */
  onMdatPayload(info, bytes) {
    this.#codecCoordinator.consumeSpan({
      start: info.payloadAbsoluteOffset,
      bytes,
    });
    this.#byteViewCollector.excludeByteRange(
      info.payloadAbsoluteOffset,
      info.payloadAbsoluteOffset + bytes.byteLength,
    );
  }

  /**
   * @param {number} absoluteOffset
   * @param {Uint8Array} bytes
   */
  captureByteViewInputChunk(absoluteOffset, bytes) {
    this.#byteViewCollector.captureInputChunk(absoluteOffset, bytes);
  }

  /**
   * @param {(start: number, endExclusive: number) => AsyncIterable<Uint8Array>} readRange
   * @param {AbortSignal} abortSignal
   */
  async completeLocalFileAnalysis(readRange, abortSignal) {
    await this.#codecCoordinator.completeLocalFileAnalysis(
      readRange,
      abortSignal,
    );
  }

  /**
   * @param {Array<import("isobmff-inspector").ParsedBox>} supplementalBoxes
   */
  getCodecDetailsResults(supplementalBoxes) {
    return this.#codecCoordinator.mergeIntoResults(
      deriveCodecDetails(this.#topLevelBoxes, { supplementalBoxes }),
    );
  }

  getTopLevelBoxes() {
    return this.#topLevelBoxes;
  }

  getByteViewRenderData() {
    return this.#byteViewCollector.toRenderData();
  }

  /**
   * @returns {null | { severity: "warning" | "error", message: string }}
   */
  getEmptyInputNotice() {
    if (this.#inspectedFirstTopLevelBox) {
      return null;
    }
    const message =
      "This input is empty, so it does not look like an ISOBMFF file.";
    if (this.#strictFirstBoxValidation) {
      throw new Error(message);
    }
    return {
      severity: "error",
      message,
    };
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {import("isobmff-inspector").ParsedBox}
 */
function createRecoveredTopLevelBox(box) {
  return {
    ...box,
    type: box.type || "(header)",
    description:
      box.description ??
      "The parser could not read a complete top-level box header.",
  };
}

/**
 * @param {{
 *   type: string,
 *   size: number,
 *   headerSize: number,
 * }} box
 */
function validateFirstBox(box) {
  if (!/^[\x20-\x7e]{4}$/.test(box.type)) {
    throw new Error(
      "The first top-level box type is not a printable four-character code, so this input is unlikely to be ISOBMFF.",
    );
  }

  if (box.size !== 0 && box.size < box.headerSize) {
    return;
  }

  if (!USUAL_FIRST_BOX_TYPES.has(box.type)) {
    throw new Error(
      `The first top-level box is "${box.type}", which is not a usual ISOBMFF entry box.`,
    );
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 */
function throwIncompleteHeader(box) {
  const parserIssue = box.issues.find((issue) => issue.severity === "error");
  throw new Error(
    parserIssue
      ? `This input does not start with a complete ISOBMFF box header. ${parserIssue.message}`
      : "This input does not start with a complete ISOBMFF box header.",
  );
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {{ severity: "warning" | "error", message: string }}
 */
function getIncompleteHeaderNotice(box) {
  const parserIssue = box.issues.find((issue) => issue.severity === "error");
  return {
    severity: "error",
    message: parserIssue
      ? `This input does not start with a complete ISOBMFF box header. ${parserIssue.message} The result below is tentative.`
      : "This input does not start with a complete ISOBMFF box header. The result below is tentative.",
  };
}

/**
 * This is intentionally a UI heuristic, not parser validation. It catches
 * common wrong inputs early while still letting the parser show any tentative
 * structure it can recover.
 * @param {{
 *   type: string,
 *   size: number,
 *   headerSize: number,
 * }} box
 * @returns {{ severity: "warning" | "error", message: string } | null}
 */
function getInputHeuristicNotice(box) {
  if (!/^[\x20-\x7e]{4}$/.test(box.type)) {
    return {
      severity: "error",
      message:
        "The first top-level box type is not a printable four-character code, so this input is unlikely to be ISOBMFF. The result below is tentative.",
    };
  }

  if (box.size !== 0 && box.size < box.headerSize) {
    return null;
  }

  if (!USUAL_FIRST_BOX_TYPES.has(box.type)) {
    return {
      severity: "error",
      message: `The first top-level box is "${box.type}", which is not a usual ISOBMFF entry box. This input may not be ISOBMFF; the result below is tentative.`,
    };
  }

  return null;
}
