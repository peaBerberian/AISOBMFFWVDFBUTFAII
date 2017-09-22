const SYSTEM_IDS = {
  "69F908AF481646EA910CCD5DCCCB0A3A": "Marlin",
  "9A04F07998404286AB92E65BE0885F95": "PlayReady",
  "EDEF8BA979D64ACEA3C827DCD51D21ED": "Widevine",
  "F239E769EFA348509C16A903C6932EFB": "PrimeTime",
  "A1077EFECC0B24D02ACE33C1E52E2FB4B": "cenc",
};

export default {
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
};
