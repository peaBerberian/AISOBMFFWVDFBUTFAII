export default {
  name: "Independent and Disposable Samples Box",
  description: "",

  parser(r) {
    const ret = {
      version: r.bytesToInt(1),
      flags: r.bytesToInt(3),
    };

    const remaining = r.getRemainingLength();

    let i = remaining;
    ret.samples = [];
    while (i--) {
      const byte = r.bytesToInt(1);
      ret.samples.push({
        is_leading: byte >> 6 & 0x03,
        sample_depends_on: byte >> 4 & 0x03,
        sample_is_depended_on: byte >> 2 & 0x03,
        sample_has_redundancy: byte & 0x03,
      });
    }
    return ret;
  },
};
