import deriveMediaInfo from "./read.js";

/**
 * @typedef {{
 *   mediaInfo: import("./box_analysis.js").MediaInfo,
 * }} InspectionProjections
 */

/**
 * TODO: Still needed?
 *
 * Compute completed semantic data used by result tabs.
 *
 * @param {Array<import("isobmff-inspector").ParsedBox>} topLevelBoxes
 * @param {{
 *   supplementalMetadata?: { boxes: Array<import("isobmff-inspector").ParsedBox> } | null,
 * }} [options]
 * @returns {InspectionProjections}
 */
export function deriveInspectionProjections(topLevelBoxes, options = {}) {
  return {
    mediaInfo: deriveMediaInfo(topLevelBoxes, {
      supplementalBoxes: options.supplementalMetadata?.boxes ?? null,
    }),
  };
}
