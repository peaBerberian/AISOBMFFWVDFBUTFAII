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

export {
  be2toi,
  be3toi,
  be4toi,
  be5toi,
  be8toi,
  bytesToHex,
  betoa,
};
