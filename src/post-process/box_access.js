/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {string} type
 * @returns {import("isobmff-inspector").ParsedBox | null}
 */
export function findFirstBox(boxes, type) {
  for (const box of boxes) {
    if (box.type === type) {
      return box;
    }
    const child = findFirstBox(box.children ?? [], type);
    if (child) {
      return child;
    }
  }
  return null;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {string} type
 * @param {Array<import("isobmff-inspector").ParsedBox>} out
 * @returns {Array<import("isobmff-inspector").ParsedBox>}
 */
export function findBoxes(boxes, type, out = []) {
  for (const box of boxes) {
    if (box.type === type) {
      out.push(box);
    }
    findBoxes(box.children ?? [], type, out);
  }
  return out;
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {Set<string>} types
 * @returns {boolean}
 */
export function hasBoxType(boxes, types) {
  return boxes.some(
    (box) => types.has(box.type) || hasBoxType(box.children ?? [], types),
  );
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
export function getField(box, key) {
  return box?.values?.find((field) => field.key === key) ?? null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
export function getStringField(box, key) {
  const value = getFieldPrimitiveByKey(box, key);
  return value == null ? null : String(value);
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
export function getNumberField(box, key) {
  const value = getFieldPrimitiveByKey(box, key);
  return toNullableNumber(value);
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
export function getBooleanField(box, key) {
  const value = getFieldPrimitive(getField(box, key));
  return typeof value === "boolean" ? value : null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
export function getNumberArrayField(box, key) {
  const field = getField(box, key);
  if (field?.kind !== "array") {
    return [];
  }
  return field.items
    .map((item) => toNullableNumber(getFieldPrimitive(item)))
    .filter((value) => value != null);
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 */
export function getStructArrayField(box, key) {
  const field = getField(box, key);
  if (field?.kind !== "array") {
    return [];
  }
  return field.items.filter((item) => item.kind === "struct");
}

/**
 * @param {import("isobmff-inspector").ParsedField | null | undefined} field
 * @returns {string | number | bigint | boolean | null}
 */
export function getFieldPrimitive(field) {
  if (!field) {
    return null;
  }
  switch (field.kind) {
    case "number":
    case "bigint":
    case "string":
    case "bytes":
    case "boolean":
    case "fixed-point":
    case "date":
    case "bits":
    case "flags":
      return field.value;
    case "null":
      return null;
    default:
      return null;
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null | undefined} box
 * @param {string} key
 * @returns {string | number | bigint | boolean | null}
 */
function getFieldPrimitiveByKey(box, key) {
  const field = getField(box, key);
  if (field) {
    return getFieldPrimitive(field);
  }
  for (const value of box?.values ?? []) {
    const nested = findNestedFieldPrimitive(value, key);
    if (nested != null) {
      return nested;
    }
  }
  return null;
}

/**
 * @param {import("isobmff-inspector").ParsedField} field
 * @param {string} key
 * @returns {string | number | bigint | boolean | null}
 */
function findNestedFieldPrimitive(field, key) {
  if ("fields" in field && Array.isArray(field.fields)) {
    for (const nestedField of field.fields) {
      if (nestedField.key === key) {
        if ("kind" in nestedField) {
          return getFieldPrimitive(nestedField);
        }
        return getPrimitiveValue(nestedField.value);
      }
      if ("kind" in nestedField) {
        const nested = findNestedFieldPrimitive(nestedField, key);
        if (nested != null) {
          return nested;
        }
      }
    }
  }
  if ("items" in field && Array.isArray(field.items)) {
    for (const item of field.items) {
      if ("kind" in item) {
        const nested = findNestedFieldPrimitive(item, key);
        if (nested != null) {
          return nested;
        }
      }
    }
  }
  if ("flags" in field && Array.isArray(field.flags)) {
    const flag = field.flags.find((entry) => entry.key === key);
    return flag ? getPrimitiveValue(flag.value) : null;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {string | number | bigint | boolean | null}
 */
function getPrimitiveValue(value) {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
    ? value
    : null;
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | undefined} struct
 * @param {string} key
 */
export function getNumberFromStruct(struct, key) {
  if (!struct) {
    return null;
  }
  const field = struct.fields.find((item) => item.key === key);
  return toNullableNumber(getFieldPrimitive(field));
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | undefined} struct
 * @param {string} key
 */
export function getPrimitiveNumberFromStruct(struct, key) {
  if (!struct) {
    return null;
  }
  const field = struct.fields.find((item) => item.key === key);
  const value = getFieldPrimitive(field);
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    const converted = Number(value);
    return Number.isSafeInteger(converted) ? converted : null;
  }
  return null;
}

/**
 * @param {unknown} value
 */
export function toNullableNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return null;
}

/**
 * @param {unknown} value
 */
export function toNumber(value) {
  return toNullableNumber(value) ?? 0;
}

/**
 * @param {number} value
 */
export function numberToFourCC(value) {
  return String.fromCharCode(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ).replace(/\0+$/, "");
}
