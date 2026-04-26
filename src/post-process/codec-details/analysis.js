import { getActualBoxSize } from "../../utils/box_size.js";
import { numberFormat } from "../../utils/format.js";
import {
  findBoxes,
  findFirstBox,
  getField,
  getFieldPrimitive,
  getNumberArrayField,
  getNumberField,
  getNumberFromStruct,
  getStringField,
  getStructArrayField,
  toNullableNumber,
} from "../box_access.js";
import {
  getAudioDescription,
  getCodecLabel,
  getDimensions,
  getHandlerType,
  isProtectedSampleEntry,
  normalizeTrackKind,
} from "../codec_meta.js";
import { formatBitrate, formatNumber } from "../format.js";

const MAX_ANALYZED_SAMPLES = 160;
const MAX_ANALYZED_NALS = 4000;

const AVC_NAL_TYPE_NAMES = new Map([
  [1, "non-IDR slice"],
  [2, "slice A"],
  [3, "slice B"],
  [4, "slice C"],
  [5, "IDR slice"],
  [6, "SEI"],
  [7, "SPS"],
  [8, "PPS"],
  [9, "AUD"],
  [10, "end of sequence"],
  [11, "end of stream"],
  [12, "filler"],
]);

const HEVC_NAL_TYPE_NAMES = new Map([
  [0, "TRAIL_N"],
  [1, "TRAIL_R"],
  [8, "RASL_N"],
  [9, "RASL_R"],
  [16, "BLA_W_LP"],
  [17, "BLA_W_RADL"],
  [18, "BLA_N_LP"],
  [19, "IDR_W_RADL"],
  [20, "IDR_N_LP"],
  [21, "CRA_NUT"],
  [32, "VPS"],
  [33, "SPS"],
  [34, "PPS"],
  [35, "AUD"],
  [39, "prefix SEI"],
  [40, "suffix SEI"],
]);

/**
 * @typedef {{
 *   title: string,
 *   trackLabel: string,
 *   codecLabel: string,
 *   description: string,
 *   codecFamily: "avc" | "hevc" | null,
 *   overviewFacts: Array<{ label: string, value: string, note: string | null }>,
 *   details: string[],
 *   parameterSets: Array<{ label: string, details: string[] }>,
 *   sampleFacts: Array<{ label: string, value: string, note: string | null }>,
 *   sampleDetails: string[],
 *   nalTypes: Array<{ label: string, count: number }>,
 *   sampleSequence: string[],
 *   issues: string[],
 * }} CodecTrackDetails
 *
 * @typedef {{
 *   sampleEntry: import("isobmff-inspector").ParsedBox,
 *   sampleDescriptionIndex: number,
 *   originalFormat: string | null,
 *   codecType: string | null | undefined,
 *   codecFamily: "avc" | "hevc" | null,
 *   avcC: import("isobmff-inspector").ParsedBox | null,
 *   hvcC: import("isobmff-inspector").ParsedBox | null,
 *   esds: import("isobmff-inspector").ParsedBox | null,
 *   dac3: import("isobmff-inspector").ParsedBox | null,
 *   dec3: import("isobmff-inspector").ParsedBox | null,
 *   dOps: import("isobmff-inspector").ParsedBox | null,
 * }} TrackSampleEntry
 *
 * @typedef {{ label: string, value: string, note: string | null }} CodecFact
 *
 * @typedef {{
 *   recognized: boolean,
 *   codecLabel: string | null,
 *   overviewFacts: CodecFact[],
 *   details: string[],
 *   issues: string[],
 * }} DerivedEntryCodecMetadata
 */

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {{
 *   bytes?: Uint8Array | null,
 *   supplementalBoxes?: Array<import("isobmff-inspector").ParsedBox> | null,
 * }} [options]
 * @returns {CodecTrackDetails[]}
 */
export default function deriveCodecDetails(boxes, options = {}) {
  if (!boxes.length) {
    return [];
  }

  const bytes = options.bytes ?? null;
  const supplementalBoxes = options.supplementalBoxes ?? [];
  const moov = findFirstBox(boxes, "moov");
  const supplementalMoov = moov
    ? null
    : findFirstBox(supplementalBoxes, "moov");
  const trexDefaults = getTrexDefaults(boxes);
  const trackSourceBoxes = moov
    ? [moov]
    : supplementalMoov
      ? [supplementalMoov]
      : boxes;
  const tracks = findBoxes(trackSourceBoxes, "trak");
  const fragments = findBoxes(boxes, "moof");
  /** @type {CodecTrackDetails[]} */
  const results = [];

  for (const trak of tracks) {
    const trackResult = deriveTrackCodecDetails(
      trak,
      boxes,
      fragments,
      trexDefaults,
      bytes,
    );
    if (trackResult) {
      results.push(trackResult);
    }
  }

  if (!results.length && findBoxes(boxes, "moof").length && !moov) {
    results.push({
      title: "media fragment",
      trackLabel: "media fragment",
      codecLabel: "track metadata not present in this segment",
      description: "fragment-only inspection",
      codecFamily: null,
      overviewFacts: [],
      details: [],
      parameterSets: [],
      sampleFacts: [],
      sampleDetails: [],
      nalTypes: [],
      sampleSequence: [],
      issues: [
        "This looks like a standalone media fragment without an init segment. Sample entry definitions and decoder configuration are usually carried in the init segment, so codec-specific analysis is limited here.",
      ],
    });
  }

  return results;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} trak
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {Array<import("isobmff-inspector").ParsedBox>} moofs
 * @param {Map<string, { defaultSampleDescriptionIndex: number | null, defaultSampleSize: number | null }>} trexDefaults
 * @param {Uint8Array | null} bytes
 * @returns {CodecTrackDetails | null}
 */
function deriveTrackCodecDetails(trak, boxes, moofs, trexDefaults, bytes) {
  const tkhd = findFirstBox([trak], "tkhd");
  const hdlr = findFirstBox([trak], "hdlr");
  const trackId = String(getNumberField(tkhd, "track_ID") ?? "?");
  const trackEntries = getTrackSampleEntries(trak);
  const handlerType = getHandlerType(hdlr);
  /** @type {TrackSampleEntry | undefined} */
  const chosenEntry =
    trackEntries.find((entry) => entry.codecFamily !== null) ??
    trackEntries.find(
      (entry) =>
        normalizeTrackKind(handlerType, entry.sampleEntry.type) !== "unknown",
    ) ??
    trackEntries[0];
  if (!chosenEntry) {
    return null;
  }
  const codecFamily = chosenEntry.codecFamily;
  const kind = normalizeTrackKind(handlerType, chosenEntry.sampleEntry.type);
  const codecMetadata = deriveSampleEntryCodecMetadata(chosenEntry);

  const codecLabel =
    codecMetadata.codecLabel ??
    getCodecLabel(chosenEntry.sampleEntry.type, chosenEntry.originalFormat, {
      avcC: chosenEntry.avcC,
      hvcC: chosenEntry.hvcC,
    });
  const protectedEntry = isProtectedSampleEntry(chosenEntry.sampleEntry.type);
  const dimensions = getDimensions(chosenEntry.sampleEntry, tkhd);
  const config =
    codecFamily === "avc"
      ? parseAvcConfigBox(chosenEntry.avcC)
      : codecFamily === "hevc"
        ? parseHevcConfigBox(chosenEntry.hvcC)
        : null;

  if (kind !== "video" || !codecFamily || !config) {
    return buildGenericTrackCodecDetails({
      trackId,
      kind,
      handlerType,
      chosenEntry,
      codecLabel,
      protectedEntry,
      dimensions,
      codecFamily,
      hasConfig: config !== null,
      codecMetadata,
    });
  }
  const detailedCodecFamily = /** @type {"avc" | "hevc"} */ (codecFamily);

  const regularSamples = buildRegularTrackSampleLocations(
    trak,
    chosenEntry.sampleDescriptionIndex,
  );
  const fragmentSamples = buildFragmentSampleLocations(
    boxes,
    moofs,
    trackId,
    chosenEntry.sampleDescriptionIndex,
    trexDefaults.get(trackId) ?? {
      defaultSampleDescriptionIndex: null,
      defaultSampleSize: null,
    },
  );
  const sampleLocations = [
    ...regularSamples.locations,
    ...fragmentSamples.locations,
  ];
  const sampleIssues = [...regularSamples.issues, ...fragmentSamples.issues];

  /** @type {Array<{ label: string, value: string, note: string | null }>} */
  const overviewFacts = [
    {
      label: "Sample Entry",
      value: chosenEntry.sampleEntry.type,
      note: "codec sample entry type from the container",
    },
    {
      label: "NAL Prefix",
      value: `${config.lengthSize}-byte`,
      note: "length field size used before each NAL unit in samples",
    },
  ];
  /** @type {string[]} */
  const details = [];
  details.push(
    chosenEntry.codecFamily === "avc"
      ? chosenEntry.codecType === "avc3"
        ? "avc3 sample entry: in-band SPS/PPS may be required"
        : "avc1 sample entry: parameter sets are expected out of band"
      : chosenEntry.codecType === "hev1"
        ? "hev1 sample entry: in-band VPS/SPS/PPS may be required"
        : "hvc1 sample entry: parameter sets are expected out of band",
  );
  if (dimensions) {
    overviewFacts.push({
      label: "Sample Entry Size",
      value: dimensions,
      note: "container-level display intent from the visual sample entry",
    });
  }
  if (protectedEntry) {
    details.push(
      "protected sample entry: raw sample bytes are likely encrypted",
    );
  }
  if (regularSamples.locations.length) {
    details.push(
      `mapped ${numberFormat(regularSamples.locations.length)} sample(s) from the regular sample tables`,
    );
  }
  if (fragmentSamples.locations.length) {
    details.push(
      `mapped ${numberFormat(fragmentSamples.locations.length)} sample(s) from movie fragments`,
    );
  }
  overviewFacts.push(...config.summaryFacts);

  const parameterSets = buildParameterSetSections(config, detailedCodecFamily);
  const sampleAnalysis =
    bytes && !protectedEntry && sampleLocations.length
      ? analyzeTrackSamples(
          bytes,
          sampleLocations,
          config.lengthSize,
          detailedCodecFamily,
        )
      : null;

  /** @type {Array<{ label: string, value: string, note: string | null }>} */
  const sampleFacts = [];
  /** @type {string[]} */
  const sampleDetails = [];
  if (!sampleLocations.length) {
    sampleDetails.push(
      "payload analysis unavailable because sample-to-byte mapping is incomplete in the current inspection metadata",
    );
  } else if (protectedEntry) {
    sampleDetails.push(
      "sample payload analysis unavailable because the selected samples are protected or encrypted",
    );
  } else if (!bytes) {
    sampleDetails.push(
      "sample payload analysis is deferred in this streaming-safe pass: config metadata is available, but the inspection did not retain full sample bytes for post-processing",
    );
    if (regularSamples.locations.length || fragmentSamples.locations.length) {
      sampleDetails.push(
        "the current track has mapped sample ranges, so later streaming-time capture or targeted rereads can deepen this analysis without whole-resource buffering",
      );
    }
  } else if (sampleAnalysis) {
    sampleFacts.push({
      label: "Analyzed Samples",
      value: numberFormat(sampleAnalysis.sampleCount),
      note: "decoded from mapped sample payload bytes in this inspection",
    });
    sampleFacts.push({
      label: "Analyzed NAL Units",
      value: numberFormat(sampleAnalysis.nalCount),
      note: "total length-prefixed NAL units inspected in the current window",
    });
    sampleFacts.push(...sampleAnalysis.summaryFacts);
    if (sampleLocations.length > sampleAnalysis.sampleCount) {
      sampleDetails.push(
        `window limited to the first ${numberFormat(sampleAnalysis.sampleCount)} mapped sample(s)`,
      );
    }
  }

  return {
    title: `${kind} track ${trackId}`,
    trackLabel: `track ${trackId}`,
    codecLabel,
    description: `${kind} track ${trackId} - ${detailedCodecFamily.toUpperCase()}`,
    codecFamily: detailedCodecFamily,
    overviewFacts,
    details,
    parameterSets,
    sampleFacts,
    sampleDetails,
    nalTypes: sampleAnalysis?.nalTypes ?? [],
    sampleSequence: sampleAnalysis?.sampleSequence ?? [],
    issues: [
      ...config.issues,
      ...sampleIssues,
      ...(sampleAnalysis?.issues ?? []),
    ],
  };
}

/**
 * @param {{
 *   trackId: string,
 *   kind: string,
 *   handlerType: string | null,
 *   chosenEntry: TrackSampleEntry,
 *   codecLabel: string,
 *   protectedEntry: boolean,
 *   dimensions: string | null,
 *   codecFamily: "avc" | "hevc" | null,
 *   hasConfig: boolean,
 *   codecMetadata: ReturnType<typeof deriveSampleEntryCodecMetadata>,
 * }} input
 */
function buildGenericTrackCodecDetails(input) {
  const {
    trackId,
    kind,
    handlerType,
    chosenEntry,
    codecLabel,
    protectedEntry,
    dimensions,
    codecFamily,
    hasConfig,
    codecMetadata,
  } = input;
  const audioDescription = getAudioDescription(chosenEntry.sampleEntry);
  const normalizedKind = kind === "unknown" ? "track" : `${kind} track`;
  /** @type {Array<{ label: string, value: string, note: string | null }>} */
  const overviewFacts = [
    {
      label: "Sample Entry",
      value: chosenEntry.sampleEntry.type,
      note: "codec sample entry type from the container",
    },
  ];
  if (chosenEntry.originalFormat) {
    overviewFacts.push({
      label: "Original Format",
      value: chosenEntry.originalFormat,
      note: "clear codec type declared behind the protected sample entry",
    });
  }
  if (audioDescription) {
    overviewFacts.push({
      label: "Audio Format",
      value: audioDescription,
      note: "container-level audio parameters from the sample entry",
    });
  }
  if (dimensions) {
    overviewFacts.push({
      label: "Sample Entry Size",
      value: dimensions,
      note: "container-level display intent from the visual sample entry",
    });
  }
  if (handlerType && kind === "unknown") {
    overviewFacts.push({
      label: "Handler",
      value: handlerType,
      note: "track handler type from the container metadata",
    });
  }
  overviewFacts.push(...codecMetadata.overviewFacts);

  /** @type {string[]} */
  const details = [];
  if (protectedEntry) {
    details.push(
      "protected sample entry: raw sample bytes are likely encrypted",
    );
  }
  if (codecFamily && !hasConfig) {
    details.push(
      `${chosenEntry.codecType ?? "selected"} sample entry is present, but its decoder configuration box is not available in the current track metadata`,
    );
  } else if (codecMetadata.recognized) {
    details.push(...codecMetadata.details);
  } else if (kind === "audio") {
    details.push(
      "sample-entry metadata is available for this audio track, but deep decoder-config parsing in this tab is not implemented for this codec family yet",
    );
  } else if (kind === "text") {
    details.push(
      "sample-entry metadata is available for this text track, but this tab does not yet decode text-sample-entry specific configuration details",
    );
  } else if (kind === "video") {
    details.push(
      "container metadata is available for this video track, but deep decoder-config parsing in this tab currently focuses on AVC and HEVC",
    );
  } else {
    details.push(
      "track-level codec metadata is available, but this tab has no deeper parser for the selected sample entry yet",
    );
  }
  if (kind !== "video") {
    details.push(
      "sample payload analysis is currently only implemented for AVC and HEVC length-prefixed video samples",
    );
  }

  return {
    title: `${normalizedKind} ${trackId}`,
    trackLabel: `track ${trackId}`,
    codecLabel,
    description:
      kind === "unknown"
        ? `track ${trackId} - metadata-only codec view`
        : `${kind} track ${trackId} - metadata-only codec view`,
    codecFamily: null,
    overviewFacts,
    details,
    parameterSets: [],
    sampleFacts: [],
    sampleDetails: [],
    nalTypes: [],
    sampleSequence: [],
    issues: [...codecMetadata.issues],
  };
}

/**
 * @param {TrackSampleEntry} chosenEntry
 * @returns {DerivedEntryCodecMetadata}
 */
function deriveSampleEntryCodecMetadata(chosenEntry) {
  switch (chosenEntry.codecType) {
    case "mp4a":
      return deriveMp4aCodecMetadata(chosenEntry.esds);
    case "ac-3":
      return deriveAc3CodecMetadata(chosenEntry.dac3);
    case "ec-3":
      return deriveEc3CodecMetadata(chosenEntry.dec3);
    case "Opus":
      return deriveOpusCodecMetadata(chosenEntry.dOps);
    default:
      return {
        recognized: false,
        codecLabel: null,
        overviewFacts: [],
        details: [],
        issues: [],
      };
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null} esds
 */
function deriveMp4aCodecMetadata(esds) {
  if (!esds) {
    return {
      recognized: true,
      codecLabel: null,
      overviewFacts: [],
      details: [],
      issues: [
        "mp4a sample entry is present, but its esds decoder configuration box is not available in the current track metadata",
      ],
    };
  }

  const descriptors = getStructArrayField(esds, "descriptors");
  const decoderConfig = findFirstDescriptorByTag(descriptors, 0x04);
  const decoderConfigPayload = getDescriptorPayload(decoderConfig);
  const objectTypeIndication = getStructNumberField(
    decoderConfigPayload,
    "object_type_indication",
  );
  const streamType = getStructNumberField(decoderConfigPayload, "stream_type");
  const maxBitrate = getStructNumberField(decoderConfigPayload, "max_bitrate");
  const avgBitrate = getStructNumberField(decoderConfigPayload, "avg_bitrate");
  const decoderSpecific = findFirstDescriptorByTag(descriptors, 0x05);
  const decoderSpecificPayload = getDescriptorPayload(decoderSpecific);
  const decoderSpecificBytes = decodeHexByteField(
    getStructFieldPrimitive(decoderSpecificPayload, "decoder_specific_info"),
  );
  const audioSpecificConfig = decoderSpecificBytes
    ? parseAacAudioSpecificConfig(decoderSpecificBytes)
    : null;
  const objectTypeLabel = formatMp4ObjectTypeIndication(objectTypeIndication);

  /** @type {Array<{ label: string, value: string, note: string | null }>} */
  const overviewFacts = [];
  /** @type {string[]} */
  const details = [];
  /** @type {string[]} */
  const issues = [];

  if (objectTypeLabel) {
    overviewFacts.push({
      label: "Object Type",
      value: objectTypeLabel,
      note: "MPEG-4 object type indication from the DecoderConfigDescriptor",
    });
  }
  if (audioSpecificConfig?.audioObjectTypeLabel) {
    overviewFacts.push({
      label: "Audio Object",
      value: audioSpecificConfig.audioObjectTypeLabel,
      note: "decoded from the AudioSpecificConfig payload in esds",
    });
  }
  if (audioSpecificConfig?.sampleRate != null) {
    overviewFacts.push({
      label: "Config Sample Rate",
      value: `${formatNumber(audioSpecificConfig.sampleRate)} Hz`,
      note: "sample rate declared in AudioSpecificConfig",
    });
  }
  if (audioSpecificConfig?.channelLayout) {
    overviewFacts.push({
      label: "Config Channels",
      value: audioSpecificConfig.channelLayout,
      note: "channel configuration declared in AudioSpecificConfig",
    });
  }
  if (avgBitrate != null) {
    overviewFacts.push({
      label: "Average Bitrate",
      value: formatBitrate(avgBitrate),
      note: "average bitrate from the DecoderConfigDescriptor",
    });
  }
  if (maxBitrate != null) {
    overviewFacts.push({
      label: "Max Bitrate",
      value: formatBitrate(maxBitrate),
      note: "maximum bitrate from the DecoderConfigDescriptor",
    });
  }

  if (streamType != null) {
    details.push(
      `stream type ${formatMp4StreamType(streamType)} in the DecoderConfigDescriptor`,
    );
  }
  if (decoderSpecificBytes) {
    details.push(
      `AudioSpecificConfig present (${numberFormat(decoderSpecificBytes.length)} byte${decoderSpecificBytes.length === 1 ? "" : "s"})`,
    );
  } else {
    issues.push(
      "esds is present, but no decoder-specific AudioSpecificConfig payload could be extracted from it",
    );
  }
  if (audioSpecificConfig?.sbrPresent) {
    details.push("SBR extension signaled in AudioSpecificConfig");
  }
  if (audioSpecificConfig?.psPresent) {
    details.push("Parametric Stereo extension signaled in AudioSpecificConfig");
  }
  if (audioSpecificConfig?.extensionAudioObjectTypeLabel) {
    details.push(
      `extension audio object ${audioSpecificConfig.extensionAudioObjectTypeLabel}`,
    );
  }

  return {
    recognized: true,
    codecLabel:
      objectTypeIndication === 0x40 && audioSpecificConfig?.audioObjectType
        ? `mp4a.40.${audioSpecificConfig.audioObjectType}`
        : null,
    overviewFacts,
    details,
    issues,
  };
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null} dac3
 */
function deriveAc3CodecMetadata(dac3) {
  if (!dac3) {
    return {
      recognized: true,
      codecLabel: null,
      overviewFacts: [],
      details: [],
      issues: [
        "ac-3 sample entry is present, but its dac3 decoder configuration box is not available in the current track metadata",
      ],
    };
  }

  const sampleRate = getAc3SampleRate(getNumberField(dac3, "fscod"));
  const channelMode = getAc3ChannelMode(getNumberField(dac3, "acmod"));
  const lfe = getNumberField(dac3, "lfeon") === 1;
  const bitrate = getNumberField(dac3, "data_rate_kbps");
  /** @type {CodecFact[]} */
  const overviewFacts = [];
  if (sampleRate != null) {
    overviewFacts.push({
      label: "Sample Rate",
      value: `${formatNumber(sampleRate)} Hz`,
      note: "derived from the AC-3 decoder configuration",
    });
  }
  if (channelMode) {
    overviewFacts.push({
      label: "Channel Mode",
      value: formatChannelModeWithLfe(channelMode, lfe),
      note: "channel mode and LFE flag from dac3",
    });
  }
  if (bitrate != null) {
    overviewFacts.push({
      label: "Bitrate",
      value: `${numberFormat(bitrate)} kbps`,
      note: "declared AC-3 data rate from dac3",
    });
  }

  return {
    recognized: true,
    codecLabel: null,
    overviewFacts,
    details: [
      `bitstream identification bsid ${getNumberField(dac3, "bsid") ?? "?"}`,
      `bitstream mode ${formatAc3BitstreamMode(getNumberField(dac3, "bsmod"))}`,
    ],
    issues: [],
  };
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null} dec3
 */
function deriveEc3CodecMetadata(dec3) {
  if (!dec3) {
    return {
      recognized: true,
      codecLabel: null,
      overviewFacts: [],
      details: [],
      issues: [
        "ec-3 sample entry is present, but its dec3 decoder configuration box is not available in the current track metadata",
      ],
    };
  }

  const substreams = getStructArrayField(dec3, "substreams");
  const firstSubstream = substreams[0];
  const sampleRate = getAc3SampleRate(
    getStructNumberField(firstSubstream, "fscod"),
  );
  const channelMode = getAc3ChannelMode(
    getStructNumberField(firstSubstream, "acmod"),
  );
  const lfe = getStructNumberField(firstSubstream, "lfeon") === 1;
  const dataRate = getNumberField(dec3, "data_rate");
  const extension = getField(dec3, "ec3_extension");
  const extensionStruct = extension?.kind === "struct" ? extension : null;
  const extensionTypeA =
    getStructNumberField(extensionStruct, "flag_ec3_extension_type_a") === 1;
  /** @type {CodecFact[]} */
  const overviewFacts = [
    {
      label: "Independent Substreams",
      value: numberFormat(substreams.length),
      note: "count of independent substreams signaled in dec3",
    },
  ];
  if (sampleRate != null) {
    overviewFacts.push({
      label: "Sample Rate",
      value: `${formatNumber(sampleRate)} Hz`,
      note: "derived from the first EC-3 independent substream",
    });
  }
  if (channelMode) {
    overviewFacts.push({
      label: "Primary Substream",
      value: formatChannelModeWithLfe(channelMode, lfe),
      note: "channel mode and LFE flag from the first dec3 substream",
    });
  }
  if (dataRate != null) {
    overviewFacts.push({
      label: "Data Rate",
      value: `${numberFormat(dataRate)} kbps`,
      note: "declared EC-3 data rate from dec3",
    });
  }
  /** @type {string[]} */
  const details = [
    `first independent substream bsid ${getStructNumberField(firstSubstream, "bsid") ?? "?"}, mode ${formatAc3BitstreamMode(getStructNumberField(firstSubstream, "bsmod"))}`,
  ];
  if (extensionTypeA) {
    details.push(
      "EC-3 extension type A is signaled, which is commonly used for Atmos/JOC carriage",
    );
  }

  return {
    recognized: true,
    codecLabel: null,
    overviewFacts,
    details,
    issues: [],
  };
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null} dOps
 */
function deriveOpusCodecMetadata(dOps) {
  if (!dOps) {
    return {
      recognized: true,
      codecLabel: null,
      overviewFacts: [],
      details: [],
      issues: [
        "Opus sample entry is present, but its dOps decoder configuration box is not available in the current track metadata",
      ],
    };
  }

  const channelCount = getNumberField(dOps, "OutputChannelCount");
  const inputSampleRate = getNumberField(dOps, "InputSampleRate");
  const preSkip = getNumberField(dOps, "PreSkip");
  const gain = getNumberField(dOps, "OutputGain");
  const mappingFamily = getNumberField(dOps, "ChannelMappingFamily");
  const streamCount = getNumberField(dOps, "StreamCount");
  const coupledCount = getNumberField(dOps, "CoupledCount");
  /** @type {CodecFact[]} */
  const overviewFacts = [];
  if (channelCount != null) {
    overviewFacts.push({
      label: "Output Channels",
      value: numberFormat(channelCount),
      note: "decoded from the Opus dOps box",
    });
  }
  if (inputSampleRate != null) {
    overviewFacts.push({
      label: "Input Sample Rate",
      value: `${formatNumber(inputSampleRate)} Hz`,
      note: "original input sample rate declared in dOps",
    });
  }
  if (preSkip != null) {
    overviewFacts.push({
      label: "Pre-skip",
      value: numberFormat(preSkip),
      note: "initial samples to discard before normal output",
    });
  }
  if (mappingFamily != null) {
    overviewFacts.push({
      label: "Mapping Family",
      value: String(mappingFamily),
      note: "Opus channel mapping family from dOps",
    });
  }
  /** @type {string[]} */
  const details = [];
  if (gain != null && gain !== 0) {
    details.push(`output gain ${gain} Q8 dB units`);
  }
  if (streamCount != null) {
    details.push(
      `stream count ${streamCount}${coupledCount == null ? "" : `, coupled streams ${coupledCount}`}`,
    );
  }

  return {
    recognized: true,
    codecLabel: null,
    overviewFacts,
    details,
    issues: [],
  };
}

/**
 * @param {Array<Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }>>} descriptors
 * @param {number} tag
 * @returns {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | null}
 */
function findFirstDescriptorByTag(descriptors, tag) {
  for (const descriptor of descriptors) {
    if (getStructNumberField(descriptor, "tag") === tag) {
      return descriptor;
    }
    const nested = getNestedDescriptors(descriptor);
    const nestedMatch = findFirstDescriptorByTag(nested, tag);
    if (nestedMatch) {
      return nestedMatch;
    }
  }
  return null;
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | null | undefined} descriptor
 * @returns {Array<Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }>>}
 */
function getNestedDescriptors(descriptor) {
  const payload = getDescriptorPayload(descriptor);
  const descriptorsField = getStructField(payload, "descriptors");
  if (descriptorsField?.kind !== "array") {
    return [];
  }
  return descriptorsField.items.filter((item) => item.kind === "struct");
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | null | undefined} descriptor
 */
function getDescriptorPayload(descriptor) {
  const payload = getStructField(descriptor, "payload");
  return payload?.kind === "struct" ? payload : null;
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | null | undefined} struct
 * @param {string} key
 */
function getStructField(struct, key) {
  return struct?.fields.find((field) => field.key === key) ?? null;
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | null | undefined} struct
 * @param {string} key
 */
function getStructFieldPrimitive(struct, key) {
  return getFieldPrimitive(getStructField(struct, key));
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }> | null | undefined} struct
 * @param {string} key
 */
function getStructNumberField(struct, key) {
  return toNullableNumber(getStructFieldPrimitive(struct, key));
}

/**
 * @param {unknown} value
 * @returns {Uint8Array | null}
 */
function decodeHexByteField(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof value !== "string" || value.length % 2 !== 0) {
    return null;
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    const parsed = Number.parseInt(value.slice(index, index + 2), 16);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    bytes[index / 2] = parsed;
  }
  return bytes;
}

/**
 * @param {Uint8Array} bytes
 */
function parseAacAudioSpecificConfig(bytes) {
  let bitOffset = 0;
  /**
   * @param {number} bitCount
   */
  function readBits(bitCount) {
    if (bitOffset + bitCount > bytes.length * 8) {
      return null;
    }
    let value = 0;
    for (let index = 0; index < bitCount; index++) {
      const absoluteBit = bitOffset + index;
      const currentByte = bytes[absoluteBit >> 3];
      const shift = 7 - (absoluteBit & 7);
      value = (value << 1) | ((currentByte >> shift) & 1);
    }
    bitOffset += bitCount;
    return value;
  }
  function readAudioObjectType() {
    const value = readBits(5);
    if (value == null) {
      return null;
    }
    if (value !== 31) {
      return value;
    }
    const extended = readBits(6);
    return extended == null ? null : 32 + extended;
  }

  const audioObjectType = readAudioObjectType();
  const samplingFrequencyIndex = readBits(4);
  const sampleRate =
    samplingFrequencyIndex === 15
      ? readBits(24)
      : getAacSamplingRate(samplingFrequencyIndex);
  const channelConfiguration = readBits(4);
  if (
    audioObjectType == null ||
    samplingFrequencyIndex == null ||
    channelConfiguration == null
  ) {
    return null;
  }

  let extensionSampleRate = null;
  let extensionAudioObjectType = null;
  if (audioObjectType === 5 || audioObjectType === 29) {
    const extensionSamplingIndex = readBits(4);
    extensionSampleRate =
      extensionSamplingIndex === 15
        ? readBits(24)
        : getAacSamplingRate(extensionSamplingIndex);
    extensionAudioObjectType = readAudioObjectType();
  }

  return {
    audioObjectType,
    audioObjectTypeLabel: formatAacAudioObjectType(audioObjectType),
    sampleRate,
    channelConfiguration,
    channelLayout: formatAacChannelConfiguration(channelConfiguration),
    extensionSampleRate,
    extensionAudioObjectType,
    extensionAudioObjectTypeLabel:
      extensionAudioObjectType == null
        ? null
        : formatAacAudioObjectType(extensionAudioObjectType),
    sbrPresent: audioObjectType === 5,
    psPresent: audioObjectType === 29,
  };
}

/**
 * @param {number | null} value
 */
function getAacSamplingRate(value) {
  switch (value) {
    case 0:
      return 96000;
    case 1:
      return 88200;
    case 2:
      return 64000;
    case 3:
      return 48000;
    case 4:
      return 44100;
    case 5:
      return 32000;
    case 6:
      return 24000;
    case 7:
      return 22050;
    case 8:
      return 16000;
    case 9:
      return 12000;
    case 10:
      return 11025;
    case 11:
      return 8000;
    case 12:
      return 7350;
    default:
      return null;
  }
}

/**
 * @param {number} value
 */
function formatAacAudioObjectType(value) {
  const name = new Map([
    [1, "AAC Main"],
    [2, "AAC LC"],
    [3, "AAC SSR"],
    [4, "AAC LTP"],
    [5, "SBR"],
    [6, "AAC Scalable"],
    [17, "ER AAC LC"],
    [19, "ER AAC LTP"],
    [20, "ER AAC Scalable"],
    [22, "ER BSAC"],
    [23, "ER AAC LD"],
    [29, "PS"],
    [39, "ER AAC ELD"],
    [42, "USAC"],
  ]).get(value);
  return name ? `${name} (${value})` : String(value);
}

/**
 * @param {number} value
 */
function formatAacChannelConfiguration(value) {
  switch (value) {
    case 0:
      return "program config element";
    case 1:
      return "mono";
    case 2:
      return "stereo";
    case 3:
      return "3.0";
    case 4:
      return "4.0";
    case 5:
      return "5.0";
    case 6:
      return "5.1";
    case 7:
      return "7.1";
    default:
      return String(value);
  }
}

/**
 * @param {number | null} value
 */
function formatMp4ObjectTypeIndication(value) {
  if (value == null) {
    return null;
  }
  const name = new Map([
    [0x40, "MPEG-4 Audio"],
    [0x66, "MPEG-2 AAC Main"],
    [0x67, "MPEG-2 AAC LC"],
    [0x68, "MPEG-2 AAC SSR"],
    [0x69, "MPEG-2 Audio"],
    [0x6b, "MPEG-1 Audio"],
  ]).get(value);
  return name
    ? `${name} (0x${value.toString(16).toUpperCase()})`
    : `0x${value.toString(16).toUpperCase()}`;
}

/**
 * @param {number | null} value
 */
function formatMp4StreamType(value) {
  switch (value) {
    case 4:
      return "visual";
    case 5:
      return "audio";
    case 13:
      return "scene description";
    default:
      return String(value);
  }
}

/**
 * @param {number | null} value
 */
function getAc3SampleRate(value) {
  switch (value) {
    case 0:
      return 48000;
    case 1:
      return 44100;
    case 2:
      return 32000;
    default:
      return null;
  }
}

/**
 * @param {number | null} value
 */
function getAc3ChannelMode(value) {
  switch (value) {
    case 0:
      return { label: "dual mono", channels: 2 };
    case 1:
      return { label: "mono", channels: 1 };
    case 2:
      return { label: "stereo", channels: 2 };
    case 3:
      return { label: "3.0", channels: 3 };
    case 4:
      return { label: "2.1", channels: 3 };
    case 5:
      return { label: "3.1", channels: 4 };
    case 6:
      return { label: "4.0", channels: 4 };
    case 7:
      return { label: "5.0", channels: 5 };
    default:
      return null;
  }
}

/**
 * @param {{ label: string, channels: number }} channelMode
 * @param {boolean} hasLfe
 */
function formatChannelModeWithLfe(channelMode, hasLfe) {
  const totalChannels = channelMode.channels + (hasLfe ? 1 : 0);
  return `${channelMode.label}${hasLfe ? " + LFE" : ""} (${totalChannels} ch)`;
}

/**
 * @param {number | null} value
 */
function formatAc3BitstreamMode(value) {
  switch (value) {
    case 0:
      return "complete main";
    case 1:
      return "music and effects";
    case 2:
      return "visually impaired";
    case 3:
      return "hearing impaired";
    case 4:
      return "dialogue";
    case 5:
      return "commentary";
    case 6:
      return "emergency";
    case 7:
      return "voice-over / karaoke";
    default:
      return value == null ? "unknown" : String(value);
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox} trak
 * @returns {TrackSampleEntry[]}
 */
export function getTrackSampleEntries(trak) {
  const stsd = findFirstBox([trak], "stsd");
  if (!stsd?.children?.length) {
    return [];
  }

  return stsd.children.map((sampleEntry, index) => {
    const originalFormat = getStringField(
      findFirstBox([sampleEntry], "frma"),
      "original_format",
    );
    const codecType = isProtectedSampleEntry(sampleEntry.type)
      ? originalFormat
      : sampleEntry.type;
    return {
      sampleEntry,
      sampleDescriptionIndex: index + 1,
      originalFormat,
      codecType,
      codecFamily:
        codecType === "avc1" || codecType === "avc3"
          ? "avc"
          : codecType === "hvc1" || codecType === "hev1"
            ? "hevc"
            : null,
      avcC: findFirstBox([sampleEntry], "avcC"),
      hvcC: findFirstBox([sampleEntry], "hvcC"),
      esds: findFirstBox([sampleEntry], "esds"),
      dac3: findFirstBox([sampleEntry], "dac3"),
      dec3: findFirstBox([sampleEntry], "dec3"),
      dOps: findFirstBox([sampleEntry], "dOps"),
    };
  });
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 */
export function getTrexDefaults(boxes) {
  const defaults = new Map();
  for (const trex of findBoxes(boxes, "trex")) {
    const trackId = getNumberField(trex, "track_ID");
    if (trackId == null) {
      continue;
    }
    defaults.set(String(trackId), {
      defaultSampleDescriptionIndex: getNumberField(
        trex,
        "default_sample_description_index",
      ),
      defaultSampleSize: getNumberField(trex, "default_sample_size"),
    });
  }
  return defaults;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} trak
 * @param {number} sampleDescriptionIndex
 */
export function buildRegularTrackSampleLocations(trak, sampleDescriptionIndex) {
  const stsc = findFirstBox([trak], "stsc");
  const stsz = findFirstBox([trak], "stsz");
  const stco = findFirstBox([trak], "stco");
  const co64 = findFirstBox([trak], "co64");
  /** @type {{ index: number, offset: number, size: number }[]} */
  const locations = [];
  /** @type {string[]} */
  const issues = [];
  if (!stsc || !stsz || (!stco && !co64)) {
    return { locations, issues };
  }

  const chunkOffsets = stco
    ? getNumberArrayField(stco, "chunk_offsets")
    : getNumberArrayField(co64, "chunk_offsets");
  const stscEntries = [];
  for (const entry of getStructArrayField(stsc, "entries")) {
    const firstChunk = getNumberFromStruct(entry, "first_chunk");
    const samplesPerChunk = getNumberFromStruct(entry, "samples_per_chunk");
    const descriptionIndex = getNumberFromStruct(
      entry,
      "sample_description_index",
    );
    if (
      firstChunk == null ||
      samplesPerChunk == null ||
      descriptionIndex == null
    ) {
      continue;
    }
    stscEntries.push({
      firstChunk,
      samplesPerChunk,
      descriptionIndex,
    });
  }
  const sampleSizes = getSampleSizes(stsz);

  if (!chunkOffsets.length || !stscEntries.length || !sampleSizes.length) {
    return { locations, issues };
  }

  let sampleIndex = 0;
  for (let entryIndex = 0; entryIndex < stscEntries.length; entryIndex++) {
    const entry = stscEntries[entryIndex];
    const nextFirstChunk =
      stscEntries[entryIndex + 1]?.firstChunk ?? chunkOffsets.length + 1;
    for (
      let chunkIndex = entry.firstChunk;
      chunkIndex < nextFirstChunk && chunkIndex <= chunkOffsets.length;
      chunkIndex++
    ) {
      let sampleOffset = chunkOffsets[chunkIndex - 1];
      for (
        let chunkSampleIndex = 0;
        chunkSampleIndex < entry.samplesPerChunk &&
        sampleIndex < sampleSizes.length;
        chunkSampleIndex++
      ) {
        const sampleSize = sampleSizes[sampleIndex];
        if (entry.descriptionIndex === sampleDescriptionIndex) {
          locations.push({
            index: sampleIndex + 1,
            offset: sampleOffset,
            size: sampleSize,
          });
        }
        sampleOffset += sampleSize;
        sampleIndex++;
      }
    }
  }

  if (sampleIndex < sampleSizes.length) {
    issues.push("sample tables ended before all declared samples were mapped");
  }

  return { locations, issues };
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {Array<import("isobmff-inspector").ParsedBox>} moofs
 * @param {string} trackId
 * @param {number} sampleDescriptionIndex
 * @param {{ defaultSampleDescriptionIndex: number | null, defaultSampleSize: number | null }} trexDefaults
 * @param {number | undefined} [defaultPayloadOffsetOverride]
 */
export function buildFragmentSampleLocations(
  boxes,
  moofs,
  trackId,
  sampleDescriptionIndex,
  trexDefaults,
  defaultPayloadOffsetOverride = undefined,
) {
  /** @type {{ index: number, offset: number, size: number }[]} */
  const locations = [];
  /** @type {string[]} */
  const issues = [];
  let sampleIndex = 1;

  for (const moof of moofs) {
    const moofStart = moof.offset;
    const moofEnd = moof.offset + getActualBoxSize(moof);
    const defaultPayloadOffset =
      defaultPayloadOffsetOverride ??
      findFollowingMdatPayloadOffset(boxes, moofEnd) ??
      moofEnd;

    for (const traf of moof.children?.filter(
      (child) => child.type === "traf",
    ) ?? []) {
      const tfhd = findFirstBox([traf], "tfhd");
      if (String(getNumberField(tfhd, "track_ID") ?? "") !== trackId) {
        continue;
      }

      const fragmentDescriptionIndex =
        getNumberField(tfhd, "sample_description_index") ??
        trexDefaults.defaultSampleDescriptionIndex ??
        1;
      if (fragmentDescriptionIndex !== sampleDescriptionIndex) {
        continue;
      }

      const baseDataOffset = getNumberField(tfhd, "base_data_offset");
      const dataBase = baseDataOffset ?? moofStart;
      const defaultSampleSize =
        getNumberField(tfhd, "default_sample_size") ??
        trexDefaults.defaultSampleSize;
      let currentOffset = defaultPayloadOffset;

      for (const trun of findBoxes([traf], "trun")) {
        const trunSamples = getStructArrayField(trun, "samples");
        const trunSampleCount =
          getNumberField(trun, "sample_count") ?? trunSamples.length;
        const explicitDataOffset = getNumberField(trun, "data_offset");
        if (explicitDataOffset != null) {
          currentOffset = dataBase + explicitDataOffset;
        }

        for (let trunIndex = 0; trunIndex < trunSampleCount; trunIndex++) {
          const sample = trunSamples[trunIndex];
          const sampleSize =
            getNumberFromStruct(sample, "sample_size") ?? defaultSampleSize;
          if (sampleSize == null) {
            issues.push(
              `fragment track ${trackId} has samples without known size`,
            );
            break;
          }
          locations.push({
            index: sampleIndex,
            offset: currentOffset,
            size: sampleSize,
          });
          sampleIndex++;
          currentOffset += sampleSize;
        }
      }
    }
  }

  return { locations, issues };
}

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 * @param {number} afterOffset
 */
function findFollowingMdatPayloadOffset(boxes, afterOffset) {
  for (const box of boxes) {
    if (box.type !== "mdat" || box.offset < afterOffset) {
      continue;
    }
    return box.offset + box.headerSize;
  }
  return null;
}

/**
 * @param {import("isobmff-inspector").ParsedBox} stsz
 */
function getSampleSizes(stsz) {
  const defaultSampleSize = getNumberField(stsz, "sample_size") ?? 0;
  const sampleCount = getNumberField(stsz, "sample_count") ?? 0;
  if (defaultSampleSize > 0 && sampleCount > 0) {
    return Array.from({ length: sampleCount }, () => defaultSampleSize);
  }
  return getNumberArrayField(stsz, "entries");
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null} avcC
 */
export function parseAvcConfigBox(avcC) {
  if (!avcC) {
    return null;
  }
  const lengthSize = (getNumberField(avcC, "lengthSizeMinusOne") ?? 0) + 1;
  const sps = getParameterSetArray(avcC, "sequenceParameterSets").map((entry) =>
    parseAvcParameterSet("SPS", entry.data),
  );
  const pps = getParameterSetArray(avcC, "pictureParameterSets").map((entry) =>
    parseAvcParameterSet("PPS", entry.data),
  );

  const firstSps = /** @type {ReturnType<typeof parseAvcSps> | null} */ (
    sps.find((entry) => entry.parsed !== null)?.parsed ?? null
  );
  return {
    lengthSize,
    summaryFacts: buildAvcSummaryFacts(firstSps),
    summary: [],
    parameterSets: [...sps, ...pps],
    issues: [],
  };
}

/**
 * @param {import("isobmff-inspector").ParsedBox | null} hvcC
 */
export function parseHevcConfigBox(hvcC) {
  if (!hvcC) {
    return null;
  }
  const chromaFormat = getNumberField(hvcC, "chromaFormat") ?? 0;
  const bitDepthLuma = (getNumberField(hvcC, "bitDepthLumaMinus8") ?? 0) + 8;
  const bitDepthChroma =
    (getNumberField(hvcC, "bitDepthChromaMinus8") ?? 0) + 8;
  const lengthSize = (getNumberField(hvcC, "lengthSizeMinusOne") ?? 0) + 1;
  /** @type {Array<ReturnType<typeof parseHevcParameterSet>>} */
  const parameterSets = [];
  for (const arrayEntry of getHevcParameterSetArrays(hvcC)) {
    for (const nalEntry of arrayEntry.nalus) {
      parameterSets.push(
        parseHevcParameterSet(arrayEntry.nalUnitType, nalEntry.data),
      );
    }
  }

  const firstSps = /** @type {ReturnType<typeof parseHevcSps> | null} */ (
    parameterSets.find(
      (entry) => entry.label === "SPS" && entry.parsed !== null,
    )?.parsed ?? null
  );
  return {
    lengthSize,
    summaryFacts: buildHevcSummaryFacts({
      chromaFormat,
      bitDepthLuma,
      bitDepthChroma,
      firstSps,
    }),
    summary: [],
    parameterSets,
    issues: [],
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ index: number, offset: number, size: number }[]} sampleLocations
 * @param {number} lengthSize
 * @param {"avc" | "hevc"} codecFamily
 */
function analyzeTrackSamples(bytes, sampleLocations, lengthSize, codecFamily) {
  /** @type {Map<string, number>} */
  const nalTypeCounts = new Map();
  /** @type {string[]} */
  const issues = [];
  /** @type {Map<string, number>} */
  const sampleClassCounts = new Map();
  /** @type {string[]} */
  const sampleSequence = [];
  let idrSamples = 0;
  let craSamples = 0;
  let irapSamples = 0;
  let samplesWithParameterSets = 0;
  let sampleCount = 0;
  let nalCount = 0;

  for (const sample of sampleLocations.slice(0, MAX_ANALYZED_SAMPLES)) {
    if (nalCount >= MAX_ANALYZED_NALS) {
      break;
    }
    if (
      sample.offset < 0 ||
      sample.size < 0 ||
      sample.offset + sample.size > bytes.length
    ) {
      issues.push(`sample ${sample.index} points outside the inspected bytes`);
      continue;
    }
    const sampleBytes = bytes.subarray(
      sample.offset,
      sample.offset + sample.size,
    );
    const split = splitLengthPrefixedNals(sampleBytes, lengthSize);
    if (split.truncated) {
      issues.push(`sample ${sample.index} ends in a truncated NAL unit`);
    }

    let sampleHasParameterSets = false;
    let sampleHasIdr = false;
    let sampleHasCra = false;
    let sampleHasIrap = false;
    let sampleClass = null;

    for (const nal of split.nals) {
      nalCount++;
      if (codecFamily === "avc") {
        const type = nal[0] & 0x1f;
        const name = AVC_NAL_TYPE_NAMES.get(type) ?? `type ${type}`;
        nalTypeCounts.set(name, (nalTypeCounts.get(name) ?? 0) + 1);
        if (type === 5) {
          sampleHasIdr = true;
        }
        if (type === 7 || type === 8) {
          sampleHasParameterSets = true;
        }
        if (sampleClass === null && (type === 1 || type === 2 || type === 5)) {
          sampleClass = parseAvcSliceType(nal);
        }
      } else {
        const type = (nal[0] >> 1) & 0x3f;
        const name = HEVC_NAL_TYPE_NAMES.get(type) ?? `type ${type}`;
        nalTypeCounts.set(name, (nalTypeCounts.get(name) ?? 0) + 1);
        if (type === 19 || type === 20) {
          sampleHasIdr = true;
        }
        if (type === 21) {
          sampleHasCra = true;
        }
        if (type >= 16 && type <= 23) {
          sampleHasIrap = true;
        }
        if (type === 32 || type === 33 || type === 34) {
          sampleHasParameterSets = true;
        }
      }
      if (nalCount >= MAX_ANALYZED_NALS) {
        break;
      }
    }

    sampleCount++;
    if (sampleHasParameterSets) {
      samplesWithParameterSets++;
    }
    if (sampleHasIdr) {
      idrSamples++;
    }
    if (sampleHasCra) {
      craSamples++;
    }
    if (sampleHasIrap) {
      irapSamples++;
    }
    if (sampleClass) {
      sampleClassCounts.set(
        sampleClass,
        (sampleClassCounts.get(sampleClass) ?? 0) + 1,
      );
    }
    if (sampleSequence.length < 48) {
      if (codecFamily === "avc" && sampleClass) {
        sampleSequence.push(sampleHasIdr ? `${sampleClass}*` : sampleClass);
      } else if (codecFamily === "hevc") {
        sampleSequence.push(
          sampleHasIdr
            ? "IDR"
            : sampleHasCra
              ? "CRA"
              : sampleHasIrap
                ? "IRAP"
                : "other",
        );
      }
    }
  }

  return {
    sampleCount,
    nalCount,
    summaryFacts: buildSampleSummaryFacts({
      codecFamily,
      idrSamples,
      craSamples,
      irapSamples,
      samplesWithParameterSets,
      sampleClassCounts,
    }),
    summary: [],
    issues,
    nalTypes: [...nalTypeCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([label, count]) => ({ label, count })),
    sampleSequence,
  };
}

/**
 * @param {Uint8Array} sampleBytes
 * @param {number} lengthSize
 */
export function splitLengthPrefixedNals(sampleBytes, lengthSize) {
  /** @type {Uint8Array[]} */
  const nals = [];
  let offset = 0;
  let truncated = false;
  while (offset + lengthSize <= sampleBytes.length) {
    const nalLength = readUint(sampleBytes, offset, lengthSize);
    offset += lengthSize;
    if (nalLength === 0) {
      continue;
    }
    if (offset + nalLength > sampleBytes.length) {
      truncated = true;
      break;
    }
    nals.push(sampleBytes.subarray(offset, offset + nalLength));
    offset += nalLength;
  }
  if (offset !== sampleBytes.length) {
    truncated = true;
  }
  return { nals, truncated };
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 * @param {string} key
 */
function getParameterSetArray(box, key) {
  const field = getField(box, key);
  if (field?.kind !== "array") {
    return [];
  }
  return field.items
    .map((item) => {
      if (item.kind !== "struct") {
        return null;
      }
      const data = getStructBytes(item, "data");
      if (!data) {
        return null;
      }
      return {
        length: getNumberFromStruct(item, "length") ?? data.length,
        data,
      };
    })
    .filter((entry) => entry !== null);
}

/**
 * @param {import("isobmff-inspector").ParsedBox} hvcC
 */
function getHevcParameterSetArrays(hvcC) {
  const field = getField(hvcC, "arrays");
  if (field?.kind !== "array") {
    return [];
  }
  return field.items
    .map((item) => {
      if (item.kind !== "struct") {
        return null;
      }
      const nalusField = item.fields.find((entry) => entry.key === "nalus");
      if (nalusField?.kind !== "array") {
        return null;
      }
      const nalus = nalusField.items
        .map((nalItem) => {
          if (nalItem.kind !== "struct") {
            return null;
          }
          const data = getStructBytes(nalItem, "data");
          if (!data) {
            return null;
          }
          return {
            length: getNumberFromStruct(nalItem, "length") ?? data.length,
            data,
          };
        })
        .filter((entry) => entry !== null);
      return {
        nalUnitType: getNumberFromStruct(item, "NAL_unit_type") ?? -1,
        nalus,
      };
    })
    .filter((entry) => entry !== null);
}

/**
 * @param {Extract<import("isobmff-inspector").ParsedField, { kind: "struct" }>} struct
 * @param {string} key
 */
function getStructBytes(struct, key) {
  const field = struct.fields.find((item) => item.key === key);
  const value = getFieldPrimitive(field);
  return typeof value === "string" ? hexToBytes(value) : null;
}

/**
 * @param {string} hex
 */
function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    const byte = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (!Number.isFinite(byte)) {
      return null;
    }
    bytes[index] = byte;
  }
  return bytes;
}

/**
 * @param {"SPS" | "PPS"} label
 * @param {Uint8Array} nal
 */
function parseAvcParameterSet(label, nal) {
  const parsed =
    label === "SPS"
      ? parseAvcSps(nal)
      : label === "PPS"
        ? parseAvcPps(nal)
        : null;
  return { label, nal, parsed };
}

/**
 * @param {number} nalUnitType
 * @param {Uint8Array} nal
 */
function parseHevcParameterSet(nalUnitType, nal) {
  const label =
    nalUnitType === 32
      ? "VPS"
      : nalUnitType === 33
        ? "SPS"
        : nalUnitType === 34
          ? "PPS"
          : `type ${nalUnitType}`;
  const parsed =
    nalUnitType === 32
      ? parseHevcVps(nal)
      : nalUnitType === 33
        ? parseHevcSps(nal)
        : nalUnitType === 34
          ? parseHevcPps(nal)
          : null;
  return { label, nal, parsed };
}

/**
 * @param {{ lengthSize: number, summary: string[], parameterSets: Array<{ label: string, nal: Uint8Array, parsed: Record<string, unknown> | null }>, issues: string[] }} config
 * @param {"avc" | "hevc"} codecFamily
 */
function buildParameterSetSections(config, codecFamily) {
  /** @type {Map<string, Array<{ label: string, nal: Uint8Array, parsed: any }>>} */
  const groups = new Map();
  for (const set of config.parameterSets) {
    const key = `${set.label}`;
    groups.set(key, [...(groups.get(key) ?? []), set]);
  }

  return [...groups.entries()].map(([label, sets]) => {
    /** @type {string[]} */
    const details = [
      `${numberFormat(sets.length)} parameter set(s)`,
      `sizes ${sets.map((set) => String(set.nal.length)).join(", ")} B`,
    ];
    const firstParsed = sets.find((set) => set.parsed != null)?.parsed ?? null;
    if (firstParsed) {
      if (label === "SPS" && codecFamily === "avc") {
        details.push(
          `id ${firstParsed.id}, display ${firstParsed.width}x${firstParsed.height}, chroma ${describeAvcChroma(firstParsed.chromaFormatIdc)}`,
        );
      } else if (label === "PPS" && codecFamily === "avc") {
        details.push(`id ${firstParsed.id}, SPS ${firstParsed.spsId}`);
      } else if (label === "VPS" && codecFamily === "hevc") {
        details.push(`id ${firstParsed.id}`);
      } else if (label === "SPS" && codecFamily === "hevc") {
        details.push(
          `id ${firstParsed.id}, display ${firstParsed.width}x${firstParsed.height}, chroma ${describeHevcChroma(firstParsed.chromaFormatIdc)}`,
        );
      } else if (label === "PPS" && codecFamily === "hevc") {
        details.push(`id ${firstParsed.id}, SPS ${firstParsed.spsId}`);
      }
    }
    return { label, details };
  });
}

/**
 * @param {Uint8Array} nal
 */
export function parseAvcSliceType(nal) {
  if (nal.length < 2) {
    return null;
  }
  const reader = new BitReader(toRbsp(nal.subarray(1)));
  try {
    readUE(reader);
    const sliceType = readUE(reader) % 5;
    return AVC_SLICE_TYPE_LABELS[sliceType] ?? null;
  } catch {
    return null;
  }
}

const AVC_SLICE_TYPE_LABELS = ["P", "B", "I", "SP", "SI"];

/**
 * @param {Uint8Array} nal
 */
function parseAvcSps(nal) {
  if (nal.length < 4) {
    return null;
  }
  const reader = new BitReader(toRbsp(nal.subarray(1)));
  try {
    const profileIdc = reader.readBits(8);
    reader.skipBits(8);
    reader.skipBits(8);
    const id = readUE(reader);
    let chromaFormatIdc = 1;
    let bitDepthLuma = 8;
    let bitDepthChroma = 8;

    if (
      profileIdc === 100 ||
      profileIdc === 110 ||
      profileIdc === 122 ||
      profileIdc === 244 ||
      profileIdc === 44 ||
      profileIdc === 83 ||
      profileIdc === 86 ||
      profileIdc === 118 ||
      profileIdc === 128 ||
      profileIdc === 138 ||
      profileIdc === 144
    ) {
      chromaFormatIdc = readUE(reader);
      if (chromaFormatIdc === 3) {
        reader.skipBits(1);
      }
      bitDepthLuma = readUE(reader) + 8;
      bitDepthChroma = readUE(reader) + 8;
      reader.skipBits(1);
      if (reader.readBits(1)) {
        const scalingCount = chromaFormatIdc !== 3 ? 8 : 12;
        for (let index = 0; index < scalingCount; index++) {
          if (reader.readBits(1)) {
            skipScalingList(reader, index < 6 ? 16 : 64);
          }
        }
      }
    }

    readUE(reader);
    const picOrderCntType = readUE(reader);
    if (picOrderCntType === 0) {
      readUE(reader);
    } else if (picOrderCntType === 1) {
      reader.skipBits(1);
      readSE(reader);
      readSE(reader);
      const cycleCount = readUE(reader);
      for (let index = 0; index < cycleCount; index++) {
        readSE(reader);
      }
    }
    readUE(reader);
    reader.skipBits(1);
    const picWidthInMbsMinus1 = readUE(reader);
    const picHeightInMapUnitsMinus1 = readUE(reader);
    const frameMbsOnlyFlag = reader.readBits(1) === 1;
    if (!frameMbsOnlyFlag) {
      reader.skipBits(1);
    }
    reader.skipBits(1);
    let cropLeft = 0;
    let cropRight = 0;
    let cropTop = 0;
    let cropBottom = 0;
    if (reader.readBits(1)) {
      cropLeft = readUE(reader);
      cropRight = readUE(reader);
      cropTop = readUE(reader);
      cropBottom = readUE(reader);
    }

    const subWidthC = chromaFormatIdc === 1 || chromaFormatIdc === 2 ? 2 : 1;
    const subHeightC = chromaFormatIdc === 1 ? 2 : 1;
    const cropUnitX = chromaFormatIdc === 0 ? 1 : subWidthC;
    const cropUnitY =
      chromaFormatIdc === 0
        ? 2 - Number(frameMbsOnlyFlag)
        : subHeightC * (2 - Number(frameMbsOnlyFlag));
    const codedWidth = (picWidthInMbsMinus1 + 1) * 16;
    const codedHeight =
      (picHeightInMapUnitsMinus1 + 1) * 16 * (2 - Number(frameMbsOnlyFlag));

    return {
      id,
      chromaFormatIdc,
      bitDepthLuma,
      bitDepthChroma,
      codedWidth,
      codedHeight,
      width: codedWidth - (cropLeft + cropRight) * cropUnitX,
      height: codedHeight - (cropTop + cropBottom) * cropUnitY,
      frameMbsOnlyFlag,
    };
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} nal
 */
function parseAvcPps(nal) {
  if (nal.length < 2) {
    return null;
  }
  const reader = new BitReader(toRbsp(nal.subarray(1)));
  try {
    return {
      id: readUE(reader),
      spsId: readUE(reader),
    };
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} nal
 */
function parseHevcVps(nal) {
  if (nal.length < 3) {
    return null;
  }
  const reader = new BitReader(toRbsp(nal.subarray(2)));
  try {
    return { id: reader.readBits(4) };
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} nal
 */
function parseHevcPps(nal) {
  if (nal.length < 3) {
    return null;
  }
  const reader = new BitReader(toRbsp(nal.subarray(2)));
  try {
    return {
      id: readUE(reader),
      spsId: readUE(reader),
    };
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} nal
 */
function parseHevcSps(nal) {
  if (nal.length < 4) {
    return null;
  }
  const reader = new BitReader(toRbsp(nal.subarray(2)));
  try {
    reader.skipBits(4);
    const maxSubLayersMinus1 = reader.readBits(3);
    reader.skipBits(1);
    skipHevcProfileTierLevel(reader, maxSubLayersMinus1);
    const id = readUE(reader);
    const chromaFormatIdc = readUE(reader);
    let separateColourPlane = 0;
    if (chromaFormatIdc === 3) {
      separateColourPlane = reader.readBits(1);
    }
    const codedWidth = readUE(reader);
    const codedHeight = readUE(reader);
    let cropLeft = 0;
    let cropRight = 0;
    let cropTop = 0;
    let cropBottom = 0;
    if (reader.readBits(1)) {
      cropLeft = readUE(reader);
      cropRight = readUE(reader);
      cropTop = readUE(reader);
      cropBottom = readUE(reader);
    }
    readUE(reader);
    readUE(reader);
    const bitDepthLuma = readUE(reader) + 8;
    const bitDepthChroma = readUE(reader) + 8;

    const subWidthC = chromaFormatIdc === 1 || chromaFormatIdc === 2 ? 2 : 1;
    const subHeightC = chromaFormatIdc === 1 ? 2 : 1;
    const cropUnitX = separateColourPlane ? 1 : subWidthC;
    const cropUnitY = separateColourPlane ? 1 : subHeightC;

    return {
      id,
      chromaFormatIdc,
      bitDepthLuma,
      bitDepthChroma,
      codedWidth,
      codedHeight,
      width: codedWidth - (cropLeft + cropRight) * cropUnitX,
      height: codedHeight - (cropTop + cropBottom) * cropUnitY,
    };
  } catch {
    return null;
  }
}

/**
 * @param {BitReader} reader
 * @param {number} maxSubLayersMinus1
 */
function skipHevcProfileTierLevel(reader, maxSubLayersMinus1) {
  reader.skipBits(2 + 1 + 5 + 32 + 48 + 8);
  /** @type {boolean[]} */
  const subLayerProfilePresent = [];
  /** @type {boolean[]} */
  const subLayerLevelPresent = [];
  for (let layer = 0; layer < maxSubLayersMinus1; layer++) {
    subLayerProfilePresent.push(reader.readBits(1) === 1);
    subLayerLevelPresent.push(reader.readBits(1) === 1);
  }
  if (maxSubLayersMinus1 > 0) {
    for (let layer = maxSubLayersMinus1; layer < 8; layer++) {
      reader.skipBits(2);
    }
  }
  for (let layer = 0; layer < maxSubLayersMinus1; layer++) {
    if (subLayerProfilePresent[layer]) {
      reader.skipBits(2 + 1 + 5 + 32 + 48);
    }
    if (subLayerLevelPresent[layer]) {
      reader.skipBits(8);
    }
  }
}

/**
 * @param {BitReader} reader
 * @param {number} size
 */
function skipScalingList(reader, size) {
  let lastScale = 8;
  let nextScale = 8;
  for (let index = 0; index < size; index++) {
    if (nextScale !== 0) {
      nextScale = (lastScale + readSE(reader) + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
}

/**
 * @param {BitReader} reader
 */
function readUE(reader) {
  let leadingZeroBits = 0;
  while (reader.readBits(1) === 0) {
    leadingZeroBits++;
    if (leadingZeroBits > 31) {
      throw new Error("ue too large");
    }
  }
  const suffix = leadingZeroBits > 0 ? reader.readBits(leadingZeroBits) : 0;
  return (1 << leadingZeroBits) - 1 + suffix;
}

/**
 * @param {BitReader} reader
 */
function readSE(reader) {
  const value = readUE(reader);
  return value % 2 === 0 ? -(value / 2) : (value + 1) / 2;
}

class BitReader {
  /**
   * @param {Uint8Array} bytes
   */
  constructor(bytes) {
    this.bytes = bytes;
    this.bitOffset = 0;
  }

  /**
   * @param {number} count
   */
  readBits(count) {
    if (count === 0) {
      return 0;
    }
    let value = 0;
    for (let bitIndex = 0; bitIndex < count; bitIndex++) {
      const byteIndex = this.bitOffset >> 3;
      if (byteIndex >= this.bytes.length) {
        throw new Error("unexpected end of bitstream");
      }
      const shift = 7 - (this.bitOffset & 7);
      value = (value << 1) | ((this.bytes[byteIndex] >> shift) & 0x01);
      this.bitOffset++;
    }
    return value;
  }

  /**
   * @param {number} count
   */
  skipBits(count) {
    for (let bitIndex = 0; bitIndex < count; bitIndex++) {
      this.readBits(1);
    }
  }
}

/**
 * @param {Uint8Array} bytes
 */
function toRbsp(bytes) {
  /** @type {number[]} */
  const out = [];
  let zeroCount = 0;
  for (const value of bytes) {
    if (zeroCount >= 2 && value === 0x03) {
      zeroCount = 0;
      continue;
    }
    out.push(value);
    if (value === 0x00) {
      zeroCount++;
    } else {
      zeroCount = 0;
    }
  }
  return new Uint8Array(out);
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {number} length
 */
function readUint(data, offset, length) {
  let value = 0;
  for (let index = 0; index < length; index++) {
    value = value * 256 + (data[offset + index] ?? 0);
  }
  return value;
}

/**
 * @param {ReturnType<typeof parseAvcSps> | null} firstSps
 */
function buildAvcSummaryFacts(firstSps) {
  /** @type {Array<{ label: string, value: string, note: string | null }>} */
  const facts = [];
  if (!firstSps) {
    return facts;
  }
  facts.push({
    label: "SPS Coded Size",
    value: `${firstSps.codedWidth}x${firstSps.codedHeight}`,
    note: "macroblock-aligned coded raster before conformance crop",
  });
  facts.push({
    label: "SPS Display Size",
    value: `${firstSps.width}x${firstSps.height}`,
    note: "display size after applying SPS cropping",
  });
  facts.push({
    label: "Chroma Subsampling",
    value: formatAvcChroma(firstSps.chromaFormatIdc),
    note: describeAvcChromaNote(firstSps.chromaFormatIdc),
  });
  facts.push({
    label: "Bit Depth",
    value: `${firstSps.bitDepthLuma} / ${firstSps.bitDepthChroma}`,
    note: "luma / chroma bits per component",
  });
  facts.push({
    label: "Scan Type",
    value: firstSps.frameMbsOnlyFlag ? "progressive" : "interlaced/field",
    note: "derived from frame_mbs_only_flag in the SPS",
  });
  return facts;
}

/**
 * @param {{
 *   chromaFormat: number,
 *   bitDepthLuma: number,
 *   bitDepthChroma: number,
 *   firstSps: ReturnType<typeof parseHevcSps> | null
 * }} input
 */
function buildHevcSummaryFacts({
  chromaFormat,
  bitDepthLuma,
  bitDepthChroma,
  firstSps,
}) {
  /** @type {Array<{ label: string, value: string, note: string | null }>} */
  const facts = [
    {
      label: "Chroma Subsampling",
      value: formatHevcChroma(chromaFormat),
      note: describeHevcChromaNote(chromaFormat),
    },
    {
      label: "Bit Depth",
      value: `${bitDepthLuma} / ${bitDepthChroma}`,
      note: "luma / chroma bits per component",
    },
  ];
  if (firstSps) {
    facts.push({
      label: "SPS Coded Size",
      value: `${firstSps.codedWidth}x${firstSps.codedHeight}`,
      note: "coded raster before conformance crop",
    });
    facts.push({
      label: "SPS Display Size",
      value: `${firstSps.width}x${firstSps.height}`,
      note: "display size after applying SPS cropping",
    });
  }
  return facts;
}

/**
 * @param {{
 *   codecFamily: "avc" | "hevc",
 *   idrSamples: number,
 *   craSamples: number,
 *   irapSamples: number,
 *   samplesWithParameterSets: number,
 *   sampleClassCounts: Map<string, number>,
 * }} input
 */
function buildSampleSummaryFacts({
  codecFamily,
  idrSamples,
  craSamples,
  irapSamples,
  samplesWithParameterSets,
  sampleClassCounts,
}) {
  /** @type {Array<{ label: string, value: string, note: string | null }>} */
  const facts = [];
  if (idrSamples > 0) {
    facts.push({
      label: "IDR Samples",
      value: numberFormat(idrSamples),
      note: "samples containing an IDR access unit",
    });
  }
  if (codecFamily === "hevc" && craSamples > 0) {
    facts.push({
      label: "CRA Samples",
      value: numberFormat(craSamples),
      note: "samples containing a clean random access point",
    });
  }
  if (codecFamily === "hevc" && irapSamples > 0) {
    facts.push({
      label: "IRAP Samples",
      value: numberFormat(irapSamples),
      note: "samples containing an intra random access point",
    });
  }
  if (samplesWithParameterSets > 0) {
    facts.push({
      label: "In-Band Parameter Sets",
      value: numberFormat(samplesWithParameterSets),
      note: "samples carrying VPS/SPS/PPS or SPS/PPS inside media payloads",
    });
  }
  if (sampleClassCounts.size > 0) {
    facts.push({
      label: "Slice Classes",
      value: [...sampleClassCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([label, count]) => `${label} ${numberFormat(count)}`)
        .join(", "),
      note: "decode-order slice classes inferred from AVC slice headers",
    });
  }
  return facts;
}

/**
 * @param {number | null | undefined} chromaFormatIdc
 */
function describeAvcChromaNote(chromaFormatIdc) {
  switch (chromaFormatIdc) {
    case 0:
      return "no separate chroma planes";
    case 1:
      return "one chroma sample for each 2x2 luma block";
    case 2:
      return "one chroma sample for each 2x1 luma block";
    case 3:
      return "full chroma resolution";
    default:
      return "chroma layout could not be determined";
  }
}

/**
 * @param {number | null | undefined} chromaFormatIdc
 */
function describeHevcChromaNote(chromaFormatIdc) {
  switch (chromaFormatIdc) {
    case 0:
      return "no separate chroma planes";
    case 1:
      return "one chroma sample for each 2x2 luma block";
    case 2:
      return "one chroma sample for each 2x1 luma block";
    case 3:
      return "full chroma resolution";
    default:
      return "chroma layout could not be determined";
  }
}

/**
 * @param {number | null | undefined} chromaFormatIdc
 */
function formatAvcChroma(chromaFormatIdc) {
  switch (chromaFormatIdc) {
    case 0:
      return "monochrome";
    case 1:
      return "4:2:0";
    case 2:
      return "4:2:2";
    case 3:
      return "4:4:4";
    default:
      return "unknown";
  }
}

/**
 * @param {number | null | undefined} chromaFormatIdc
 */
function formatHevcChroma(chromaFormatIdc) {
  switch (chromaFormatIdc) {
    case 0:
      return "monochrome";
    case 1:
      return "4:2:0";
    case 2:
      return "4:2:2";
    case 3:
      return "4:4:4";
    default:
      return "unknown";
  }
}

/**
 * @param {number | null | undefined} chromaFormatIdc
 */
function describeAvcChroma(chromaFormatIdc) {
  const value = formatAvcChroma(chromaFormatIdc);
  switch (chromaFormatIdc) {
    case 0:
      return `${value}, no separate chroma planes`;
    case 1:
      return `${value}, one chroma sample for each 2x2 luma block`;
    case 2:
      return `${value}, one chroma sample for each 2x1 luma block`;
    case 3:
      return `${value}, full chroma resolution`;
    default:
      return value;
  }
}

/**
 * @param {number | null | undefined} chromaFormatIdc
 */
function describeHevcChroma(chromaFormatIdc) {
  const value = formatHevcChroma(chromaFormatIdc);
  switch (chromaFormatIdc) {
    case 0:
      return `${value}, no separate chroma planes`;
    case 1:
      return `${value}, one chroma sample for each 2x2 luma block`;
    case 2:
      return `${value}, one chroma sample for each 2x1 luma block`;
    case 3:
      return `${value}, full chroma resolution`;
    default:
      return value;
  }
}
