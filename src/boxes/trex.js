export default {
  name: "Track Extends Box",
  description: "sets up default values used by the movie fragments. By setting defaults in this way, space and complexity can be saved in each Track Fragment Box",

  parser(reader) {
    return {
      version: reader.bytesToInt(1),
      flags: reader.bytesToInt(3),
      "track_id": reader.bytesToInt(4),
      "default_sample_description_index": reader.bytesToInt(4),
      "default_sample_duration": reader.bytesToInt(4),
      "default_sample_size": reader.bytesToInt(4),
      "default_sample_flags": reader.bytesToInt(4),
    };
  },
};
