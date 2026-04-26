import InspectionResultsView from "../ui/InspectionResultsView.js";
import { clearInspectionSource } from "../ui/InspectionSourceElement.js";
import { hideSegmentChooser } from "../ui/PlaylistSegmentChooser.js";
import ProgressBar from "../ui/ProgressBar.js";

/**
 * Per-inspection app run state. Only one run may be current at a time.
 *
 * @typedef InspectionRun
 * @property {AbortController} controller - Allows to abort or check if that
 * run was already aborted.
 * @property {import("./InspectionSession.js").default | null} session - Instance
 * running advanced analysis on the file while it is being parsed.
 * @property {() => boolean} isCurrent - Returns `true` if this inspection is
 * the current one being done.
 */

/** @type {InspectionRun | null} */
let currentInspectionRun = null;

/**
 * @returns {InspectionRun}
 */
export function beginInspectionLifecycle() {
  currentInspectionRun?.controller.abort();
  hideSegmentChooser();
  const controller = new AbortController();
  /** @type {InspectionRun} */
  const run = {
    controller,
    session: null,
    isCurrent() {
      return isCurrentInspection(run);
    },
  };
  currentInspectionRun = run;
  ProgressBar.bindAbortController(controller);
  InspectionResultsView.setLoading(true);
  controller.signal.addEventListener(
    "abort",
    () => {
      if (currentInspectionRun !== run) {
        return;
      }
      hideSegmentChooser();
      clearInspectionSource();
      InspectionResultsView.clear();
      InspectionResultsView.setLoading(false);
      ProgressBar.bindAbortController(null);
      currentInspectionRun = null;
    },
    { once: true },
  );
  return run;
}

/**
 * @param {InspectionRun} run
 */
export function finishInspectionLifecycle(run) {
  if (currentInspectionRun !== run) {
    return;
  }
  hideSegmentChooser();
  InspectionResultsView.setLoading(false);
  ProgressBar.bindAbortController(null);
  currentInspectionRun = null;
}

/**
 * @param {InspectionRun} run
 * @returns {boolean}
 */
export function isCurrentInspection(run) {
  return currentInspectionRun === run;
}
