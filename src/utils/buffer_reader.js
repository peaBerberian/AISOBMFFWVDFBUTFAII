import {
  be2toi,
  be3toi,
  be4toi,
  be5toi,
  be8toi,
  betoa,

  bytesToHex,
} from "./bytes.js";

/**
 * Create object allowing to easily parse an ISOBMFF box.
 *
 * The BufferReader saves in its state the current offset after each method
 * call, allowing to easily parse contiguous bytes in box parsers.
 *
 * @param {Uint8Array} buffer
 * @returns {Object}
 */
export default function createBufferReader(buffer) {
  let currentOffset = 0;

  return {
    /**
     * Returns the following byte, as a number between 0 and 255.
     * @returns {number}
     */
    getNextByte() {
      this.getNextBytes(1);
    },

    /**
     * Returns the N next bytes, as an Uint8Array
     * @param {number} nb
     * @returns {Uint8Array}
     */
    getNextBytes(nb) {
      if (this.getRemainingLength() < nb) {
        return ;
      }
      currentOffset += nb;
      return buffer.slice(0, nb);
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
     * @param {number}
     * @returns {string}
     */
    bytesToHex(nbBytes) {
      if (this.getRemainingLength() < nbBytes) {
        return ;
      }
      const res = bytesToHex(buffer, currentOffset, nbBytes);
      currentOffset += nbBytes;
      return res;
    },

    /**
     * Returns the N next bytes into a string.
     * @param {number}
     * @returns {string}
     */
    bytesToASCII(nbBytes) {
      if (this.getRemainingLength() < nbBytes) {
        return ;
      }
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
    },
  };
}
