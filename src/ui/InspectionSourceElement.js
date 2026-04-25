import { requireElementById } from "../utils/dom.js";
import { createCompactSource } from "../utils/source-utils.js";

const rootElt = requireElementById("inspection-source", HTMLElement);

/**
 * @param {{
 *   selectedLabel: string,
 *   selectedValue: string,
 *   originLabel?: string,
 *   originValue?: string,
 * }} input
 */
export function setInspectionSource(input) {
  rootElt.replaceChildren();
  rootElt.appendChild(
    createInspectionSourceItem(input.selectedLabel, input.selectedValue),
  );

  if (input.originLabel && input.originValue) {
    rootElt.appendChild(
      createInspectionSourceItem(input.originLabel, input.originValue),
    );
  }

  rootElt.style.display = "flex";
  rootElt.hidden = false;
}

export function clearInspectionSource() {
  rootElt.style.display = "none";
  rootElt.hidden = true;
  rootElt.replaceChildren();
}

/**
 * @param {string} label
 * @param {string} value
 */
function createInspectionSourceItem(label, value) {
  const item = document.createElement("div");
  item.className = "inspection-source-item";
  item.appendChild(createCompactSource(label, value));
  return item;
}
