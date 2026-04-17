(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ../isobmff-inspector/dist/bundle.js
  var require_bundle = __commonJS({
    "../isobmff-inspector/dist/bundle.js"(exports, module) {
      "use strict";
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.inspectISOBMFF = factory());
      })(exports, function() {
        "use strict";
        "use strict";
        var __inspectISOBMFFBundle = (() => {
          var __defProp2 = Object.defineProperty;
          var __defProps = Object.defineProperties;
          var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
          var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
          var __getOwnPropNames2 = Object.getOwnPropertyNames;
          var __getOwnPropSymbols = Object.getOwnPropertySymbols;
          var __hasOwnProp2 = Object.prototype.hasOwnProperty;
          var __propIsEnum = Object.prototype.propertyIsEnumerable;
          var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name);
          var __typeError = (msg) => {
            throw TypeError(msg);
          };
          var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
          var __spreadValues = (a, b) => {
            for (var prop in b || (b = {}))
              if (__hasOwnProp2.call(b, prop))
                __defNormalProp(a, prop, b[prop]);
            if (__getOwnPropSymbols)
              for (var prop of __getOwnPropSymbols(b)) {
                if (__propIsEnum.call(b, prop))
                  __defNormalProp(a, prop, b[prop]);
              }
            return a;
          };
          var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
          var __export = (target, all) => {
            for (var name in all)
              __defProp2(target, name, { get: all[name], enumerable: true });
          };
          var __copyProps2 = (to, from, except, desc) => {
            if (from && typeof from === "object" || typeof from === "function") {
              for (let key of __getOwnPropNames2(from))
                if (!__hasOwnProp2.call(to, key) && key !== except)
                  __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
            }
            return to;
          };
          var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
          var __await = function(promise, isYieldStar) {
            this[0] = promise;
            this[1] = isYieldStar;
          };
          var __asyncGenerator = (__this, __arguments, generator) => {
            var resume = (k, v, yes, no) => {
              try {
                var x = generator[k](v), isAwait = (v = x.value) instanceof __await, done = x.done;
                Promise.resolve(isAwait ? v[0] : v).then((y) => isAwait ? resume(k === "return" ? k : "next", v[1] ? { done: y.done, value: y.value } : y, yes, no) : yes({ value: y, done })).catch((e) => resume("throw", e, yes, no));
              } catch (e) {
                no(e);
              }
            }, method = (k, call, wait, clear) => it[k] = (x) => (call = new Promise((yes, no, run) => (run = () => resume(k, x, yes, no), q ? q.then(run) : run())), clear = () => q === wait && (q = 0), q = wait = call.then(clear, clear), call), q, it = {};
            return generator = generator.apply(__this, __arguments), it[__knownSymbol("asyncIterator")] = () => it, method("next"), method("throw"), method("return"), it;
          };
          var __yieldStar = (value) => {
            var obj = value[__knownSymbol("asyncIterator")], isAwait = false, method, it = {};
            if (obj == null) {
              obj = value[__knownSymbol("iterator")]();
              method = (k) => it[k] = (x) => obj[k](x);
            } else {
              obj = obj.call(value);
              method = (k) => it[k] = (v) => {
                if (isAwait) {
                  isAwait = false;
                  if (k === "throw") throw v;
                  return v;
                }
                isAwait = true;
                return {
                  done: false,
                  value: new __await(new Promise((resolve) => {
                    var x = obj[k](v);
                    if (!(x instanceof Object)) __typeError("Object expected");
                    resolve(x);
                  }), 1)
                };
              };
            }
            return it[__knownSymbol("iterator")] = () => it, method("next"), "throw" in obj ? method("throw") : it.throw = (x) => {
              throw x;
            }, "return" in obj && method("return"), it;
          };
          var __forAwait = (obj, it, method) => (it = obj[__knownSymbol("asyncIterator")]) ? it.call(obj) : (obj = obj[__knownSymbol("iterator")](), it = {}, method = (key, fn) => (fn = obj[key]) && (it[key] = (arg) => new Promise((yes, no, done) => (arg = fn.call(obj, arg), done = arg.done, Promise.resolve(arg.value).then((value) => yes({ value, done }), no)))), method("next"), method("return"), it);
          var main_exports = {};
          __export(main_exports, {
            default: () => main_default,
            parse: () => parse,
            parseBuffer: () => parseBuffer,
            parseEvents: () => parseEvents
          });
          var MAC_EPOCH_TO_UNIX_EPOCH_SECONDS = 2082844800;
          function decodeFixedPoint(value, fractionalBits) {
            return value / 2 ** fractionalBits;
          }
          function toSignedInt(value, bits) {
            const maxUnsigned = 2 ** bits;
            const signedBoundary = 2 ** (bits - 1);
            return value >= signedBoundary ? value - maxUnsigned : value;
          }
          function decodeSignedFixedPoint(value, bits, fractionalBits) {
            return decodeFixedPoint(toSignedInt(value, bits), fractionalBits);
          }
          function fixedPointField(raw, bits, fractionalBits, format) {
            return {
              kind: "fixed-point",
              value: decodeFixedPoint(raw, fractionalBits),
              raw,
              format,
              signed: false,
              bits
            };
          }
          function signedFixedPointField(raw, bits, fractionalBits, format) {
            return {
              kind: "fixed-point",
              value: decodeSignedFixedPoint(raw, bits, fractionalBits),
              raw,
              format,
              signed: true,
              bits
            };
          }
          function bitsField(raw, totalBits, parts) {
            var _a, _b;
            let remainingBits = totalBits;
            const fields = parts.map((part) => {
              remainingBits -= part.bits;
              const value = Math.floor(raw / 2 ** remainingBits) & 2 ** part.bits - 1;
              return {
                key: part.key,
                value,
                bits: part.bits,
                shift: remainingBits,
                mask: (2 ** part.bits - 1) * 2 ** remainingBits
              };
            });
            return {
              kind: "bits",
              value: (_b = (_a = fields.find((field) => field.key === "value")) == null ? void 0 : _a.value) != null ? _b : raw,
              raw,
              bits: totalBits,
              fields
            };
          }
          function flagsField(raw, totalBits, flags) {
            return {
              kind: "flags",
              value: raw,
              raw,
              bits: totalBits,
              flags: Object.entries(flags).map(([key, mask]) => ({
                key,
                value: (raw & mask) !== 0,
                mask
              }))
            };
          }
          function unixSecondsToIsoString(unixSeconds) {
            if (typeof unixSeconds === "bigint") {
              if (unixSeconds < BigInt(Number.MIN_SAFE_INTEGER) || unixSeconds > BigInt(Number.MAX_SAFE_INTEGER)) {
                return null;
              }
              return unixSecondsToIsoString(Number(unixSeconds));
            }
            const unixMilliseconds = unixSeconds * 1e3;
            if (!Number.isFinite(unixMilliseconds)) {
              return null;
            }
            const date = new Date(unixMilliseconds);
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
          }
          function macDateField(value) {
            const unixSeconds = typeof value === "bigint" ? value - BigInt(MAC_EPOCH_TO_UNIX_EPOCH_SECONDS) : value - MAC_EPOCH_TO_UNIX_EPOCH_SECONDS;
            return {
              kind: "date",
              value,
              date: unixSecondsToIsoString(unixSeconds),
              epoch: "1904-01-01T00:00:00.000Z",
              unit: "seconds"
            };
          }
          function parsedBoxValue(key, value, description) {
            const ret = __spreadValues({
              key
            }, normalizeField(value));
            if (description !== void 0) {
              return __spreadProps(__spreadValues({}, ret), { description });
            }
            return ret;
          }
          function structField(fields, layout) {
            const ret = {
              kind: "struct",
              fields
            };
            if (layout !== void 0) {
              ret.layout = layout;
            }
            return ret;
          }
          function isParsedField(value) {
            return typeof value === "object" && value !== null && "kind" in value && typeof value.kind === "string";
          }
          function normalizeField(value) {
            if (isParsedField(value)) {
              return value;
            }
            if (typeof value === "number") {
              return { kind: "number", value };
            }
            if (typeof value === "bigint") {
              return { kind: "bigint", value };
            }
            if (typeof value === "string") {
              return { kind: "string", value };
            }
            if (typeof value === "boolean") {
              return { kind: "boolean", value };
            }
            if (Array.isArray(value)) {
              return {
                kind: "array",
                items: value.map((item) => normalizeField(item))
              };
            }
            if (value && typeof value === "object") {
              return structField(
                Object.entries(value).map(
                  ([key, fieldValue]) => parsedBoxValue(key, fieldValue)
                )
              );
            }
            if (value === null) {
              return { kind: "null", value: null };
            }
            throw new TypeError(`Unsupported parsed field value: ${typeof value}`);
          }
          function be2toi(bytes, off) {
            return (bytes[0 + off] << 8) + bytes[1 + off];
          }
          function be3toi(bytes, off) {
            return bytes[0 + off] * 65536 + bytes[1 + off] * 256 + bytes[2 + off];
          }
          function be4toi(bytes, off) {
            return bytes[0 + off] * 16777216 + bytes[1 + off] * 65536 + bytes[2 + off] * 256 + bytes[3 + off];
          }
          function be5toi(bytes, off) {
            return bytes[0 + off] * 4294967296 + bytes[1 + off] * 16777216 + bytes[2 + off] * 65536 + bytes[3 + off] * 256 + bytes[4 + off];
          }
          function be8toi(bytes, off) {
            return (bytes[0 + off] * 16777216 + bytes[1 + off] * 65536 + bytes[2 + off] * 256 + bytes[3 + off]) * 4294967296 + bytes[4 + off] * 16777216 + bytes[5 + off] * 65536 + bytes[6 + off] * 256 + bytes[7 + off];
          }
          function bytesToHex(uint8arr, off, nbBytes) {
            if (!uint8arr) {
              return "";
            }
            const arr = uint8arr.slice(off, nbBytes + off);
            let hexStr = "";
            for (let i = 0; i < arr.length; i++) {
              let hex = (arr[i] & 255).toString(16);
              hex = hex.length === 1 ? `0${hex}` : hex;
              hexStr += hex;
            }
            return hexStr.toUpperCase();
          }
          function betoa(uint8arr, off, nbBytes) {
            if (!uint8arr) {
              return "";
            }
            const arr = uint8arr.slice(off, nbBytes + off);
            return String.fromCharCode(...arr);
          }
          function createBufferReader(buffer) {
            let currentOffset = 0;
            function hexToBigInt(hex) {
              return BigInt(`0x${hex}`);
            }
            function ensureAvailable(nbBytes) {
              if (!Number.isInteger(nbBytes) || nbBytes < 0) {
                throw new Error(`Cannot read an invalid byte length: ${nbBytes}.`);
              }
              const remaining = buffer.length - currentOffset;
              if (remaining < nbBytes) {
                throw new Error(
                  `Cannot read ${nbBytes} byte(s) at offset ${currentOffset}: only ${Math.max(0, remaining)} byte(s) remaining.`
                );
              }
            }
            return {
              /**
               * Returns the N next bytes, as a single number.
               *
               * /!\ only work for now for 1, 2, 3, 4, 5 or 8 bytes.
               *
               * /!\ Depending on the size of the number, it may be larger than JS'
               * limit.
               *
               * @param {number} nbBytes
               * @returns {number}
               */
              bytesToInt(nbBytes) {
                ensureAvailable(nbBytes);
                let res;
                switch (nbBytes) {
                  case 1:
                    res = buffer[currentOffset];
                    break;
                  case 2:
                    res = be2toi(buffer, currentOffset);
                    break;
                  case 3:
                    res = be3toi(buffer, currentOffset);
                    break;
                  case 4:
                    res = be4toi(buffer, currentOffset);
                    break;
                  case 5:
                    res = be5toi(buffer, currentOffset);
                    break;
                  case 8:
                    res = be8toi(buffer, currentOffset);
                    break;
                  default:
                    throw new Error("not implemented yet.");
                }
                currentOffset += nbBytes;
                return res;
              },
              /**
               * Returns the N next bytes into a string of Hexadecimal values.
               * @param {number} nbBytes
               * @returns {string}
               */
              bytesToHex(nbBytes) {
                ensureAvailable(nbBytes);
                const res = bytesToHex(buffer, currentOffset, nbBytes);
                currentOffset += nbBytes;
                return res;
              },
              /**
               * Returns the next 8 bytes as an exact unsigned 64-bit bigint.
               * @returns {bigint}
               */
              bytesToUint64BigInt() {
                ensureAvailable(8);
                const hex = bytesToHex(buffer, currentOffset, 8);
                currentOffset += 8;
                return hexToBigInt(hex);
              },
              /**
               * Returns the next 8 bytes as an exact signed 64-bit bigint.
               * @returns {bigint}
               */
              bytesToInt64BigInt() {
                ensureAvailable(8);
                const hex = bytesToHex(buffer, currentOffset, 8);
                currentOffset += 8;
                return BigInt.asIntN(64, hexToBigInt(hex));
              },
              /**
               * Returns the N next bytes into a string.
               * @param {number} nbBytes
               * @returns {string}
               */
              bytesToASCII(nbBytes) {
                ensureAvailable(nbBytes);
                const res = betoa(buffer, currentOffset, nbBytes);
                currentOffset += nbBytes;
                return res;
              },
              /**
               * Returns the total length of the buffer
               * @returns {number}
               */
              getTotalLength() {
                return buffer.length;
              },
              /**
               * Returns the length of the buffer which is not yet parsed.
               * @returns {number}
               */
              getRemainingLength() {
                return Math.max(0, buffer.length - currentOffset);
              },
              /**
               * Returns true if this buffer is entirely parsed.
               * @returns {boolean}
               */
              isFinished() {
                return buffer.length <= currentOffset;
              }
            };
          }
          function getDescription(meta) {
            if (typeof meta === "string") {
              return meta;
            }
            return meta == null ? void 0 : meta.description;
          }
          function createBoxReader(buffer) {
            const reader = createBufferReader(buffer);
            const values = [];
            function addField(key, value, meta) {
              values.push(parsedBoxValue(key, value, getDescription(meta)));
              return value;
            }
            return (
              /** @type {import("./types.js").BoxReader<T>} */
              __spreadProps(__spreadValues({}, reader), {
                addField,
                readUint: reader.bytesToInt,
                readUint64: reader.bytesToUint64BigInt,
                readInt64: reader.bytesToInt64BigInt,
                readHex: reader.bytesToHex,
                readAscii: reader.bytesToASCII,
                fieldUint(key, nbBytes, meta) {
                  return (
                    /** @type {number} */
                    addField(key, reader.bytesToInt(nbBytes), meta)
                  );
                },
                fieldUint64(key, meta) {
                  return (
                    /** @type {bigint} */
                    addField(key, reader.bytesToUint64BigInt(), meta)
                  );
                },
                fieldInt64(key, meta) {
                  return (
                    /** @type {bigint} */
                    addField(key, reader.bytesToInt64BigInt(), meta)
                  );
                },
                fieldHex(key, nbBytes, meta) {
                  return (
                    /** @type {string} */
                    addField(key, reader.bytesToHex(nbBytes), meta)
                  );
                },
                fieldAscii(key, nbBytes, meta) {
                  return (
                    /** @type {string} */
                    addField(key, reader.bytesToASCII(nbBytes), meta)
                  );
                },
                fieldFixedPoint(key, nbBytes, fractionalBits, format, meta) {
                  const value = fixedPointField(
                    reader.bytesToInt(nbBytes),
                    nbBytes * 8,
                    fractionalBits,
                    format
                  );
                  addField(key, value, meta);
                  return value;
                },
                fieldSignedFixedPoint(key, nbBytes, bits, fractionalBits, format, meta) {
                  const value = signedFixedPointField(
                    reader.bytesToInt(nbBytes),
                    bits,
                    fractionalBits,
                    format
                  );
                  addField(key, value, meta);
                  return value;
                },
                fieldMacDate(key, nbBytes, meta) {
                  const raw = nbBytes === 8 ? reader.bytesToUint64BigInt() : reader.bytesToInt(nbBytes);
                  const value = macDateField(raw);
                  addField(key, value, meta);
                  return value;
                },
                fieldBits(key, nbBytes, parts, meta) {
                  const value = bitsField(reader.bytesToInt(nbBytes), nbBytes * 8, parts);
                  addField(key, value, meta);
                  return value.value;
                },
                fieldFlags(key, nbBytes, flags, meta) {
                  const value = flagsField(reader.bytesToInt(nbBytes), nbBytes * 8, flags);
                  addField(key, value, meta);
                  return value.value;
                },
                getValues() {
                  return values.slice();
                }
              })
            );
          }
          function parseTransformationMatrix(r) {
            return structField(
              [
                parsedBoxValue(
                  "a",
                  signedFixedPointField(r.bytesToInt(4), 32, 16, "16.16")
                ),
                parsedBoxValue(
                  "b",
                  signedFixedPointField(r.bytesToInt(4), 32, 16, "16.16")
                ),
                parsedBoxValue(
                  "u",
                  signedFixedPointField(r.bytesToInt(4), 32, 30, "2.30")
                ),
                parsedBoxValue(
                  "c",
                  signedFixedPointField(r.bytesToInt(4), 32, 16, "16.16")
                ),
                parsedBoxValue(
                  "d",
                  signedFixedPointField(r.bytesToInt(4), 32, 16, "16.16")
                ),
                parsedBoxValue(
                  "v",
                  signedFixedPointField(r.bytesToInt(4), 32, 30, "2.30")
                ),
                parsedBoxValue(
                  "x",
                  signedFixedPointField(r.bytesToInt(4), 32, 16, "16.16")
                ),
                parsedBoxValue(
                  "y",
                  signedFixedPointField(r.bytesToInt(4), 32, 16, "16.16")
                ),
                parsedBoxValue(
                  "w",
                  signedFixedPointField(r.bytesToInt(4), 32, 30, "2.30")
                )
              ],
              "matrix-3x3"
            );
          }
          function parsePascalString(r, length) {
            const stringLength = Math.min(r.bytesToInt(1), length - 1);
            const value = stringLength > 0 ? r.bytesToASCII(stringLength) : "";
            const paddingLength = length - 1 - stringLength;
            if (paddingLength > 0) {
              r.bytesToHex(paddingLength);
            }
            return value;
          }
          function parseVisualSampleEntry(r) {
            const reserved = [];
            for (let i = 0; i < 6; i++) {
              reserved.push(r.bytesToInt(1));
            }
            return {
              reserved,
              data_reference_index: r.bytesToInt(2),
              pre_defined: r.bytesToInt(2),
              reserved_1: r.bytesToInt(2),
              pre_defined_1: [r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4)],
              width: r.bytesToInt(2),
              height: r.bytesToInt(2),
              horizresolution: fixedPointField(r.bytesToInt(4), 32, 16, "16.16"),
              vertresolution: fixedPointField(r.bytesToInt(4), 32, 16, "16.16"),
              reserved_2: r.bytesToInt(4),
              frame_count: r.bytesToInt(2),
              compressorname: parsePascalString(r, 32),
              depth: r.bytesToInt(2),
              pre_defined_2: r.bytesToInt(2)
            };
          }
          function parseAudioSampleEntry(r) {
            const reserved = [];
            for (let i = 0; i < 6; i++) {
              reserved.push(r.bytesToInt(1));
            }
            const base = {
              reserved,
              data_reference_index: r.bytesToInt(2),
              version: r.bytesToInt(2),
              revision_level: r.bytesToInt(2),
              vendor: r.bytesToInt(4),
              channelcount: r.bytesToInt(2),
              samplesize: r.bytesToInt(2),
              compression_id: r.bytesToInt(2),
              packet_size: r.bytesToInt(2),
              samplerate: fixedPointField(r.bytesToInt(4), 32, 16, "16.16")
            };
            if (base.version === 1) {
              const result = __spreadProps(__spreadValues({}, base), {
                samples_per_packet: r.bytesToInt(4),
                bytes_per_packet: r.bytesToInt(4),
                bytes_per_frame: r.bytesToInt(4),
                bytes_per_sample: r.bytesToInt(4)
              });
              return (
                /** @type {AudioSampleEntryV1} */
                result
              );
            } else if (base.version === 2) {
              const result = __spreadProps(__spreadValues({}, base), {
                struct_size: r.bytesToInt(4),
                sample_rate: fixedPointField(r.bytesToInt(4), 32, 16, "16.16"),
                channel_count: r.bytesToInt(4),
                reserved_1: r.bytesToInt(4),
                bits_per_channel: r.bytesToInt(4),
                format_specific_flags: r.bytesToInt(4),
                bytes_per_audio_packet: r.bytesToInt(4),
                LPCM_frames_per_audio_packet: r.bytesToInt(4)
              });
              return (
                /** @type {AudioSampleEntryV2} */
                result
              );
            }
            return base;
          }
          function parseDescriptorLength(r) {
            let length = 0;
            let size = 0;
            while (size < 4) {
              const currentByte = r.bytesToInt(1);
              size += 1;
              length = length << 7 | currentByte & 127;
              if ((currentByte & 128) === 0) {
                return {
                  length,
                  size
                };
              }
            }
            throw new Error("invalid descriptor length");
          }
          function parseNestedDescriptors(r, size) {
            const descriptors = [];
            let remaining = size;
            while (remaining > 0) {
              const before = r.getRemainingLength();
              const descriptor = parseDescriptor(r);
              const consumed = before - r.getRemainingLength();
              remaining -= consumed;
              descriptors.push(descriptor);
            }
            if (remaining !== 0) {
              throw new Error("descriptor size mismatch");
            }
            return descriptors;
          }
          function parseDescriptorPayload(r, tag, size) {
            if (tag === 3) {
              const es_id = r.bytesToInt(2);
              const flags = r.bytesToInt(1);
              const ret = {
                es_id,
                stream_dependence_flag: !!(flags & 128),
                URL_flag: !!(flags & 64),
                OCRstream_flag: !!(flags & 32),
                stream_priority: flags & 31
              };
              let consumed = 3;
              if (ret.stream_dependence_flag) {
                ret.depends_on_es_id = r.bytesToInt(2);
                consumed += 2;
              }
              if (ret.URL_flag) {
                const urlLength = r.bytesToInt(1);
                ret.URL_length = urlLength;
                ret.URL_string = urlLength > 0 ? r.bytesToASCII(urlLength) : "";
                consumed += 1 + urlLength;
              }
              if (ret.OCRstream_flag) {
                ret.ocr_es_id = r.bytesToInt(2);
                consumed += 2;
              }
              if (size > consumed) {
                ret.descriptors = parseNestedDescriptors(r, size - consumed);
              }
              return ret;
            }
            if (tag === 4) {
              const objectTypeIndication = r.bytesToInt(1);
              const streamByte = r.bytesToInt(1);
              const ret = {
                object_type_indication: objectTypeIndication,
                stream_type: streamByte >> 2 & 63,
                up_stream: !!(streamByte >> 1 & 1),
                reserved: streamByte & 1,
                buffer_size_db: r.bytesToInt(3),
                max_bitrate: r.bytesToInt(4),
                avg_bitrate: r.bytesToInt(4)
              };
              if (size > 13) {
                ret.descriptors = parseNestedDescriptors(r, size - 13);
              }
              return ret;
            }
            if (tag === 5) {
              return {
                decoder_specific_info: size > 0 ? r.bytesToHex(size) : ""
              };
            }
            if (tag === 6) {
              return {
                predefined: r.bytesToInt(1),
                remaining_payload: size > 1 ? r.bytesToHex(size - 1) : ""
              };
            }
            return {
              data: size > 0 ? r.bytesToHex(size) : ""
            };
          }
          function parseDescriptor(r) {
            const tag = r.bytesToInt(1);
            const { length, size } = parseDescriptorLength(r);
            return {
              tag,
              size: length,
              header_size: size + 1,
              payload: parseDescriptorPayload(r, tag, length)
            };
          }
          var avc1_default = {
            name: "AVC Sample Entry",
            description: "Describes AVC video samples whose parameter sets are stored in this entry.",
            container: true,
            parser(r) {
              return parseVisualSampleEntry(r);
            }
          };
          var avc3_default = {
            name: "AVC3 Sample Entry",
            description: "Describes AVC video samples whose parameter sets may be carried in-band.",
            container: true,
            parser(r) {
              return parseVisualSampleEntry(r);
            }
          };
          var avcC_default = {
            name: "AVC Decoder Configuration Record",
            description: "Stores AVC decoder configuration, including profile data and parameter sets.",
            parser(reader) {
              reader.fieldUint("configurationVersion", 1);
              reader.fieldUint("AVCProfileIndication", 1);
              reader.fieldUint("profile_compatibility", 1);
              reader.fieldUint("AVCLevelIndication", 1);
              reader.fieldBits("lengthSizeMinusOne", 1, [
                { key: "reserved", bits: 6 },
                { key: "value", bits: 2 }
              ]);
              const numOfSequenceParameterSets = reader.fieldBits(
                "numOfSequenceParameterSets",
                1,
                [
                  { key: "reserved", bits: 3 },
                  { key: "value", bits: 5 }
                ]
              );
              const sequenceParameterSets = [];
              for (let i = 0; i < numOfSequenceParameterSets; i++) {
                const sequenceParameterSetLength = reader.readUint(2);
                sequenceParameterSets.push({
                  length: sequenceParameterSetLength,
                  data: reader.readHex(sequenceParameterSetLength)
                });
              }
              reader.addField("sequenceParameterSets", sequenceParameterSets);
              const numOfPictureParameterSets = reader.fieldUint(
                "numOfPictureParameterSets",
                1
              );
              const pictureParameterSets = [];
              for (let i = 0; i < numOfPictureParameterSets; i++) {
                const pictureParameterSetLength = reader.readUint(2);
                pictureParameterSets.push({
                  length: pictureParameterSetLength,
                  data: reader.readHex(pictureParameterSetLength)
                });
              }
              reader.addField("pictureParameterSets", pictureParameterSets);
              if (!reader.isFinished()) {
                reader.fieldHex("ext", reader.getRemainingLength());
              }
            }
          };
          var btrt_default = {
            name: "Bit Rate Box",
            description: "Provides buffer size and bitrate limits for a sample entry.",
            parser(reader) {
              reader.fieldUint("bufferSizeDB", 4);
              reader.fieldUint("maxBitrate", 4);
              reader.fieldUint("avgBitrate", 4);
            }
          };
          var co64_default = {
            name: "Chunk Large Offset Box",
            description: "Maps each media chunk to its 64-bit byte offset in the file.",
            parser(r) {
              const version = r.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              const flags = r.bytesToInt(3);
              const entry_count = r.bytesToInt(4);
              const chunk_offsets = [];
              for (let i = 0; i < entry_count; i++) {
                chunk_offsets.push(r.bytesToUint64BigInt());
              }
              return {
                version,
                flags,
                entry_count,
                chunk_offsets
              };
            }
          };
          var colr_default = {
            name: "Colour Information Box",
            description: "Signals the colour representation used by visual samples.",
            parser(r) {
              const colour_type = r.bytesToASCII(4);
              const ret = { colour_type };
              if (colour_type === "nclx" || colour_type === "nclc") {
                ret.colour_primaries = r.bytesToInt(2);
                ret.transfer_characteristics = r.bytesToInt(2);
                ret.matrix_coefficients = r.bytesToInt(2);
                if (!r.isFinished()) {
                  ret.full_range_flag = !!(r.bytesToInt(1) & 128);
                }
              } else if (!r.isFinished()) {
                ret.data = r.bytesToHex(r.getRemainingLength());
              }
              return ret;
            }
          };
          var ctts_default = {
            name: "Composition Time to Sample Box",
            description: "Maps samples to composition-time offsets for presentation order.",
            parser(r) {
              const version = r.bytesToInt(1);
              if (version > 1) {
                throw new Error("invalid version");
              }
              const flags = r.bytesToInt(3);
              const entry_count = r.bytesToInt(4);
              const entries = [];
              for (let i = 0; i < entry_count; i++) {
                entries.push({
                  sample_count: r.bytesToInt(4),
                  sample_offset: version === 0 ? r.bytesToInt(4) : ~~r.bytesToInt(4)
                });
              }
              return {
                version,
                flags,
                entry_count,
                entries
              };
            }
          };
          var dinf_default = {
            name: "Data Information Box",
            description: "Objects that declare the location of the media information in a track.",
            container: true
          };
          var dref_default = {
            name: "Data Reference Box",
            description: "Lists references that locate the media data used by the track.",
            container: true,
            parser(reader) {
              const version = reader.fieldUint("version", 1);
              const flags = reader.fieldUint("flags", 3);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              if (flags !== 0) {
                throw new Error("invalid flags");
              }
              reader.fieldUint("entry_count", 4);
            }
          };
          var edts_default = {
            name: "Edit Box",
            description: "Maps the presentation time\u2010line to the media time\u2010line as it is stored in the file.",
            container: true
          };
          var elst_default = {
            name: "Edit List Box",
            description: "Defines timeline edits that map movie time to media time.",
            parser(reader) {
              const version = reader.fieldUint("version", 1);
              if (version > 1) {
                throw new Error("invalid version");
              }
              reader.fieldUint("flags", 3);
              const entry_count = reader.fieldUint("entry_count", 4);
              const entries = [];
              for (let i = 0; i < entry_count; i++) {
                entries.push({
                  segment_duration: version === 0 ? reader.bytesToInt(4) : reader.bytesToUint64BigInt(),
                  media_time: version === 0 ? ~~reader.bytesToInt(4) : reader.bytesToInt64BigInt(),
                  media_rate_integer: toSignedInt(reader.bytesToInt(2), 16),
                  media_rate_fraction: reader.bytesToInt(2)
                });
              }
              reader.addField("entries", entries);
            }
          };
          var encv_default = {
            name: "Encrypted Video Sample Entry",
            description: "Describes encrypted visual samples and their protection metadata.",
            container: true,
            parser(r) {
              return parseVisualSampleEntry(r);
            }
          };
          var esds_default = {
            name: "Elementary Stream Descriptor Box",
            description: "Carries MPEG-4 elementary stream descriptors for a sample entry.",
            parser(reader) {
              const version = reader.fieldUint("version", 1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              reader.fieldUint("flags", 3);
              const descriptors = [];
              while (!reader.isFinished()) {
                descriptors.push(parseDescriptor(reader));
              }
              reader.addField("descriptors", descriptors);
            }
          };
          var free_default = {
            name: "Free Space Box",
            description: "This box can be completely ignored"
          };
          var frma_default = {
            name: "Original Format Box",
            description: "Identifies the coding format before protection was applied.",
            parser(reader) {
              reader.fieldAscii("original_format", 4);
            }
          };
          var ftyp_default = {
            name: "File Type Box",
            description: "File type and compatibility",
            content: [
              {
                /* name: "major brand", */
                // optional name
                key: "major_brand",
                description: "Brand identifier."
              },
              {
                key: "minor_version",
                description: "informative integer for the minor version of the major brand"
              },
              {
                key: "compatible_brands",
                description: "List of brands"
              }
            ],
            parser(reader) {
              const len = reader.getTotalLength();
              const major_brand = reader.bytesToASCII(4);
              const minor_version = reader.bytesToInt(4);
              const compatArr = [];
              for (let i = 8; i < len; i += 4) {
                compatArr.push(reader.bytesToASCII(4));
              }
              return {
                major_brand,
                minor_version,
                compatible_brands: compatArr.join(", ")
              };
            }
          };
          var hdlr_default = {
            name: "Handler Reference Box",
            description: "Identifies the handler type for the track or metadata it belongs to.",
            parser(r) {
              const ret = {
                version: r.bytesToInt(1),
                flags: r.bytesToInt(3),
                pre_defined: r.bytesToInt(4),
                handler_type: r.bytesToInt(4),
                reserved: [r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4)]
              };
              const remaining = r.getRemainingLength();
              if (remaining > 0) {
                ret.name = r.bytesToASCII(remaining);
              }
              return ret;
            }
          };
          var hev1_default = {
            name: "HEV1 Sample Entry",
            description: "Describes HEVC samples whose parameter sets may be carried in-band.",
            container: true,
            parser(r) {
              return parseVisualSampleEntry(r);
            }
          };
          var hvc1_default = {
            name: "HEVC Sample Entry",
            description: "Describes HEVC samples whose parameter sets are stored in this entry.",
            container: true,
            parser(r) {
              return parseVisualSampleEntry(r);
            }
          };
          var hvcC_default = {
            name: "HEVC Decoder Configuration Record",
            description: "Stores HEVC decoder configuration, including profile data and NAL arrays.",
            parser(r) {
              const configurationVersion = r.bytesToInt(1);
              const generalProfileByte = r.bytesToInt(1);
              const generalCompatibilityFlagsUpper = r.bytesToInt(4);
              const generalLevelIdc = r.bytesToInt(1);
              const constraintUpper = r.bytesToInt(4);
              const constraintLower = r.bytesToInt(2);
              const minSpatialSegmentation = r.bytesToInt(2);
              const parallelismType = r.bytesToInt(1);
              const chromaFormat = r.bytesToInt(1);
              const bitDepthLumaMinus8 = r.bytesToInt(1);
              const bitDepthChromaMinus8 = r.bytesToInt(1);
              const avgFrameRate = r.bytesToInt(2);
              const miscByte = r.bytesToInt(1);
              const numOfArrays = r.bytesToInt(1);
              const arrays = [];
              for (let i = 0; i < numOfArrays; i++) {
                const arrayCompletenessByte = r.bytesToInt(1);
                const numNalus = r.bytesToInt(2);
                const nalus = [];
                for (let j = 0; j < numNalus; j++) {
                  const nalUnitLength = r.bytesToInt(2);
                  nalus.push({
                    length: nalUnitLength,
                    data: r.bytesToHex(nalUnitLength)
                  });
                }
                arrays.push({
                  array_completeness: !!(arrayCompletenessByte >> 7 & 1),
                  reserved: !!(arrayCompletenessByte >> 6 & 1),
                  NAL_unit_type: arrayCompletenessByte & 63,
                  numNalus,
                  nalus
                });
              }
              return {
                configurationVersion,
                general_profile_space: generalProfileByte >> 6 & 3,
                general_tier_flag: !!(generalProfileByte >> 5 & 1),
                general_profile_idc: generalProfileByte & 31,
                general_profile_compatibility_flags: generalCompatibilityFlagsUpper,
                general_constraint_indicator_flags: constraintUpper * 65536 + constraintLower,
                general_level_idc: generalLevelIdc,
                min_spatial_segmentation_idc: minSpatialSegmentation & 4095,
                parallelismType: parallelismType & 3,
                chromaFormat: chromaFormat & 3,
                bitDepthLumaMinus8: bitDepthLumaMinus8 & 7,
                bitDepthChromaMinus8: bitDepthChromaMinus8 & 7,
                avgFrameRate,
                constantFrameRate: miscByte >> 6 & 3,
                numTemporalLayers: miscByte >> 3 & 7,
                temporalIdNested: !!(miscByte >> 2 & 1),
                lengthSizeMinusOne: miscByte & 3,
                numOfArrays,
                arrays
              };
            }
          };
          function decodeIso639Language(code) {
            return String.fromCharCode(
              (code >> 10 & 31) + 96,
              (code >> 5 & 31) + 96,
              (code & 31) + 96
            );
          }
          var ID32_default = {
            name: "ID3 Metadata Box",
            description: "Carries ID3 metadata with a language code and raw ID3 payload.",
            parser(r) {
              const version = r.bytesToInt(1);
              const flags = r.bytesToInt(3);
              const languageCode = r.bytesToInt(2);
              const data = r.bytesToHex(r.getRemainingLength());
              return {
                version,
                flags,
                language: decodeIso639Language(languageCode),
                data
              };
            }
          };
          var ilst_default = {
            name: "Item List Box",
            description: "Contains metadata items, commonly used for iTunes-style tags.",
            container: true
          };
          var iods_default = {
            name: "Initial Object Descriptor Box",
            description: "Container for MPEG-4 object descriptor information.",
            parser(r) {
              const version = r.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              const flags = r.bytesToInt(3);
              const descriptors = [];
              while (!r.isFinished()) {
                descriptors.push(parseDescriptor(r));
              }
              return {
                version,
                flags,
                descriptors
              };
            }
          };
          var leva_default = {
            name: "Level Assignment Box",
            description: "Assigns media data to levels for partial presentation selection.",
            parser(reader) {
              const version = reader.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              const flags = reader.bytesToInt(3);
              const level_count = reader.bytesToInt(1);
              const levels = [];
              for (let i = 0; i < level_count; i++) {
                const assignment = {
                  track_id: reader.bytesToInt(4),
                  padding_flag: false,
                  assignment_type: 0
                };
                const assignmentByte = reader.bytesToInt(1);
                assignment.padding_flag = !!(assignmentByte & 128);
                assignment.assignment_type = assignmentByte & 127;
                if (assignment.assignment_type === 0) {
                  assignment.grouping_type = reader.bytesToInt(4);
                } else if (assignment.assignment_type === 1) {
                  assignment.grouping_type = reader.bytesToInt(4);
                  assignment.grouping_type_parameter = reader.bytesToInt(4);
                } else if (assignment.assignment_type === 4) {
                  assignment.sub_track_id = reader.bytesToInt(4);
                } else if (assignment.assignment_type !== 2 && assignment.assignment_type !== 3) {
                  throw new Error("invalid assignment_type");
                }
                levels.push(assignment);
              }
              return {
                version,
                flags,
                level_count,
                levels
              };
            }
          };
          var mdat_default = {
            name: "Media Data Box",
            description: "the content's data"
          };
          var mdhd_default = {
            name: "Media Header Box",
            description: "Timing and language metadata for one track's media.",
            parser(r) {
              const version = r.bytesToInt(1);
              const flags = r.bytesToInt(3);
              const creation_time = version ? r.bytesToUint64BigInt() : r.bytesToInt(4);
              const modification_time = version ? r.bytesToUint64BigInt() : r.bytesToInt(4);
              const timescale = r.bytesToInt(4);
              const duration = version ? r.bytesToUint64BigInt() : r.bytesToInt(4);
              const next2Bytes = r.bytesToInt(2);
              const pad = next2Bytes >> 15 & 1;
              const language = [
                String.fromCharCode((next2Bytes >> 10 & 31) + 96),
                String.fromCharCode((next2Bytes >> 5 & 31) + 96),
                String.fromCharCode((next2Bytes & 31) + 96)
              ].join("");
              const pre_defined = r.bytesToInt(2);
              return {
                version,
                flags,
                creation_time: macDateField(creation_time),
                modification_time: macDateField(modification_time),
                timescale,
                duration,
                pad,
                language: structField(
                  [parsedBoxValue("value", language), parsedBoxValue("raw", next2Bytes)],
                  "iso-639-2-t"
                ),
                pre_defined
              };
            }
          };
          var mdia_default = {
            name: "Track Media Structure",
            description: "Container for the media description and sample tables of a track.",
            container: true
          };
          var mehd_default = {
            name: "Movie Extends Header Box",
            description: "Provides the overall duration, including fragments, of a fragmented movie. If this box is not present, the overall duration must be computed by examining each fragment.",
            parser(reader) {
              const version = reader.bytesToInt(1);
              if (version > 1) {
                throw new Error("invalid version");
              }
              const flags = reader.bytesToInt(3);
              const fragmentDuration = version === 1 ? reader.bytesToUint64BigInt() : reader.bytesToInt(4);
              return {
                version,
                flags,
                fragment_duration: fragmentDuration
              };
            }
          };
          var meta_default = {
            name: "Metadata Box",
            description: "Container for metadata boxes and their handler.",
            container: true,
            parser(r) {
              const version = r.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              return {
                version,
                flags: r.bytesToInt(3)
              };
            }
          };
          var mfhd_default = {
            name: "Movie Fragment Header Box",
            description: "This box contains just a sequence number (usually starting at 1), as a safety check.",
            parser(r) {
              return {
                version: r.bytesToInt(1),
                flags: r.bytesToInt(3),
                sequence_number: r.bytesToInt(4)
              };
            }
          };
          var minf_default = {
            name: "Media Information Box",
            description: "Container for media-specific header boxes and data references.",
            container: true
          };
          var moof_default = {
            name: "Movie Fragment Box",
            description: "Container for metadata that describes one movie fragment.",
            container: true
          };
          var moov_default = {
            name: "Movie Box",
            description: "The movie metadata",
            container: true
          };
          var mp4a_default = {
            name: "MPEG-4 Audio Sample Entry",
            description: "Describes MPEG-4 audio samples and their decoder configuration.",
            container: true,
            parser(r) {
              return parseAudioSampleEntry(r);
            }
          };
          var mvex_default = {
            name: "Movie Extends Box",
            description: "Container for defaults and metadata used by movie fragments.",
            container: true
          };
          var mvhd_default = {
            name: "Movie Header Box",
            description: "Overall timing and playback defaults for the whole presentation.",
            content: [
              {
                name: "version",
                description: "mvhd version",
                key: "version"
              },
              {
                name: "flags",
                description: "mvhd flags",
                key: "flags"
              },
              {
                name: "creation_time",
                description: "Creation timestamp in seconds since 1904-01-01 UTC.",
                key: "creation_time"
              },
              {
                name: "modification_time",
                description: "Last modification timestamp in seconds since 1904-01-01 UTC.",
                key: "modification_time"
              },
              {
                name: "timescale",
                description: "Number of movie time units per second.",
                key: "timescale"
              },
              {
                name: "duration",
                description: "Movie duration in the movie timescale.",
                key: "duration"
              },
              {
                name: "rate",
                description: "Preferred playback rate as a 16.16 fixed-point value.",
                key: "rate"
              },
              {
                name: "volume",
                description: "Preferred playback volume as an 8.8 fixed-point value.",
                key: "volume"
              },
              {
                name: "reserved 1",
                description: "Reserved 16 bits",
                key: "reserved_1"
              },
              {
                name: "reserved 2",
                description: "Reserved 2*32 bits",
                key: "reserved_2"
              },
              {
                name: "matrix",
                description: "Transformation matrix used for presentation geometry.",
                key: "matrix"
              },
              {
                name: "pre-defined",
                description: "Pre-defined 32*6 bits.",
                key: "pre_defined"
              },
              {
                name: "next_track_ID",
                description: "Suggested non-zero track id for the next added track.",
                key: "next_track_ID"
              }
            ],
            parser: (reader) => {
              const version = reader.bytesToInt(1);
              if (version > 1) {
                throw new Error("invalid version");
              }
              const flags = reader.bytesToInt(3);
              let creation_time, modification_time, timescale, duration;
              if (version === 1) {
                creation_time = reader.bytesToUint64BigInt();
                modification_time = reader.bytesToUint64BigInt();
                timescale = reader.bytesToInt(4);
                duration = reader.bytesToUint64BigInt();
              } else {
                creation_time = reader.bytesToInt(4);
                modification_time = reader.bytesToInt(4);
                timescale = reader.bytesToInt(4);
                duration = reader.bytesToInt(4);
              }
              const rate = signedFixedPointField(reader.bytesToInt(4), 32, 16, "16.16");
              const volume = fixedPointField(reader.bytesToInt(2), 16, 8, "8.8");
              const reserved_1 = reader.bytesToInt(2);
              const reserved_2 = [reader.bytesToInt(4), reader.bytesToInt(4)];
              const matrix = parseTransformationMatrix(reader);
              const pre_defined = [
                reader.bytesToInt(4),
                reader.bytesToInt(4),
                reader.bytesToInt(4),
                reader.bytesToInt(4),
                reader.bytesToInt(4),
                reader.bytesToInt(4)
              ];
              const next_track_ID = reader.bytesToInt(4);
              return {
                version,
                flags,
                creation_time: macDateField(creation_time),
                modification_time: macDateField(modification_time),
                timescale,
                duration,
                rate,
                volume,
                reserved_1,
                reserved_2,
                matrix,
                pre_defined,
                next_track_ID
              };
            }
          };
          var pasp_default = {
            name: "Pixel Aspect Ratio Box",
            description: "Specifies the horizontal and vertical spacing that define pixel aspect ratio.",
            parser(r) {
              return {
                hSpacing: r.bytesToInt(4),
                vSpacing: r.bytesToInt(4)
              };
            }
          };
          var pdin_default = {
            name: "Progressive Download Information Box",
            description: "Provides rate and startup-delay hints for progressive download playback.",
            content: [
              {
                name: "version",
                description: "pdin version",
                key: "version"
              },
              {
                name: "flags",
                description: "pdin flags",
                key: "flags"
              },
              {
                name: "rate",
                description: "Download rate expressed in bytes/second",
                key: "rate"
              },
              {
                name: "initial_delay",
                description: "Suggested startup delay for playback at the stated download rate.",
                key: "delay"
              }
            ],
            parser(reader) {
              const version = reader.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              return {
                version,
                flags: reader.bytesToInt(3),
                rate: reader.bytesToInt(4),
                delay: reader.bytesToInt(4)
              };
            }
          };
          var SYSTEM_IDS = {
            "1077EFECC0B24D02ACE33C1E52E2FB4B": "cenc",
            "1F83E1E86EE94F0DBA2F5EC4E3ED1A66": "SecureMedia",
            "35BF197B530E42D78B651B4BF415070F": "DivX DRM",
            "45D481CB8FE049C0ADA9AB2D2455B2F2": "CoreCrypt",
            "5E629AF538DA4063897797FFBD9902D4": "Marlin",
            "616C7469636173742D50726F74656374": "AltiProtect",
            "644FE7B5260F4FAD949A0762FFB054B4": "CMLA",
            "69F908AF481646EA910CCD5DCCCB0A3A": "Marlin",
            "6A99532D869F59229A91113AB7B1E2F3": "MobiDRM",
            "80A6BE7E14484C379E70D5AEBE04C8D2": "Irdeto",
            "94CE86FB07FF4F43ADB893D2FA968CA2": "FairPlay",
            "992C46E6C4374899B6A050FA91AD0E39": "SteelKnot",
            "9A04F07998404286AB92E65BE0885F95": "PlayReady",
            "9A27DD82FDE247258CBC4234AA06EC09": "Verimatrix VCAS",
            A68129D3575B4F1A9CBA3223846CF7C3: "VideoGuard Everywhere",
            ADB41C242DBF4A6D958B4457C0D27B95: "Nagra",
            B4413586C58CFFB094A5D4896C1AF6C3: "Viaccess-Orca",
            DCF4E3E362F158187BA60A6FE33FF3DD: "DigiCAP",
            E2719D58A985B3C9781AB030AF78D30E: "ClearKey",
            EDEF8BA979D64ACEA3C827DCD51D21ED: "Widevine",
            F239E769EFA348509C16A903C6932EFB: "PrimeTime"
          };
          var pssh_default = {
            name: "Protection System Specific Header",
            description: "Carries DRM system identifiers and system-specific protection data.",
            parser(reader) {
              const ret = {};
              const version = reader.bytesToInt(1);
              ret.version = version;
              if (version > 1) {
                throw new Error("invalid version");
              }
              ret.flags = reader.bytesToInt(3);
              const systemID = reader.bytesToHex(16);
              ret.systemID = systemID;
              const systemIDName = SYSTEM_IDS[systemID];
              if (systemIDName) {
                ret.systemID += ` (${systemIDName})`;
              }
              if (ret.version === 1) {
                const KID_count = reader.bytesToInt(4);
                ret.KID_count = KID_count;
                const KIDs = [];
                ret.KIDs = KIDs;
                let i = KID_count;
                while (i--) {
                  KIDs.push([reader.bytesToHex(16)]);
                }
              }
              const data_length = reader.bytesToInt(4);
              ret.data_length = data_length;
              ret.data = reader.bytesToHex(data_length);
              return ret;
            }
          };
          var saio_default = {
            name: "Sample Auxiliary Information Offsets",
            description: "Gives file offsets for auxiliary sample information such as encryption data.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              ret.flags = r.bytesToInt(3);
              if (ret.flags === 1) {
                ret.aux_info_type = r.bytesToInt(4);
                ret.aux_info_type_parameter = r.bytesToInt(4);
              }
              const entry_count = r.bytesToInt(4);
              ret.entry_count = entry_count;
              const offset = [];
              ret.offset = offset;
              let i = entry_count;
              while (i--) {
                offset.push(r.bytesToInt(ret.version === 0 ? 4 : 8));
              }
              return ret;
            }
          };
          var saiz_default = {
            name: "Sample Auxiliary Information Sizes",
            description: "Gives per-sample sizes for auxiliary information such as encryption data.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              ret.flags = r.bytesToInt(3);
              if (ret.flags === 1) {
                ret.aux_info_type = r.bytesToInt(4);
                ret.aux_info_type_parameter = r.bytesToInt(4);
              }
              ret.default_sample_info_size = r.bytesToInt(1);
              const sample_count = r.bytesToInt(4);
              ret.sample_count = sample_count;
              if (ret.default_sample_info_size === 0) {
                const sample_info_size = [];
                ret.sample_info_size = sample_info_size;
                let i = sample_count;
                while (i--) {
                  sample_info_size.push(r.bytesToInt(1));
                }
              }
              return ret;
            }
          };
          var schi_default = {
            name: "Scheme Information Box",
            description: "Container for details specific to the selected protection scheme.",
            container: true
          };
          var schm_default = {
            name: "Scheme Type Box",
            description: "Identifies the protection or restriction scheme and its version.",
            parser(r) {
              const version = r.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              const flags = r.bytesToInt(3);
              const ret = {
                version,
                flags,
                scheme_type: r.bytesToASCII(4),
                scheme_version: r.bytesToInt(4)
              };
              if (flags & 1) {
                ret.scheme_uri = r.bytesToASCII(r.getRemainingLength()).replace(/\0+$/, "");
              }
              return ret;
            }
          };
          var sdtp_default = {
            name: "Independent and Disposable Samples Box",
            description: "Records dependency flags for samples in decoding order.",
            parser(r) {
              const ret = {
                version: r.bytesToInt(1),
                flags: r.bytesToInt(3)
              };
              const remaining = r.getRemainingLength();
              let i = remaining;
              const samples = [];
              ret.samples = samples;
              while (i--) {
                const byte = r.bytesToInt(1);
                samples.push({
                  is_leading: byte >> 6 & 3,
                  sample_depends_on: byte >> 4 & 3,
                  sample_is_depended_on: byte >> 2 & 3,
                  sample_has_redundancy: byte & 3
                });
              }
              return ret;
            }
          };
          var sidx_default = {
            name: "Segment Index Box",
            description: "Index of the media stream",
            parser(r) {
              const version = r.bytesToInt(1);
              const flags = r.bytesToInt(3);
              const reference_ID = r.bytesToInt(4);
              const timescale = r.bytesToInt(4);
              const earliest_presentation_time = r.bytesToInt(version === 0 ? 4 : 8);
              const first_offset = r.bytesToInt(version === 0 ? 4 : 8);
              const reserved = r.bytesToInt(2);
              const reference_count = r.bytesToInt(2);
              const items = [];
              let i = reference_count;
              while (i--) {
                const first4Bytes = r.bytesToInt(4);
                const second4Bytes = r.bytesToInt(4);
                const third4Bytes = r.bytesToInt(4);
                items.push({
                  reference_type: first4Bytes >> 31 & 1,
                  referenced_size: first4Bytes & 2147483647,
                  subsegment_duration: second4Bytes,
                  starts_with_SAP: third4Bytes >> 31 & 1,
                  SAP_type: third4Bytes >> 28 & 7,
                  SAP_delta_time: third4Bytes & 268435455
                });
              }
              return {
                version,
                flags,
                reference_ID,
                timescale,
                earliest_presentation_time,
                first_offset,
                reserved,
                reference_count,
                items
              };
            }
          };
          var sinf_default = {
            name: "Protection Scheme Information Box",
            description: "Groups the original format, scheme type, and scheme information for protected content.",
            container: true
          };
          var skip_default = {
            name: "Free Space Box",
            description: "This box can be completely ignored."
          };
          var smhd_default = {
            name: "Sound Media Header Box",
            description: "Stores audio presentation information for a sound track.",
            parser(r) {
              const version = r.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              return {
                version,
                flags: r.bytesToInt(3),
                balance: toSignedInt(r.bytesToInt(2), 16) / 256,
                reserved: r.bytesToInt(2)
              };
            }
          };
          var stbl_default = {
            name: "Sample Table",
            description: "Container for sample timing, location, and description tables.",
            container: true
          };
          var stco_default = {
            name: "Chunk Offset",
            description: "Maps each media chunk to its 32-bit byte offset in the file.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              ret.flags = r.bytesToInt(3);
              const entry_count = r.bytesToInt(4);
              ret.entry_count = entry_count;
              const chunk_offsets = [];
              ret.chunk_offsets = chunk_offsets;
              let i = entry_count;
              while (i--) {
                chunk_offsets.push(r.bytesToInt(4));
              }
              return ret;
            }
          };
          var stsc_default = {
            name: "Sample To Chunk",
            description: "Maps chunks to the number and description index of their samples.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              ret.flags = r.bytesToInt(3);
              const entry_count = r.bytesToInt(4);
              ret.entry_count = entry_count;
              const entries = [];
              ret.entries = entries;
              let i = entry_count;
              while (i--) {
                const e = {
                  first_chunk: r.bytesToInt(4),
                  samples_per_chunk: r.bytesToInt(4),
                  sample_description_index: r.bytesToInt(4)
                };
                entries.push(e);
              }
              return ret;
            }
          };
          var stsd_default = {
            name: "Sample Description",
            description: "Information about the coding type used",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              ret.flags = r.bytesToInt(3);
              ret.entry_count = r.bytesToInt(4);
              return ret;
            },
            container: true
          };
          var stss_default = {
            name: "Sync Sample Box",
            description: "Lists samples that can be used as random access points.",
            parser(r) {
              const version = r.bytesToInt(1);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              const flags = r.bytesToInt(3);
              const entry_count = r.bytesToInt(4);
              const sample_numbers = [];
              for (let i = 0; i < entry_count; i++) {
                sample_numbers.push(r.bytesToInt(4));
              }
              return {
                version,
                flags,
                entry_count,
                sample_numbers
              };
            }
          };
          var stsz_default = {
            name: "Sample Size",
            description: "Stores the default sample size or a table of per-sample sizes.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              ret.flags = r.bytesToInt(3);
              ret.sample_size = r.bytesToInt(4);
              const sample_count = r.bytesToInt(4);
              ret.sample_count = sample_count;
              if (ret.sample_size === 0) {
                const entries = [];
                ret.entries = entries;
                let i = sample_count;
                while (i--) {
                  entries.push(r.bytesToInt(4));
                }
              }
              return ret;
            }
          };
          var stts_default = {
            name: "Decoding Time to Sample",
            description: "Maps consecutive samples to their decoding-time deltas.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              ret.flags = r.bytesToInt(3);
              const entry_count = r.bytesToInt(4);
              ret.entry_count = entry_count;
              const entries = [];
              ret.entries = entries;
              let i = entry_count;
              while (i--) {
                entries.push({
                  sample_count: r.bytesToInt(4),
                  sample_delta: r.bytesToInt(4)
                });
              }
              return ret;
            }
          };
          var styp_default = {
            name: "Segment Type Box",
            description: "Identifies the brands and compatibility of a media segment.",
            content: ftyp_default.content,
            parser: ftyp_default.parser
          };
          var tenc_default = {
            name: "Track Encryption Box",
            description: "Defines default encryption parameters for samples in a protected track.",
            parser(r) {
              const version = r.bytesToInt(1);
              if (version > 1) {
                throw new Error("invalid version");
              }
              const flags = r.bytesToInt(3);
              const ret = {
                version,
                flags
              };
              ret.reserved = r.bytesToInt(1);
              if (version === 0) {
                ret.reserved_1 = r.bytesToInt(1);
              } else {
                const blocks = r.bytesToInt(1);
                ret.default_crypt_byte_block = blocks >> 4 & 15;
                ret.default_skip_byte_block = blocks & 15;
                ret.default_pattern = structField(
                  [
                    parsedBoxValue("crypt_byte_block", ret.default_crypt_byte_block),
                    parsedBoxValue("skip_byte_block", ret.default_skip_byte_block),
                    parsedBoxValue("raw", blocks)
                  ],
                  "cenc-pattern"
                );
              }
              ret.default_IsProtected = r.bytesToInt(1);
              ret.default_Per_Sample_IV_Size = r.bytesToInt(1);
              ret.default_KID = r.bytesToHex(16);
              if (ret.default_Per_Sample_IV_Size === 0 && !r.isFinished()) {
                const default_constant_IV_size = r.bytesToInt(1);
                ret.default_constant_IV_size = default_constant_IV_size;
                ret.default_constant_IV = r.bytesToHex(default_constant_IV_size);
              }
              return (
                /** @type {TrackEncryptionBoxContent} */
                ret
              );
            }
          };
          var tfdt_default = {
            name: "Track Fragment Decode Time",
            description: "The absolute decode time, measured on the media timeline, of the first sample in decode order in the track fragment",
            parser(r) {
              const version = r.bytesToInt(1);
              return {
                version,
                flags: r.bytesToInt(3),
                baseMediaDecodeTime: version ? r.bytesToUint64BigInt() : r.bytesToInt(4)
              };
            }
          };
          var tfhd_default = {
            name: "Track Fragment Header Box",
            description: "Sets track-wide defaults and addressing for samples in a fragment.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              const flags = r.bytesToInt(3);
              const hasBaseDataOffset = flags & 1;
              const hasSampleDescriptionIndex = flags & 2;
              const hasDefaultSampleDuration = flags & 8;
              const hasDefaultSampleSize = flags & 16;
              const hasDefaultSampleFlags = flags & 32;
              const durationIsEmpty = flags & 65536;
              const defaultBaseIsMOOF = flags & 131072;
              ret.flags = {
                "base-data-offset-present": !!hasBaseDataOffset,
                "sample-description-index-present": !!hasSampleDescriptionIndex,
                "default-sample-duration-present": !!hasDefaultSampleDuration,
                "default-sample-size-present": !!hasDefaultSampleSize,
                "default-sample-flags-present": !!hasDefaultSampleFlags,
                "duration-is-empty": !!durationIsEmpty,
                "default-base-is-moof": !!defaultBaseIsMOOF
              };
              ret.track_ID = r.bytesToInt(4);
              if (hasBaseDataOffset) {
                ret.base_data_offset = r.bytesToUint64BigInt();
              }
              if (hasSampleDescriptionIndex) {
                ret.sample_description_index = r.bytesToInt(4);
              }
              if (hasDefaultSampleDuration) {
                ret.default_sample_duration = r.bytesToInt(4);
              }
              if (hasDefaultSampleSize) {
                ret.default_sample_size = r.bytesToInt(4);
              }
              if (hasDefaultSampleFlags) {
                ret.default_sample_flags = r.bytesToInt(4);
              }
              return ret;
            }
          };
          var tkhd_default = {
            name: "Track Header Box",
            description: "Characteristics of a single track.",
            parser(r) {
              const version = r.bytesToInt(1);
              const flags = r.bytesToInt(3);
              const creation_time = version ? r.bytesToUint64BigInt() : r.bytesToInt(4);
              const modification_time = version ? r.bytesToUint64BigInt() : r.bytesToInt(4);
              return {
                version,
                flags,
                creation_time: macDateField(creation_time),
                modification_time: macDateField(modification_time),
                track_ID: r.bytesToInt(4),
                reserved_1: r.bytesToInt(4),
                duration: version ? r.bytesToUint64BigInt() : r.bytesToInt(4),
                reserved_2: [r.bytesToInt(4), r.bytesToInt(4)],
                layer: toSignedInt(r.bytesToInt(2), 16),
                alternate_group: toSignedInt(r.bytesToInt(2), 16),
                volume: fixedPointField(r.bytesToInt(2), 16, 8, "8.8"),
                reserved_3: r.bytesToInt(2),
                matrix: parseTransformationMatrix(r),
                width: fixedPointField(r.bytesToInt(4), 32, 16, "16.16"),
                height: fixedPointField(r.bytesToInt(4), 32, 16, "16.16")
              };
            }
          };
          var traf_default = {
            name: "Track Fragment Box",
            description: "Container for one track's metadata within a movie fragment.",
            container: true
          };
          var trak_default = {
            name: "Track Box",
            description: "Container box for a single track of a presentation. A presentation consists of one or more tracks. Each track is independent of the other tracks in the presentation and carries its own temporal and spatial information. Each track will contain its associated Media Box.",
            container: true
          };
          var trep_default = {
            name: "Track Extension Properties Box",
            description: "Carries extra properties associated with a movie-fragment track.",
            container: true,
            parser(r) {
              return {
                version: r.bytesToInt(1),
                flags: r.bytesToInt(3),
                track_ID: r.bytesToInt(4)
              };
            }
          };
          var trex_default = {
            name: "Track Extends Box",
            description: "sets up default values used by the movie fragments. By setting defaults in this way, space and complexity can be saved in each Track Fragment Box",
            parser(reader) {
              return {
                version: reader.bytesToInt(1),
                flags: reader.bytesToInt(3),
                track_ID: reader.bytesToInt(4),
                default_sample_description_index: reader.bytesToInt(4),
                default_sample_duration: reader.bytesToInt(4),
                default_sample_size: reader.bytesToInt(4),
                default_sample_flags: reader.bytesToInt(4)
              };
            }
          };
          var trun_default = {
            name: "Track Fragment Run Box",
            description: "Lists sample records and optional per-sample data for a track fragment.",
            parser(r) {
              const ret = {};
              ret.version = r.bytesToInt(1);
              const flags = r.bytesToInt(3);
              const hasDataOffset = flags & 1;
              const hasFirstSampleFlags = flags & 4;
              const hasSampleDuration = flags & 256;
              const hasSampleSize = flags & 512;
              const hasSampleFlags = flags & 1024;
              const hasSampleCompositionOffset = flags & 2048;
              ret.flags = {
                "data-offset-present": !!hasDataOffset,
                "first-sample-flags-present": !!hasFirstSampleFlags,
                "sample-duration-present": !!hasSampleDuration,
                "sample-size-present": !!hasSampleSize,
                "sample-flags-present": !!hasSampleFlags,
                "sample-composition-time-offset-present": !!hasSampleCompositionOffset
              };
              const sample_count = r.bytesToInt(4);
              ret.sample_count = sample_count;
              if (hasDataOffset) {
                ret.data_offset = ~~r.bytesToInt(4);
              }
              if (hasFirstSampleFlags) {
                ret.first_sample_flags = r.bytesToInt(4);
              }
              let i = sample_count;
              const samples = [];
              ret.samples = samples;
              while (i--) {
                const sample = {};
                if (hasSampleDuration) {
                  sample.sample_duration = r.bytesToInt(4);
                }
                if (hasSampleSize) {
                  sample.sample_size = r.bytesToInt(4);
                }
                if (hasSampleFlags) {
                  sample.sample_flags = r.bytesToInt(4);
                }
                if (hasSampleCompositionOffset) {
                  sample.sample_composition_time_offset = ret.version === 0 ? r.bytesToInt(4) : ~~r.bytesToInt(4);
                }
                samples.push(sample);
              }
              return ret;
            }
          };
          var udta_default = {
            name: "User Data Box",
            description: "Container for user-defined metadata associated with the presentation.",
            container: true
          };
          var url_default = {
            name: "Data Entry Url Box",
            description: "declare the location(s) of the media data used within the presentation.",
            parser(r) {
              r.fieldUint("version", 1, "That box's version");
              r.fieldUint("flags", 3);
              r.fieldAscii("location", r.getRemainingLength());
            }
          };
          function readNullTerminatedStrings(r) {
            const bytes = r.bytesToASCII(r.getRemainingLength());
            return bytes.split("\0").filter((str) => str.length > 0);
          }
          var urn_default = {
            name: "Data Entry Urn Box",
            description: "declare the location(s) of the media data used within the presentation.",
            parser(r) {
              const ret = {
                version: r.bytesToInt(1),
                flags: r.bytesToInt(3)
              };
              const [name, location] = readNullTerminatedStrings(r);
              if (name !== void 0) {
                ret.name = name;
              }
              if (location !== void 0) {
                ret.location = location;
              }
              return ret;
            }
          };
          var uuid_default = {
            name: "User-defined Box",
            description: "Custom box. Those are not yet parsed here."
          };
          var vmhd_default = {
            name: "Video Media Header",
            description: "The video media header contains general presentation information, independent of the coding, for video media.",
            parser(reader) {
              const version = reader.bytesToInt(1);
              const flags = reader.bytesToInt(3);
              if (version !== 0) {
                throw new Error("invalid version");
              }
              if (flags !== 1) {
                throw new Error("invalid flags");
              }
              const graphicsmode = reader.bytesToInt(2);
              const opcolor = [
                reader.bytesToInt(2),
                reader.bytesToInt(2),
                reader.bytesToInt(2)
              ];
              return { version, flags, graphicsmode, opcolor };
            }
          };
          var boxes_default = {
            ID32: ID32_default,
            avc1: avc1_default,
            avc3: avc3_default,
            avcC: avcC_default,
            btrt: btrt_default,
            colr: colr_default,
            co64: co64_default,
            ctts: ctts_default,
            dinf: dinf_default,
            dref: dref_default,
            edts: edts_default,
            elst: elst_default,
            encv: encv_default,
            esds: esds_default,
            free: free_default,
            frma: frma_default,
            ftyp: ftyp_default,
            hdlr: hdlr_default,
            hev1: hev1_default,
            hvc1: hvc1_default,
            hvcC: hvcC_default,
            iods: iods_default,
            ilst: ilst_default,
            leva: leva_default,
            mdat: mdat_default,
            mdhd: mdhd_default,
            mdia: mdia_default,
            mehd: mehd_default,
            meta: meta_default,
            mfhd: mfhd_default,
            minf: minf_default,
            moof: moof_default,
            moov: moov_default,
            mp4a: mp4a_default,
            mvex: mvex_default,
            mvhd: mvhd_default,
            pasp: pasp_default,
            pdin: pdin_default,
            pssh: pssh_default,
            saio: saio_default,
            saiz: saiz_default,
            schi: schi_default,
            schm: schm_default,
            sdtp: sdtp_default,
            sidx: sidx_default,
            sinf: sinf_default,
            smhd: smhd_default,
            skip: skip_default,
            stbl: stbl_default,
            stco: stco_default,
            stsc: stsc_default,
            stsd: stsd_default,
            stss: stss_default,
            stsz: stsz_default,
            stts: stts_default,
            styp: styp_default,
            tfdt: tfdt_default,
            tfhd: tfhd_default,
            tenc: tenc_default,
            tkhd: tkhd_default,
            traf: traf_default,
            trak: trak_default,
            trep: trep_default,
            trex: trex_default,
            trun: trun_default,
            udta: udta_default,
            "url ": url_default,
            "urn ": urn_default,
            uuid: uuid_default,
            vmhd: vmhd_default
          };
          function formatErrorMessage(error) {
            return error instanceof Error ? error.message : String(error);
          }
          function addBoxIssue(box, severity, message) {
            box.issues.push({ severity, message });
          }
          function shouldReadContent(name) {
            const config = boxes_default[name];
            return !!(config && (config.parser || config.container));
          }
          function hasContentParser(name) {
            const config = boxes_default[name];
            return !!(config == null ? void 0 : config.parser);
          }
          function isContainerBox(name) {
            const config = boxes_default[name];
            return !!(config == null ? void 0 : config.container);
          }
          function parseBoxContent(atomObject, content, parseChildren, contentOffset) {
            const config = boxes_default[atomObject.type];
            if (!config) {
              return;
            }
            const contentInfos = config.content ? config.content.reduce(
              /**
               * @param {Record<string, { description?: string }>} acc
               * @param {import("./types.js").BoxContentEntry} el
               */
              (acc, el) => {
                acc[el.key] = {
                  description: el.description || void 0
                };
                return acc;
              },
              {}
            ) : (
              /** @type {Record<string, { description?: string }>} */
              {}
            );
            if (config.name) {
              atomObject.name = config.name;
            }
            if (config.description) {
              atomObject.description = config.description;
            }
            const hasChildren = !!config.container;
            let contentForChildren;
            if (typeof config.parser === "function") {
              const parserReader = createBoxReader(content);
              let result;
              try {
                result = /** @type {import("./types.js").BoxParserFields | undefined} */
                config.parser(parserReader);
              } catch (e) {
                addBoxIssue(atomObject, "error", formatErrorMessage(e));
              }
              if (hasChildren) {
                const remaining = parserReader.getRemainingLength();
                contentForChildren = content.slice(content.length - remaining);
                contentOffset += content.length - remaining;
              } else if (!parserReader.isFinished()) {
                addBoxIssue(
                  atomObject,
                  "warning",
                  `Parser left ${parserReader.getRemainingLength()} byte(s) unread.`
                );
              }
              atomObject.values.push(...parserReader.getValues());
              try {
                if (result !== void 0) {
                  delete result.__data__;
                  Object.keys(result).forEach((key) => {
                    const infos = contentInfos[key] || {};
                    atomObject.values.push(
                      parsedBoxValue(key, result[key], infos.description)
                    );
                  });
                }
              } catch (e) {
                addBoxIssue(atomObject, "error", formatErrorMessage(e));
              }
            }
            if (hasChildren) {
              atomObject.children = parseChildren(
                contentForChildren || content,
                contentOffset
              );
            }
          }
          var ProgressiveByteReader = class {
            /**
             * @param {AsyncIterator<Uint8Array>} iterator
             */
            constructor(iterator) {
              this._iterator = iterator;
              this._buffers = [];
              this._bufferedLength = 0;
              this._done = false;
            }
            /**
             * @param {number} nbBytes
             * @returns {Promise<void>}
             */
            async ensure(nbBytes) {
              while (!this._done && this._bufferedLength < nbBytes) {
                const next = await this._iterator.next();
                if (next.done) {
                  this._done = true;
                  break;
                }
                if (next.value.length > 0) {
                  this._buffers.push(next.value);
                  this._bufferedLength += next.value.length;
                }
              }
            }
            /**
             * @returns {number}
             */
            getBufferedLength() {
              return this._bufferedLength;
            }
            /**
             * @returns {boolean}
             */
            isDone() {
              return this._done && this._bufferedLength === 0;
            }
            /**
             * @param {number} nbBytes
             * @returns {Uint8Array}
             */
            takeAvailable(nbBytes) {
              const size = Math.min(nbBytes, this._bufferedLength);
              const result = new Uint8Array(size);
              let resultOffset = 0;
              while (resultOffset < size) {
                const buffer = this._buffers[0];
                const copiedLength = Math.min(buffer.length, size - resultOffset);
                result.set(buffer.subarray(0, copiedLength), resultOffset);
                resultOffset += copiedLength;
                if (copiedLength === buffer.length) {
                  this._buffers.shift();
                } else {
                  this._buffers[0] = buffer.subarray(copiedLength);
                }
                this._bufferedLength -= copiedLength;
              }
              return result;
            }
            /**
             * @param {number} nbBytes
             * @returns {Promise<Uint8Array>}
             */
            async read(nbBytes) {
              await this.ensure(nbBytes);
              return this.takeAvailable(nbBytes);
            }
            /**
             * @param {number} nbBytes
             * @returns {Promise<number>}
             */
            async skip(nbBytes) {
              let remaining = nbBytes;
              let skipped = 0;
              while (remaining > 0) {
                await this.ensure(1);
                if (this._bufferedLength === 0) {
                  break;
                }
                const skippedThisRound = Math.min(remaining, this._bufferedLength);
                this.takeAvailable(skippedThisRound);
                remaining -= skippedThisRound;
                skipped += skippedThisRound;
              }
              return skipped;
            }
            /**
             * @returns {Promise<number>}
             */
            async skipUntilEnd() {
              let skipped = 0;
              while (true) {
                await this.ensure(1);
                if (this._bufferedLength === 0) {
                  break;
                }
                const skippedThisRound = this._bufferedLength;
                this.takeAvailable(skippedThisRound);
                skipped += skippedThisRound;
              }
              return skipped;
            }
            /**
             * @returns {Promise<Uint8Array>}
             */
            async readUntilEnd() {
              const chunks = [];
              let totalLength = 0;
              while (true) {
                await this.ensure(1);
                if (this._bufferedLength === 0) {
                  break;
                }
                const chunk = this.takeAvailable(this._bufferedLength);
                chunks.push(chunk);
                totalLength += chunk.length;
              }
              const result = new Uint8Array(totalLength);
              let offset = 0;
              for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
              }
              return result;
            }
          };
          function viewToUint8Array(view) {
            return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
          }
          function isBufferSource(value) {
            return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
          }
          function bufferSourceToUint8Array(arr) {
            if (arr instanceof Uint8Array) {
              return arr;
            }
            if (arr instanceof ArrayBuffer) {
              return new Uint8Array(arr);
            }
            return viewToUint8Array(arr);
          }
          function byteChunkToUint8Array(chunk) {
            if (chunk instanceof Uint8Array) {
              return chunk;
            }
            if (chunk instanceof ArrayBuffer) {
              return new Uint8Array(chunk);
            }
            if (ArrayBuffer.isView(chunk)) {
              return viewToUint8Array(chunk);
            }
            throw new Error(
              "Progressive ISOBMFF inputs must yield ArrayBuffer or TypedArray chunks."
            );
          }
          function asyncByteIterable(iterable) {
            return {
              [Symbol.asyncIterator]() {
                return __asyncGenerator(this, null, function* () {
                  try {
                    for (var iter = __forAwait(iterable), more, temp, error; more = !(temp = yield new __await(iter.next())).done; more = false) {
                      const chunk = temp.value;
                      yield byteChunkToUint8Array(chunk);
                    }
                  } catch (temp2) {
                    error = [temp2];
                  } finally {
                    try {
                      more && (temp = iter.return) && (yield new __await(temp.call(iter)));
                    } finally {
                      if (error)
                        throw error[0];
                    }
                  }
                });
              }
            };
          }
          function getProgressiveSource(input) {
            if (input === null || input === void 0) {
              return void 0;
            }
            if (typeof input === "object" && "body" in input) {
              const body = (
                /** @type {{ body?: unknown }} */
                input.body
              );
              if (body !== null && body !== void 0) {
                return getProgressiveSource(body);
              }
            }
            if (typeof input === "object" && "getReader" in input && typeof input.getReader === "function") {
              return {
                [Symbol.asyncIterator]() {
                  return __asyncGenerator(this, null, function* () {
                    const reader = (
                      /** @type {ReadableStream<import("./types.js").ISOBMFFByteChunk>} */
                      input.getReader()
                    );
                    try {
                      while (true) {
                        const { done, value } = yield new __await(reader.read());
                        if (done) {
                          break;
                        }
                        yield byteChunkToUint8Array(value);
                      }
                    } finally {
                      reader.releaseLock();
                    }
                  });
                }
              };
            }
            if (typeof input === "object" && Symbol.asyncIterator in input && typeof input[Symbol.asyncIterator] === "function") {
              return asyncByteIterable(
                /** @type {AsyncIterable<unknown>} */
                input
              );
            }
            if (typeof input === "object" && Symbol.iterator in input && typeof input[Symbol.iterator] === "function") {
              return asyncByteIterable(
                /** @type {Iterable<unknown>} */
                input
              );
            }
            if (typeof input === "object" && "stream" in input && typeof input.stream === "function") {
              return getProgressiveSource(input.stream());
            }
            if (typeof input === "object" && "arrayBuffer" in input && typeof input.arrayBuffer === "function") {
              const arrayBuffer = (
                /** @type {{ arrayBuffer: () => Promise<ArrayBuffer> }} */
                input.arrayBuffer
              );
              return asyncByteIterable({
                [Symbol.asyncIterator]() {
                  return __asyncGenerator(this, null, function* () {
                    yield yield new __await(arrayBuffer.call(input));
                  });
                }
              });
            }
            return void 0;
          }
          var MIN_BOX_HEADER_SIZE = 8;
          var LARGE_BOX_SIZE_BYTES = 8;
          var UUID_SUBTYPE_BYTES = 16;
          function emitParsedBoxEvents(boxes, parentPath) {
            return __asyncGenerator(this, null, function* () {
              for (const box of boxes) {
                const path = parentPath.concat(box.type);
                yield {
                  event: "box-start",
                  path,
                  type: box.type,
                  offset: box.offset,
                  size: box.size,
                  headerSize: box.headerSize,
                  sizeField: box.sizeField,
                  uuid: box.uuid
                };
                if (box.children) {
                  yield* __yieldStar(emitParsedBoxEvents(box.children, path));
                  yield { event: "box-complete", path, box };
                } else {
                  yield { event: "box-complete", path, box };
                }
              }
            });
          }
          function parseBoxEventsFromReader(reader, parseBuffer2, remainingLength, parentPath, onParsedBox, baseOffset = 0) {
            return __asyncGenerator(this, null, function* () {
              let consumedLength = 0;
              while (remainingLength === void 0 || consumedLength < remainingLength) {
                const boxOffset = baseOffset + consumedLength;
                const remainingInParent = remainingLength === void 0 ? void 0 : remainingLength - consumedLength;
                const headerLength = remainingInParent === void 0 ? MIN_BOX_HEADER_SIZE : Math.min(MIN_BOX_HEADER_SIZE, remainingInParent);
                const header = yield new __await(reader.read(headerLength));
                consumedLength += header.length;
                if (header.length === 0) {
                  break;
                }
                if (header.length < MIN_BOX_HEADER_SIZE) {
                  const box2 = {
                    type: "",
                    offset: boxOffset,
                    size: header.length,
                    headerSize: header.length,
                    values: [],
                    issues: [
                      {
                        severity: "error",
                        message: `Cannot parse box header: missing ${MIN_BOX_HEADER_SIZE - header.length} byte(s).`
                      }
                    ]
                  };
                  yield { event: "box-complete", path: parentPath.concat(""), box: box2 };
                  onParsedBox == null ? void 0 : onParsedBox(box2);
                  break;
                }
                let size = be4toi(header, 0);
                const name = betoa(header, 4, 4);
                const path = parentPath.concat(name);
                let headerSize = MIN_BOX_HEADER_SIZE;
                let sizeField = "size";
                if (size === 1) {
                  sizeField = "largeSize";
                  const largeSizeLength = remainingLength === void 0 ? LARGE_BOX_SIZE_BYTES : Math.min(LARGE_BOX_SIZE_BYTES, remainingLength - consumedLength);
                  const largeSizeBuffer = yield new __await(reader.read(largeSizeLength));
                  consumedLength += largeSizeBuffer.length;
                  headerSize += largeSizeBuffer.length;
                  if (largeSizeBuffer.length < LARGE_BOX_SIZE_BYTES) {
                    const box2 = {
                      type: name,
                      offset: boxOffset,
                      size: header.length + largeSizeBuffer.length,
                      headerSize,
                      sizeField,
                      values: [],
                      issues: [
                        {
                          severity: "error",
                          message: `Cannot parse large box header: missing ${LARGE_BOX_SIZE_BYTES - largeSizeBuffer.length} byte(s).`
                        }
                      ]
                    };
                    yield { event: "box-complete", path, box: box2 };
                    onParsedBox == null ? void 0 : onParsedBox(box2);
                    break;
                  }
                  size = be8toi(largeSizeBuffer, 0);
                } else if (size === 0) {
                  sizeField = "extendsToEnd";
                }
                let uuid;
                if (name === "uuid") {
                  const uuidLength = remainingLength === void 0 ? UUID_SUBTYPE_BYTES : Math.min(UUID_SUBTYPE_BYTES, remainingLength - consumedLength);
                  const uuidBuffer = yield new __await(reader.read(uuidLength));
                  consumedLength += uuidBuffer.length;
                  headerSize += uuidBuffer.length;
                  uuid = bytesToHex(uuidBuffer, 0, uuidBuffer.length);
                }
                const box = {
                  type: name,
                  offset: boxOffset,
                  size,
                  headerSize,
                  sizeField,
                  values: [],
                  issues: []
                };
                if (uuid !== void 0) {
                  box.uuid = uuid;
                }
                yield {
                  event: "box-start",
                  path,
                  type: box.type,
                  offset: box.offset,
                  size: box.size,
                  headerSize: box.headerSize,
                  sizeField: box.sizeField,
                  uuid: box.uuid
                };
                if (size !== 0 && size < headerSize) {
                  addBoxIssue(
                    box,
                    "error",
                    `Invalid box size ${size}: smaller than its ${headerSize} byte header.`
                  );
                  yield { event: "box-complete", path, box };
                  onParsedBox == null ? void 0 : onParsedBox(box);
                  break;
                }
                let contentSize;
                if (size === 0) {
                  contentSize = remainingLength === void 0 ? void 0 : remainingLength - consumedLength;
                  if (contentSize !== void 0) {
                    box.size = headerSize + contentSize;
                  }
                } else {
                  contentSize = size - headerSize;
                }
                if (isContainerBox(name) && !hasContentParser(name)) {
                  const children = [];
                  const childConsumedLength = yield* __yieldStar(parseBoxEventsFromReader(
                    reader,
                    parseBuffer2,
                    contentSize,
                    path,
                    (child) => {
                      children.push(child);
                    },
                    boxOffset + headerSize
                  ));
                  consumedLength += childConsumedLength;
                  if (contentSize === void 0) {
                    box.size = headerSize + childConsumedLength;
                  } else if (childConsumedLength < contentSize) {
                    addBoxIssue(
                      box,
                      "error",
                      `Truncated box: declared ${box.size} byte(s), only ${headerSize + childConsumedLength} available.`
                    );
                  }
                  parseBoxContent(
                    box,
                    new Uint8Array(0),
                    () => children,
                    boxOffset + headerSize
                  );
                  yield { event: "box-complete", path, box };
                  onParsedBox == null ? void 0 : onParsedBox(box);
                  if (contentSize !== void 0 && childConsumedLength < contentSize) {
                    break;
                  }
                  continue;
                }
                if (shouldReadContent(name)) {
                  const content = contentSize === void 0 ? yield new __await(reader.readUntilEnd()) : yield new __await(reader.read(contentSize));
                  consumedLength += content.length;
                  if (contentSize === void 0) {
                    box.size = headerSize + content.length;
                  } else if (content.length < contentSize) {
                    addBoxIssue(
                      box,
                      "error",
                      `Truncated box: declared ${box.size} byte(s), only ${headerSize + content.length} available.`
                    );
                  }
                  parseBoxContent(box, content, parseBuffer2, boxOffset + headerSize);
                  if (box.children) {
                    yield* __yieldStar(emitParsedBoxEvents(box.children, path));
                    yield { event: "box-complete", path, box };
                  } else {
                    yield { event: "box-complete", path, box };
                  }
                  onParsedBox == null ? void 0 : onParsedBox(box);
                  if (contentSize !== void 0 && content.length < contentSize) {
                    break;
                  }
                  continue;
                }
                const skippedContentSize = contentSize === void 0 ? yield new __await(reader.skipUntilEnd()) : yield new __await(reader.skip(contentSize));
                consumedLength += skippedContentSize;
                if (contentSize === void 0) {
                  box.size = headerSize + skippedContentSize;
                } else if (skippedContentSize < contentSize) {
                  addBoxIssue(
                    box,
                    "error",
                    `Truncated box: declared ${box.size} byte(s), only ${headerSize + skippedContentSize} available.`
                  );
                }
                parseBoxContent(
                  box,
                  new Uint8Array(0),
                  parseBuffer2,
                  boxOffset + headerSize
                );
                yield { event: "box-complete", path, box };
                onParsedBox == null ? void 0 : onParsedBox(box);
                if (contentSize !== void 0 && skippedContentSize < contentSize) {
                  break;
                }
              }
              return consumedLength;
            });
          }
          function parseBoxEvents(input, parseBuffer2) {
            return __asyncGenerator(this, null, function* () {
              if (isBufferSource(input)) {
                yield* __yieldStar(emitParsedBoxEvents(
                  parseBuffer2(bufferSourceToUint8Array(input), 0),
                  []
                ));
                return;
              }
              const progressiveSource = getProgressiveSource(input);
              if (progressiveSource !== void 0) {
                const iterator = asyncByteIterable(progressiveSource)[Symbol.asyncIterator]();
                yield* __yieldStar(parseBoxEventsFromReader(
                  new ProgressiveByteReader(iterator),
                  parseBuffer2,
                  void 0,
                  [],
                  void 0,
                  0
                ));
                return;
              }
              throw new Error(
                "Unrecognized format. Please give an ArrayBuffer, TypedArray, Blob, ReadableStream, Request, Response or byte iterable instead."
              );
            });
          }
          function formatParsedBoxes(boxes) {
            return boxes.map(formatParsedBox);
          }
          function formatParsedBox(box) {
            const simpleBox = {
              type: box.type,
              offset: box.offset,
              size: box.size,
              headerSize: box.headerSize,
              fields: formatValues(box.values)
            };
            if (box.sizeField !== void 0) {
              simpleBox.sizeField = box.sizeField;
            }
            if (box.uuid !== void 0) {
              simpleBox.uuid = box.uuid;
            }
            if (box.children !== void 0) {
              simpleBox.children = formatParsedBoxes(box.children);
            }
            if (box.issues.length > 0) {
              simpleBox.issues = box.issues;
            }
            return simpleBox;
          }
          function formatValues(values) {
            return Object.fromEntries(
              values.map((value) => [value.key, formatField(value)])
            );
          }
          function formatField(field) {
            var _a;
            switch (field.kind) {
              case "number":
              case "bigint":
              case "string":
              case "boolean":
              case "null":
                return field.value;
              case "fixed-point":
                return field.value;
              case "date":
                return (_a = field.date) != null ? _a : field.value;
              case "bits":
                return __spreadValues({
                  $raw: field.raw
                }, Object.fromEntries(
                  field.fields.map((part) => [part.key, part.value])
                ));
              case "flags":
                return __spreadValues({
                  $raw: field.raw
                }, Object.fromEntries(
                  field.flags.map((flag) => [flag.key, flag.value])
                ));
              case "array":
                return field.items.map(formatField);
              case "struct":
                return formatValues(field.fields);
              default:
                return (
                  /** @type {{ value: unknown }} */
                  field.value
                );
            }
          }
          var MIN_BOX_HEADER_SIZE2 = 8;
          var LARGE_BOX_SIZE_BYTES2 = 8;
          var UUID_SUBTYPE_BYTES2 = 16;
          function recursiveParseBoxes(arr, baseOffset = 0) {
            let i = 0;
            const returnedArray = [];
            while (i < arr.length) {
              const boxStartOffset = i;
              let currentOffset = i;
              if (arr.length - currentOffset < MIN_BOX_HEADER_SIZE2) {
                returnedArray.push({
                  type: "",
                  offset: baseOffset + currentOffset,
                  size: arr.length - currentOffset,
                  headerSize: arr.length - currentOffset,
                  values: [],
                  issues: [
                    {
                      severity: "error",
                      message: `Cannot parse box header: missing ${MIN_BOX_HEADER_SIZE2 - (arr.length - currentOffset)} byte(s).`
                    }
                  ]
                });
                break;
              }
              let size = be4toi(arr, currentOffset);
              currentOffset += 4;
              const name = betoa(arr, currentOffset, 4);
              currentOffset += 4;
              let sizeField = "size";
              if (size === 1) {
                sizeField = "largeSize";
                if (arr.length - currentOffset < LARGE_BOX_SIZE_BYTES2) {
                  returnedArray.push({
                    type: name,
                    offset: baseOffset + boxStartOffset,
                    size: arr.length - boxStartOffset,
                    headerSize: arr.length - boxStartOffset,
                    sizeField,
                    values: [],
                    issues: [
                      {
                        severity: "error",
                        message: `Cannot parse large box header: missing ${LARGE_BOX_SIZE_BYTES2 - (arr.length - currentOffset)} byte(s).`
                      }
                    ]
                  });
                  break;
                }
                size = be8toi(arr, currentOffset);
                currentOffset += LARGE_BOX_SIZE_BYTES2;
              } else if (size === 0) {
                sizeField = "extendsToEnd";
                size = arr.length - boxStartOffset;
              }
              const atomObject = {
                type: name,
                offset: baseOffset + boxStartOffset,
                size,
                headerSize: currentOffset - boxStartOffset,
                sizeField,
                values: [],
                issues: []
              };
              if (size < currentOffset - boxStartOffset) {
                addBoxIssue(
                  atomObject,
                  "error",
                  `Invalid box size ${size}: smaller than its ${currentOffset - boxStartOffset} byte header.`
                );
                returnedArray.push(atomObject);
                break;
              }
              if (size > arr.length - boxStartOffset) {
                addBoxIssue(
                  atomObject,
                  "error",
                  `Truncated box: declared ${size} byte(s), only ${arr.length - boxStartOffset} available.`
                );
              }
              if (name === "uuid") {
                const uuid = arr.slice(currentOffset, currentOffset + UUID_SUBTYPE_BYTES2);
                atomObject.uuid = bytesToHex(uuid, 0, uuid.length);
                currentOffset += uuid.length;
                atomObject.headerSize = currentOffset - boxStartOffset;
              }
              returnedArray.push(atomObject);
              parseBoxContent(
                atomObject,
                shouldReadContent(name) ? arr.slice(currentOffset, size + boxStartOffset) : new Uint8Array(0),
                recursiveParseBoxes,
                baseOffset + currentOffset
              );
              i += size;
            }
            return returnedArray;
          }
          function parseEvents(input) {
            return __asyncGenerator(this, null, function* () {
              yield* __yieldStar(parseBoxEvents(input, recursiveParseBoxes));
            });
          }
          async function parseProgressive(source) {
            const iterator = asyncByteIterable(source)[Symbol.asyncIterator]();
            const reader = new ProgressiveByteReader(iterator);
            const returnedArray = [];
            let offset = 0;
            while (true) {
              const boxOffset = offset;
              const header = await reader.read(MIN_BOX_HEADER_SIZE2);
              offset += header.length;
              if (header.length === 0) {
                break;
              }
              if (header.length < MIN_BOX_HEADER_SIZE2) {
                returnedArray.push({
                  type: "",
                  offset: boxOffset,
                  size: header.length,
                  headerSize: header.length,
                  values: [],
                  issues: [
                    {
                      severity: "error",
                      message: `Cannot parse box header: missing ${MIN_BOX_HEADER_SIZE2 - header.length} byte(s).`
                    }
                  ]
                });
                break;
              }
              let size = be4toi(header, 0);
              const name = betoa(header, 4, 4);
              let headerSize = MIN_BOX_HEADER_SIZE2;
              let sizeField = "size";
              if (size === 1) {
                sizeField = "largeSize";
                const largeSizeBuffer = await reader.read(LARGE_BOX_SIZE_BYTES2);
                offset += largeSizeBuffer.length;
                headerSize += largeSizeBuffer.length;
                if (largeSizeBuffer.length < LARGE_BOX_SIZE_BYTES2) {
                  returnedArray.push({
                    type: name,
                    offset: boxOffset,
                    size: header.length + largeSizeBuffer.length,
                    headerSize,
                    sizeField,
                    values: [],
                    issues: [
                      {
                        severity: "error",
                        message: `Cannot parse large box header: missing ${LARGE_BOX_SIZE_BYTES2 - largeSizeBuffer.length} byte(s).`
                      }
                    ]
                  });
                  break;
                }
                size = be8toi(largeSizeBuffer, 0);
              } else if (size === 0) {
                sizeField = "extendsToEnd";
              }
              let uuid;
              if (name === "uuid") {
                const uuidBuffer = await reader.read(UUID_SUBTYPE_BYTES2);
                offset += uuidBuffer.length;
                headerSize += uuidBuffer.length;
                uuid = bytesToHex(uuidBuffer, 0, uuidBuffer.length);
              }
              const atomObject = {
                type: name,
                offset: boxOffset,
                size,
                headerSize,
                sizeField,
                values: [],
                issues: []
              };
              if (uuid !== void 0) {
                atomObject.uuid = uuid;
              }
              returnedArray.push(atomObject);
              if (size !== 0 && size < headerSize) {
                addBoxIssue(
                  atomObject,
                  "error",
                  `Invalid box size ${size}: smaller than its ${headerSize} byte header.`
                );
                break;
              }
              if (size === 0) {
                if (shouldReadContent(name)) {
                  const content = await reader.readUntilEnd();
                  offset += content.length;
                  atomObject.size = headerSize + content.length;
                  parseBoxContent(
                    atomObject,
                    content,
                    recursiveParseBoxes,
                    boxOffset + headerSize
                  );
                } else {
                  const skippedContentSize = await reader.skipUntilEnd();
                  offset += skippedContentSize;
                  atomObject.size = headerSize + skippedContentSize;
                  parseBoxContent(
                    atomObject,
                    new Uint8Array(0),
                    recursiveParseBoxes,
                    boxOffset + headerSize
                  );
                }
                break;
              }
              const contentSize = size - headerSize;
              if (shouldReadContent(name)) {
                const content = await reader.read(contentSize);
                offset += content.length;
                if (content.length < contentSize) {
                  addBoxIssue(
                    atomObject,
                    "error",
                    `Truncated box: declared ${size} byte(s), only ${headerSize + content.length} available.`
                  );
                }
                parseBoxContent(
                  atomObject,
                  content,
                  recursiveParseBoxes,
                  boxOffset + headerSize
                );
                if (content.length < contentSize) {
                  break;
                }
              } else {
                const skippedContentSize = await reader.skip(contentSize);
                offset += skippedContentSize;
                if (skippedContentSize < contentSize) {
                  addBoxIssue(
                    atomObject,
                    "error",
                    `Truncated box: declared ${size} byte(s), only ${headerSize + skippedContentSize} available.`
                  );
                  break;
                }
                parseBoxContent(
                  atomObject,
                  new Uint8Array(0),
                  recursiveParseBoxes,
                  boxOffset + headerSize
                );
              }
            }
            return returnedArray;
          }
          function getParseFormat(options) {
            var _a;
            const format = (_a = options == null ? void 0 : options.format) != null ? _a : "full";
            if (format === "full" || format === "simple") {
              return format;
            }
            throw new Error(`Unsupported parse format: ${format}`);
          }
          function formatParseResult(boxes, format) {
            if (format === "full") {
              return (
                /** @type {T} */
                boxes
              );
            }
            return (
              /** @type {T} */
              formatParsedBoxes(boxes)
            );
          }
          async function parse(arr, options) {
            const format = getParseFormat(options);
            let boxes;
            if (isBufferSource(arr)) {
              boxes = recursiveParseBoxes(bufferSourceToUint8Array(arr));
            } else {
              const progressiveSource = getProgressiveSource(arr);
              if (progressiveSource === void 0) {
                throw new Error(
                  "Unrecognized format. Please give an ArrayBuffer, TypedArray, Blob, ReadableStream, Request, Response or byte iterable instead."
                );
              }
              boxes = await parseProgressive(progressiveSource);
            }
            return formatParseResult(boxes, format);
          }
          function parseBuffer(arr, options) {
            const format = getParseFormat(options);
            return formatParseResult(
              recursiveParseBoxes(bufferSourceToUint8Array(arr)),
              format
            );
          }
          var main_default = parse;
          return __toCommonJS(main_exports);
        })();
        const bundleValue = __inspectISOBMFFBundle;
        const defaultValue = bundleValue && bundleValue.default || bundleValue;
        if (bundleValue && defaultValue && (typeof defaultValue === "function" || typeof defaultValue === "object")) {
          Object.keys(bundleValue).forEach(function(key) {
            if (key !== "default") {
              defaultValue[key] = bundleValue[key];
            }
          });
        }
        return defaultValue;
      });
    }
  });

  // src/index.js
  var import_isobmff_inspector = __toESM(require_bundle());

  // src/renderer.js
  var wrapper = document.getElementById("file-description");
  var sanitize = (str) => {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  };
  var title = () => {
    return `
    <h2 id="result-title">Results</h2>
  `;
  };
  var getObjectDisplay = (obj) => {
    const props = obj.map(
      (f) => `
      <div class="value-object-prop">
        <span class="value-object-key">${sanitize(f.key)}</span>:
        <span class="value-object-value">${getValueToDisplay(f)}</span>
      </div>
    `
    ).join("");
    return `
    <div class="value-object-line">
      ${props}
    </div>
  `;
  };
  var getValueToDisplay = (prop) => {
    if (prop == null) {
      return void 0;
    }
    if (typeof prop !== "object") {
      if (typeof prop === "string") {
        return `"${sanitize(prop)}"`;
      }
      return `${sanitize(prop)}`;
    }
    switch (prop.kind) {
      case "array":
        if (!prop.items.length) {
          return "no element";
        }
        if (typeof prop.items[0] === "number") {
          return prop.items.join(" ");
        }
        return prop.items.map(getValueToDisplay).join(" ");
      case "struct":
      case "bits":
        return getObjectDisplay(prop.fields);
      case "flags":
        return getObjectDisplay(prop.flags);
      default:
        if (typeof prop.value === "string") {
          return `"${sanitize(prop.value)}"`;
        }
        return `${sanitize(prop.value)}`;
    }
  };
  var BoxTitle = (box) => `
    <div class="box-title">
      <span class="box-name">${sanitize(box.name)}</span>
      <span class="box-alias">("${sanitize(box.type)}")</span>
      <span class="box-size">${sanitize(box.size)} bytes</span>
    </div>
  `;
  var BoxDescription = (box) => `
    <div class="box-description">
      ${sanitize(box.description)}
    </div>
  `;
  var BoxValue = (value) => {
    return `
    <div class="box-value-entry">
      <span class="box-value-key">${sanitize(value.key)}</span>:
      <span class="box-value-value">${getValueToDisplay(value)}</span>
    </div>
  `;
  };
  var BoxValues = (box) => (box.values || []).map((v) => BoxValue(v)).join("");
  var Box = (box) => {
    const children = (box.children || []).map(Box).join("");
    return `
    <div class="box">
      ${BoxTitle(box)}
      ${BoxDescription(box)}
      ${BoxValues(box)}
      ${children}
    </div>
  `;
  };
  var renderer_default = (arr = []) => {
    console.log("rendering...", arr);
    wrapper.style.display = "none";
    wrapper.innerHTML = title() + arr.map(Box).join("");
    wrapper.style.display = "block";
  };

  // src/index.js
  if (window.File && window.FileReader && window.Uint8Array) {
    let onFileSelection = function(evt) {
      const fileInputElt = (
        /** @type {HTMLInputElement | null} */
        evt.target
      );
      if (fileInputElt === null) {
        return;
      }
      const files = fileInputElt.files;
      if (files !== null && !files.length) {
        return;
      }
      (0, import_isobmff_inspector.default)(files[0]).then(
        /** @param {*} data */
        (data) => {
          renderer_default(data);
        }
      ).catch(
        /** @param {unknown} err */
        (err) => {
          console.error(
            "An error happened which prevented parsing the segment",
            err
          );
        }
      );
      return false;
    };
    document.getElementById("file-input").addEventListener("change", onFileSelection, false);
  } else {
    const localSegmentInput = document.getElementById("choices-local-segment");
    localSegmentInput.style.display = "none";
    const choiceSeparator = document.getElementById("choices-separator");
    choiceSeparator.style.display = "none";
  }
  if (window.fetch && window.Uint8Array) {
    let onUrlValidation = function(url) {
      fetch(url).then((response) => (0, import_isobmff_inspector.default)(response)).then(
        (parsed) => {
          renderer_default(parsed);
        },
        (error) => {
          console.error("Parsing error:", error);
        }
      );
    }, onButtonClicking = function() {
      const urlInput = (
        /** @type {HTMLInputElement} */
        document.getElementById("url-input")
      );
      const url = urlInput.value;
      if (url) {
        onUrlValidation(url);
        return false;
      }
    }, onInputKeyPress = function(evt) {
      const keyCode = evt.keyCode || evt.which;
      if (keyCode === 13) {
        const urlInput = (
          /** @type {HTMLInputElement | null} */
          evt.target
        );
        const url = urlInput?.value;
        if (url) {
          onUrlValidation(url);
        }
        return false;
      }
    };
    document.getElementById("url-input").addEventListener("keypress", onInputKeyPress, false);
    document.getElementById("url-button").addEventListener("click", onButtonClicking, false);
  } else {
    const choiceSeparator = document.getElementById("choices-separator");
    choiceSeparator.style.display = "none";
    const urlSegmentInput = document.getElementById("choices-url-segment");
    urlSegmentInput.style.display = "none";
  }
})();
