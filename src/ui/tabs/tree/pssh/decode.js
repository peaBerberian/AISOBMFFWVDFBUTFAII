const PLAYREADY_SYSTEM_ID = "9A04F07998404286AB92E65BE0885F95";
const NAGRA_SYSTEM_ID = "ADB41C242DBF4A6D958B4457C0D27B95";
const WIDEVINE_SYSTEM_ID = "EDEF8BA979D64ACEA3C827DCD51D21ED";
const SYSTEM_IDS = new Map([
  [PLAYREADY_SYSTEM_ID, "Microsoft PlayReady"],
  ["1077EFECC0B24D02ACE33C1E52E2FB4B", "W3C Common PSSH box"],
  ["94CE86FB07FF4F43ADB893D2FA968CA2", "Apple FairPlay"],
  ["3EA8778F77424BF9B18BE834B2ACBD47", "Clear Key AES-128"],
  ["BE58615B19C4468488B3C8C57E99E957", "Clear Key SAMPLE-AES"],
  ["E2719D58A985B3C9781AB030AF78D30E", "Clear Key DASH-IF"],
  ["644FE7B5260F4FAD949A0762FFB054B4", "CMLA (OMA DRM)"],
  ["6DD8B3C345F44A68BF3A64168D01A4A6", "ABV DRM (MoDRM)"],
  ["F239E769EFA348509C16A903C6932EFB", "Adobe Primetime DRM version 4"],
  ["616C7469636173742D50726F74656374", "Alticast"],
  ["279FE473512C48FEADE8D176FEE6B40F", "Arris Titanium"],
  ["3D5E6D359B9A41E8B843DD3C6E72C42C", "ChinaDRM"],
  ["37C332587B994C7EB15D19AF74482154", "Commscope Titanium V3"],
  ["45D481CB8FE049C0ADA9AB2D2455B2F2", "CoreCrypt"],
  ["DCF4E3E362F158187BA60A6FE33FF3DD", "DigiCAP SmartXess"],
  ["35BF197B530E42D78B651B4BF415070F", "DivX DRM Series 5"],
  ["80A6BE7E14484C379E70D5AEBE04C8D2", "Irdeto Content Protection"],
  [
    "5E629AF538DA4063897797FFBD9902D4",
    "Marlin Adaptive Streaming Simple Profile V1.0",
  ],
  [NAGRA_SYSTEM_ID, "Nagra MediaAccess PRM 3.0"],
  ["6A99532D869F59229A9113ABB7B1E2F3", "MobiTV DRM"],
  ["1F83E1E86EE94F0DBA2F5EC4E3ED1A66", "SecureMedia"],
  ["992C46E6C4374899B6A050FA91AD0E39", "SecureMedia SteelKnot"],
  ["A68129D3575B4F1A9CBA3223846CF7C3", "Synamedia/Cisco/NDS VideoGuard DRM"],
  ["AA11967FCC014A4A8E99C5D3DDDFEA2D", "Unitend DRM (UDRM)"],
  ["9A27DD82FDE247258CBC4234AA06EC09", "Verimatrix VCAS"],
  ["B4413586C58CFFB094A5D4896C1AF6C3", "Viaccess-Orca DRM (VODRM)"],
  ["793B79569F944946A94223E7EF7E44B4", "VisionCrypt"],
  [WIDEVINE_SYSTEM_ID, "Widevine Content Protection"],
]);

/**
 * @param {string} systemId
 * @returns {string | null}
 */
export function getPsshSystemIdLabel(systemId) {
  const normalized = systemId.trim().toUpperCase();
  return SYSTEM_IDS.get(normalized) ?? null;
}

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
  const systemId =
    systemIdField?.kind !== "string" && systemIdField?.kind !== "bytes"
      ? null
      : systemIdField.value.trim().toUpperCase();
  const hex = dataField?.kind === "bytes" ? dataField.value : null;
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
