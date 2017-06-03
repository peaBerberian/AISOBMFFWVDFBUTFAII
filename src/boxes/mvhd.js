export default {
  name: "Movie Header Box",
  description: "This box defines overall information which is " +
  "media‐independent, and relevant to the entire presentation " +
  "considered as a whole.",
  content: [
    {
      name: "version",
      description: "mvhd version",
      key: "version",
    },
    {
      name: "flags",
      description: "mvhd flags",
      key: "flags",
    },
    {
      name: "creation_time",
      description: "An integer that declares the creation time of the presentation (in seconds since midnight, Jan. 1, 1904, in UTC time)",
      key: "creationTime"
    },
    {
      name: "modification_time",
      description: "An integer that declares the most recent time the presentation was modified (in seconds since midnight, Jan. 1, 1904, in UTC time)",
      key: "modificationTime"
    },
    {
      name: "timescale",
      description: "An integer that specifies the time‐scale for the entire presentation; this is the number of time units that pass in one second. For example, a t me coordinate system that measures time in sixtieths of a second has a time scale of 60.",
      key: "timescale",
    },
    {
      name: "duration",
      description: "An integer that declares length of the presentation (in the indicated timescale). This property is derived from the presentation’s tracks: the value of this field corresponds to the duration of the longest track in the presentation. If the durat ion cannot be determined then duration is set to all 1s.",
      key: "duration",
    },
    {
      name: "rate",
      description: "A fixed point 16.16 number that indicates the preferred rate to play the presentation; 1.0 (0x00010000) is normal forward playback ",
      key: "rate",
    },
    {
      name: "volume",
      description: "A fixed point 8.8 number that indicates the preferred playback volume. 1.0 (0x0100) is full volume.",
      key: "volume",
    },
    {
      name: "reserved 1",
      description: "Reserved 16 bits",
      key: "reserved1",
    },
    {
      name: "reserved 2",
      description: "Reserved 2*32 bits",
      key: "reserved2",
    },
    {
      name: "matrix",
      description: "Provides a transformation matrix for the video; (u,v,w) are restricted here to (0,0,1), hex values (0,0,0x40000000).",
      key: "matrix",
    },
    {
      name: "pre-defined",
      description: "Pre-defined 32*6 bits.",
      key: "predefined",
    },
    {
      name: "next_track_ID",
      description: "A non‐zero integer that indicates a value to use for the track ID of the next track to be added to this presentation. Zero is not a valid track ID value. The value of next_track_ID shall be larger than the largest track‐ID in use. If this valu e is equal to all 1s (32‐bit maxint), and a new media track is to be added, then a s earch must be made in the file for an unused track identifier.",
      key: "nextTrackId",
    },
  ],

  parser: (reader) => {
    const version = reader.bytesToInt(1);
    if (version > 1) {
      throw new Error("invalid version");
    }

    const flags = reader.bytesToInt(3);

    let creationTime, modificationTime, timescale, duration;
    if (version === 1) {
      creationTime = reader.bytesToInt(8);
      modificationTime = reader.bytesToInt(8);
      timescale = reader.bytesToInt(4);
      duration = reader.bytesToInt(8);
    } else {
      creationTime = reader.bytesToInt(4);
      modificationTime = reader.bytesToInt(4);
      timescale = reader.bytesToInt(4);
      duration = reader.bytesToInt(4);
    }

    const rate = [
      reader.bytesToInt(2),
      reader.bytesToInt(2),
    ].join(".");

    const volume = [
      reader.bytesToInt(1),
      reader.bytesToInt(1),
    ].join(".");

    const reserved1 = reader.bytesToInt(2);
    const reserved2 = [
      reader.bytesToInt(4),
      reader.bytesToInt(4),
    ];

    const matrixArr = [];
    for (let i = 0; i < 9; i++) {
      matrixArr.push(reader.bytesToInt(4));
    }

    const predefined = [
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
      reader.bytesToInt(4),
    ];

    const nextTrackId = reader.bytesToInt(4);

    return {
      version,
      flags,
      creationTime,
      modificationTime,
      timescale,
      duration,
      rate,
      volume,
      reserved1,
      reserved2,
      matrix: matrixArr,
      predefined,
      nextTrackId,
    };
  },
};
