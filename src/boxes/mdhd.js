export default {
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
};
