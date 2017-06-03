export default {
  name: "Track Fragment Header Box",
  description: "",

  parser(r) {
    const ret = {};

    ret.version = r.bytesToInt(1);
    const flags = r.bytesToInt(3);

    const hasBaseDataOffset = flags & 0x000001;
    const hasSampleDescriptionIndex = flags & 0x000002;
    const hasDefaultSampleDuration = flags & 0x000008;
    const hasDefaultSampleSize = flags & 0x000010;
    const hasDefaultSampleFlags = flags & 0x000020;
    const durationIsEmpty = flags & 0x010000;
    const defaultBaseIsMOOF = flags & 0x020000;

    ret.flags = {
      "base-data-offset-present": !!hasBaseDataOffset,
      "sample-description-index-present": !!hasSampleDescriptionIndex,
      "default-sample-duration-present": !!hasDefaultSampleDuration,
      "default-sample-size-present": !!hasDefaultSampleSize,
      "default-sample-flags-present": !!hasDefaultSampleFlags,
      "duration-is-empty": !!durationIsEmpty,
      "default-base-is-moof": !!defaultBaseIsMOOF,
    };

    ret.track_ID = r.bytesToInt(4);

    if (hasBaseDataOffset) {
      ret.base_data_offset = r.bytesToInt(8);
    }
    if (hasSampleDescriptionIndex) {
      ret.sample_description_index = r.bytesToInt(4);
    }
    if (hasDefaultSampleDuration) {
      ret.default_sample_duration = r.bytesToInt(4);
    }
    if (hasDefaultSampleSize) {
      ret.default_sample_size = r.bytesToInt(4);
    }
    if (hasDefaultSampleFlags) {
      ret.default_sample_flags = r.bytesToInt(4);
    }

    return ret;
  },
};
