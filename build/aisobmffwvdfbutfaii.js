/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 39);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "File Type Box",
  description: "File type and compatibility",
  content: [
    {
      /* name: "major brand", */ // optional name
      key: "major_brand",
      description: "Brand identifier.",
    },
    {
      key: "minor_version",
      description: "informative integer for the minor version of the major brand",
    },
    {
      key: "compatible_brands",
      description: "List of brands",
    },
  ],

  parser(reader) {
    const len = reader.getTotalLength();
    const major_brand = reader.bytesToASCII(4);
    const minor_version = reader.bytesToInt(4);

    const compatArr = [];
    for (let i = 8; i < len; i+=4) {
      compatArr.push(reader.bytesToASCII(4));
    }

    return {
      major_brand,
      minor_version,
      compatible_brands: compatArr.join(", "),
    };
  },
});


/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return be2toi; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "e", function() { return be3toi; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return be4toi; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "f", function() { return be5toi; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return be8toi; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "g", function() { return bytesToHex; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return betoa; });
/**
 * Translate groups of 2 big-endian bytes to Integer (from 0 up to 65535).
 * @param {TypedArray} bytes
 * @param {Number} off - The offset (from the start of the given array)
 * @returns {Number}
 */
function be2toi(bytes, off) {
  return (
    (bytes[0+off] << 8) +
    (bytes[1+off])
  );
}

/**
 * Translate groups of 3 big-endian bytes to Integer.
 * @param {TypedArray} bytes
 * @param {Number} off - The offset (from the start of the given array)
 * @returns {Number}
 */
function be3toi(bytes, off) {
  return (
    (bytes[0+off] * 0x0010000) +
    (bytes[1+off] * 0x0000100) +
    (bytes[2+off])
  );
}

/**
 * Translate groups of 4 big-endian bytes to Integer.
 * @param {TypedArray} bytes
 * @param {Number} off - The offset (from the start of the given array)
 * @returns {Number}
 */
function be4toi(bytes, off) {
  return (
    (bytes[0+off] * 0x1000000) +
    (bytes[1+off] * 0x0010000) +
    (bytes[2+off] * 0x0000100) +
    (bytes[3+off])
  );
}

/**
 * Translate groups of 4 big-endian bytes to Integer.
 * @param {TypedArray} bytes
 * @param {Number} off - The offset (from the start of the given array)
 * @returns {Number}
 */
function be5toi(bytes, off) {
  return (
    (bytes[0+off] * 0x100000000) +
    (bytes[1+off] * 0x001000000) +
    (bytes[2+off] * 0x000010000) +
    (bytes[3+off] * 0x000000100) +
    (bytes[4+off])
  );
}

/**
 * Translate groups of 8 big-endian bytes to Integer.
 * @param {TypedArray} bytes
 * @param {Number} off - The offset (from the start of the given array)
 * @returns {Number}
 */
function be8toi(bytes, off) {
  return (
    (
      (bytes[0+off] * 0x1000000) +
      (bytes[1+off] * 0x0010000) +
      (bytes[2+off] * 0x0000100) +
       (bytes[3+off])
     ) * 0x100000000 +
     (bytes[4+off] * 0x1000000) +
     (bytes[5+off] * 0x0010000) +
     (bytes[6+off] * 0x0000100) +
     (bytes[7+off])
  );
}

function bytesToHex(uint8arr, off, nbBytes) {
  if (!uint8arr) {
    return "";
  }

  const arr = uint8arr.slice(off, nbBytes + off);
  let hexStr = "";
  for (let i = 0; i < arr.length; i++) {
    let hex = (arr[i] & 0xff).toString(16);
    hex = (hex.length === 1) ? "0" + hex : hex;
    hexStr += hex;
  }

  return hexStr.toUpperCase();
}

// XXX TODO test that
function betoa(uint8arr, off, nbBytes) {
  if (!uint8arr) {
    return "";
  }

  const arr = uint8arr.slice(off, nbBytes + off);
  return String.fromCharCode.apply(String, arr);
}




/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__utils_bytes_js__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__utils_buffer_reader_js__ = __webpack_require__(40);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__boxes__ = __webpack_require__(9);





/**
 * Parse ISOBMFF Uint8Array and translate it into a more useful array containing
 * "atom objects" (descriptions of the contained atoms), ready to be displayed
 * by a UI.
 * TODO document the "atom objects" structures.
 * @param {Uint8Array} arr
 * @returns {Array.<Object>}
 */
const parseBoxes = (arr) => {
  let i = 0;
  const returnedArray = [];

  while ( i < arr.length) {
    let currentOffset = i;

    let size = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__utils_bytes_js__["a" /* be4toi */])(arr, currentOffset);
    currentOffset += 4;

    if (size === 1) {
      size = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__utils_bytes_js__["b" /* be8toi */])(arr, currentOffset);
      currentOffset += 8;
    } else if (size === 0) {
      size = arr.length - i;
    }

    const name = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__utils_bytes_js__["c" /* betoa */])(arr, currentOffset, 4);
    currentOffset += 4;

    const atomObject = {
      alias: name,
      size,
      values: [],
    };

    if (name === "uuid") {
      const subtype = [];
      let j = 16;
      while(j--) {
        subtype.push(arr[currentOffset]);
        currentOffset +=1;
      }

      atomObject.subtype = subtype;
    }

    returnedArray.push(atomObject);

    if (__WEBPACK_IMPORTED_MODULE_2__boxes__["a" /* default */][name]) {
      const config = __WEBPACK_IMPORTED_MODULE_2__boxes__["a" /* default */][name];
      const contentInfos = config.content ?
        config.content.reduce((acc, el) => {
          acc[el.key] = {
            name: el.name || "",
            description: el.description | "",
          };
          return acc;
        }, {}) : { name: "", description: "" };

      atomObject.name = config.name || "";
      atomObject.description = config.description || "";
      const hasChildren = !!config.container;

      const content = arr.slice(currentOffset, size + i);
      let contentForChildren;

      if (typeof config.parser === "function") {
        const parserReader = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_1__utils_buffer_reader_js__["a" /* default */])(content);
        let result = {};
        try {
          result = config.parser(parserReader);
        } catch (e) {
          console.warn(`impossible to parse "${name}" box.`, e);
        }

        if (hasChildren) {
          const remaining = parserReader.getRemainingLength();
          contentForChildren = content.slice(content.length - remaining);
        } else if (!parserReader.isFinished()) {
          console.warn("not everything has been parsed for box: " + name +
            ". Missing", parserReader.getRemainingLength(), "bytes.");
        }

        delete result.__data__;
        Object.keys(result).forEach((key) => {
          const infos = contentInfos[key] || {};

          if (!infos.name) {
            infos.name = key;
          }

          atomObject.values.push(Object.assign({
            value: result[key],
          }, infos));
        });
      }

      if (hasChildren) {
        const childrenResult = parseBoxes(contentForChildren || content);
        atomObject.children = childrenResult;
      }
    }
    i += size;
  }

  return returnedArray;
};

/* harmony default export */ __webpack_exports__["a"] = (parseBoxes);


/***/ }),
/* 3 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
const el = document.getElementById("file-description");

const sanitize = (str) => {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

const getObjectDisplay = (obj) => {
  const props = Object.keys(obj).map(key =>
    `
      <div class="value-object-prop">
        <span class="value-object-key">${sanitize(key)}</span>:
        <span class="value-object-value">${getValueToDisplay(obj[key])}</span>
      </div>
    `
  ).join("");
  return `
    <div class="value-object-line">
      ${props}
    </div>
  `;
};

const getValueToDisplay = (val) => {
  if (val == null) {
    return undefined;
  }
  switch (typeof val) {
  case "object":
    if (Array.isArray(val)) {
      if (!val.length) {
        return "no element";
      }
      if (typeof val[0] === "number") {
        return val.join(" ");
      }
      return val.map(getObjectDisplay).join(" ");
    }

    return getObjectDisplay(val);
  case "string":
    return `"${sanitize(val)}"`;
  }

  return sanitize(val);
};

const BoxTitle = (box) =>
  `
    <div class="box-title">
      <span class="box-name">${sanitize(box.name)}</span>
      <span class="box-alias">("${sanitize(box.alias)}")</span>
      <span class="box-size">${sanitize(box.size)} bytes</span>
    </div>
  `;

const BoxDescription = (box) =>
  `
    <div class="box-description">
      ${sanitize(box.description)}
    </div>
  `;

const BoxValue = (value) => {
  return `
    <div class="box-value-entry">
      <span class="box-value-key">${sanitize(value.name)}</span>:
      <span class="box-value-value">${getValueToDisplay(value.value)}</span>
    </div>
  `;
};

const BoxValues = (box) =>
  (box.values || []).map(v => BoxValue(v)).join("");

const Box = (box) => {
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

/* harmony default export */ __webpack_exports__["a"] = ((arr = []) => {
  console.log(arr);
  el.innerHTML =  arr.map(Box).join("");
});


/***/ }),
/* 4 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Data Information Box",
  description: "Objects that declare the location of the media information in a track.",
  container: true,
});


/***/ }),
/* 5 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Data Reference Box",
  description: "",
  container: true,

  parser(reader) {
    const version = reader.bytesToInt(1);
    const flags = reader.bytesToInt(3);
    if (version !== 0) {
      throw new Error("invalid version");
    }
    if (flags !== 0) {
      throw new Error("invalid flags");
    }

    const entry_count = reader.bytesToInt(4);

    return { version, flags, entry_count };
  },
});


/***/ }),
/* 6 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Edit Box",
  description: "Maps the presentation time‐line to the media time‐line as it is stored in the file.",
  container: true,
});


/***/ }),
/* 7 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Free Space Box",
  description: "This box can be completely ignored",
});


/***/ }),
/* 8 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Handler Reference Box",
  description: "This box within a Media Box declares media type of the track, and thus the process by which the media‐data in the track is presented",

  parser(r) {
    const ret = {
      version: r.bytesToInt(1),
      flags: r.bytesToInt(3),
      pre_defined: r.bytesToInt(4),
      handler_type: r.bytesToInt(4),
      reserved: [
        r.bytesToInt(4),
        r.bytesToInt(4),
        r.bytesToInt(4),
      ],
    };

    let remaining = r.getRemainingLength();
    ret.name = "";
    while (remaining--) {
      ret.name += String.fromCharCode(parseInt(r.bytesToInt(1), 10));
    }

    return ret;
  },
});


/***/ }),
/* 9 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__dinf_js__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__dref_js__ = __webpack_require__(5);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__edts_js__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__free_js__ = __webpack_require__(7);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ftyp_js__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__hdlr_js__ = __webpack_require__(8);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__iods_js__ = __webpack_require__(10);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__leva_js__ = __webpack_require__(11);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__mdat_js__ = __webpack_require__(12);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__mdhd_js__ = __webpack_require__(13);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10__mdia_js__ = __webpack_require__(14);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_11__mehd_js__ = __webpack_require__(15);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12__mfhd_js__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_13__minf_js__ = __webpack_require__(17);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_14__moof_js__ = __webpack_require__(18);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_15__moov_js__ = __webpack_require__(19);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_16__mvex_js__ = __webpack_require__(20);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_17__mvhd_js__ = __webpack_require__(21);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_18__pdin_js__ = __webpack_require__(22);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_19__pssh_js__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_20__sdtp_js__ = __webpack_require__(24);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_21__sidx_js__ = __webpack_require__(25);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_22__skip_js__ = __webpack_require__(26);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_23__styp_js__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_24__tfdt_js__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_25__tfhd_js__ = __webpack_require__(29);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_26__tkhd_js__ = __webpack_require__(30);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_27__traf_js__ = __webpack_require__(31);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_28__trak_js__ = __webpack_require__(32);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_29__trex_js__ = __webpack_require__(33);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_30__trun_js__ = __webpack_require__(34);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_31__url_js__ = __webpack_require__(35);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_32__urn_js__ = __webpack_require__(36);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_33__uuid_js__ = __webpack_require__(37);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_34__vmhd_js__ = __webpack_require__(38);




































/* harmony default export */ __webpack_exports__["a"] = ({
  dinf: __WEBPACK_IMPORTED_MODULE_0__dinf_js__["a" /* default */],
  dref: __WEBPACK_IMPORTED_MODULE_1__dref_js__["a" /* default */],
  edts: __WEBPACK_IMPORTED_MODULE_2__edts_js__["a" /* default */],
  free: __WEBPACK_IMPORTED_MODULE_3__free_js__["a" /* default */],
  ftyp: __WEBPACK_IMPORTED_MODULE_4__ftyp_js__["a" /* default */],
  hdlr: __WEBPACK_IMPORTED_MODULE_5__hdlr_js__["a" /* default */],
  iods: __WEBPACK_IMPORTED_MODULE_6__iods_js__["a" /* default */],
  leva: __WEBPACK_IMPORTED_MODULE_7__leva_js__["a" /* default */],
  mdat: __WEBPACK_IMPORTED_MODULE_8__mdat_js__["a" /* default */],
  mdhd: __WEBPACK_IMPORTED_MODULE_9__mdhd_js__["a" /* default */],
  mdia: __WEBPACK_IMPORTED_MODULE_10__mdia_js__["a" /* default */],
  mehd: __WEBPACK_IMPORTED_MODULE_11__mehd_js__["a" /* default */],
  mfhd: __WEBPACK_IMPORTED_MODULE_12__mfhd_js__["a" /* default */],
  minf: __WEBPACK_IMPORTED_MODULE_13__minf_js__["a" /* default */],
  moof: __WEBPACK_IMPORTED_MODULE_14__moof_js__["a" /* default */],
  moov: __WEBPACK_IMPORTED_MODULE_15__moov_js__["a" /* default */],
  mvex: __WEBPACK_IMPORTED_MODULE_16__mvex_js__["a" /* default */],
  mvhd: __WEBPACK_IMPORTED_MODULE_17__mvhd_js__["a" /* default */],
  pdin: __WEBPACK_IMPORTED_MODULE_18__pdin_js__["a" /* default */],
  pssh: __WEBPACK_IMPORTED_MODULE_19__pssh_js__["a" /* default */],
  sdtp: __WEBPACK_IMPORTED_MODULE_20__sdtp_js__["a" /* default */],
  sidx: __WEBPACK_IMPORTED_MODULE_21__sidx_js__["a" /* default */],
  skip: __WEBPACK_IMPORTED_MODULE_22__skip_js__["a" /* default */],
  styp: __WEBPACK_IMPORTED_MODULE_23__styp_js__["a" /* default */],
  tfdt: __WEBPACK_IMPORTED_MODULE_24__tfdt_js__["a" /* default */],
  tfhd: __WEBPACK_IMPORTED_MODULE_25__tfhd_js__["a" /* default */],
  tkhd: __WEBPACK_IMPORTED_MODULE_26__tkhd_js__["a" /* default */],
  traf: __WEBPACK_IMPORTED_MODULE_27__traf_js__["a" /* default */],
  trak: __WEBPACK_IMPORTED_MODULE_28__trak_js__["a" /* default */],
  trex: __WEBPACK_IMPORTED_MODULE_29__trex_js__["a" /* default */],
  trun: __WEBPACK_IMPORTED_MODULE_30__trun_js__["a" /* default */],
  "url ": __WEBPACK_IMPORTED_MODULE_31__url_js__["a" /* default */],
  "urn ": __WEBPACK_IMPORTED_MODULE_32__urn_js__["a" /* default */],
  uuid: __WEBPACK_IMPORTED_MODULE_33__uuid_js__["a" /* default */],
  vmhd: __WEBPACK_IMPORTED_MODULE_34__vmhd_js__["a" /* default */],
});


/***/ }),
/* 10 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// TODO
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Initial Object Descriptor Box",
});


/***/ }),
/* 11 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Level Assignment Box",

  // TODO
  parser(reader) {
    const version = reader.bytesToInt(1);
    const flags = reader.bytesToInt(3);

    // ...

    return {
      version,
      flags,
    };
  },
});


/***/ }),
/* 12 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Media Data Box",
  description: "the content's data",
});


/***/ }),
/* 13 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Media Header Box",
  description: "The media header declares overall information that is media‐independent, and relevant to characteristics of the media in a track.",
  parser(r) {
    const version = r.bytesToInt(1);
    const flags = r.bytesToInt(3);
    const creation_time = r.bytesToInt(version ? 8 : 4);
    const modification_time = r.bytesToInt(version ? 8 : 4);
    const timescale = r.bytesToInt(4);
    const duration = r.bytesToInt(version ? 8 : 4);

    const next2Bytes = r.bytesToInt(2);
    const pad = next2Bytes >> 15 & 0x01;
    const language = [
      String.fromCharCode((next2Bytes >> 10 & 0x1F) + 0x60),
      String.fromCharCode((next2Bytes >> 5  & 0x1F) + 0x60),
      String.fromCharCode((next2Bytes       & 0x1F) + 0x60),
    ].join("");
    const predifined = r.bytesToInt(2);
    return {
      version,
      flags,
      creation_time,
      modification_time,
      timescale,
      duration,
      pad,
      language,
      predifined,
    };
  },
});


/***/ }),
/* 14 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Media Structure",
  description: "declare information about the media data within a track.",
  container: true,
});


/***/ }),
/* 15 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Movie Extends Header Box",
  description: "Provides the overall duration, including fragments, of a fragmented movie. If this box is not present, the overall duration must be computed by examining each fragment.",

  parser(reader) {
    const version = reader.bytesToInt(1);
    if (version > 1) {
      throw new Error("invalid version");
    }

    const flags = reader.bytesToInt(3);

    const fragmentDuration = version === 1 ?
      reader.bytesToInt(8) : reader.bytesToInt(4);

    return {
      version,
      flags,
      "fragment_duration": fragmentDuration,
    };
  },
});


/***/ }),
/* 16 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Movie Fragment Header Box",
  description: "This box contains just a sequence number (usually starting at 1), as a safety check.",

  parser(r) {
    return {
      version: r.bytesToInt(1),
      flags: r.bytesToInt(3),
      sequence_number: r.bytesToInt(4),
    };
  },
});


/***/ }),
/* 17 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Media Information Box",
  description: "This box contains all the objects that declare characteristic information of the media in the track.",
  container: true,
});


/***/ }),
/* 18 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Movie Fragment Box",
  description: "",
  container: true,
});


/***/ }),
/* 19 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Movie Box",
  description: "The movie metadata",
  container: true,
});


/***/ }),
/* 20 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Movie Extends Box",
  container: true,
});


/***/ }),
/* 21 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Movie Header Box",
  description: "This box defines overall information which is " +
  "media‐independent, and relevant to the entire presentation " +
  "considered as a whole.",
  content: [
    {
      name: "version",
      description: "mvhd version",
      key: "version",
    },
    {
      name: "flags",
      description: "mvhd flags",
      key: "flags",
    },
    {
      name: "creation_time",
      description: "An integer that declares the creation time of the presentation (in seconds since midnight, Jan. 1, 1904, in UTC time)",
      key: "creationTime"
    },
    {
      name: "modification_time",
      description: "An integer that declares the most recent time the presentation was modified (in seconds since midnight, Jan. 1, 1904, in UTC time)",
      key: "modificationTime"
    },
    {
      name: "timescale",
      description: "An integer that specifies the time‐scale for the entire presentation; this is the number of time units that pass in one second. For example, a t me coordinate system that measures time in sixtieths of a second has a time scale of 60.",
      key: "timescale",
    },
    {
      name: "duration",
      description: "An integer that declares length of the presentation (in the indicated timescale). This property is derived from the presentation’s tracks: the value of this field corresponds to the duration of the longest track in the presentation. If the durat ion cannot be determined then duration is set to all 1s.",
      key: "duration",
    },
    {
      name: "rate",
      description: "A fixed point 16.16 number that indicates the preferred rate to play the presentation; 1.0 (0x00010000) is normal forward playback ",
      key: "rate",
    },
    {
      name: "volume",
      description: "A fixed point 8.8 number that indicates the preferred playback volume. 1.0 (0x0100) is full volume.",
      key: "volume",
    },
    {
      name: "reserved 1",
      description: "Reserved 16 bits",
      key: "reserved1",
    },
    {
      name: "reserved 2",
      description: "Reserved 2*32 bits",
      key: "reserved2",
    },
    {
      name: "matrix",
      description: "Provides a transformation matrix for the video; (u,v,w) are restricted here to (0,0,1), hex values (0,0,0x40000000).",
      key: "matrix",
    },
    {
      name: "pre-defined",
      description: "Pre-defined 32*6 bits.",
      key: "predefined",
    },
    {
      name: "next_track_ID",
      description: "A non‐zero integer that indicates a value to use for the track ID of the next track to be added to this presentation. Zero is not a valid track ID value. The value of next_track_ID shall be larger than the largest track‐ID in use. If this valu e is equal to all 1s (32‐bit maxint), and a new media track is to be added, then a s earch must be made in the file for an unused track identifier.",
      key: "nextTrackId",
    },
  ],

  parser: (reader) => {
    const version = reader.bytesToInt(1);
    if (version > 1) {
      throw new Error("invalid version");
    }

    const flags = reader.bytesToInt(3);

    let creationTime, modificationTime, timescale, duration;
    if (version === 1) {
      creationTime = reader.bytesToInt(8);
      modificationTime = reader.bytesToInt(8);
      timescale = reader.bytesToInt(4);
      duration = reader.bytesToInt(8);
    } else {
      creationTime = reader.bytesToInt(4);
      modificationTime = reader.bytesToInt(4);
      timescale = reader.bytesToInt(4);
      duration = reader.bytesToInt(4);
    }

    const rate = [
      reader.bytesToInt(2),
      reader.bytesToInt(2),
    ].join(".");

    const volume = [
      reader.bytesToInt(1),
      reader.bytesToInt(1),
    ].join(".");

    const reserved1 = reader.bytesToInt(2);
    const reserved2 = [
      reader.bytesToInt(4),
      reader.bytesToInt(4),
    ];

    const matrixArr = [];
    for (let i = 0; i < 9; i++) {
      matrixArr.push(reader.bytesToInt(4));
    }

    const predefined = [
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
    ];

    const nextTrackId = reader.bytesToInt(4);

    return {
      version,
      flags,
      creationTime,
      modificationTime,
      timescale,
      duration,
      rate,
      volume,
      reserved1,
      reserved2,
      matrix: matrixArr,
      predefined,
      nextTrackId,
    };
  },
});


/***/ }),
/* 22 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Progressive Download Information Box",
  description: "",
  content: [
    {
      name: "version",
      description: "pdin version",
      key: "version",
    },
    {
      name: "flags",
      description: "pdin flags",
      key: "flags",
    },
    {
      name: "rate",
      description: "Download rate expressed in bytes/second",
      key: "rate",
    },
    {
      name: "initial_delay",
      description: "Suggested delay to use when playing the file, such " +
      "that if download continues at the given rate, all data within " +
      "the file will arrive in time for its use and playback should " +
      "not need to stall.",
      key: "delay",
    },
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
      delay: reader.bytesToInt(4),
    };
  },
});


/***/ }),
/* 23 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
const SYSTEM_IDS = {
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
  "A68129D3575B4F1A9CBA3223846CF7C3": "VideoGuard Everywhere",
  "ADB41C242DBF4A6D958B4457C0D27B95": "Nagra",
  "B4413586C58CFFB094A5D4896C1AF6C3": "Viaccess-Orca",
  "DCF4E3E362F158187BA60A6FE33FF3DD": "DigiCAP",
  "E2719D58A985B3C9781AB030AF78D30E": "ClearKey",
  "EDEF8BA979D64ACEA3C827DCD51D21ED": "Widevine",
  "F239E769EFA348509C16A903C6932EFB": "PrimeTime",
};

/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Protection System Specific Header",
  description: "",
  parser(reader) {
    const ret = {};
    ret.version = reader.bytesToInt(1);
    if (ret.version > 1) {
      throw new Error("invalid version");
    }

    ret.flags = reader.bytesToInt(3);
    ret.systemID = reader.bytesToHex(16);

    const systemIDName = SYSTEM_IDS[ret.systemID];
    if (systemIDName) {
      ret.systemID += ` (${systemIDName})`;
    }

    if (ret.version === 1) {
      ret.KID_count = reader.bytesToInt(4);

      ret.KIDs = [];

      let i = ret.KID_count;
      while (i--) {
        ret.KIDs.push(reader.bytesToASCII(16));
      }
    }

    ret.data_length = reader.bytesToInt(4);
    ret.data = reader.bytesToASCII(ret.data_length);
    return ret;
  },
});


/***/ }),
/* 24 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Independent and Disposable Samples Box",
  description: "",

  parser(r) {
    const ret = {
      version: r.bytesToInt(1),
      flags: r.bytesToInt(3),
    };

    const remaining = r.getRemainingLength();

    let i = remaining;
    ret.samples = [];
    while (i--) {
      const byte = r.bytesToInt(1);
      ret.samples.push({
        is_leading: byte >> 6 & 0x03,
        sample_depends_on: byte >> 4 & 0x03,
        sample_is_depended_on: byte >> 2 & 0x03,
        sample_has_redundancy: byte & 0x03,
      });
    }
    return ret;
  },
});


/***/ }),
/* 25 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Segment Index Box",
  description: "Index of the media stream",

  parser(r) {
    const version = r.bytesToInt(1);
    const flags = r.bytesToInt(3);
    const reference_id = r.bytesToInt(4);
    const timescale = r.bytesToInt(4);
    const earliest_presentation_time =
      r.bytesToInt(version === 0 ? 4 : 8);
    const first_offset =
      r.bytesToInt(version === 0 ? 4 : 8);
    const reserved = r.bytesToInt(2);
    const reference_count = r.bytesToInt(2);

    const items = [];
    let i = reference_count;
    while(i--) {
      const first4Bytes = r.bytesToInt(4);
      const second4Bytes = r.bytesToInt(4);
      const third4Bytes = r.bytesToInt(4);
      items.push({
        reference_type: first4Bytes >> 31 & 0x01,
        referenced_size: first4Bytes & 0x7FFFFFFF,
        subsegment_duration: second4Bytes,
        starts_with_SAP: third4Bytes >> 31 & 0x01,
        SAP_type: third4Bytes >> 28 & 0x07,
        SAP_delta_time: third4Bytes & 0x0FFFFFFF,
      });
    }

    return {
      version,
      flags,
      reference_id,
      timescale,
      earliest_presentation_time,
      first_offset,
      reserved,
      reference_count,
      items,
    };
  },
});


/***/ }),
/* 26 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Free Space Box",
  description: "This box can be completely ignored.",
});


/***/ }),
/* 27 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__ftyp_js__ = __webpack_require__(0);


/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Segment Type Box",
  description: "",
  content: __WEBPACK_IMPORTED_MODULE_0__ftyp_js__["a" /* default */].content,
  parser: __WEBPACK_IMPORTED_MODULE_0__ftyp_js__["a" /* default */].parser,
});


/***/ }),
/* 28 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Fragment Decode Time",
  description: "The absolute decode time, measured on the media timeline, of the first sample in decode order in the track fragment",
  parser(r) {
    const version = r.bytesToInt(1);
    return {
      version,
      flags: r.bytesToInt(3),
      baseMediaDecodeTime: r.bytesToInt(version ? 8 : 4),
    };
  },
});


/***/ }),
/* 29 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Fragment Header Box",
  description: "",

  parser(r) {
    const ret = {};

    ret.version = r.bytesToInt(1);
    const flags = r.bytesToInt(3);

    const hasBaseDataOffset = flags & 0x000001;
    const hasSampleDescriptionIndex = flags & 0x000002;
    const hasDefaultSampleDuration = flags & 0x000008;
    const hasDefaultSampleSize = flags & 0x000010;
    const hasDefaultSampleFlags = flags & 0x000020;
    const durationIsEmpty = flags & 0x010000;
    const defaultBaseIsMOOF = flags & 0x020000;

    ret.flags = {
      "base-data-offset-present": !!hasBaseDataOffset,
      "sample-description-index-present": !!hasSampleDescriptionIndex,
      "default-sample-duration-present": !!hasDefaultSampleDuration,
      "default-sample-size-present": !!hasDefaultSampleSize,
      "default-sample-flags-present": !!hasDefaultSampleFlags,
      "duration-is-empty": !!durationIsEmpty,
      "default-base-is-moof": !!defaultBaseIsMOOF,
    };

    ret.track_ID = r.bytesToInt(4);

    if (hasBaseDataOffset) {
      ret.base_data_offset = r.bytesToInt(8);
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
  },
});


/***/ }),
/* 30 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Header Box",
  description: "Characteristics of a single track.",

  parser(r) {
    const version = r.bytesToInt(1);
    return {
      version,
      flags: r.bytesToInt(3),
      creation_time: r.bytesToInt(version ? 8 : 4),
      modification_time: r.bytesToInt(version ? 8 : 4),
      track_ID: r.bytesToInt(4),
      reserved1: r.bytesToInt(4),
      duration: r.bytesToInt(version ? 8 : 4),
      reserved2: [
        r.bytesToInt(4),
        r.bytesToInt(4),
      ],

      // TODO template? signed?
      layer: r.bytesToInt(2),
      alternate_group: r.bytesToInt(2),
      volume: [r.bytesToInt(1), r.bytesToInt(1)].join("."),
      reserved3: r.bytesToInt(2),
      matrix: [
        r.bytesToInt(4),
        r.bytesToInt(4),
        r.bytesToInt(4),

        r.bytesToInt(4),
        r.bytesToInt(4),
        r.bytesToInt(4),

        r.bytesToInt(4),
        r.bytesToInt(4),
        r.bytesToInt(4),
      ],
      width: [r.bytesToInt(2), r.bytesToInt(2)],
      height: [r.bytesToInt(2), r.bytesToInt(2)],
    };
  },
});


/***/ }),
/* 31 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Fragment Box",
  description: "",
  container: true,
});


/***/ }),
/* 32 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Box",
  description: "Container box for a single track of a presentation. A presentation consists of one or more tracks. Each track is independent of the other tracks in the presentation and carries its own temporal and spatial information. Each track will contain its associated Media Box.",
  container: true,
});


/***/ }),
/* 33 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Extends Box",
  description: "sets up default values used by the movie fragments. By setting defaults in this way, space and complexity can be saved in each Track Fragment Box",

  parser(reader) {
    return {
      version: reader.bytesToInt(1),
      flags: reader.bytesToInt(3),
      "track_id": reader.bytesToInt(4),
      "default_sample_description_index": reader.bytesToInt(4),
      "default_sample_duration": reader.bytesToInt(4),
      "default_sample_size": reader.bytesToInt(4),
      "default_sample_flags": reader.bytesToInt(4),
    };
  },
});


/***/ }),
/* 34 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Track Fragment Run Box",

  parser(r) {
    const ret = {};
    ret.version = r.bytesToInt(1);

    const flags = r.bytesToInt(3);

    const hasDataOffset = flags & 0x000001;
    const hasFirstSampleFlags = flags & 0x000004;
    const hasSampleDuration = flags & 0x000100;
    const hasSampleSize = flags & 0x000200;
    const hasSampleFlags = flags & 0x000400;
    const hasSampleCompositionOffset = flags & 0x000800;

    ret.flags = {
      "data-offset-present": !!hasDataOffset,
      "first-sample-flags-present": !!hasFirstSampleFlags,
      "sample-duration-present": !!hasSampleDuration,
      "sample-size-present": !!hasSampleSize,
      "sample-flags-present": !!hasSampleFlags,
      "sample-composition-time-offset-present": !!hasSampleCompositionOffset,
    };

    ret.sample_count = r.bytesToInt(4);

    // two's complement
    if (hasDataOffset) {
      ret.data_offset = ~~r.bytesToInt(4);
    }

    if (hasFirstSampleFlags) {
      ret.first_sample_flags = r.bytesToInt(4);
    }

    let i = ret.sample_count;
    ret.samples = [];
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
        sample.sample_composition_time_offset = ret.version === 0 ?
          r.bytesToInt(4) : ~~r.bytesToInt(4);
      }
      ret.samples.push(sample);
    }

    return ret;
  },
});


/***/ }),
/* 35 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Data Entry Url Box",
  description: "declare the location(s) of the media data used within the presentation.",
  parser(r) {
    const ret = {};
    ret.version = r.bytesToInt(1);
    ret.flags = r.bytesToInt(3);

    const remaining = r.getRemainingLength();

    if (remaining) {
      ret.location = String.fromCharCode.apply(
        String, r.bytesToInt(r.getRemainingLength())
      );
    }
    return ret;
  },
});


/***/ }),
/* 36 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "Data Entry Url Box",
  description: "declare the location(s) of the media data used within the presentation.",
  parser(r) {
    const ret = {};
    ret.version = r.bytesToInt(1);
    ret.flags = r.bytesToInt(3);

    const remaining = r.getRemainingLength();

    // TODO Check NULL-terminated stream for name+location
    // might also check flags for that
    if (remaining) {
      ret.name = String.fromCharCode.apply(
        String, r.bytesToInt(r.getRemainingLength())
      );
    }
    return ret;
  },
});


/***/ }),
/* 37 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
  name: "User-defined Box",
  description: "Custom box. Those are not yet parsed here.",
});


/***/ }),
/* 38 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony default export */ __webpack_exports__["a"] = ({
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

    // TODO template?
    const graphicsmode = reader.bytesToInt(2);
    const opcolor = [
      reader.bytesToInt(2),
      reader.bytesToInt(2),
      reader.bytesToInt(2),
    ];
    return { version, flags, graphicsmode, opcolor };
  },
});


/***/ }),
/* 39 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__parser_js__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__renderer_js__ = __webpack_require__(3);



// Check for the various File API support.
if (!window.File || !window.FileReader) {
  const div = document.createElement("div");
  div.innerHTML = "Your browser is not compatible.";
  document.body.appendChild(div);
  throw new Error("Your browser is not compatible.");
}

/**
 * @param {Event} evt
 */
function onFileSelection(evt) {
  const files = evt.target.files; // FileList object

  if (!files.length) {
    return;
  }

  const file = files[0];
  const reader = new FileReader();

  // TODO read progressively to skip mdat and whatnot
  reader.onload = (evt) => {
    const arr = new Uint8Array(evt.target.result);
    const res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__parser_js__["a" /* default */])(arr);
    __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_1__renderer_js__["a" /* default */])(res);
  };

  reader.readAsArrayBuffer(file);
}

document.getElementById("file-input")
  .addEventListener("change", onFileSelection, false);


/***/ }),
/* 40 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__bytes_js__ = __webpack_require__(1);


/* harmony default export */ __webpack_exports__["a"] = ((buffer) => {
  let currentOffset = 0;

  return {
    getNextByte() {
      this.getNextBytes(1);
    },

    getNextBytes(nb) {
      if (this.getRemainingLength() < nb) {
        return ;
      }
      currentOffset += nb;
      return buffer.slice(0, nb);
    },

    bytesToInt(nbBytes) {
      if (this.getRemainingLength() < nbBytes) {
        return ;
      }
      let res;
      switch(nbBytes) {
      case 1:
        res = buffer[currentOffset];
        break;
      case 2:
        res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__bytes_js__["d" /* be2toi */])(buffer, currentOffset);
        break;
      case 3:
        res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__bytes_js__["e" /* be3toi */])(buffer, currentOffset);
        break;
      case 4:
        res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__bytes_js__["a" /* be4toi */])(buffer, currentOffset);
        break;
      case 5:
        res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__bytes_js__["f" /* be5toi */])(buffer, currentOffset);
        break;
      case 8:
        res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__bytes_js__["b" /* be8toi */])(buffer, currentOffset);
        break;
      default:
        throw new Error("not implemented yet.");
      }

      currentOffset += nbBytes;
      return res;
    },

    bytesToHex(nbBytes) {
      if (this.getRemainingLength() < nbBytes) {
        return ;
      }
      const res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__bytes_js__["g" /* bytesToHex */])(buffer, currentOffset, nbBytes);
      currentOffset += nbBytes;
      return res;
    },

    bytesToASCII(nbBytes) {
      if (this.getRemainingLength() < nbBytes) {
        return ;
      }
      const res = __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_0__bytes_js__["c" /* betoa */])(buffer, currentOffset, nbBytes);

      currentOffset += nbBytes;
      return res;
    },

    getTotalLength() {
      return buffer.length;
    },

    getRemainingLength() {
      return Math.max(0, buffer.length - currentOffset);
    },

    isFinished() {
      return buffer.length <= currentOffset;
    },
  };
});


/***/ })
/******/ ]);