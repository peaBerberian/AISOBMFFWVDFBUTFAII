import { el, esc, fmtBytes } from "./utils";

const AUTO_OPEN_FIELD_LIMIT = 80;
const COLLAPSIBLE_TEXT_LIMIT = 160;
const PLAYREADY_SYSTEM_ID = "9A04F07998404286AB92E65BE0885F95";
const NAGRA_SYSTEM_ID = "ADB41C242DBF4A6D958B4457C0D27B95";
const WIDEVINE_SYSTEM_ID = "EDEF8BA979D64ACEA3C827DCD51D21ED";

/**
 * View abstraction for one rendered box-tree node.
 */
export default class BoxTreeNodeView {
  /** @type {HTMLElement} */
  #element;
  /** @type {HTMLElement | null} */
  #childContainer;

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
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
   * @param {import("isobmff-inspector").ParsedBox} box
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

/**
 * Builds a DOM element for one box and returns the child container created for
 * it, when one exists.
 *
 * Container boxes (with `children`) get a `<details>` so they can be
 * collapsed. Leaf boxes get a flat `<div>`.
 *
 * When `shallow` is true (streaming mode) the children array on the box
 * object is ignored — the caller appends child elements directly into the
 * returned element's child container.
 * @param {import("isobmff-inspector").ParsedBox} box
 * @param {{ autoOpen?: boolean, shallow?: boolean }} options
 * @returns {{ element: HTMLElement, childContainer: HTMLElement | null }}
 */
function renderBoxTreeNode(box, options = {}) {
  const shallow = options.shallow ?? false;
  const hasValues = box.values?.length > 0;
  const hasChildren = !shallow && box.children?.length > 0;
  const hasContent =
    hasValues || hasChildren || box.description || box.issues?.length;
  const autoOpen = options.autoOpen ?? shouldAutoOpen(box);

  // Issue indicator dot
  const makeDot = () => {
    if (!box.issues?.length) {
      return null;
    }
    const dot = el("span");
    const isWarnOnly = box.issues.every((i) => i.severity === "warning");
    dot.className = `box-issue-dot${isWarnOnly ? " warn" : ""}`;
    dot.setAttribute("role", "img");
    dot.setAttribute(
      "aria-label",
      isWarnOnly ? "Box has warnings" : "Box has errors",
    );
    return dot;
  };

  // Header content (shared between <summary> and flat <div>)
  const makeHeader = () => {
    const header = el("span", "box-header");
    const typeSpan = el("span", "box-type");
    typeSpan.textContent = box.type;
    header.appendChild(typeSpan);
    if (box.name) {
      const nameSpan = el("span", "box-name");
      nameSpan.textContent = box.name;
      header.appendChild(nameSpan);
    }
    const sizeSpan = el("span", "box-size");
    sizeSpan.textContent = fmtBytes(box.size);
    header.appendChild(sizeSpan);
    const dot = makeDot();
    if (dot) {
      header.appendChild(dot);
    }
    return header;
  };

  // Body: description + values table + issues
  const makeBody = () => {
    const body = el("div", "box-body");

    if (box.description) {
      const desc = el("div", "box-desc");
      desc.textContent = box.description;
      body.appendChild(desc);
    }

    if (hasValues) {
      const tbl = /** @type {HTMLTableElement} */ (el("table", "values-table"));
      for (const v of getDisplayFields(box)) {
        const row = tbl.insertRow();
        row.className = "box-value-line";
        const keyCell = row.insertCell();
        renderKeyCell(keyCell, v);
        const valCell = row.insertCell();
        valCell.appendChild(renderValue(v, { box }));
      }
      body.appendChild(tbl);
    }

    if (box.issues?.length) {
      const isWarnOnly = box.issues.every((i) => i.severity === "warning");
      const issueEl = el("div", `issue-list${isWarnOnly ? " warn" : ""}`);
      for (const issue of box.issues) {
        const item = el("div", "issue-item");
        item.textContent = issue.message;
        issueEl.appendChild(item);
      }
      body.appendChild(issueEl);
    }

    return body;
  };

  if (!hasContent && !box.children) {
    const div = el("div", "leaf-box");
    const caret = el("span", "box-caret");
    caret.textContent = "";
    caret.style.opacity = "0";
    div.appendChild(caret);
    div.appendChild(makeHeader());
    return { element: div, childContainer: null };
  }

  const det = document.createElement("details");
  det.open = autoOpen;

  const summary = document.createElement("summary");
  const caret = el("span", "box-caret");
  caret.setAttribute("aria-hidden", "true");
  summary.appendChild(caret);
  summary.appendChild(makeHeader());
  det.appendChild(summary);

  // Child container — in streaming mode the caller appends into this div
  const childContainer = el("div", "box-children");
  det.appendChild(childContainer);

  if (hasContent) {
    const insertBody = () => {
      det.insertBefore(makeBody(), childContainer);
    };

    if (det.open) {
      insertBody();
    } else {
      det.addEventListener(
        "toggle",
        () => {
          if (det.open && !det.querySelector(":scope > .box-body")) {
            insertBody();
          }
        },
        { once: true },
      );
    }
  }

  // Non-streaming: populate children immediately
  if (hasChildren) {
    for (const child of box.children) {
      childContainer.appendChild(
        new BoxTreeNodeView(child, { shallow: false }).element,
      );
    }
  }

  return { element: det, childContainer };
}

/**
 * @param {import("isobmff-inspector").ParsedField | PsshPreviewField | null} f
 * @param {{ box?: import("isobmff-inspector").ParsedBox }} [options]
 * @returns {HTMLElement}
 */
function renderValue(f, options = {}) {
  if (f == null) {
    return el("span", "vv-null", "null");
  }

  if ("kind" in f && f.kind === "pssh-preview") {
    return renderPsshPreview(f);
  }

  // Primitive shortcut (shouldn't happen in full format but guard anyway)
  if (typeof f !== "object") {
    const s = el("span", typeof f === "string" ? "vv-str" : "vv-num");
    s.textContent = typeof f === "string" ? `"${f}"` : String(f);
    return s;
  }

  switch (f.kind) {
    case "number":
    case "bigint": {
      const s = el("span", "vv-num");
      s.textContent = String(f.value);
      return s;
    }

    case "string": {
      return renderStringValue(f.value, {
        className: "vv-str",
        forceExpanded: !shouldCollapseStringField(options.box, f),
      });
    }

    case "boolean": {
      const s = el("span", "vv-bool");
      s.textContent = String(f.value);
      return s;
    }

    case "null": {
      return el("span", "vv-null", "null");
    }

    case "fixed-point": {
      const wrap = el("span", "vv-fp");
      const num = el("span", "vv-fp-val");
      num.textContent = String(f.value);
      const fmt = el("span", "vv-fp-fmt");
      fmt.textContent = ` ${f.format} fixed`;
      if (f.signed === false) {
        fmt.textContent += ", unsigned";
      }
      wrap.appendChild(num);
      wrap.appendChild(fmt);
      return wrap;
    }

    case "date": {
      const wrap = el("div", "vv-date");
      if (f.date) {
        const human = el("span", "vv-date-human");
        human.textContent = f.date;
        wrap.appendChild(human);
      }
      const raw = el("span", "vv-date-raw");
      raw.textContent = `raw ${f.value} · epoch ${f.epoch ?? "??"} · unit ${f.unit ?? "?"}`;
      wrap.appendChild(raw);
      return wrap;
    }

    case "flags": {
      const wrap = el("div", "flags-grid");
      for (const flag of f.flags ?? []) {
        const chip = el("span", `flag-chip${flag.value ? " on" : ""}`);
        chip.textContent = flag.key;
        wrap.appendChild(chip);
      }
      if (!f.flags?.length) {
        wrap.textContent = "—";
      }
      return wrap;
    }

    case "bits": {
      const wrap = el("div", "bits-row");
      for (const b of f.fields ?? []) {
        const part = el("span", "bits-field");
        part.innerHTML = `${esc(b.key)}=<span>${esc(b.value)}</span>`;
        wrap.appendChild(part);
      }
      return wrap;
    }

    case "struct": {
      if (f.layout === "matrix-3x3") {
        const grid = el("div", "matrix-grid");
        for (const cell of f.fields ?? []) {
          const c = el("span");
          const value = /** @type {{ value?: unknown }} */ (cell).value;
          c.textContent = value != null ? String(value) : "—";
          grid.appendChild(c);
        }
        return grid;
      }
      if (f.layout === "iso-639-2-t") {
        const lang = (f.fields ?? []).find((x) => x.key === "language");
        const s = el("span", "vv-str");
        const value = lang
          ? /** @type {{ value?: unknown }} */ (lang).value
          : null;
        s.textContent = value != null ? `"${value}"` : "—";
        return s;
      }
      // Generic struct → nested table
      const tbl = /** @type {HTMLTableElement} */ (el("table", "values-table"));
      for (const sf of f.fields ?? []) {
        const row = tbl.insertRow();
        renderKeyCell(row.insertCell(), sf);
        row.insertCell().appendChild(renderValue(sf, options));
      }
      return tbl;
    }

    case "array": {
      if (!f.items?.length) {
        const s = el("span", "vv-null");
        s.textContent = "[]";
        return s;
      }
      // Fast path: all numeric → single line
      if (f.items.every((i) => i.kind === "number" || i.kind === "bigint")) {
        const s = el("span", "vv-num");
        s.textContent = `[${f.items.map((i) => i.value).join(", ")}]`;
        return s;
      }
      const wrap = el("div");
      f.items.forEach((item, idx) => {
        const row = el("div", "arr-item");
        const lbl = el("span", "arr-label");
        lbl.textContent = `[${idx}] `;
        row.appendChild(lbl);
        row.appendChild(renderValue(item, options));
        wrap.appendChild(row);
      });
      return wrap;
    }
  }
}

/**
 * @typedef {{
 *   key: string,
 *   description?: string,
 *   kind: "pssh-preview",
 *   value: string,
 *   status: "decoded" | "unparseable" | "unsupported",
 *   label: string,
 * }} PsshPreviewField
 */

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {Array<import("isobmff-inspector").ParsedBoxValue | PsshPreviewField>}
 */
function getDisplayFields(box) {
  /** @type {Array<import("isobmff-inspector").ParsedBoxValue | PsshPreviewField>} */
  const values = [...(box.values ?? [])];
  if (box.type !== "pssh") {
    return values;
  }

  const preview = getPsshPreviewField(box);
  if (preview) {
    values.push(preview);
  }
  return values;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {PsshPreviewField | null}
 */
function getPsshPreviewField(box) {
  const systemIdField = findBoxValue(box, "systemID");
  const dataField = findBoxValue(box, "data");
  const systemId = getSystemIdValue(systemIdField);
  const hex = dataField?.kind === "string" ? dataField.value : null;
  if (!systemId || !hex) {
    return null;
  }

  const payload = hexToBytes(hex);
  if (!payload) {
    return {
      key: "decoded_payload",
      kind: "pssh-preview",
      label: "Decoded payload",
      status: "unparseable",
      value: "Could not decode the raw payload bytes.",
    };
  }

  if (systemId === PLAYREADY_SYSTEM_ID) {
    const decoded = decodePlayReadyPayload(payload);
    return {
      key: "decoded_payload",
      kind: "pssh-preview",
      label: "Decoded payload",
      status: decoded ? "decoded" : "unparseable",
      value:
        decoded ??
        "PlayReady payload detected, but the UTF-16LE XML payload could not be decoded.",
    };
  }

  if (systemId === NAGRA_SYSTEM_ID) {
    const decoded = decodeNagraPayload(payload);
    return {
      key: "decoded_payload",
      kind: "pssh-preview",
      label: "Decoded payload",
      status: decoded ? "decoded" : "unparseable",
      value:
        decoded ??
        "Nagra payload detected, but the UTF-8 base64 JSON payload could not be decoded.",
    };
  }

  if (systemId === WIDEVINE_SYSTEM_ID) {
    const decoded = decodeWidevinePayload(payload);
    return {
      key: "decoded_payload",
      kind: "pssh-preview",
      label: "Decoded payload",
      status: decoded ? "decoded" : "unparseable",
      value:
        decoded ??
        "Widevine payload detected, but the protobuf payload could not be decoded.",
    };
  }

  return null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @param {string} key
 * @returns {import("isobmff-inspector").ParsedBoxValue | null}
 */
function findBoxValue(box, key) {
  return (box.values ?? []).find((value) => value.key === key) ?? null;
}

/**
 * @param {import("isobmff-inspector").ParsedBoxValue | null} field
 * @returns {string | null}
 */
function getSystemIdValue(field) {
  if (field?.kind !== "string") {
    return null;
  }
  const match = /^[0-9A-F]+/.exec(field.value);
  return match ? match[0] : null;
}

/**
 * @param {string} hex
 * @returns {Uint8Array | null}
 */
function hexToBytes(hex) {
  if (hex.length % 2 !== 0 || /[^0-9A-Fa-f]/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      return null;
    }
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * @param {Uint8Array} payload
 * @returns {string | null}
 */
function decodePlayReadyPayload(payload) {
  try {
    const xmlPayload = extractPlayReadyXml(payload);
    if (!xmlPayload) {
      return null;
    }
    const xml = new TextDecoder("utf-16le", { fatal: true }).decode(xmlPayload);
    return formatXml(xml);
  } catch {
    return null;
  }
}

/**
 * Parse a PlayReady Object:
 * - DWORD length
 * - WORD record count
 * - repeated WORD type + WORD length + value
 *
 * We only decode type 0x0001, which carries the UTF-16LE WRMHEADER XML.
 * @param {Uint8Array} payload
 * @returns {Uint8Array | null}
 */
function extractPlayReadyXml(payload) {
  if (payload.length < 6) {
    return null;
  }

  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const declaredLength = view.getUint32(0, true);
  if (declaredLength > payload.length || declaredLength < 6) {
    return null;
  }

  const recordCount = view.getUint16(4, true);
  let offset = 6;
  for (let i = 0; i < recordCount; i++) {
    if (offset + 4 > declaredLength) {
      return null;
    }

    const recordType = view.getUint16(offset, true);
    const recordLength = view.getUint16(offset + 2, true);
    offset += 4;

    if (offset + recordLength > declaredLength) {
      return null;
    }

    if (recordType === 0x0001) {
      return payload.slice(offset, offset + recordLength);
    }

    offset += recordLength;
  }

  return null;
}

/**
 * @param {Uint8Array} payload
 * @returns {string | null}
 */
function decodeNagraPayload(payload) {
  try {
    const encoded = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    const base64 = encoded.replace(/\s+/g, "");
    const jsonText = atob(base64);
    const parsed = JSON.parse(jsonText);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} payload
 * @returns {string | null}
 */
function decodeWidevinePayload(payload) {
  const fields = parseProtoFields(payload);
  if (!fields) {
    return null;
  }

  const lines = [];
  for (const field of fields) {
    const rendered = formatWidevineField(field);
    if (rendered) {
      lines.push(rendered);
    }
  }

  return lines.length ? lines.join("\n") : null;
}

/**
 * @typedef {{
 *   number: number,
 *   wireType: number,
 *   value?: number,
 *   bytes?: Uint8Array,
 * }} ProtoField
 */

/**
 * @param {Uint8Array} bytes
 * @returns {ProtoField[] | null}
 */
function parseProtoFields(bytes) {
  /** @type {ProtoField[]} */
  const fields = [];
  let offset = 0;

  while (offset < bytes.length) {
    const tag = readProtoVarint(bytes, offset);
    if (!tag || tag.value === 0) {
      return null;
    }
    offset = tag.nextOffset;

    const fieldNumber = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;
    if (fieldNumber <= 0) {
      return null;
    }

    if (wireType === 0) {
      const varint = readProtoVarint(bytes, offset);
      if (!varint) {
        return null;
      }
      fields.push({
        number: fieldNumber,
        wireType,
        value: varint.value,
      });
      offset = varint.nextOffset;
      continue;
    }

    if (wireType === 2) {
      const length = readProtoVarint(bytes, offset);
      if (!length || offsetBeyond(bytes, length.nextOffset, length.value)) {
        return null;
      }
      offset = length.nextOffset;
      fields.push({
        number: fieldNumber,
        wireType,
        bytes: bytes.slice(offset, offset + length.value),
      });
      offset += length.value;
      continue;
    }

    if (wireType === 5) {
      if (offsetBeyond(bytes, offset, 4)) {
        return null;
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
      fields.push({
        number: fieldNumber,
        wireType,
        value: view.getUint32(0, true),
      });
      offset += 4;
      continue;
    }

    if (wireType === 1) {
      if (offsetBeyond(bytes, offset, 8)) {
        return null;
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
      fields.push({
        number: fieldNumber,
        wireType,
        value: Number(view.getBigUint64(0, true)),
      });
      offset += 8;
      continue;
    }

    return null;
  }

  return fields;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {{ value: number, nextOffset: number } | null}
 */
function readProtoVarint(bytes, offset) {
  let value = 0;
  let shift = 0;

  while (offset < bytes.length && shift < 35) {
    const byte = bytes[offset];
    value += (byte & 0x7f) * 2 ** shift;
    offset++;
    if ((byte & 0x80) === 0) {
      return { value, nextOffset: offset };
    }
    shift += 7;
  }

  return null;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} length
 * @returns {boolean}
 */
function offsetBeyond(bytes, offset, length) {
  return length < 0 || offset + length > bytes.length;
}

/**
 * @param {ProtoField} field
 * @returns {string | null}
 */
function formatWidevineField(field) {
  if (field.number === 1 && field.bytes) {
    const provider = decodeUtf8(field.bytes);
    return provider
      ? `provider: ${provider}`
      : `provider: ${bytesToHex(field.bytes)}`;
  }

  if (field.number === 2 && field.bytes) {
    return `content_id: ${describeBytes(field.bytes)}`;
  }

  if (field.number === 3 && field.bytes) {
    const policy = decodeUtf8(field.bytes);
    return policy ? `policy: ${policy}` : `policy: ${bytesToHex(field.bytes)}`;
  }

  if (field.number === 4 && field.bytes) {
    return `key_id: ${formatWidevineKeyId(field.bytes)}`;
  }

  if (field.number === 7 && field.value != null) {
    return `crypto_period_index: ${field.value}`;
  }

  if (field.number === 9 && field.value != null) {
    return `protection_scheme: ${formatProtectionScheme(field.value)}`;
  }

  if (field.number === 10 && field.value != null) {
    return `crypto_period_seconds: ${field.value}`;
  }

  if (field.bytes) {
    return `field_${field.number}: ${describeBytes(field.bytes)}`;
  }

  if (field.value != null) {
    return `field_${field.number}: ${field.value}`;
  }

  return null;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
function decodeUtf8(bytes) {
  try {
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return /^[\u0020-\u007e\s]+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function describeBytes(bytes) {
  const utf8 = decodeUtf8(bytes);
  if (utf8) {
    return `${utf8} (${bytesToHex(bytes)})`;
  }
  return bytesToHex(bytes);
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0").toUpperCase(),
  ).join("");
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function formatWidevineKeyId(bytes) {
  const hex = bytesToHex(bytes);
  if (bytes.length !== 16) {
    return hex;
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatProtectionScheme(value) {
  const chars = [
    String.fromCharCode((value >>> 24) & 0xff),
    String.fromCharCode((value >>> 16) & 0xff),
    String.fromCharCode((value >>> 8) & 0xff),
    String.fromCharCode(value & 0xff),
  ].join("");
  return /^[\u0020-\u007e]{4}$/.test(chars)
    ? `${chars} (${value})`
    : String(value);
}

/**
 * @param {string} xml
 * @returns {string}
 */
function formatXml(xml) {
  const normalized = xml.replace(/>\s+</g, "><").trim();
  const tokens = normalized.replace(/</g, "\n<").trim().split("\n");
  let depth = 0;
  const lines = [];
  for (const token of tokens) {
    if (/^<\//.test(token)) {
      depth = Math.max(0, depth - 1);
    }
    lines.push(`${"  ".repeat(depth)}${token}`);
    if (/^<[^!?/][^>]*[^/]>$/.test(token) && !/<\/[^>]+>$/.test(token)) {
      depth++;
    }
  }
  return lines.join("\n");
}

/**
 * @param {PsshPreviewField} field
 * @returns {HTMLElement}
 */
function renderPsshPreview(field) {
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
 * @param {string} value
 * @param {{ className: string, forceExpanded?: boolean, preserveWhitespace?: boolean }} options
 * @returns {HTMLElement}
 */
function renderStringValue(value, options) {
  const text = `"${value}"`;
  if (options.forceExpanded || text.length <= COLLAPSIBLE_TEXT_LIMIT) {
    const s = el(
      "span",
      `${options.className}${options.preserveWhitespace ? " vv-pre" : ""}`,
    );
    s.textContent = text;
    return s;
  }

  const details = document.createElement("details");
  details.className = "vv-collapsible";
  const summary = document.createElement("summary");
  summary.className = "vv-collapsible-summary";
  summary.textContent = `${text.slice(0, COLLAPSIBLE_TEXT_LIMIT)}…`;
  details.appendChild(summary);
  const body = el(
    "div",
    `vv-collapsible-body ${options.className}${options.preserveWhitespace ? " vv-pre" : ""}`,
  );
  body.textContent = text;
  details.appendChild(body);
  return details;
}

/**
 * @param {import("isobmff-inspector").ParsedBox | undefined} box
 * @param {import("isobmff-inspector").ParsedField & { key?: string }} field
 * @returns {boolean}
 */
function shouldCollapseStringField(box, field) {
  return box?.type === "pssh" && field.key === "data";
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {boolean}
 */
function shouldAutoOpenBox(box) {
  return shouldAutoOpen(box);
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {boolean}
 */
function shouldAutoOpen(box) {
  if (countFields(box.values ?? []) > AUTO_OPEN_FIELD_LIMIT) {
    return false;
  }
  return true;
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

/**
 * @param {HTMLTableCellElement} cell
 * @param {{ key: string, description?: string }} field
 */
function renderKeyCell(cell, field) {
  cell.className = "vk";

  const key = el("span", "property-key");
  const keyText = el("span", "property-key-text");
  keyText.textContent = field.key;
  key.appendChild(keyText);

  if (field.description) {
    const help = /** @type {HTMLButtonElement} */ (
      el("button", "property-help")
    );
    help.type = "button";
    help.textContent = "i";
    help.setAttribute("aria-label", `${field.key}: ${field.description}`);
    help.setAttribute("aria-describedby", "property-help-tooltip");
    help.dataset.description = field.description;
    help.addEventListener("pointerenter", () => showPropertyTooltip(help));
    help.addEventListener("pointerleave", hidePropertyTooltip);
    help.addEventListener("focus", () => showPropertyTooltip(help));
    help.addEventListener("blur", hidePropertyTooltip);
    help.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") {
        hidePropertyTooltip();
        help.blur();
      }
    });
    key.appendChild(help);
  }

  cell.appendChild(key);
}

/** @type {HTMLButtonElement | null} */
let activeTooltipTarget = null;

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
 */
function showPropertyTooltip(target) {
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

function hidePropertyTooltip() {
  activeTooltipTarget = null;
  const tooltip = document.getElementById("property-help-tooltip");
  if (!tooltip) {
    return;
  }
  tooltip.classList.remove("is-visible");
  tooltip.setAttribute("aria-hidden", "true");
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

  const maxLeft = Math.max(
    margin,
    window.innerWidth - tooltipRect.width - margin,
  );
  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  left = Math.min(Math.max(left, margin), maxLeft);

  const aboveTop = targetRect.top - tooltipRect.height - gap;
  const belowTop = targetRect.bottom + gap;
  const top =
    aboveTop >= margin
      ? aboveTop
      : Math.min(
          belowTop,
          Math.max(margin, window.innerHeight - tooltipRect.height - margin),
        );

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

window.addEventListener("scroll", () => {
  if (activeTooltipTarget) {
    positionPropertyTooltip(activeTooltipTarget, getPropertyTooltip());
  }
});

window.addEventListener("resize", () => {
  if (activeTooltipTarget) {
    positionPropertyTooltip(activeTooltipTarget, getPropertyTooltip());
  }
});
