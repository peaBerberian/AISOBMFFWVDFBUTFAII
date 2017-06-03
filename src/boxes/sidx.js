export default {
  name: "Segment Index Box",
  description: "Index of the media stream",

  parser(r) {
    const version = r.bytesToInt(1);
    const flags = r.bytesToInt(3);
    const reference_id = r.bytesToInt(4);
    const timescale = r.bytesToInt(4);
    const earliest_presentation_time =
      r.bytesToInt(version === 0 ? 4 : 8);
    const first_offset =
      r.bytesToInt(version === 0 ? 4 : 8);
    const reserved = r.bytesToInt(2);
    const reference_count = r.bytesToInt(2);

    const items = [];
    let i = reference_count;
    while(i--) {
      const first4Bytes = r.bytesToInt(4);
      const second4Bytes = r.bytesToInt(4);
      const third4Bytes = r.bytesToInt(4);
      items.push({
        reference_type: first4Bytes >> 31 & 0x01,
        referenced_size: first4Bytes & 0x7FFFFFFF,
        subsegment_duration: second4Bytes,
        starts_with_SAP: third4Bytes >> 31 & 0x01,
        SAP_type: third4Bytes >> 28 & 0x07,
        SAP_delta_time: third4Bytes & 0x0FFFFFFF,
      });
    }

    return {
      version,
      flags,
      reference_id,
      timescale,
      earliest_presentation_time,
      first_offset,
      reserved,
      reference_count,
      items,
    };
  },
};
