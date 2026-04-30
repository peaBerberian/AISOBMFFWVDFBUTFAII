import { getPsshPreviewField, getPsshSystemIdLabel } from "./pssh/index.js";

/**
 * @typedef {import("../../../utils/box_size.js").BoxWithOptionalActualSize} RenderedBox
 */
/**
 * @typedef {import("./pssh/index.js").PsshPreviewField} PsshPreviewField
 */

/**
 * @param {RenderedBox} box
 * @returns {Array<import("isobmff-inspector").ParsedBoxValue | PsshPreviewField>}
 */
export function getDisplayFields(box) {
  /** @type {Array<import("isobmff-inspector").ParsedBoxValue | PsshPreviewField>} */
  const values = [...(box.values ?? [])];

  if (box.type !== "pssh") {
    return values;
  }

  const preview = getPsshPreviewField(
    /** @type {import("isobmff-inspector").ParsedBox} */ (box),
  );
  if (preview) {
    values.push(preview);
  }
  return values;
}

/**
 * @param {RenderedBox | undefined} box
 * @param {import("isobmff-inspector").ParsedField} field
 * @returns {string | null}
 */
export function getFieldAnnotation(box, field) {
  if (
    box?.type !== "mdhd" ||
    !("key" in field) ||
    field.key !== "language" ||
    field.kind === "string"
  ) {
    return null;
  }

  if (field.kind === "struct" && field.layout === "iso-639-2-t") {
    const lang = field.fields.find((item) => item.key === "language");
    const value =
      lang && "value" in lang && typeof lang.value === "string"
        ? lang.value
        : null;
    return value ? `decoded ${value}` : null;
  }

  if (field.kind !== "bits") {
    return null;
  }

  const packed =
    field.fields.find((item) => item.key === "value")?.value ?? field.value;
  return decodeIso639LanguageCode(packed);
}

/**
 * @param {RenderedBox | undefined} box
 * @param {import("isobmff-inspector").ParsedField} field
 * @returns {{ value: string, label: string } | null}
 */
export function getPsshSystemIdInfo(box, field) {
  if (
    box?.type !== "pssh" ||
    !("key" in field) ||
    field.key !== "systemID" ||
    !("value" in field) ||
    typeof field.value !== "string"
  ) {
    return null;
  }

  const label = getPsshSystemIdLabel(field.value);
  if (!label) {
    return null;
  }
  return { value: field.value, label };
}

/**
 * @param {string | number | bigint | boolean | null} value
 * @returns {string | null}
 */
function decodeIso639LanguageCode(value) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  return [
    String.fromCharCode(((value >> 10) & 0x1f) + 0x60),
    String.fromCharCode(((value >> 5) & 0x1f) + 0x60),
    String.fromCharCode((value & 0x1f) + 0x60),
  ].join("");
}
