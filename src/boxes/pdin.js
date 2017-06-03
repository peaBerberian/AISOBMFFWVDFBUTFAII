export default {
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
};
