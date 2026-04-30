import { shouldAutoOpenBox } from "./box_opening";
import renderBoxTreeNode from "./renderBoxTreeNode";

/**
 * View abstraction for one rendered box-tree node.
 */
export default class BoxTreeNodeView {
  /** @type {HTMLElement} */
  #element;
  /** @type {HTMLElement | null} */
  #childContainer;

  /**
   * @param {import("../../../utils/box_size").BoxWithOptionalActualSize} box
   * @param {{ autoOpen?: boolean, shallow?: boolean }} options
   */
  constructor(box, options = {}) {
    const { element, childContainer } = renderBoxTreeNode(box, options);
    this.#element = element;
    this.#childContainer = childContainer;
  }

  /**
   * @returns {HTMLElement}
   */
  get element() {
    return this.#element;
  }

  /**
   * Creates, attaches, and returns a child box view.
   * @param {import("../../../utils/box_size").BoxWithOptionalActualSize} box
   * @param {{ autoOpen?: boolean }} options
   * @returns {BoxTreeNodeView}
   */
  appendChildBox(box, options = {}) {
    if (!this.#childContainer) {
      throw new Error(
        `box ${box.type} cannot be appended without a child container`,
      );
    }

    const view = new BoxTreeNodeView(box, {
      autoOpen: this.#isOpen() && (options.autoOpen ?? true),
      shallow: true,
    });
    this.#childContainer.appendChild(view.element);
    return view;
  }

  /**
   * Updates this node from newer box data while preserving attached child views.
   * @param {import("isobmff-inspector").ParsedBox} box
   */
  updateBox(box) {
    const { element, childContainer } = renderBoxTreeNode(box, {
      autoOpen: this.#isOpen() && shouldAutoOpenBox(box),
      shallow: true,
    });

    if (this.#childContainer?.firstChild && !childContainer) {
      throw new Error(
        `box ${box.type} cannot preserve children without a child container`,
      );
    }

    if (this.#childContainer && childContainer) {
      while (this.#childContainer.firstChild) {
        childContainer.appendChild(this.#childContainer.firstChild);
      }
    }

    this.#element.replaceWith(element);
    this.#element = element;
    this.#childContainer = childContainer;
  }

  /**
   * @returns {boolean}
   */
  #isOpen() {
    return this.#element instanceof HTMLDetailsElement
      ? this.#element.open
      : false;
  }
}
