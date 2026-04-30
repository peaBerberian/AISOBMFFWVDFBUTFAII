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
export async function handleHlsSource(
  sourceUrl,
  probeResult,
  onSegmentChosen,
  dispatch,
  signal,
) {
  dispatch({
    type: "manifest-loading",
    source: {
      selectedLabel: "HLS playlist",
      selectedValue: sourceUrl,
    },
    status: {
      message: "Loading HLS playlist…",
      state: "start",
      progress: { phase: "manifest", indeterminate: true },
    },
  });

  try {
    const extraction =
      probeResult.text !== null
        ? extractISOBMFFPlaylistMetadataFromString(probeResult.text, sourceUrl)
        : await extractISOBMFFPlaylistMetadata(sourceUrl, signal);

    if (signal.aborted) {
      return;
    }

    if (countHlsChoices(extraction) === 0) {
      const error = new Error("No ISOBMFF segments found in HLS playlist.");
      dispatch({
        type: "source-resolution-failed",
        error,
        status: { message: error.message, state: "error" },
      });
      return;
    }

    const renderChooser = () => {
      dispatch({
        type: "segment-choices-available",
        sourceKind: "hls",
        sourceUrl,
        extraction,
        onInspect: onSegmentChosen,
        status: {
          message: "HLS playlist loaded.",
          state: "success",
          progress: { phase: "manifest", ratio: 1 },
        },
        async onLoadResult(result) {
          dispatch({
            type: "segment-list-loading",
            status: {
              message: "Loading HLS segment list...",
              state: "start",
              progress: { phase: "resolve", indeterminate: true },
            },
          });
          try {
            await resolveMediaPlaylist(result, signal);
            if (signal.aborted) {
              return;
            }
            dispatch({
              type: "segment-list-loaded",
              status: {
                message: "HLS segment list loaded",
                state: "success",
                progress: { phase: "resolve", ratio: 1 },
              },
            });
            renderChooser();
          } catch (err) {
            if (!signal.aborted) {
              const message = err instanceof Error ? err.message : err;
              dispatch({
                type: "segment-list-failed",
                status: {
                  message: `playlist error: ${message}`,
                  state: "error",
                },
              });
              throw err;
            }
          }
        },
      });
    };

    renderChooser();
  } catch (err) {
    if (!signal.aborted) {
      const message = err instanceof Error ? err.message : err;
      dispatch({
        type: "source-resolution-failed",
        error: err instanceof Error ? err : new Error(String(err)),
        status: { message: `playlist error: ${message}`, state: "error" },
      });
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
