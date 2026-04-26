import InspectionResultsView from "../ui/InspectionResultsView.js";
import { setInspectionSource } from "../ui/InspectionSourceElement.js";
import { hideSegmentChooser } from "../ui/PlaylistSegmentChooser.js";
import ProgressBar from "../ui/ProgressBar.js";
import { createAbortableAsyncIterable } from "../utils/abortables.js";
import { formatSegmentSourceValue } from "../utils/format.js";
import {
  finishInspectionLifecycle,
  isCurrentInspection,
} from "./InspectionLifecycle.js";
import {
  parseAndRenderSegment,
  parseSegmentWithoutRender,
} from "./parseSegment.js";

/**
 * @param {string} url
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {AbortSignal} signal
 * @returns {Promise<import("isobmff-inspector").ISOBMFFInput>}
 */
export async function fetchSegmentInput(url, byteRange, signal) {
  /** @type {HeadersInit} */
  const headers = {};
  if (byteRange !== undefined) {
    const [start, end] = byteRange;
    headers.Range =
      end !== undefined ? `bytes=${start}-${end}` : `bytes=${start}-`;
  }
  const r = await fetch(url, { signal, headers });
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (!r.ok) {
    InspectionResultsView.clear();
    const errMsg = `HTTP ${r.status}${r.statusText ? ` ${r.statusText}` : ""}`;
    throw new Error(`fetch error: ${errMsg}`);
  }
  return r.body ? createAbortableAsyncIterable(r.body, signal) : r;
}

/**
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined }} segment
 * @param {AbortSignal} signal
 * @returns {Promise<{ boxes: Array<import("isobmff-inspector").ParsedBox> }>}
 */
async function loadSupplementalInitMetadata(segment, signal) {
  const input = await fetchSegmentInput(segment.url, segment.byteRange, signal);
  const boxes = await parseSegmentWithoutRender(input, signal);
  return { boxes };
}

/**
 * @typedef {{
 *   selectedLabel: string,
 *   selectedValue: string,
 *   originLabel?: string,
 *   originValue?: string,
 *   extraSources?: Array<{ label: string, value: string }>,
 *   companionInit?: { url: string, byteRange: [number, number|undefined]|undefined },
 *   input?: import("isobmff-inspector").ISOBMFFInput,
 *   startMessage?: string,
 *   statusMessage?: string,
 * }} RemoteSegmentOptions
 */

/**
 * Fetch, parse, and render a remote segment.
 * Returns immediately if the run is no longer current or was aborted.
 *
 * @param {string} segmentUrl
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {import("./InspectionLifecycle.js").InspectionRun} run
 * @param {RemoteSegmentOptions} options
 * @returns {Promise<void>}
 */
export function inspectRemoteSegment(
  segmentUrl,
  byteRange,
  run,
  {
    selectedLabel,
    selectedValue,
    originLabel,
    originValue,
    extraSources,
    companionInit = undefined,
    input = undefined,
    startMessage = "Fetching segment...",
    statusMessage = undefined,
  },
) {
  if (!isCurrentInspection(run) || run.controller.signal.aborted) {
    return Promise.resolve();
  }

  if (startMessage !== undefined) {
    ProgressBar.start(startMessage);
    ProgressBar.startEasing();
  } else if (statusMessage !== undefined) {
    ProgressBar.updateStatus(statusMessage);
  }

  setInspectionSource({
    selectedLabel,
    selectedValue,
    originLabel,
    originValue,
    extraSources,
  });
  hideSegmentChooser();

  const inputPromise =
    input !== undefined
      ? Promise.resolve(input)
      : fetchSegmentInput(segmentUrl, byteRange, run.controller.signal);

  return inputPromise
    .then((segmentInput) => {
      const supplementalMetadataPromise = companionInit
        ? loadSupplementalInitMetadata(companionInit, run.controller.signal)
        : Promise.resolve(null);
      return parseAndRenderSegment(segmentInput, run, {
        supplementalMetadataPromise,
      });
    })
    .catch((err) => {
      if (!run.controller.signal.aborted) {
        ProgressBar.fail(err instanceof Error ? err.message : "Unknown Error");
      }
    })
    .finally(() => {
      finishInspectionLifecycle(run);
    });
}

/**
 * Convenience wrapper used by playlist choosers (DASH / HLS) when the user
 * picks a specific segment. Applies standard labels and delegates to
 * `inspectRemoteSegment`.
 *
 * @param {string} segmentUrl
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {import("./InspectionLifecycle.js").InspectionRun} run
 * @param {string | null} originUrl
 * @param {string | null} originKind
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
 * @returns {Promise<void>}
 */
export function inspectChosenSegment(
  segmentUrl,
  byteRange,
  run,
  originUrl = null,
  originKind = null,
  companionInit = undefined,
) {
  return inspectRemoteSegment(segmentUrl, byteRange, run, {
    selectedLabel: "Selected segment URL",
    selectedValue: segmentUrl,
    originLabel: originUrl && originKind ? `${originKind} source` : undefined,
    originValue: originUrl ?? undefined,
    extraSources: companionInit
      ? [
          {
            label: "Side-loaded init metadata",
            value: formatSegmentSourceValue(
              companionInit.url,
              companionInit.byteRange,
            ),
          },
        ]
      : undefined,
    companionInit,
    startMessage: "Fetching segment...",
  });
}
