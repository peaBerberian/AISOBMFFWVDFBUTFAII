const PLAYREADY_SYSTEM_ID = "9A04F07998404286AB92E65BE0885F95";
const NAGRA_SYSTEM_ID = "ADB41C242DBF4A6D958B4457C0D27B95";
const WIDEVINE_SYSTEM_ID = "EDEF8BA979D64ACEA3C827DCD51D21ED";

/**
 * @typedef {{
 *   key: string,
 *   description?: string,
 *   kind: "pssh-preview",
 *   value: string,
 *   status: "decoded" | "unparseable",
 *   label: string,
 * }} PsshPreviewField
 */

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {PsshPreviewField | null}
 */
export function getPsshPreviewField(box) {
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
  if (field.number === 1 && field.value != null) {
    return `algorithm: ${formatWidevineAlgorithm(field.value)}`;
  }

  if (field.number === 2 && field.bytes) {
    return `key_id: ${formatWidevineKeyId(field.bytes)}`;
  }

  if (field.number === 3 && field.bytes) {
    const provider = decodeUtf8(field.bytes);
    return provider
      ? `provider: ${provider}`
      : `provider: ${bytesToHex(field.bytes)}`;
  }

  if (field.number === 4 && field.bytes) {
    return `content_id: ${describeBytes(field.bytes)}`;
  }

  if (field.number === 6 && field.bytes) {
    const policy = decodeUtf8(field.bytes);
    return policy ? `policy: ${policy}` : `policy: ${bytesToHex(field.bytes)}`;
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
function formatWidevineAlgorithm(value) {
  if (value === 1) {
    return `AESCTR (${value})`;
  }
  return String(value);
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
