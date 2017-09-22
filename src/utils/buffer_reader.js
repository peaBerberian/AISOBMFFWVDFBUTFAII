import {
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

  bytesToHex,
} from "./bytes.js";

export default (buffer) => {
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

    bytesToHex(nbBytes) {
      if (this.getRemainingLength() < nbBytes) {
        return ;
      }
      const res = bytesToHex(buffer, currentOffset, nbBytes);
      currentOffset += nbBytes;
      return res;
    },

    bytesToASCII(nbBytes) {
      if (this.getRemainingLength() < nbBytes) {
        return ;
      }
      let res;
      switch(nbBytes) {
      case 1:
        res = be1toa(buffer, currentOffset);
        break;
      case 2:
        res = be2toa(buffer, currentOffset);
        break;
      case 3:
        res = be3toa(buffer, currentOffset);
        break;
      case 4:
        res = be4toa(buffer, currentOffset);
        break;
      case 5:
        res = be5toa(buffer, currentOffset);
        break;
      case 8:
        res = be8toa(buffer, currentOffset);
        break;
      default:
        throw new Error("not implemented yet.");
      }

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
};
