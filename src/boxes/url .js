export default {
  name: "Data Entry Url Box",
  description: "declare the location(s) of the media data used within the presentation.",
  parser(r) {
    const ret = {};
    ret.version = r.bytesToInt(1);
    ret.flags = r.bytesToInt(3);

    const remaining = r.getRemainingLength();

    if (remaining) {
      ret.location = String.fromCharCode.apply(
        String, r.bytesToInt(r.getRemainingLength())
      );
    }
    return ret;
  },
};
