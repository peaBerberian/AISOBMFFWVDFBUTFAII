import {
  parseMPDFromString,
  parseMPDFromURL,
  resolveIndexForRepresentation,
} from "./extractors/dash/index.js";

/**
 * Handle a remote URL that has been identified as a DASH manifest:
 * parse it, validate it has inspectable representations, then show the
 * segment chooser UI.
 *
 * @param {string} sourceUrl
 * @param {{ text: string | null }} probeResult
 * @param {(
 *   segmentUrl: string,
 *   byteRange: [number, number|undefined]|undefined,
 *   companionInit: { url: string, byteRange: [number, number|undefined]|undefined } | undefined
 * ) => void} onSegmentChosen
 * @param {(action: import("../inspection/InspectionSourceHandle.js").SourceAction) => void} dispatch
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
export async function handleDashSource(
  sourceUrl,
  probeResult,
  onSegmentChosen,
  dispatch,
  signal,
) {
  dispatch({
    type: "manifest-loading",
    sourceKind: "dash",
    source: {
      selectedLabel: "DASH manifest",
      selectedValue: sourceUrl,
    },
  });

  try {
    const tree =
      probeResult.text !== null
        ? parseMPDFromString(probeResult.text, sourceUrl, signal)
        : await parseMPDFromURL(sourceUrl, signal);

    if (signal.aborted) {
      return;
    }

    if (countDashChoices(tree) === 0) {
      const error = new Error("No ISOBMFF segments found in DASH manifest.");
      dispatch({
        type: "source-resolution-failed",
        error,
      });
      return;
    }

    const renderChooser = () => {
      dispatch({
        type: "segment-choices-available",
        sourceKind: "dash",
        sourceUrl,
        tree,
        onInspect: onSegmentChosen,
        async onLoadRepresentation(representation) {
          dispatch({
            type: "segment-list-loading",
            sourceKind: "dash",
          });
          try {
            await resolveIndexForRepresentation(representation, signal);
            if (signal.aborted) {
              return;
            }
            dispatch({
              type: "segment-list-loaded",
              sourceKind: "dash",
            });
            renderChooser();
          } catch (err) {
            if (!signal.aborted) {
              dispatch({
                type: "segment-list-failed",
                sourceKind: "dash",
                error: err instanceof Error ? err : new Error(String(err)),
              });
              throw err;
            }
          }
        },
      });
    };

    dispatch({
      type: "manifest-loaded",
      sourceKind: "dash",
    });
    renderChooser();
  } catch (err) {
    if (!signal.aborted) {
      dispatch({
        type: "source-resolution-failed",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }
}

/**
 * Count how many ISOBMFF-backed representations exist in a DASH tree.
 * @param {import("./extractors/dash/types.js").DashTree} tree
 * @returns {number}
 */
function countDashChoices(tree) {
  let count = 0;
  for (const period of tree.periods) {
    for (const adaptation of period.adaptationSets) {
      for (const representation of adaptation.representations) {
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
