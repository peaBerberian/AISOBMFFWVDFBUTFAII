export default {
  name: "Movie Fragment Header Box",
  description: "This box contains just a sequence number (usually starting at 1), as a safety check.",

  parser(r) {
    return {
      version: r.bytesToInt(1),
      flags: r.bytesToInt(3),
      sequence_number: r.bytesToInt(4),
    };
  },
};
