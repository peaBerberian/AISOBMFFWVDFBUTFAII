import InspectionResultsView from "../ui/InspectionResultsView.js";
import { setInspectionSource } from "../ui/InspectionSourceElement.js";
import { showHlsSegmentChooser } from "../ui/PlaylistSegmentChooser.js";
import ProgressBar from "../ui/ProgressBar.js";
import {
  extractISOBMFFPlaylistMetadata,
  extractISOBMFFPlaylistMetadataFromString,
  resolveMediaPlaylist,
} from "./extractors/hls/index.js";

/**
 * Handle a remote URL that has been identified as an HLS playlist:
 * parse it, validate it has inspectable segments, then show the
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
export async function handleHlsSource(
  sourceUrl,
  probe,
  controller,
  onSegmentChosen,
) {
  const signal = controller.signal;

  setInspectionSource({
    selectedLabel: "HLS playlist",
    selectedValue: sourceUrl,
  });
  ProgressBar.updateStatus("Loading HLS playlist…");

  try {
    const extraction =
      probe.text !== null
        ? extractISOBMFFPlaylistMetadataFromString(probe.text, sourceUrl)
        : await extractISOBMFFPlaylistMetadata(sourceUrl, signal);

    if (signal.aborted) {
      return;
    }

    if (countHlsChoices(extraction) === 0) {
      InspectionResultsView.clear();
      ProgressBar.fail("No ISOBMFF segments found in HLS playlist.");
      return;
    }

    ProgressBar.end("HLS playlist loaded.");
    InspectionResultsView.clear();

    const renderChooser = () => {
      showHlsSegmentChooser(
        sourceUrl,
        extraction,
        onSegmentChosen,
        async (result) => {
          ProgressBar.start("Loading HLS segment list...");
          ProgressBar.startEasing();
          try {
            await resolveMediaPlaylist(result, signal);
            if (signal.aborted) {
              return;
            }
            ProgressBar.end("HLS segment list loaded");
            renderChooser();
          } catch (err) {
            if (!signal.aborted) {
              const message = err instanceof Error ? err.message : err;
              ProgressBar.fail(`playlist error: ${message}`);
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
      ProgressBar.fail(`playlist error: ${message}`);
      throw err;
    }
  }
}

/**
 * Count how many inspectable ISOBMFF entries exist in an HLS extraction result.
 * @param {import("./extractors/hls/index.js").ExtractionResult} extraction
 * @returns {number}
 */
function countHlsChoices(extraction) {
  let count = 0;
  for (const result of extraction.results) {
    if (result.segments === null) {
      count++;
      continue;
    }
    const seenMapKeys = new Set();
    for (const segment of result.segments) {
      if (segment.map) {
        const mapKey = `${segment.map.url}:${segment.map.byteRange?.[0] ?? ""}:${segment.map.byteRange?.[1] ?? ""}`;
        if (!seenMapKeys.has(mapKey)) {
          seenMapKeys.add(mapKey);
          count++;
        }
      }
      count++;
    }
  }
  return count;
}
