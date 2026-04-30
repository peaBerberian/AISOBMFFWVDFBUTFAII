import { el } from "../../../utils/dom";

/** @type {HTMLButtonElement | null} */
let activeTooltipTarget = null;

window.addEventListener("scroll", () => {
  if (!activeTooltipTarget) {
    return;
  }
  const tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    return;
  }
  positionPropertyTooltip(activeTooltipTarget, tooltip);
});

window.addEventListener("resize", () => {
  if (!activeTooltipTarget) {
    return;
  }
  const tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    return;
  }
  positionPropertyTooltip(activeTooltipTarget, tooltip);
});

/**
 * @param {HTMLButtonElement} target
 */
export function showPropertyTooltip(target) {
  const description = target.dataset.description;
  if (!description) {
    return;
  }

  activeTooltipTarget = target;
  const tooltip = getPropertyTooltip();
  tooltip.textContent = description;
  tooltip.setAttribute("aria-hidden", "false");
  tooltip.classList.add("is-visible");
  positionPropertyTooltip(target, tooltip);
}

export function hidePropertyTooltip() {
  activeTooltipTarget = null;
  const tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    return;
  }
  tooltip.classList.remove("is-visible");
  tooltip.setAttribute("aria-hidden", "true");
}

/**
 * @returns {HTMLElement}
 */
function getPropertyTooltip() {
  let tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    tooltip = el("div", "property-tooltip");
    tooltip.id = "property-help-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

/**
 * @param {HTMLButtonElement} target
 * @param {HTMLElement} tooltip
 */
function positionPropertyTooltip(target, tooltip) {
  const margin = 8;
  const gap = 14;
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  left = Math.max(
    margin,
    Math.min(left, viewportWidth - tooltipRect.width - margin),
  );

  let top = targetRect.top - tooltipRect.height - gap;
  if (top < margin) {
    top = targetRect.bottom + gap;
  }
  if (top + tooltipRect.height > viewportHeight - margin) {
    top = Math.max(margin, viewportHeight - tooltipRect.height - margin);
  }

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}
