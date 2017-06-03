export default {
  name: "Movie Extends Header Box",
  description: "Provides the overall duration, including fragments, of a fragmented movie. If this box is not present, the overall duration must be computed by examining each fragment.",

  parser(reader) {
    const version = reader.bytesToInt(1);
    if (version > 1) {
      throw new Error("invalid version");
    }

    const flags = reader.bytesToInt(3);

    const fragmentDuration = version === 1 ?
      reader.bytesToInt(8) : reader.bytesToInt(4);

    return {
      version,
      flags,
      "fragment_duration": fragmentDuration,
    };
  },
};
