export default {
  name: "Data Entry Url Box",
  description: "declare the location(s) of the media data used within the presentation.",
  parser(r) {
    const ret = {};
    ret.version = r.bytesToInt(1);
    ret.flags = r.bytesToInt(3);

    const remaining = r.getRemainingLength();

    // TODO Check NULL-terminated stream for name+location
    // might also check flags for that
    if (remaining) {
      ret.name = String.fromCharCode.apply(
        String, r.bytesToInt(r.getRemainingLength())
      );
    }
    return ret;
  },
};
