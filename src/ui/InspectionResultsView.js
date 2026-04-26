import { requireElementById } from "../utils/dom.js";
import {
  BoxTreeNodeView,
  renderCodecDetails,
  renderMediaInfo,
  renderSampleView,
  renderSizeChart,
  renderTreePositionMap,
  switchToTab,
} from "./tabs/index.js";

const AUTO_OPEN_BOX_LIMIT = 200;

/**
 * Handle the central UI around result presentation, both wile parsing (where
 * the progressive box tree is shown) and at its end (where all UI formatting)
 * the result is shown.
 *
 * @typedef {{ severity: "warning" | "error", message: string }} ParseNotice
 * @typedef {import("../utils/box_size.js").BoxWithOptionalActualSize} PendingParsedBox
 */

class InspectionResultsViewClass {
  #tabs = requireElementById("tabs", HTMLElement);
  #results = requireElementById("results", HTMLElement);
  #resultNotices = requireElementById("result-notices", HTMLElement);
  #boxesPanel = requireElementById("tab-boxes", HTMLElement);
  #infoPanel = requireElementById("tab-info", HTMLElement);
  #wrapper = requireElementById("file-description", HTMLElement);
  #mediaInfo = requireElementById("media-info", HTMLElement);
  #codecTabButton = requireElementById(
    "tab-button-codec-details",
    HTMLButtonElement,
  );
  #codecPanel = requireElementById("tab-codec-details", HTMLElement);
  #codecDetails = requireElementById("codec-details", HTMLElement);
  #sizesPanel = requireElementById("tab-sizes", HTMLElement);
  #sizeChart = requireElementById("size-chart", HTMLElement);
  #sampleTabButton = requireElementById(
    "tab-button-samples",
    HTMLButtonElement,
  );
  #sampleTabPanel = requireElementById("tab-samples", HTMLElement);
  #sampleView = requireElementById("sample-view", HTMLElement);
  /** @type {Array<import("./tabs/index.js").BoxTreeNodeView>} */
  #stack = [];
  #renderedBoxCount = 0;
  #abortCtrlr = new AbortController();

  /**
   * @param {boolean} isLoading
   */
  setLoading(isLoading) {
    this.#results.classList.toggle("is-stale-loading", isLoading);
    this.#results.inert = isLoading;
    this.#results.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  /**
   * TODO: seems awkward here
   */
  finishRequest() {
    this.#results.setAttribute("aria-busy", "false");
  }

  /**
   * Clear the whole inspection UI.
   */
  clear() {
    this.#abortCtrlr.abort();
    this.#abortCtrlr = new AbortController();
    this.#clearDom();
    this.#stack.length = 0;
    this.#renderedBoxCount = 0;
  }

  /**
   * Setup the base UI for a new parsed file.
   */
  initializeForNewRender() {
    this.clear();
    this.#results.setAttribute("aria-busy", "true");
    this.#tabs.hidden = false;
    switchToTab("boxes");
    this.#tabs.classList.add("is-reserved");
    this.#tabs.classList.remove("is-visible");
  }

  /**
   * Begin rendering the box that has just been encounted while parsing
   * in the "box tree" that should be currently in view.
   * @param {PendingParsedBox} box
   * @param {number} depth
   * @param {string[]} path
   */
  renderBoxTreeStart(box, depth, path) {
    this.#stack.length = depth;
    const shouldAutoOpen = this.#renderedBoxCount < AUTO_OPEN_BOX_LIMIT;
    this.#renderedBoxCount++;
    const view =
      depth === 0
        ? new BoxTreeNodeView(box, {
            autoOpen: shouldAutoOpen,
            shallow: true,
          })
        : this.#stack[depth - 1]?.appendChildBox(box, {
            autoOpen: shouldAutoOpen,
          });
    if (!view) {
      throw new Error(`missing parent for ${path.join("/")}`);
    }
    if (depth === 0) {
      this.#wrapper.appendChild(view.element);
    }
    this.#stack[depth] = view;
  }

  /**
   * Once a box has been completely parsed, updated with potential new
   * information since `renderBoxTreeStart` was called.
   * This function returns `true` if it could complete the box. See return
   * value documentation for the semantics of a `false` return value.
   *
   * @param {import("isobmff-inspector").ParsedBox} box - The full box
   * metadata to add to the tree.
   * @param {number} depth - The "depth" of the box, `0` being top-level. used
   * for defensive reasons.
   * @returns {boolean} - Returns `false` either if this box was never
   * signaled through `renderBoxTreeStart`, or if it wasn't the last one
   * encountered at that depth.
   * In both of those cases, nothing new has been rendered.
   * Returns `true` if it was the last "started" box at that depth and
   * render the supplementary information.
   */
  completeStartedBox(box, depth) {
    const current = this.#stack[depth];
    if (!current) {
      return false;
    }

    current.updateBox(box);
    return true;
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   */
  appendStandaloneTopLevelBox(box) {
    const view = new BoxTreeNodeView(box, {
      autoOpen: true,
    });
    this.#wrapper.appendChild(view.element);
  }

  /**
   * Add the given "notice" (e.g. warning / error proeminently featured on
   * screen) to the UI.
   * @param {ParseNotice} notice
   */
  renderNotice(notice) {
    const noticeEl = document.createElement("div");
    noticeEl.className = `parse-notice issue-list${
      notice.severity === "warning" ? " warn" : ""
    }`;
    const item = document.createElement("div");
    item.className = "issue-item";
    item.textContent = notice.message;
    noticeEl.appendChild(item);
    this.#resultNotices.appendChild(noticeEl);
  }

  /**
   * To call once parsing is finished, to start rendering the full analysis
   * UI on that file.
   * @param {{
   *   topLevelBoxes: Array<import("isobmff-inspector").ParsedBox>,
   *   supplementalMetadata?: {
   *     boxes: Array<import("isobmff-inspector").ParsedBox>,
   *   } | null,
   *   codecDetailsResults?: Array<any> | null,
   *   remoteDeferredAnalysisAction?: {
   *     state: any,
   *     run: () => Promise<{ state: any, results: Array<any> } | null>,
   *   } | null,
   * } | null} [options]
   */
  renderFullResults(options = null) {
    const topLevelBoxes = options?.topLevelBoxes ?? [];
    const supplementalMetadata = options?.supplementalMetadata ?? null;
    const renderOptions = supplementalMetadata
      ? { supplementalBoxes: supplementalMetadata.boxes }
      : {};
    renderMediaInfo(topLevelBoxes, renderOptions);
    const hasCodecDetails = renderCodecDetails(topLevelBoxes, {
      ...renderOptions,
      results: options?.codecDetailsResults ?? null,
      remoteDeferredAnalysisAction:
        options?.remoteDeferredAnalysisAction ?? null,
    });
    this.#codecTabButton.hidden = !hasCodecDetails;
    this.#codecPanel.hidden = !hasCodecDetails;
    const hasSampleView = renderSampleView(topLevelBoxes, renderOptions);
    this.#sampleTabButton.hidden = !hasSampleView;
    this.#sampleTabPanel.hidden = !hasSampleView;
    renderSizeChart(topLevelBoxes);
    renderTreePositionMap(
      topLevelBoxes,
      this.#wrapper,
      this.#abortCtrlr.signal,
    );
    this.#tabs.classList.remove("is-reserved");
    this.#tabs.classList.add("is-visible");
  }

  /**
   * To call if parsing failed, this will update the UI accordingly.
   */
  finalizeFailedRender() {
    this.#tabs.hidden = true;
    this.#tabs.classList.remove("is-reserved", "is-visible");
    this.#abortCtrlr.abort();
  }

  #clearDom() {
    this.#resultNotices.replaceChildren();
    this.#restorePanelRoot(this.#boxesPanel, this.#wrapper);
    this.#restorePanelRoot(this.#infoPanel, this.#mediaInfo);
    this.#restorePanelRoot(this.#codecPanel, this.#codecDetails);
    this.#restorePanelRoot(this.#sampleTabPanel, this.#sampleView);
    this.#restorePanelRoot(this.#sizesPanel, this.#sizeChart);
    this.#codecTabButton.hidden = true;
    this.#codecPanel.hidden = true;
    this.#sampleTabButton.hidden = true;
    this.#sampleTabPanel.hidden = true;
    this.#tabs.hidden = true;
    this.#tabs.classList.remove("is-reserved", "is-visible");
    this.#results.classList.remove("is-stale-loading");
    this.#results.inert = false;
    this.#results.setAttribute("aria-busy", "false");
  }

  /**
   * @param {HTMLElement} panel
   * @param {HTMLElement} root
   */
  #restorePanelRoot(panel, root) {
    if (root.parentElement !== panel) {
      panel.replaceChildren(root);
    } else {
      const siblings = panel.children;
      while (siblings.length > 1) {
        panel.removeChild(siblings[siblings.length - 1]);
      }
    }
    root.replaceChildren();
    panel.hidden = panel !== this.#boxesPanel;
    panel.classList.toggle("active", panel === this.#boxesPanel);
  }
}

const InspectionResultsView = new InspectionResultsViewClass();

export default InspectionResultsView;
