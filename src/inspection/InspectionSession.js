import CodecDetailsCoordinator from "../post-process/codec-details/coordinator.js";
import deriveCodecDetails from "../post-process/codec-details/index.js";

// TODO: Merge in some ways logic with `InspectionResultsView`?
export default class InspectionSession {
  #codecCoordinator;

  /**
   * @param {{
   *   supplementalBoxes?: Array<import("isobmff-inspector").ParsedBox> | null,
   * }} [options]
   */
  constructor(options = {}) {
    this.#codecCoordinator = new CodecDetailsCoordinator(options);
  }

  /**
   * @param {{
   *   type: string,
   *   offset: number,
   *   headerSize: number,
   *   size: number,
   * }} box
   * @param {number} depth
   */
  onBoxStart(box, depth) {
    if (depth !== 0) {
      return;
    }
    this.#codecCoordinator.onTopLevelBoxStart(box);
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {number} depth
   */
  onBoxComplete(box, depth) {
    if (depth !== 0) {
      return;
    }
    this.#codecCoordinator.onTopLevelBoxComplete(box);
  }

  /**
   * @param {import("isobmff-inspector").BoxPayloadChunkInfo} info
   * @param {Uint8Array} bytes
   */
  observePayloadChunk(info, bytes) {
    this.#codecCoordinator.consumeSpan({
      start: info.payloadAbsoluteOffset,
      bytes,
    });
  }

  /**
   * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
   * @param {Array<import("isobmff-inspector").ParsedBox>} supplementalBoxes
   */
  getCodecDetailsResults(boxes, supplementalBoxes) {
    return this.#codecCoordinator.mergeIntoResults(
      deriveCodecDetails(boxes, { supplementalBoxes }),
    );
  }

  getTopLevelBoxes() {
    return this.#codecCoordinator.getTopLevelBoxes();
  }
}
