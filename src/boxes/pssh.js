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
