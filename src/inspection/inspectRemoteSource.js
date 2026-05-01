import { handleDashSource } from "../sources/dash_resource.js";
import { probeRemoteSource } from "../sources/filetype_detection.js";
import { handleHlsSource } from "../sources/hls_resource.js";
import fetchRemoteSegment from "../sources/remote_segment.js";
import { formatSegmentSourceValue } from "../utils/format.js";
import InspectionCoordinator from "./InspectionCoordinator.js";
import { parseInspectionStream } from "./parseInspectionStream.js";

/**
 * Start inspection for a remote URL while preserving the app's single active
 * inspection lifecycle.
 *
 * @param {string} url
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
 */
export function inspectRemoteSource(url, companionInit = undefined) {
  const { parseHandle, sourceHandle } = InspectionCoordinator.begin();
  inspectRemoteUrl(url, parseHandle, sourceHandle, companionInit)
    .catch((err) => {
      failSourceResolution(parseHandle, sourceHandle, err);
    })
    .finally(() => {
      if (!sourceHandle.hasActiveChooser) {
        InspectionCoordinator.finish(parseHandle);
      }
    });
}

/**
 * @param {string} sourceUrl
 * @param {import("./InspectionParseHandle.js").default} parseHandle
 * @param {import("./InspectionSourceHandle.js").default} sourceHandle
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
 */
async function inspectRemoteUrl(
  sourceUrl,
  parseHandle,
  sourceHandle,
  companionInit = undefined,
) {
  const signal = parseHandle.controller.signal;

  sourceHandle.dispatch({
    type: "remote-probe-started",
  });

  const probeResult = await probeRemoteSource(sourceUrl, signal);
  if (!InspectionCoordinator.isCurrent(parseHandle) || signal.aborted) {
    return;
  }

  const originKindLabel = getOriginKindLabel(probeResult.kind);

  /**
   * @param {string} segmentUrl
   * @param {[number, number|undefined]|undefined} byteRange
   * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [chosenCompanionInit]
   */
  const onSegmentChosen = (segmentUrl, byteRange, chosenCompanionInit) => {
    inspectRemoteSegment(
      parseHandle,
      sourceHandle,
      segmentUrl,
      byteRange,
      chosenCompanionInit,
      {
        selectedLabel: "Selected segment URL",
        selectedValue: segmentUrl,
        originValue: sourceUrl,
        originLabel: originKindLabel,
      },
    );
  };

  if (probeResult.kind === "dash") {
    return handleDashSource(
      sourceUrl,
      probeResult,
      onSegmentChosen,
      sourceHandle.dispatch.bind(sourceHandle),
      signal,
    );
  }
  if (probeResult.kind === "hls") {
    return handleHlsSource(
      sourceUrl,
      probeResult,
      onSegmentChosen,
      sourceHandle.dispatch.bind(sourceHandle),
      signal,
    );
  }

  // Plain ISOBMFF segment or unknown type — inspect directly.
  return inspectRemoteSegment(
    parseHandle,
    sourceHandle,
    probeResult.stream ?? sourceUrl,
    undefined,
    companionInit,
    {
      selectedLabel: "Remote resource",
      selectedValue: sourceUrl,
      totalBytes: probeResult.totalBytes,
    },
  );
}

/**
 * @param {import("./InspectionParseHandle.js").default} parseHandle
 * @param {import("./InspectionSourceHandle.js").default} sourceHandle
 * @param {string|AsyncIterable<Uint8Array>} input
 * @param {[number, number|undefined]|undefined} byteRange
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} companionInit
 * @param {{
 *   selectedLabel: string,
 *   selectedValue: string,
 *   originLabel?: string,
 *   originValue?: string,
 *   totalBytes?: number | null,
 * }} source
 * @returns {Promise<void>}
 */
function inspectRemoteSegment(
  parseHandle,
  sourceHandle,
  input,
  byteRange,
  companionInit,
  source,
) {
  const signal = parseHandle.controller.signal;

  if (!InspectionCoordinator.isCurrent(parseHandle) || signal.aborted) {
    return Promise.resolve();
  }

  sourceHandle.dispatch({
    type: "segment-fetch-started",
    source: {
      selectedLabel: source.selectedLabel,
      selectedValue: source.selectedValue,
      originLabel: source.originLabel,
      originValue: source.originValue,
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
    },
    hasRemoteFetch:
      typeof input === "string" ||
      companionInit !== undefined ||
      byteRange !== undefined,
  });

  return fetchRemoteSegment(input, byteRange, companionInit, signal)
    .then(({ segmentData, segmentTotalBytes, companionDataPromise }) =>
      parseInspectionStream(segmentData, parseHandle, {
        supplementalMetadataPromise: companionDataPromise,
        inputTotalBytes: segmentTotalBytes ?? source.totalBytes ?? null,
      }),
    )
    .catch((err) => {
      failSourceResolution(parseHandle, sourceHandle, err);
    })
    .finally(() => {
      InspectionCoordinator.finish(parseHandle);
    });
}

/**
 * @param {"dash" | "hls" | "segment"} kind
 */
function getOriginKindLabel(kind) {
  switch (kind) {
    case "dash":
      return "DASH manifest";
    case "hls":
      return "HLS playlist";
    case "segment":
      return "Remote resource";
  }
}

/**
 * @param {import("./InspectionParseHandle.js").default} parseHandle
 * @param {import("./InspectionSourceHandle.js").default} sourceHandle
 * @param {unknown} err
 */
function failSourceResolution(parseHandle, sourceHandle, err) {
  if (
    parseHandle.controller.signal.aborted ||
    !InspectionCoordinator.isCurrent(parseHandle)
  ) {
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  sourceHandle.dispatch({
    type: "source-resolution-failed",
    error,
  });
}
