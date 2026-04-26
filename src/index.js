import { handleDashSource } from "./setup/dash_resource.js";
import { probeRemoteSource } from "./setup/filetype_detection.js";
import { handleHlsSource } from "./setup/hls_resource.js";
import {
  beginInspectionLifecycle,
  finishInspectionLifecycle,
} from "./setup/InspectionLifecycle.js";
import {
  initializeFileDrop,
  initializeFileReaderInput,
  initializeUrlInput,
  parseLocalFile,
} from "./setup/inputs.js";
import {
  inspectChosenSegment,
  inspectRemoteSegment,
} from "./setup/remote_segment.js";
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
  const run = beginInspectionLifecycle();
  inspectRemoteUrl(url, run, companionInit).finally(() => {
    if (!hasVisibleSegmentChooser()) {
      finishInspectionLifecycle(run);
    }
  });
}

/**
 * @param {string} sourceUrl
 * @param {import("./setup/InspectionLifecycle.js").InspectionRun} run
 * @param {{ url: string, byteRange: [number, number|undefined]|undefined } | undefined} [companionInit]
 */
async function inspectRemoteUrl(sourceUrl, run, companionInit = undefined) {
  const signal = run.controller.signal;

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
      run,
      sourceUrl,
      originKindLabel,
      companionInit,
    );

  if (probe.kind === "dash") {
    return handleDashSource(sourceUrl, probe, run, onSegmentChosen);
  }
  if (probe.kind === "hls") {
    return handleHlsSource(sourceUrl, probe, run, onSegmentChosen);
  }

  // Plain ISOBMFF segment or unknown type — inspect directly.
  return inspectRemoteSegment(sourceUrl, undefined, run, {
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
