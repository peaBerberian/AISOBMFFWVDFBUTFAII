/******/ !function(modules) {
    // webpackBootstrap
    /******/ // The module cache
    /******/ var installedModules = {};
    /******/
    /******/ // The require function
    /******/    function __webpack_require__(moduleId) {
        /******/
        /******/ // Check if module is in cache
        /******/ if (installedModules[moduleId]) 
        /******/ return installedModules[moduleId].exports;
        /******/
        /******/ // Create a new module (and put it into the cache)
        /******/        var module = installedModules[moduleId] = {
            /******/ i: moduleId,
            /******/ l: !1,
            /******/ exports: {}
            /******/        };
        /******/
        /******/ // Execute the module function
        /******/        
        /******/
        /******/ // Return the exports of the module
        /******/ return modules[moduleId].call(module.exports, module, module.exports, __webpack_require__), 
        /******/
        /******/ // Flag the module as loaded
        /******/ module.l = !0, module.exports;
        /******/    }
    /******/
    /******/
    /******/ // expose the modules object (__webpack_modules__)
    /******/    
    /******/
    /******/
    /******/ // Load entry module and return exports
    /******/ __webpack_require__.m = modules, 
    /******/
    /******/ // expose the module cache
    /******/ __webpack_require__.c = installedModules, 
    /******/
    /******/ // define getter function for harmony exports
    /******/ __webpack_require__.d = function(exports, name, getter) {
        /******/ __webpack_require__.o(exports, name) || 
        /******/ Object.defineProperty(exports, name, {
            enumerable: !0,
            get: getter
        })
        /******/;
    }, 
    /******/
    /******/ // define __esModule on exports
    /******/ __webpack_require__.r = function(exports) {
        /******/ "undefined" != typeof Symbol && Symbol.toStringTag && 
        /******/ Object.defineProperty(exports, Symbol.toStringTag, {
            value: "Module"
        })
        /******/ , Object.defineProperty(exports, "__esModule", {
            value: !0
        });
    }, 
    /******/
    /******/ // create a fake namespace object
    /******/ // mode & 1: value is a module id, require it
    /******/ // mode & 2: merge all properties of value into the ns
    /******/ // mode & 4: return value when already ns object
    /******/ // mode & 8|1: behave like require
    /******/ __webpack_require__.t = function(value, mode) {
        /******/ if (
        /******/ 1 & mode && (value = __webpack_require__(value)), 8 & mode) return value;
        /******/        if (4 & mode && "object" == typeof value && value && value.__esModule) return value;
        /******/        var ns = Object.create(null);
        /******/        
        /******/ if (__webpack_require__.r(ns), 
        /******/ Object.defineProperty(ns, "default", {
            enumerable: !0,
            value: value
        }), 2 & mode && "string" != typeof value) for (var key in value) __webpack_require__.d(ns, key, function(key) {
            return value[key];
        }.bind(null, key));
        /******/        return ns;
        /******/    }, 
    /******/
    /******/ // getDefaultExport function for compatibility with non-harmony modules
    /******/ __webpack_require__.n = function(module) {
        /******/ var getter = module && module.__esModule ? 
        /******/ function getDefault() {
            return module.default;
        } : 
        /******/ function getModuleExports() {
            return module;
        };
        /******/        
        /******/ return __webpack_require__.d(getter, "a", getter), getter;
        /******/    }, 
    /******/
    /******/ // Object.prototype.hasOwnProperty.call
    /******/ __webpack_require__.o = function(object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
    }, 
    /******/
    /******/ // __webpack_public_path__
    /******/ __webpack_require__.p = "", __webpack_require__(__webpack_require__.s = 1);
    /******/}
/************************************************************************/
/******/ ([ 
/* 0 */
/***/ function(module, exports, __webpack_require__) {
    !function(global, factory) {
        module.exports = function() {
            "use strict";
            /**
   * Translate groups of 2 big-endian bytes to Integer (from 0 up to 65535).
   * @param {TypedArray} bytes
   * @param {Number} off - The offset (from the start of the given array)
   * @returns {Number}
   */            function be2toi(bytes, off) {
                return (bytes[0 + off] << 8) + bytes[1 + off];
            }
            /**
   * Translate groups of 3 big-endian bytes to Integer.
   * @param {TypedArray} bytes
   * @param {Number} off - The offset (from the start of the given array)
   * @returns {Number}
   */            function be3toi(bytes, off) {
                return 65536 * bytes[0 + off] + 256 * bytes[1 + off] + bytes[2 + off];
            }
            /**
   * Translate groups of 4 big-endian bytes to Integer.
   * @param {TypedArray} bytes
   * @param {Number} off - The offset (from the start of the given array)
   * @returns {Number}
   */            function be4toi(bytes, off) {
                return 16777216 * bytes[0 + off] + 65536 * bytes[1 + off] + 256 * bytes[2 + off] + bytes[3 + off];
            }
            /**
   * Translate groups of 4 big-endian bytes to Integer.
   * @param {TypedArray} bytes
   * @param {Number} off - The offset (from the start of the given array)
   * @returns {Number}
   */            function be5toi(bytes, off) {
                return 4294967296 * bytes[0 + off] + 16777216 * bytes[1 + off] + 65536 * bytes[2 + off] + 256 * bytes[3 + off] + bytes[4 + off];
            }
            /**
   * Translate groups of 8 big-endian bytes to Integer.
   * @param {TypedArray} bytes
   * @param {Number} off - The offset (from the start of the given array)
   * @returns {Number}
   */            function be8toi(bytes, off) {
                return 4294967296 * (16777216 * bytes[0 + off] + 65536 * bytes[1 + off] + 256 * bytes[2 + off] + bytes[3 + off]) + 16777216 * bytes[4 + off] + 65536 * bytes[5 + off] + 256 * bytes[6 + off] + bytes[7 + off];
            }
            function bytesToHex(uint8arr, off, nbBytes) {
                if (!uint8arr) return "";
                for (var arr = uint8arr.slice(off, nbBytes + off), hexStr = "", i = 0; i < arr.length; i++) {
                    var hex = (255 & arr[i]).toString(16);
                    hex = 1 === hex.length ? "0" + hex : hex, hexStr += hex;
                }
                return hexStr.toUpperCase();
            }
            // XXX TODO test that
                        function betoa(uint8arr, off, nbBytes) {
                if (!uint8arr) return "";
                var arr = uint8arr.slice(off, nbBytes + off);
                return String.fromCharCode.apply(String, arr);
            }
            /**
   * Create object allowing to easily parse an ISOBMFF box.
   *
   * The BufferReader saves in its state the current offset after each method
   * call, allowing to easily parse contiguous bytes in box parsers.
   *
   * @param {Uint8Array} buffer
   * @returns {Object}
   */            function createBufferReader(buffer) {
                var currentOffset = 0;
                return {
                    /**
       * Returns the following byte, as a number between 0 and 255.
       * @returns {number}
       */
                    getNextByte: function getNextByte() {
                        this.getNextBytes(1);
                    },
                    /**
       * Returns the N next bytes, as an Uint8Array
       * @param {number} nb
       * @returns {Uint8Array}
       */
                    getNextBytes: function getNextBytes(nb) {
                        if (!(this.getRemainingLength() < nb)) return currentOffset += nb, buffer.slice(0, nb);
                    },
                    /**
       * Returns the N next bytes, as a single number.
       *
       * /!\ only work for now for 1, 2, 3, 4, 5 or 8 bytes.
       * TODO Define a more global solution.
       *
       * /!\ Depending on the size of the number, it may be larger than JS'
       * limit.
       *
       * @param {number} nb
       * @returns {number}
       */
                    bytesToInt: function bytesToInt(nbBytes) {
                        if (!(this.getRemainingLength() < nbBytes)) {
                            var res = void 0;
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
                            return currentOffset += nbBytes, res;
                        }
                    },
                    /**
       * Returns the N next bytes into a string of Hexadecimal values.
       * @param {number}
       * @returns {string}
       */
                    bytesToHex: function bytesToHex$$1(nbBytes) {
                        if (!(this.getRemainingLength() < nbBytes)) {
                            var res = bytesToHex(buffer, currentOffset, nbBytes);
                            return currentOffset += nbBytes, res;
                        }
                    },
                    /**
       * Returns the N next bytes into a string.
       * @param {number}
       * @returns {string}
       */
                    bytesToASCII: function bytesToASCII(nbBytes) {
                        if (!(this.getRemainingLength() < nbBytes)) {
                            var res = betoa(buffer, currentOffset, nbBytes);
                            return currentOffset += nbBytes, res;
                        }
                    },
                    /**
       * Returns the total length of the buffer
       * @returns {number}
       */
                    getTotalLength: function getTotalLength() {
                        return buffer.length;
                    },
                    /**
       * Returns the length of the buffer which is not yet parsed.
       * @returns {number}
       */
                    getRemainingLength: function getRemainingLength() {
                        return Math.max(0, buffer.length - currentOffset);
                    },
                    /**
       * Returns true if this buffer is entirely parsed.
       * @returns {boolean}
       */
                    isFinished: function isFinished() {
                        return buffer.length <= currentOffset;
                    }
                };
            }
            var ftypBox = {
                name: "File Type Box",
                description: "File type and compatibility",
                content: [ {
                    /* name: "major brand", */ // optional name
                    key: "major_brand",
                    description: "Brand identifier."
                }, {
                    key: "minor_version",
                    description: "informative integer for the minor version of the major brand"
                }, {
                    key: "compatible_brands",
                    description: "List of brands"
                } ],
                parser: function parser(reader) {
                    for (var len = reader.getTotalLength(), major_brand = reader.bytesToASCII(4), minor_version = reader.bytesToInt(4), compatArr = [], i = 8; i < len; i += 4) compatArr.push(reader.bytesToASCII(4));
                    return {
                        major_brand: major_brand,
                        minor_version: minor_version,
                        compatible_brands: compatArr.join(", ")
                    };
                }
            }, SYSTEM_IDS = {
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
            }, definitions = {
                dinf: {
                    name: "Data Information Box",
                    description: "Objects that declare the location of the media information in a track.",
                    container: !0
                },
                dref: {
                    name: "Data Reference Box",
                    description: "",
                    container: !0,
                    parser: function parser(reader) {
                        var version = reader.bytesToInt(1), flags = reader.bytesToInt(3);
                        if (0 !== version) throw new Error("invalid version");
                        if (0 !== flags) throw new Error("invalid flags");
                        var entry_count = reader.bytesToInt(4);
                        return {
                            version: version,
                            flags: flags,
                            entry_count: entry_count
                        };
                    }
                },
                edts: {
                    name: "Edit Box",
                    description: "Maps the presentation time‐line to the media time‐line as it is stored in the file.",
                    container: !0
                },
                free: {
                    name: "Free Space Box",
                    description: "This box can be completely ignored"
                },
                ftyp: ftypBox,
                hdlr: {
                    name: "Handler Reference Box",
                    description: "This box within a Media Box declares media type of the track, and thus the process by which the media‐data in the track is presented",
                    parser: function parser(r) {
                        var ret = {
                            version: r.bytesToInt(1),
                            flags: r.bytesToInt(3),
                            pre_defined: r.bytesToInt(4),
                            handler_type: r.bytesToInt(4),
                            reserved: [ r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4) ]
                        }, remaining = r.getRemainingLength();
                        for (ret.name = ""; remaining--; ) ret.name += String.fromCharCode(parseInt(r.bytesToInt(1), 10));
                        return ret;
                    }
                },
                iods: {
                    name: "Initial Object Descriptor Box"
                },
                leva: {
                    name: "Level Assignment Box",
                    // TODO
                    parser: function parser(reader) {
                        var version = reader.bytesToInt(1), flags = reader.bytesToInt(3);
                        // ...
                        return {
                            version: version,
                            flags: flags
                        };
                    }
                },
                mdat: {
                    name: "Media Data Box",
                    description: "the content's data"
                },
                mdhd: {
                    name: "Media Header Box",
                    description: "The media header declares overall information that is media‐independent, and relevant to characteristics of the media in a track.",
                    parser: function parser(r) {
                        var version = r.bytesToInt(1), flags = r.bytesToInt(3), creation_time = r.bytesToInt(version ? 8 : 4), modification_time = r.bytesToInt(version ? 8 : 4), timescale = r.bytesToInt(4), duration = r.bytesToInt(version ? 8 : 4), next2Bytes = r.bytesToInt(2), pad = next2Bytes >> 15 & 1, language = [ String.fromCharCode(96 + (next2Bytes >> 10 & 31)), String.fromCharCode(96 + (next2Bytes >> 5 & 31)), String.fromCharCode(96 + (31 & next2Bytes)) ].join(""), predifined = r.bytesToInt(2);
                        return {
                            version: version,
                            flags: flags,
                            creation_time: creation_time,
                            modification_time: modification_time,
                            timescale: timescale,
                            duration: duration,
                            pad: pad,
                            language: language,
                            predifined: predifined
                        };
                    }
                },
                mdia: {
                    name: "Track Media Structure",
                    description: "declare information about the media data within a track.",
                    container: !0
                },
                mehd: {
                    name: "Movie Extends Header Box",
                    description: "Provides the overall duration, including fragments, of a fragmented movie. If this box is not present, the overall duration must be computed by examining each fragment.",
                    parser: function parser(reader) {
                        var version = reader.bytesToInt(1);
                        if (version > 1) throw new Error("invalid version");
                        var flags = reader.bytesToInt(3), fragmentDuration = 1 === version ? reader.bytesToInt(8) : reader.bytesToInt(4);
                        return {
                            version: version,
                            flags: flags,
                            fragment_duration: fragmentDuration
                        };
                    }
                },
                mfhd: {
                    name: "Movie Fragment Header Box",
                    description: "This box contains just a sequence number (usually starting at 1), as a safety check.",
                    parser: function parser(r) {
                        return {
                            version: r.bytesToInt(1),
                            flags: r.bytesToInt(3),
                            sequence_number: r.bytesToInt(4)
                        };
                    }
                },
                minf: {
                    name: "Media Information Box",
                    description: "This box contains all the objects that declare characteristic information of the media in the track.",
                    container: !0
                },
                moof: {
                    name: "Movie Fragment Box",
                    description: "",
                    container: !0
                },
                moov: {
                    name: "Movie Box",
                    description: "The movie metadata",
                    container: !0
                },
                mvex: {
                    name: "Movie Extends Box",
                    container: !0
                },
                mvhd: {
                    name: "Movie Header Box",
                    description: "This box defines overall information which is media‐independent, and relevant to the entire presentation considered as a whole.",
                    content: [ {
                        name: "version",
                        description: "mvhd version",
                        key: "version"
                    }, {
                        name: "flags",
                        description: "mvhd flags",
                        key: "flags"
                    }, {
                        name: "creation_time",
                        description: "An integer that declares the creation time of the presentation (in seconds since midnight, Jan. 1, 1904, in UTC time)",
                        key: "creationTime"
                    }, {
                        name: "modification_time",
                        description: "An integer that declares the most recent time the presentation was modified (in seconds since midnight, Jan. 1, 1904, in UTC time)",
                        key: "modificationTime"
                    }, {
                        name: "timescale",
                        description: "An integer that specifies the time‐scale for the entire presentation; this is the number of time units that pass in one second. For example, a t me coordinate system that measures time in sixtieths of a second has a time scale of 60.",
                        key: "timescale"
                    }, {
                        name: "duration",
                        description: "An integer that declares length of the presentation (in the indicated timescale). This property is derived from the presentation’s tracks: the value of this field corresponds to the duration of the longest track in the presentation. If the durat ion cannot be determined then duration is set to all 1s.",
                        key: "duration"
                    }, {
                        name: "rate",
                        description: "A fixed point 16.16 number that indicates the preferred rate to play the presentation; 1.0 (0x00010000) is normal forward playback ",
                        key: "rate"
                    }, {
                        name: "volume",
                        description: "A fixed point 8.8 number that indicates the preferred playback volume. 1.0 (0x0100) is full volume.",
                        key: "volume"
                    }, {
                        name: "reserved 1",
                        description: "Reserved 16 bits",
                        key: "reserved1"
                    }, {
                        name: "reserved 2",
                        description: "Reserved 2*32 bits",
                        key: "reserved2"
                    }, {
                        name: "matrix",
                        description: "Provides a transformation matrix for the video; (u,v,w) are restricted here to (0,0,1), hex values (0,0,0x40000000).",
                        key: "matrix"
                    }, {
                        name: "pre-defined",
                        description: "Pre-defined 32*6 bits.",
                        key: "predefined"
                    }, {
                        name: "next_track_ID",
                        description: "A non‐zero integer that indicates a value to use for the track ID of the next track to be added to this presentation. Zero is not a valid track ID value. The value of next_track_ID shall be larger than the largest track‐ID in use. If this valu e is equal to all 1s (32‐bit maxint), and a new media track is to be added, then a s earch must be made in the file for an unused track identifier.",
                        key: "nextTrackId"
                    } ],
                    parser: function parser(reader) {
                        var version = reader.bytesToInt(1);
                        if (version > 1) throw new Error("invalid version");
                        var flags = reader.bytesToInt(3), creationTime = void 0, modificationTime = void 0, timescale = void 0, duration = void 0;
                        1 === version ? (creationTime = reader.bytesToInt(8), modificationTime = reader.bytesToInt(8), 
                        timescale = reader.bytesToInt(4), duration = reader.bytesToInt(8)) : (creationTime = reader.bytesToInt(4), 
                        modificationTime = reader.bytesToInt(4), timescale = reader.bytesToInt(4), duration = reader.bytesToInt(4));
                        for (var rate = [ reader.bytesToInt(2), reader.bytesToInt(2) ].join("."), volume = [ reader.bytesToInt(1), reader.bytesToInt(1) ].join("."), reserved1 = reader.bytesToInt(2), reserved2 = [ reader.bytesToInt(4), reader.bytesToInt(4) ], matrixArr = [], i = 0; i < 9; i++) matrixArr.push(reader.bytesToInt(4));
                        var predefined = [ reader.bytesToInt(4), reader.bytesToInt(4), reader.bytesToInt(4), reader.bytesToInt(4), reader.bytesToInt(4), reader.bytesToInt(4) ], nextTrackId = reader.bytesToInt(4);
                        return {
                            version: version,
                            flags: flags,
                            creationTime: creationTime,
                            modificationTime: modificationTime,
                            timescale: timescale,
                            duration: duration,
                            rate: rate,
                            volume: volume,
                            reserved1: reserved1,
                            reserved2: reserved2,
                            matrix: matrixArr,
                            predefined: predefined,
                            nextTrackId: nextTrackId
                        };
                    }
                },
                pdin: {
                    name: "Progressive Download Information Box",
                    description: "",
                    content: [ {
                        name: "version",
                        description: "pdin version",
                        key: "version"
                    }, {
                        name: "flags",
                        description: "pdin flags",
                        key: "flags"
                    }, {
                        name: "rate",
                        description: "Download rate expressed in bytes/second",
                        key: "rate"
                    }, {
                        name: "initial_delay",
                        description: "Suggested delay to use when playing the file, such that if download continues at the given rate, all data within the file will arrive in time for its use and playback should not need to stall.",
                        key: "delay"
                    } ],
                    parser: function parser(reader) {
                        var version = reader.bytesToInt(1);
                        if (0 !== version) throw new Error("invalid version");
                        return {
                            version: version,
                            flags: reader.bytesToInt(3),
                            rate: reader.bytesToInt(4),
                            delay: reader.bytesToInt(4)
                        };
                    }
                },
                pssh: {
                    name: "Protection System Specific Header",
                    description: "",
                    parser: function parser(reader) {
                        var ret = {};
                        if (ret.version = reader.bytesToInt(1), ret.version > 1) throw new Error("invalid version");
                        ret.flags = reader.bytesToInt(3), ret.systemID = reader.bytesToHex(16);
                        var systemIDName = SYSTEM_IDS[ret.systemID];
                        if (systemIDName && (ret.systemID += " (" + systemIDName + ")"), 1 === ret.version) {
                            ret.KID_count = reader.bytesToInt(4), ret.KIDs = [];
                            for (var i = ret.KID_count; i--; ) ret.KIDs.push(reader.bytesToASCII(16));
                        }
                        return ret.data_length = reader.bytesToInt(4), ret.data = reader.bytesToASCII(ret.data_length), 
                        ret;
                    }
                },
                sdtp: {
                    name: "Independent and Disposable Samples Box",
                    description: "",
                    parser: function parser(r) {
                        var ret = {
                            version: r.bytesToInt(1),
                            flags: r.bytesToInt(3)
                        }, remaining = r.getRemainingLength(), i = remaining;
                        for (ret.samples = []; i--; ) {
                            var byte = r.bytesToInt(1);
                            ret.samples.push({
                                is_leading: byte >> 6 & 3,
                                sample_depends_on: byte >> 4 & 3,
                                sample_is_depended_on: byte >> 2 & 3,
                                sample_has_redundancy: 3 & byte
                            });
                        }
                        return ret;
                    }
                },
                sidx: {
                    name: "Segment Index Box",
                    description: "Index of the media stream",
                    parser: function parser(r) {
                        for (var version = r.bytesToInt(1), flags = r.bytesToInt(3), reference_id = r.bytesToInt(4), timescale = r.bytesToInt(4), earliest_presentation_time = r.bytesToInt(0 === version ? 4 : 8), first_offset = r.bytesToInt(0 === version ? 4 : 8), reserved = r.bytesToInt(2), reference_count = r.bytesToInt(2), items = [], i = reference_count; i--; ) {
                            var first4Bytes = r.bytesToInt(4), second4Bytes = r.bytesToInt(4), third4Bytes = r.bytesToInt(4);
                            items.push({
                                reference_type: first4Bytes >> 31 & 1,
                                referenced_size: 2147483647 & first4Bytes,
                                subsegment_duration: second4Bytes,
                                starts_with_SAP: third4Bytes >> 31 & 1,
                                SAP_type: third4Bytes >> 28 & 7,
                                SAP_delta_time: 268435455 & third4Bytes
                            });
                        }
                        return {
                            version: version,
                            flags: flags,
                            reference_id: reference_id,
                            timescale: timescale,
                            earliest_presentation_time: earliest_presentation_time,
                            first_offset: first_offset,
                            reserved: reserved,
                            reference_count: reference_count,
                            items: items
                        };
                    }
                },
                skip: {
                    name: "Free Space Box",
                    description: "This box can be completely ignored."
                },
                styp: {
                    name: "Segment Type Box",
                    description: "",
                    content: ftypBox.content,
                    parser: ftypBox.parser
                },
                tfdt: {
                    name: "Track Fragment Decode Time",
                    description: "The absolute decode time, measured on the media timeline, of the first sample in decode order in the track fragment",
                    parser: function parser(r) {
                        var version = r.bytesToInt(1);
                        return {
                            version: version,
                            flags: r.bytesToInt(3),
                            baseMediaDecodeTime: r.bytesToInt(version ? 8 : 4)
                        };
                    }
                },
                tfhd: {
                    name: "Track Fragment Header Box",
                    description: "",
                    parser: function parser(r) {
                        var ret = {};
                        ret.version = r.bytesToInt(1);
                        var flags = r.bytesToInt(3), hasBaseDataOffset = 1 & flags, hasSampleDescriptionIndex = 2 & flags, hasDefaultSampleDuration = 8 & flags, hasDefaultSampleSize = 16 & flags, hasDefaultSampleFlags = 32 & flags, durationIsEmpty = 65536 & flags, defaultBaseIsMOOF = 131072 & flags;
                        return ret.flags = {
                            "base-data-offset-present": !!hasBaseDataOffset,
                            "sample-description-index-present": !!hasSampleDescriptionIndex,
                            "default-sample-duration-present": !!hasDefaultSampleDuration,
                            "default-sample-size-present": !!hasDefaultSampleSize,
                            "default-sample-flags-present": !!hasDefaultSampleFlags,
                            "duration-is-empty": !!durationIsEmpty,
                            "default-base-is-moof": !!defaultBaseIsMOOF
                        }, ret.track_ID = r.bytesToInt(4), hasBaseDataOffset && (ret.base_data_offset = r.bytesToInt(8)), 
                        hasSampleDescriptionIndex && (ret.sample_description_index = r.bytesToInt(4)), hasDefaultSampleDuration && (ret.default_sample_duration = r.bytesToInt(4)), 
                        hasDefaultSampleSize && (ret.default_sample_size = r.bytesToInt(4)), hasDefaultSampleFlags && (ret.default_sample_flags = r.bytesToInt(4)), 
                        ret;
                    }
                },
                tkhd: {
                    name: "Track Header Box",
                    description: "Characteristics of a single track.",
                    parser: function parser(r) {
                        var version = r.bytesToInt(1);
                        return {
                            version: version,
                            flags: r.bytesToInt(3),
                            creation_time: r.bytesToInt(version ? 8 : 4),
                            modification_time: r.bytesToInt(version ? 8 : 4),
                            track_ID: r.bytesToInt(4),
                            reserved1: r.bytesToInt(4),
                            duration: r.bytesToInt(version ? 8 : 4),
                            reserved2: [ r.bytesToInt(4), r.bytesToInt(4) ],
                            // TODO template? signed?
                            layer: r.bytesToInt(2),
                            alternate_group: r.bytesToInt(2),
                            volume: [ r.bytesToInt(1), r.bytesToInt(1) ].join("."),
                            reserved3: r.bytesToInt(2),
                            matrix: [ r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4), r.bytesToInt(4) ],
                            width: [ r.bytesToInt(2), r.bytesToInt(2) ],
                            height: [ r.bytesToInt(2), r.bytesToInt(2) ]
                        };
                    }
                },
                traf: {
                    name: "Track Fragment Box",
                    description: "",
                    container: !0
                },
                trak: {
                    name: "Track Box",
                    description: "Container box for a single track of a presentation. A presentation consists of one or more tracks. Each track is independent of the other tracks in the presentation and carries its own temporal and spatial information. Each track will contain its associated Media Box.",
                    container: !0
                },
                trex: {
                    name: "Track Extends Box",
                    description: "sets up default values used by the movie fragments. By setting defaults in this way, space and complexity can be saved in each Track Fragment Box",
                    parser: function parser(reader) {
                        return {
                            version: reader.bytesToInt(1),
                            flags: reader.bytesToInt(3),
                            track_id: reader.bytesToInt(4),
                            default_sample_description_index: reader.bytesToInt(4),
                            default_sample_duration: reader.bytesToInt(4),
                            default_sample_size: reader.bytesToInt(4),
                            default_sample_flags: reader.bytesToInt(4)
                        };
                    }
                },
                trun: {
                    name: "Track Fragment Run Box",
                    parser: function parser(r) {
                        var ret = {};
                        ret.version = r.bytesToInt(1);
                        var flags = r.bytesToInt(3), hasDataOffset = 1 & flags, hasFirstSampleFlags = 4 & flags, hasSampleDuration = 256 & flags, hasSampleSize = 512 & flags, hasSampleFlags = 1024 & flags, hasSampleCompositionOffset = 2048 & flags;
                        ret.flags = {
                            "data-offset-present": !!hasDataOffset,
                            "first-sample-flags-present": !!hasFirstSampleFlags,
                            "sample-duration-present": !!hasSampleDuration,
                            "sample-size-present": !!hasSampleSize,
                            "sample-flags-present": !!hasSampleFlags,
                            "sample-composition-time-offset-present": !!hasSampleCompositionOffset
                        }, ret.sample_count = r.bytesToInt(4), 
                        // two's complement
                        hasDataOffset && (ret.data_offset = ~~r.bytesToInt(4)), hasFirstSampleFlags && (ret.first_sample_flags = r.bytesToInt(4));
                        var i = ret.sample_count;
                        for (ret.samples = []; i--; ) {
                            var sample = {};
                            hasSampleDuration && (sample.sample_duration = r.bytesToInt(4)), hasSampleSize && (sample.sample_size = r.bytesToInt(4)), 
                            hasSampleFlags && (sample.sample_flags = r.bytesToInt(4)), hasSampleCompositionOffset && (sample.sample_composition_time_offset = 0 === ret.version ? r.bytesToInt(4) : ~~r.bytesToInt(4)), 
                            ret.samples.push(sample);
                        }
                        return ret;
                    }
                },
                "url ": {
                    name: "Data Entry Url Box",
                    description: "declare the location(s) of the media data used within the presentation.",
                    parser: function parser(r) {
                        var ret = {};
                        ret.version = r.bytesToInt(1), ret.flags = r.bytesToInt(3);
                        var remaining = r.getRemainingLength();
                        return remaining && (ret.location = String.fromCharCode.apply(String, r.bytesToInt(r.getRemainingLength()))), 
                        ret;
                    }
                },
                "urn ": {
                    name: "Data Entry Url Box",
                    description: "declare the location(s) of the media data used within the presentation.",
                    parser: function parser(r) {
                        var ret = {};
                        ret.version = r.bytesToInt(1), ret.flags = r.bytesToInt(3);
                        var remaining = r.getRemainingLength();
                        // TODO Check NULL-terminated stream for name+location
                        // might also check flags for that
                                                return remaining && (ret.name = String.fromCharCode.apply(String, r.bytesToInt(r.getRemainingLength()))), 
                        ret;
                    }
                },
                uuid: {
                    name: "User-defined Box",
                    description: "Custom box. Those are not yet parsed here."
                },
                vmhd: {
                    name: "Video Media Header",
                    description: "The video media header contains general presentation information, independent of the coding, for video media.",
                    parser: function parser(reader) {
                        var version = reader.bytesToInt(1), flags = reader.bytesToInt(3);
                        if (0 !== version) throw new Error("invalid version");
                        if (1 !== flags) throw new Error("invalid flags");
                        // TODO template?
                                                var graphicsmode = reader.bytesToInt(2), opcolor = [ reader.bytesToInt(2), reader.bytesToInt(2), reader.bytesToInt(2) ];
                        return {
                            version: version,
                            flags: flags,
                            graphicsmode: graphicsmode,
                            opcolor: opcolor
                        };
                    }
                }
            };
            /**
   * Parse recursively ISOBMFF Uint8Array.
   * @param {Uint8Array} arr
   * @returns {Array.<Object>}
   */
            function recursiveParseBoxes(arr) {
                for (var i = 0, returnedArray = [], _loop = function _loop() {
                    var currentOffset = i, size = be4toi(arr, currentOffset);
                    currentOffset += 4, 1 === size ? (size = be8toi(arr, currentOffset), currentOffset += 8) : 0 === size && (size = arr.length - i);
                    var name = betoa(arr, currentOffset, 4);
                    currentOffset += 4;
                    var atomObject = {
                        alias: name,
                        size: size,
                        values: []
                    };
                    if ("uuid" === name) {
                        for (var subtype = [], j = 16; j--; ) subtype.push(arr[currentOffset]), currentOffset += 1;
                        atomObject.subtype = subtype;
                    }
                    if (returnedArray.push(atomObject), definitions[name]) {
                        var config = definitions[name], contentInfos = config.content ? config.content.reduce(function(acc, el) {
                            return acc[el.key] = {
                                name: el.name || "",
                                description: "" | el.description
                            }, acc;
                        }, {}) : {
                            name: "",
                            description: ""
                        };
                        atomObject.name = config.name || "", atomObject.description = config.description || "";
                        var hasChildren = !!config.container, content = arr.slice(currentOffset, size + i), contentForChildren = void 0;
                        if ("function" == typeof config.parser) {
                            var parserReader = createBufferReader(content), result = {};
                            try {
                                result = config.parser(parserReader);
                            } catch (e) {
                                console.warn('impossible to parse "' + name + '" box.', e);
                            }
                            if (hasChildren) {
                                var remaining = parserReader.getRemainingLength();
                                contentForChildren = content.slice(content.length - remaining);
                            } else parserReader.isFinished() || console.warn("not everything has been parsed for box: " + name + ". Missing", parserReader.getRemainingLength(), "bytes.");
                            delete result.__data__, Object.keys(result).forEach(function(key) {
                                var infos = contentInfos[key] || {};
                                infos.name || (infos.name = key), atomObject.values.push(Object.assign({
                                    value: result[key]
                                }, infos));
                            });
                        }
                        if (hasChildren) {
                            var childrenResult = parseBoxes(contentForChildren || content);
                            atomObject.children = childrenResult;
                        }
                    }
                    i += size;
                }; i < arr.length; ) _loop();
                return returnedArray;
            }
            /**
   * Parse ISOBMFF file and translate it into a more useful array containing
   * "atom objects".
   * @param {ArrayBuffer|Uint8Array} arr
   * @returns {Array.<Object>}
   */            function parseBoxes(arr) {
                if (arr instanceof Uint8Array) return recursiveParseBoxes(arr);
                if (arr instanceof ArrayBuffer) return recursiveParseBoxes(new Uint8Array(arr));
                if (arr.buffer instanceof ArrayBuffer) return recursiveParseBoxes(new Uint8Array(arr.buffer));
                throw new Error("Unrecognized format. Please give an ArrayBuffer or TypedArray instead.");
            }
            return parseBoxes;
        }();
    }();
    /***/}, 
/* 1 */
/***/ function(module, __webpack_exports__, __webpack_require__) {
    "use strict";
    __webpack_require__.r(__webpack_exports__);
    // EXTERNAL MODULE: ./node_modules/isobmff-inspector/dist/bundle.js
    var bundle = __webpack_require__(0), bundle_default = /* */ __webpack_require__.n(bundle);
    // CONCATENATED MODULE: ./src/renderer.js
    const wrapper = document.getElementById("file-description"), sanitize = str => {
        const div = document.createElement("div");
        return div.appendChild(document.createTextNode(str)), div.innerHTML;
    }, title = () => '\n    <h2 id="result-title">Results</h2>\n  ', getObjectDisplay = obj => {
        return `\n    <div class="value-object-line">\n      ${Object.keys(obj).map(key => `\n      <div class="value-object-prop">\n        <span class="value-object-key">${sanitize(key)}</span>:\n        <span class="value-object-value">${getValueToDisplay(obj[key])}</span>\n      </div>\n    `).join("")}\n    </div>\n  `;
    }, getValueToDisplay = val => {
        if (null != val) {
            switch (typeof val) {
              case "object":
                return Array.isArray(val) ? val.length ? "number" == typeof val[0] ? val.join(" ") : val.map(getObjectDisplay).join(" ") : "no element" : getObjectDisplay(val);

              case "string":
                return `"${sanitize(val)}"`;
            }
            return sanitize(val);
        }
    }, BoxTitle = box => `\n    <div class="box-title">\n      <span class="box-name">${sanitize(box.name)}</span>\n      <span class="box-alias">("${sanitize(box.alias)}")</span>\n      <span class="box-size">${sanitize(box.size)} bytes</span>\n    </div>\n  `, BoxDescription = box => `\n    <div class="box-description">\n      ${sanitize(box.description)}\n    </div>\n  `, BoxValue = value => `\n    <div class="box-value-entry">\n      <span class="box-value-key">${sanitize(value.name)}</span>:\n      <span class="box-value-value">${getValueToDisplay(value.value)}</span>\n    </div>\n  `, BoxValues = box => (box.values || []).map(v => BoxValue(v)).join(""), Box = box => {
        const children = (box.children || []).map(Box).join("");
        return `\n    <div class="box">\n      ${BoxTitle(box)}\n      ${BoxDescription(box)}\n      ${BoxValues(box)}\n      ${children}\n    </div>\n  `;
    };
    /* harmony default export */ var renderer = (arr = []) => {
        console.log("rendering...", arr), wrapper.style.display = "none", wrapper.innerHTML = title() + arr.map(Box).join(""), 
        wrapper.style.display = "block";
    };
    // CONCATENATED MODULE: ./src/index.js
    // -- Feature switching based on the various API support --
        if (window.File && window.FileReader && window.Uint8Array) {
        document.getElementById("file-input").addEventListener("change", 
        /**
   * @param {Event} evt
   * @returns {Boolean}
   */
        function onFileSelection(evt) {
            const files = evt.target.files;
 // FileList object
                        if (!files.length) return;
            const file = files[0], reader = new FileReader();
            // TODO read progressively to skip mdat and whatnot
            return reader.onload = (evt => {
                const arr = new Uint8Array(evt.target.result), res = bundle_default()(arr);
                renderer(res);
            }), reader.readAsArrayBuffer(file), !1;
        }, !1);
    } else {
        document.getElementById("choices-local-segment").style.display = "none", document.getElementById("choices-separator").style.display = "none";
    }
    if (window.fetch && window.Uint8Array) {
        /**
   * @param {Event} evt
   */
        function onUrlValidation(url) {
            fetch(url).then(response => response.arrayBuffer()).then(arrayBuffer => {
                const parsed = bundle_default()(new Uint8Array(arrayBuffer));
                renderer(parsed);
            });
        }
        /**
   * @returns {Boolean}
   */        document.getElementById("url-input").addEventListener("keypress", 
        /**
   * @param {Event} evt
   * @returns {Boolean}
   */
        function onInputKeyPress(evt) {
            if (13 == (evt.keyCode || evt.which)) {
                const url = evt.target.value;
                return url && onUrlValidation(url), !1;
            }
        }, !1), document.getElementById("url-button").addEventListener("click", function onButtonClicking() {
            const url = document.getElementById("url-input").value;
            if (url) return onUrlValidation(url), !1;
        }, !1);
    } else {
        document.getElementById("choices-separator").style.display = "none", document.getElementById("choices-url-segment").style.display = "none";
    }
    /***/}
/******/ ]);