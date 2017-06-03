export default {
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
};
