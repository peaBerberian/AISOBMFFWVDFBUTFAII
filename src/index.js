import { handleDashSource } from "./dash_resource.js";
import { probeRemoteSource } from "./filetype_detection.js";
import { handleHlsSource } from "./hls_resource.js";
import {
  inspectChosenSegment,
  inspectRemoteSegment,
} from "./remote_segment.js";
import {
  beginInspectionLifecycle,
  finishInspectionLifecycle,
} from "./ui/InspectionLifecycle.js";
import {
  initializeFileDrop,
  initializeFileReaderInput,
  initializeUrlInput,
  parseLocalFile,
} from "./ui/inputs.js";
import { hasVisibleSegmentChooser } from "./ui/PlaylistSegmentChooser.js";
import ProgressBar from "./ui/ProgressBar.js";
import { initializeTabNavigation } from "./ui/tabs/index.js";
import { requireElementById } from "./utils/dom.js";
import { formatSegmentSourceValue } from "./utils/format.js";

initializeFileReaderInput(parseLocalFile);
initializeFileDrop(parseLocalFile);
initializeUrlInput(inspectUrl);
initializeTabNavigation();
initializeGithubStars();

/**
 * @param {string} url
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
 */
function inspectUrl(url, companionInit = undefined) {
  const controller = beginInspectionLifecycle();
  inspectRemoteUrl(url, controller, companionInit).finally(() => {
    if (!hasVisibleSegmentChooser()) {
      finishInspectionLifecycle(controller);
    }
  });
}

/**
 * @param {string} sourceUrl
 * @param {AbortController} controller
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
 */
async function inspectRemoteUrl(
  sourceUrl,
  controller,
  companionInit = undefined,
) {
  const signal = controller.signal;

  ProgressBar.start("Probing remote source…");
  ProgressBar.startEasing();

  const probe = await probeRemoteSource(sourceUrl, signal);
  if (signal.aborted) {
    return;
  }

  /**
   * @param {string} segmentUrl
   * @param {[number, number|undefined]|undefined} byteRange
   * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
   */
  const originKindLabel =
    probe.kind === "dash"
      ? "DASH manifest"
      : probe.kind === "hls"
        ? "HLS playlist"
        : "Remote resource";

  /**
   * @param {string} segmentUrl
   * @param {[number, number|undefined]|undefined} byteRange
   * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
   */
  const onSegmentChosen = (segmentUrl, byteRange, companionInit) =>
    inspectChosenSegment(
      segmentUrl,
      byteRange,
      controller,
      sourceUrl,
      originKindLabel,
      companionInit,
    );

  if (probe.kind === "dash") {
    return handleDashSource(sourceUrl, probe, controller, onSegmentChosen);
  }
  if (probe.kind === "hls") {
    return handleHlsSource(sourceUrl, probe, controller, onSegmentChosen);
  }

  // Plain ISOBMFF segment or unknown type — inspect directly.
  return inspectRemoteSegment(sourceUrl, undefined, controller, {
    selectedLabel: "Remote resource",
    selectedValue: sourceUrl,
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
    input: probe.stream ?? undefined,
    startMessage: companionInit ? "Fetching segment..." : undefined,
    statusMessage: "fetching…",
  });
}

function initializeGithubStars() {
  if (!("fetch" in window)) {
    return;
  }
  const starsElt = requireElementById("github-stars", HTMLElement);

  const fetchStars = async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/peaBerberian/AISOBMFFWVDFBUTFAII",
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!response.ok) {
        return;
      }

      const repository = await response.json();
      if (typeof repository.stargazers_count !== "number") {
        return;
      }

      starsElt.textContent = new Intl.NumberFormat(undefined, {
        notation: repository.stargazers_count >= 1000 ? "compact" : "standard",
      }).format(repository.stargazers_count);
      starsElt.hidden = false;
    } catch {
      // Keep the project link unobtrusive if GitHub is unavailable.
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fetchStars);
  } else {
    globalThis.setTimeout(fetchStars, 1000);
  }
}
