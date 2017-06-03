export default {
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
};
