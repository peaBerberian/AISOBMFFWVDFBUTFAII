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

function hex2a(hex) {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

const be1toa = (bytes, offset) => hex2a(bytes[offset].toString(16));
const be2toa = (bytes, offset) => hex2a(be2toi(bytes, offset).toString(16));
const be3toa = (bytes, offset) => hex2a(be3toi(bytes, offset).toString(16));
const be4toa = (bytes, offset) => hex2a(be4toi(bytes, offset).toString(16));
const be5toa = (bytes, offset) => hex2a(be5toi(bytes, offset).toString(16));
const be8toa = (bytes, offset) => hex2a(be8toi(bytes, offset).toString(16));

export {
  be2toi,
  be3toi,
  be4toi,
  be5toi,
  be8toi,
  be1toa,
  be2toa,
  be3toa,
  be4toa,
  be5toa,
  be8toa,
};
