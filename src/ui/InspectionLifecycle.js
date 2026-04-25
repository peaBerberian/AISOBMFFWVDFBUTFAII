import InspectionResultsView from "./InspectionResultsView.js";
import { clearInspectionSource } from "./InspectionSourceElement.js";
import { hideSegmentChooser } from "./PlaylistSegmentChooser.js";
import ProgressBar from "./ProgressBar.js";

/**
 * AbortController linked to the current segment/file parsing process.
 * Only one parsing process maximum can take place at a time.
 * @type {AbortController | null}
 */
let currentSegmentParsingAbortController = null;

/**
 * @returns {AbortController}
 */
export function beginInspectionLifecycle() {
  currentSegmentParsingAbortController?.abort();
  hideSegmentChooser();
  currentSegmentParsingAbortController = new AbortController();
  const controller = currentSegmentParsingAbortController;
  ProgressBar.bindAbortController(controller);
  InspectionResultsView.setLoading(true);
  controller.signal.addEventListener(
    "abort",
    () => {
      if (currentSegmentParsingAbortController !== controller) {
        return;
      }
      hideSegmentChooser();
      clearInspectionSource();
      InspectionResultsView.clear();
      InspectionResultsView.setLoading(false);
      ProgressBar.bindAbortController(null);
      currentSegmentParsingAbortController = null;
    },
    { once: true },
  );
  return controller;
}

/**
 * @param {AbortController} controller
 */
export function finishInspectionLifecycle(controller) {
  if (currentSegmentParsingAbortController !== controller) {
    return;
  }
  hideSegmentChooser();
  InspectionResultsView.setLoading(false);
  ProgressBar.bindAbortController(null);
  currentSegmentParsingAbortController = null;
}

/**
 * @param {AbortController} controller
 * @returns {boolean}
 */
export function isCurrentInspection(controller) {
  return currentSegmentParsingAbortController === controller;
}
