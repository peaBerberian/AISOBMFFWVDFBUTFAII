import { el } from "../../utils";
import { getPsshPreviewField } from "./decode";

export { getPsshPreviewField };

/**
 * @param {import("./decode").PsshPreviewField} field
 * @param {(value: string, options: { className: string, forceExpanded?: boolean, preserveWhitespace?: boolean }) => HTMLElement} renderStringValue
 * @returns {HTMLElement}
 */
export function renderPsshPreviewField(field, renderStringValue) {
  const wrap = el("div", `pssh-preview pssh-preview-${field.status}`);
  const badge = el("span", "pssh-preview-badge");
  badge.textContent = field.status === "decoded" ? field.label : "Best effort";
  wrap.appendChild(badge);
  wrap.appendChild(
    renderStringValue(field.value, {
      className: "vv-str vv-block",
      forceExpanded: false,
      preserveWhitespace: true,
    }),
  );
  return wrap;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | undefined} box
 * @param {import("isobmff-inspector").ParsedField & { key?: string }} field
 * @returns {boolean}
 */
export function isCollapsedPsshStringField(box, field) {
  return box?.type === "pssh" && field.key === "data";
}
