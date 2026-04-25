import { requireElementById } from "../utils/dom.js";
import {
  BoxTreeNodeView,
  renderMediaInfo,
  renderSampleView,
  renderSizeChart,
  renderTreePositionMap,
  switchToTab,
} from "./tabs/index.js";

const AUTO_OPEN_BOX_LIMIT = 200;

/**
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
  /** @type {Array<import("isobmff-inspector").ParsedBox>} */
  #topLevelBoxes = [];
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

  clear() {
    this.#abortCtrlr.abort();
    this.#abortCtrlr = new AbortController();
    this.#clearDom();
    this.#stack.length = 0;
    this.#topLevelBoxes.length = 0;
    this.#renderedBoxCount = 0;
  }

  prepareForParsing() {
    this.clear();
    this.#results.setAttribute("aria-busy", "true");
    this.#tabs.hidden = false;
    switchToTab("boxes");
    this.#tabs.classList.add("is-reserved");
    this.#tabs.classList.remove("is-visible");
  }

  /**
   * @param {PendingParsedBox} box
   * @param {number} depth
   * @param {string[]} path
   */
  beginBox(box, depth, path) {
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
   * @param {import("isobmff-inspector").ParsedBox} box
   * @param {number} depth
   * @param {string[]} path
   * @returns {boolean}
   */
  completeBox(box, depth, path) {
    const current = this.#stack[depth];
    if (!current) {
      if (depth !== 0) {
        throw new Error(`missing started box for ${path.join("/")}`);
      }
      return false;
    }

    current.updateBox(box);
    if (depth === 0) {
      this.#topLevelBoxes.push(box);
    }
    return true;
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   */
  appendRecoveredTopLevelBox(box) {
    const recoveredBox = {
      ...box,
      type: box.type || "(header)",
      description:
        box.description ??
        "The parser could not read a complete top-level box header.",
    };
    const view = new BoxTreeNodeView(recoveredBox, {
      autoOpen: true,
    });
    this.#wrapper.appendChild(view.element);
    this.#topLevelBoxes.push(recoveredBox);
  }

  /**
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

  finalize() {
    renderMediaInfo(this.#topLevelBoxes);
    const hasSampleView = renderSampleView(this.#topLevelBoxes);
    this.#sampleTabButton.hidden = !hasSampleView;
    this.#sampleTabPanel.hidden = !hasSampleView;
    renderSizeChart(this.#topLevelBoxes);
    renderTreePositionMap(
      this.#topLevelBoxes,
      this.#wrapper,
      this.#abortCtrlr.signal,
    );
    this.#tabs.classList.remove("is-reserved");
    this.#tabs.classList.add("is-visible");
  }

  fail() {
    this.#tabs.hidden = true;
    this.#tabs.classList.remove("is-reserved", "is-visible");
    this.#abortCtrlr.abort();
  }

  finishRequest() {
    this.#results.setAttribute("aria-busy", "false");
  }

  #clearDom() {
    this.#resultNotices.replaceChildren();
    this.#restorePanelRoot(this.#boxesPanel, this.#wrapper);
    this.#restorePanelRoot(this.#infoPanel, this.#mediaInfo);
    this.#restorePanelRoot(this.#sampleTabPanel, this.#sampleView);
    this.#restorePanelRoot(this.#sizesPanel, this.#sizeChart);
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
