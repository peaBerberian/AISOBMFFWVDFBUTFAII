import {
  parseMPDFromString,
  parseMPDFromURL,
  resolveIndexForRepresentation,
} from "./extractors/dash/index.js";
import InspectionResultsView from "./ui/InspectionResultsView.js";
import { setInspectionSource } from "./ui/InspectionSourceElement.js";
import { showDashSegmentChooser } from "./ui/PlaylistSegmentChooser.js";
import ProgressBar from "./ui/ProgressBar.js";

/**
 * Handle a remote URL that has been identified as a DASH manifest:
 * parse it, validate it has inspectable representations, then show the
 * segment chooser UI.
 *
 * @param {string} sourceUrl
 * @param {{ text: string | null }} probe
 * @param {AbortController} controller
 * @param {(
 *   segmentUrl: string,
 *   byteRange: [number, number|undefined]|undefined,
 *   companionInit: { url: string, byteRange: [number, number|undefined]|undefined } | undefined
 * ) => void} onSegmentChosen
 * @returns {Promise<void>}
 */
export async function handleDashSource(
  sourceUrl,
  probe,
  controller,
  onSegmentChosen,
) {
  const signal = controller.signal;

  setInspectionSource({
    selectedLabel: "DASH manifest",
    selectedValue: sourceUrl,
  });
  ProgressBar.updateStatus("Loading DASH manifest…");

  try {
    const tree =
      probe.text !== null
        ? parseMPDFromString(probe.text, sourceUrl, signal)
        : await parseMPDFromURL(sourceUrl, signal);

    if (signal.aborted) {
      return;
    }

    if (countDashChoices(tree) === 0) {
      InspectionResultsView.clear();
      ProgressBar.fail("No ISOBMFF segments found in DASH manifest.");
      return;
    }

    ProgressBar.end(
      "DASH manifest loaded. Choose a representation to inspect or load on demand.",
    );
    InspectionResultsView.clear();

    const renderChooser = () => {
      showDashSegmentChooser(
        sourceUrl,
        tree,
        onSegmentChosen,
        async (representation) => {
          ProgressBar.start("Loading DASH segment list...");
          ProgressBar.startEasing();
          try {
            await resolveIndexForRepresentation(representation, signal);
            if (signal.aborted) {
              return;
            }
            ProgressBar.end("DASH segment list loaded.");
            renderChooser();
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

    renderChooser();
  } catch (err) {
    if (!signal.aborted) {
      InspectionResultsView.clear();
      const message = err instanceof Error ? err.message : err;
      ProgressBar.fail(`Manifest error: ${message}`);
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
