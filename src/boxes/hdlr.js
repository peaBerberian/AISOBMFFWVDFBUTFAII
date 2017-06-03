export default {
  name: "Handler Reference Box",
  description: "This box within a Media Box declares media type of the track, and thus the process by which the media‐data in the track is presented",

  parser(r) {
    const ret = {
      version: r.bytesToInt(1),
      flags: r.bytesToInt(3),
      pre_defined: r.bytesToInt(4),
      handler_type: r.bytesToInt(4),
      reserved: [
        r.bytesToInt(4),
        r.bytesToInt(4),
        r.bytesToInt(4),
      ],
    };

    let remaining = r.getRemainingLength();
    ret.name = "";
    while (remaining--) {
      ret.name += String.fromCharCode(parseInt(r.bytesToInt(1), 10));
    }

    return ret;
  },
};
