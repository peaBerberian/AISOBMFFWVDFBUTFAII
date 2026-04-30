const AUTO_OPEN_FIELD_LIMIT = 80;

/**
 * Some Box's details, containing their parsed content, are collapsed by default
 * and not even present in the DOM.
 * This is for performance reasons as a few metadata boxes could become huge.
 *
 * As such this map link the corresponding `HTMLDetailElement` to the code that
 * both insert the DOM and open the detail element.
 *
 * Once the detail has been opened, the entry is removed.
 * @type {WeakMap<HTMLDetailsElement, () => void>}
 */
const lazyBoxBodies = new WeakMap();

/**
 * @param {import("../../../utils/box_size").BoxWithOptionalActualSize} box
 * @returns {boolean}
 */
export function shouldAutoOpenBox(box) {
  if (countFields(box.values ?? []) > AUTO_OPEN_FIELD_LIMIT) {
    return false;
  }
  return true;
}

/**
 * Opens a rendered box-node `<details>` and inserts its lazy body if needed.
 * @param {HTMLDetailsElement} details
 */
export function openBoxBody(details) {
  details.open = true;
  const insertBody = lazyBoxBodies.get(details);
  if (!insertBody) {
    return;
  }
  insertBody();
  lazyBoxBodies.delete(details);
}

/**
 * Opens a rendered box-node `<details>` and inserts its lazy body if needed.
 * @param {HTMLDetailsElement} elt
 * @param {() => void} insertFn
 */
export function declareLazyBox(elt, insertFn) {
  lazyBoxBodies.set(elt, insertFn);
}

/**
 * @param {Array<import("isobmff-inspector").ParsedField>} fields
 * @returns {number}
 */
function countFields(fields) {
  let count = 0;
  for (const field of fields) {
    count++;
    switch (field.kind) {
      case "array":
        count += countFields(field.items ?? []);
        break;
      case "bits":
        count += field.fields?.length ?? 0;
        break;
      case "struct":
        count += countFields(field.fields ?? []);
        break;
    }
  }
  return count;
}
