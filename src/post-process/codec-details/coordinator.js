import { findBoxes, findFirstBox, getNumberField } from "../box_access.js";
import {
  getHandlerType,
  isProtectedSampleEntry,
  normalizeTrackKind,
} from "../codec_meta.js";
import {
  buildFragmentSampleLocations,
  buildRegularTrackSampleLocations,
  getTrackSampleEntries,
  getTrexDefaults,
  parseAvcConfigBox,
  parseAvcSliceType,
  parseHevcConfigBox,
  splitLengthPrefixedNals,
} from "./analysis.js";

const MAX_ANALYZED_SAMPLES = 160;
const MAX_ANALYZED_NALS = 4000;

/**
 * @typedef {{ index: number, offset: number, size: number }} SampleLocation
 * @typedef {{ start: number, endExclusive: number }} ByteRange
 * @typedef {(start: number, endExclusive: number) => AsyncIterable<Uint8Array>} RangeReader
 * @typedef {{
 *   index: number,
 *   offset: number,
 *   size: number,
 *   nextOffset: number,
 *   totalLength: number,
 *   chunks: Uint8Array[],
 * }} PartialSample
 * @typedef {{
 *   trackId: string,
 *   trackLabel: string,
 *   codecFamily: "avc" | "hevc",
 *   lengthSize: number | null,
 *   protected: boolean,
 *   sampleDescriptionIndex: number,
 *   locations: SampleLocation[],
 *   cursor: number,
 *   partialSample: PartialSample | null,
 *   analyzedSamples: number,
 *   nalCount: number,
 *   idrSamples: number,
 *   craSamples: number,
 *   irapSamples: number,
 *   samplesWithParameterSets: number,
 *   passedBeforeReady: boolean,
 *   sampleClassCounts: Map<string, number>,
 *   nalTypeCounts: Map<string, number>,
 *   sampleSequenceEntries: Array<{ sampleIndex: number, label: string }>,
 *   deferredLocations: SampleLocation[],
 *   localRereadSamples: number,
 *   localRereadFailed: boolean,
 *   remoteRereadSamples: number,
 *   remoteRereadFailed: boolean,
 *   issues: string[],
 * }} TrackState
 */

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

export default class CodecDetailsCoordinator {
  #supplementalBoxes;
  #trexDefaults;
  /** @type {{ payloadStart: number, payloadEnd: number | null } | null} */
  #activeMdat = null;
  /** @type {Array<import("isobmff-inspector").ParsedBox>} */
  #pendingMoofs = [];
  /** @type {ByteRange[]} */
  #completedPayloadRanges = [];
  /** @type {Map<string, TrackState>} */
  #tracks = new Map();
  /** @type {Array<import("isobmff-inspector").ParsedBox>} */
  #topLevelBoxes = [];
  /** @type {string | null} */
  #remoteRereadBlockedReason = null;

  /**
   * @param {{
   *   supplementalBoxes?: Array<import("isobmff-inspector").ParsedBox> | null,
   * }} [options]
   */
  constructor(options = {}) {
    this.#supplementalBoxes = options.supplementalBoxes ?? [];
    this.#trexDefaults = getTrexDefaults(this.#supplementalBoxes);
    const supplementalMoov = findFirstBox(this.#supplementalBoxes, "moov");
    if (supplementalMoov) {
      this.#ingestMoov(supplementalMoov);
    }
  }

  /**
   * @param {{
   *   type: string,
   *   offset: number,
   *   headerSize: number,
   *   size: number,
   * }} box
   */
  onTopLevelBoxStart(box) {
    if (box.type !== "mdat") {
      return;
    }
    const payloadStart = box.offset + box.headerSize;
    const payloadEnd =
      box.size === 0 ? null : Math.max(payloadStart, box.offset + box.size);
    this.#activeMdat = {
      payloadStart,
      payloadEnd,
    };
    if (this.#pendingMoofs.length > 0) {
      for (const moof of this.#pendingMoofs) {
        this.#ingestMoof(moof, payloadStart);
      }
      this.#pendingMoofs.length = 0;
    }
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} box
   */
  onTopLevelBoxComplete(box) {
    this.#topLevelBoxes.push(box);
    if (box.type === "moov") {
      for (const [trackId, defaults] of getTrexDefaults([box])) {
        this.#trexDefaults.set(trackId, defaults);
      }
      this.#ingestMoov(box);
      return;
    }
    if (box.type === "moof") {
      this.#pendingMoofs.push(box);
      return;
    }
    if (box.type === "mdat") {
      const payloadStart = box.offset + box.headerSize;
      const payloadEnd = box.offset + box.actualSize;
      if (payloadEnd > payloadStart) {
        this.#completedPayloadRanges.push({
          start: payloadStart,
          endExclusive: payloadEnd,
        });
      }
      this.#activeMdat = null;
    }
  }

  /**
   * @param {{ start: number, bytes: Uint8Array }} span
   */
  consumeSpan(span) {
    if (!this.#activeMdat) {
      return;
    }
    const spanEnd = span.start + span.bytes.length;
    const overlapStart = Math.max(span.start, this.#activeMdat.payloadStart);
    const overlapEnd = Math.min(
      spanEnd,
      this.#activeMdat.payloadEnd ?? spanEnd,
    );
    if (overlapEnd <= overlapStart) {
      return;
    }
    const relativeStart = overlapStart - span.start;
    const relativeEnd = overlapEnd - span.start;
    const payloadSpan = {
      start: overlapStart,
      endExclusive: overlapEnd,
      bytes: span.bytes.subarray(relativeStart, relativeEnd),
    };
    for (const trackState of this.#tracks.values()) {
      this.#consumeTrackSpan(trackState, payloadSpan);
    }
  }

  getTopLevelBoxes() {
    return this.#topLevelBoxes;
  }

  /**
   * @param {RangeReader} readRange
   * @param {AbortSignal} abortSignal
   */
  async completeLocalFileAnalysis(readRange, abortSignal) {
    await this.#completeDeferredAnalysis(readRange, abortSignal, "local");
  }

  /**
   * @param {RangeReader} readRange
   * @param {AbortSignal} abortSignal
   */
  async completeRemoteFileAnalysis(readRange, abortSignal) {
    await this.#completeDeferredAnalysis(readRange, abortSignal, "remote");
  }

  getDeferredRemoteAnalysisState() {
    let pendingTrackCount = 0;
    let pendingSampleCount = 0;
    let recoveredSampleCount = 0;

    for (const trackState of this.#tracks.values()) {
      if (
        trackState.protected ||
        trackState.lengthSize == null ||
        trackState.deferredLocations.length === 0
      ) {
        recoveredSampleCount += trackState.remoteRereadSamples;
        continue;
      }
      pendingTrackCount++;
      pendingSampleCount += trackState.deferredLocations.length;
      recoveredSampleCount += trackState.remoteRereadSamples;
    }

    return {
      available:
        this.#remoteRereadBlockedReason === null && pendingSampleCount > 0,
      blockedReason: this.#remoteRereadBlockedReason,
      pendingTrackCount,
      pendingSampleCount,
      recoveredSampleCount,
    };
  }

  /**
   * @param {any[]} results
   */
  mergeIntoResults(results) {
    for (const result of results) {
      const trackId = result.trackLabel.replace(/^track /, "");
      const trackState = this.#tracks.get(trackId);
      if (!trackState) {
        continue;
      }
      const payloadDetails = this.#buildPayloadDetails(trackState);
      if (!payloadDetails) {
        continue;
      }
      result.sampleFacts = payloadDetails.sampleFacts;
      result.sampleDetails = payloadDetails.sampleDetails;
      result.nalTypes = payloadDetails.nalTypes;
      result.sampleSequence = payloadDetails.sampleSequence;
      result.issues = [...result.issues, ...payloadDetails.issues];
      result.canDeepenPayloadRemotely =
        trackState.lengthSize != null &&
        !trackState.protected &&
        trackState.deferredLocations.length > 0 &&
        this.#remoteRereadBlockedReason === null;
    }
    return results;
  }

  /**
   * @param {RangeReader} readRange
   * @param {AbortSignal} abortSignal
   * @param {"local" | "remote"} sourceKind
   */
  async #completeDeferredAnalysis(readRange, abortSignal, sourceKind) {
    for (const trackState of this.#tracks.values()) {
      if (
        abortSignal.aborted ||
        trackState.protected ||
        trackState.lengthSize == null
      ) {
        continue;
      }
      while (
        trackState.deferredLocations.length > 0 &&
        trackState.analyzedSamples < MAX_ANALYZED_SAMPLES &&
        trackState.nalCount < MAX_ANALYZED_NALS
      ) {
        if (abortSignal.aborted) {
          return;
        }
        const location = trackState.deferredLocations.shift();
        if (!location) {
          break;
        }
        try {
          await this.#analyzeSampleStream(
            trackState,
            location.index,
            readRange(location.offset, location.offset + location.size),
          );
          if (abortSignal.aborted) {
            return;
          }
          if (sourceKind === "local") {
            trackState.localRereadSamples++;
          } else {
            trackState.remoteRereadSamples++;
          }
        } catch (err) {
          if (abortSignal.aborted) {
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          if (sourceKind === "local") {
            trackState.localRereadFailed = true;
            trackState.issues.push(
              `local reread failed for sample ${location.index}: ${message}`,
            );
          } else {
            trackState.remoteRereadFailed = true;
            if (isRangeUnsupportedError(err)) {
              this.#remoteRereadBlockedReason =
                "remote deferred analysis is unavailable because this server did not honor the requested HTTP byte range";
            } else {
              trackState.issues.push(
                `remote deferred fetch failed for sample ${location.index}: ${message}`,
              );
            }
          }
          break;
        }
      }
      if (sourceKind === "remote" && this.#remoteRereadBlockedReason !== null) {
        return;
      }
    }
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} moov
   */
  #ingestMoov(moov) {
    for (const trak of findBoxes([moov], "trak")) {
      this.#upsertTrackFromTrak(trak);
    }
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} moof
   * @param {number} defaultPayloadOffset
   */
  #ingestMoof(moof, defaultPayloadOffset) {
    for (const [trackId, trackState] of this.#tracks) {
      const fragmentSamples = buildFragmentSampleLocations(
        [moof],
        [moof],
        trackId,
        trackState.sampleDescriptionIndex,
        this.#trexDefaults.get(trackId) ?? {
          defaultSampleDescriptionIndex: null,
          defaultSampleSize: null,
        },
        defaultPayloadOffset,
      );
      this.#appendSampleLocations(trackState, fragmentSamples.locations);
      trackState.issues.push(...fragmentSamples.issues);
      this.#markPastSamplesUnavailable(trackState, fragmentSamples.locations);
    }
  }

  /**
   * @param {import("isobmff-inspector").ParsedBox} trak
   */
  #upsertTrackFromTrak(trak) {
    const tkhd = findFirstBox([trak], "tkhd");
    const hdlr = findFirstBox([trak], "hdlr");
    const trackIdValue = getNumberField(tkhd, "track_ID");
    if (trackIdValue == null) {
      return;
    }
    const trackId = String(trackIdValue);
    const trackEntries = getTrackSampleEntries(trak);
    const chosenEntry = trackEntries.find(
      (entry) => entry.codecFamily !== null,
    );
    if (!chosenEntry?.codecFamily) {
      return;
    }
    if (
      normalizeTrackKind(getHandlerType(hdlr), chosenEntry.sampleEntry.type) !==
      "video"
    ) {
      return;
    }
    const codecFamily = /** @type {"avc" | "hevc"} */ (chosenEntry.codecFamily);
    const config =
      codecFamily === "avc"
        ? parseAvcConfigBox(chosenEntry.avcC)
        : parseHevcConfigBox(chosenEntry.hvcC);
    if (!config) {
      return;
    }
    const protectedEntry = isProtectedSampleEntry(chosenEntry.sampleEntry.type);
    const trackState = this.#tracks.get(trackId) ?? createTrackState(trackId);
    trackState.codecFamily = codecFamily;
    trackState.lengthSize = config.lengthSize;
    trackState.protected = protectedEntry;
    trackState.sampleDescriptionIndex = chosenEntry.sampleDescriptionIndex;
    trackState.trackLabel = `track ${trackId}`;
    const regularSamples = buildRegularTrackSampleLocations(
      trak,
      chosenEntry.sampleDescriptionIndex,
    );
    this.#appendSampleLocations(trackState, regularSamples.locations);
    trackState.issues.push(...regularSamples.issues);
    this.#markPastSamplesUnavailable(trackState, regularSamples.locations);
    this.#tracks.set(trackId, trackState);
  }

  /**
   * @param {TrackState} trackState
   * @param {SampleLocation[]} locations
   */
  #appendSampleLocations(trackState, locations) {
    for (const location of locations) {
      if (trackState.locations.length >= MAX_ANALYZED_SAMPLES) {
        break;
      }
      if (location.size <= 0) {
        continue;
      }
      if (
        trackState.locations.some(
          (existing) =>
            existing.index === location.index &&
            existing.offset === location.offset &&
            existing.size === location.size,
        )
      ) {
        continue;
      }
      trackState.locations.push(location);
    }
    trackState.locations.sort((left, right) => left.offset - right.offset);
  }

  /**
   * @param {TrackState} trackState
   * @param {SampleLocation[]} locations
   */
  #markPastSamplesUnavailable(trackState, locations) {
    for (const location of locations) {
      if (
        this.#completedPayloadRanges.some(
          (range) =>
            location.offset < range.endExclusive &&
            location.offset + location.size > range.start,
        )
      ) {
        trackState.passedBeforeReady = true;
        this.#queueDeferredSample(trackState, location);
      }
    }
  }

  /**
   * @param {TrackState} trackState
   * @param {{ start: number, endExclusive: number, bytes: Uint8Array }} span
   */
  #consumeTrackSpan(trackState, span) {
    if (trackState.protected || trackState.lengthSize == null) {
      return;
    }
    while (
      trackState.cursor < trackState.locations.length &&
      trackState.analyzedSamples < MAX_ANALYZED_SAMPLES &&
      trackState.nalCount < MAX_ANALYZED_NALS
    ) {
      const location = trackState.locations[trackState.cursor];
      const sampleEnd = location.offset + location.size;
      if (sampleEnd <= span.start) {
        trackState.passedBeforeReady = true;
        this.#queueDeferredSample(trackState, location);
        trackState.cursor++;
        trackState.partialSample = null;
        continue;
      }
      if (location.offset >= span.endExclusive) {
        break;
      }
      if (!trackState.partialSample && span.start > location.offset) {
        trackState.passedBeforeReady = true;
        this.#queueDeferredSample(trackState, location);
        trackState.cursor++;
        continue;
      }

      const overlapStart = Math.max(location.offset, span.start);
      const overlapEnd = Math.min(sampleEnd, span.endExclusive);
      if (overlapEnd <= overlapStart) {
        break;
      }

      const partial =
        trackState.partialSample ??
        createPartialSample(location.index, location.offset, location.size);
      if (partial.nextOffset !== overlapStart) {
        trackState.passedBeforeReady = true;
        this.#queueDeferredSample(trackState, location);
        trackState.partialSample = null;
        trackState.cursor++;
        continue;
      }
      partial.chunks.push(
        span.bytes.subarray(overlapStart - span.start, overlapEnd - span.start),
      );
      partial.totalLength += overlapEnd - overlapStart;
      partial.nextOffset = overlapEnd;
      trackState.partialSample = partial;
      if (partial.totalLength < location.size) {
        break;
      }
      const sampleBytes = concatChunks(partial.chunks, partial.totalLength);
      this.#analyzeSample(trackState, location.index, sampleBytes);
      trackState.partialSample = null;
      trackState.cursor++;
    }
  }

  /**
   * @param {TrackState} trackState
   * @param {number} sampleIndex
   * @param {Uint8Array} sampleBytes
   */
  #analyzeSample(trackState, sampleIndex, sampleBytes) {
    const lengthSize = trackState.lengthSize;
    if (lengthSize == null) {
      return;
    }
    const split = splitLengthPrefixedNals(sampleBytes, lengthSize);
    if (split.truncated) {
      trackState.issues.push(
        `sample ${sampleIndex} ends in a truncated NAL unit`,
      );
    }

    const summary = createPendingSampleSummary();
    for (const nal of split.nals) {
      this.#consumeSampleNal(trackState, summary, nal);
      if (trackState.nalCount >= MAX_ANALYZED_NALS) {
        break;
      }
    }

    this.#finalizeSampleAnalysis(trackState, sampleIndex, summary);
  }

  /**
   * @param {TrackState} trackState
   * @param {number} sampleIndex
   * @param {AsyncIterable<Uint8Array>} chunks
   */
  async #analyzeSampleStream(trackState, sampleIndex, chunks) {
    const lengthSize = trackState.lengthSize;
    if (lengthSize == null) {
      return;
    }

    const summary = createPendingSampleSummary();
    let pendingLengthBytes = createEmptyUint8Array();
    let currentNalLength = null;
    /** @type {Uint8Array[]} */
    let currentNalChunks = [];
    let currentNalReceived = 0;
    let truncated = false;

    for await (const chunk of chunks) {
      let offset = 0;
      while (offset < chunk.length) {
        if (trackState.nalCount >= MAX_ANALYZED_NALS) {
          break;
        }
        if (currentNalLength === null) {
          const lengthRead = readPartialLength(
            pendingLengthBytes,
            chunk,
            offset,
            lengthSize,
          );
          pendingLengthBytes = lengthRead.bytes;
          offset = lengthRead.nextOffset;
          if (pendingLengthBytes.length < lengthSize) {
            break;
          }
          currentNalLength = readUint(pendingLengthBytes, 0, lengthSize);
          pendingLengthBytes = createEmptyUint8Array();
          currentNalReceived = 0;
          currentNalChunks = [];
          if (currentNalLength === 0) {
            currentNalLength = null;
          }
          continue;
        }

        const bytesNeeded = currentNalLength - currentNalReceived;
        const bytesAvailable = chunk.length - offset;
        const bytesTaken = Math.min(bytesNeeded, bytesAvailable);
        if (bytesTaken > 0) {
          currentNalChunks.push(chunk.subarray(offset, offset + bytesTaken));
          currentNalReceived += bytesTaken;
          offset += bytesTaken;
        }
        if (currentNalReceived < currentNalLength) {
          break;
        }

        const nal = concatChunks(currentNalChunks, currentNalLength);
        this.#consumeSampleNal(trackState, summary, nal);
        currentNalLength = null;
        currentNalChunks = [];
        currentNalReceived = 0;
      }
      if (trackState.nalCount >= MAX_ANALYZED_NALS) {
        break;
      }
    }

    if (
      pendingLengthBytes.length > 0 ||
      currentNalLength !== null ||
      currentNalReceived !== 0
    ) {
      truncated = true;
    }
    if (truncated) {
      trackState.issues.push(
        `sample ${sampleIndex} ends in a truncated NAL unit`,
      );
    }
    this.#finalizeSampleAnalysis(trackState, sampleIndex, summary);
  }

  /**
   * @param {TrackState} trackState
   * @param {ReturnType<typeof createPendingSampleSummary>} summary
   * @param {Uint8Array} nal
   */
  #consumeSampleNal(trackState, summary, nal) {
    trackState.nalCount++;
    if (trackState.codecFamily === "avc") {
      const type = nal[0] & 0x1f;
      const name = AVC_NAL_TYPE_NAMES.get(type) ?? `type ${type}`;
      trackState.nalTypeCounts.set(
        name,
        (trackState.nalTypeCounts.get(name) ?? 0) + 1,
      );
      if (type === 5) {
        summary.sampleHasIdr = true;
      }
      if (type === 7 || type === 8) {
        summary.sampleHasParameterSets = true;
      }
      if (
        summary.sampleClass === null &&
        (type === 1 || type === 2 || type === 5)
      ) {
        summary.sampleClass = parseAvcSliceType(nal);
      }
      return;
    }

    const type = (nal[0] >> 1) & 0x3f;
    const name = HEVC_NAL_TYPE_NAMES.get(type) ?? `type ${type}`;
    trackState.nalTypeCounts.set(
      name,
      (trackState.nalTypeCounts.get(name) ?? 0) + 1,
    );
    if (type === 19 || type === 20) {
      summary.sampleHasIdr = true;
    }
    if (type === 21) {
      summary.sampleHasCra = true;
    }
    if (type >= 16 && type <= 23) {
      summary.sampleHasIrap = true;
    }
    if (type === 32 || type === 33 || type === 34) {
      summary.sampleHasParameterSets = true;
    }
  }

  /**
   * @param {TrackState} trackState
   * @param {number} sampleIndex
   * @param {ReturnType<typeof createPendingSampleSummary>} summary
   */
  #finalizeSampleAnalysis(trackState, sampleIndex, summary) {
    const {
      sampleHasParameterSets,
      sampleHasIdr,
      sampleHasCra,
      sampleHasIrap,
      sampleClass,
    } = summary;

    trackState.analyzedSamples++;
    if (sampleHasParameterSets) {
      trackState.samplesWithParameterSets++;
    }
    if (sampleHasIdr) {
      trackState.idrSamples++;
    }
    if (sampleHasCra) {
      trackState.craSamples++;
    }
    if (sampleHasIrap) {
      trackState.irapSamples++;
    }
    if (sampleClass) {
      trackState.sampleClassCounts.set(
        sampleClass,
        (trackState.sampleClassCounts.get(sampleClass) ?? 0) + 1,
      );
    }
    if (trackState.codecFamily === "avc" && sampleClass) {
      this.#recordSampleSequence(
        trackState,
        sampleIndex,
        sampleHasIdr ? `${sampleClass}*` : sampleClass,
      );
    } else if (trackState.codecFamily === "hevc") {
      this.#recordSampleSequence(
        trackState,
        sampleIndex,
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

  /**
   * @param {TrackState} trackState
   */
  #buildPayloadDetails(trackState) {
    if (
      trackState.analyzedSamples === 0 &&
      !trackState.passedBeforeReady &&
      !trackState.protected
    ) {
      return null;
    }

    /** @type {Array<{ label: string, value: string, note: string | null }>} */
    const sampleFacts = [];
    /** @type {string[]} */
    const sampleDetails = [];
    /** @type {string[]} */
    const issues = [...trackState.issues];

    if (trackState.protected) {
      sampleDetails.push(
        "sample payload analysis unavailable because the selected samples are protected or encrypted",
      );
    } else if (trackState.analyzedSamples > 0) {
      const usedLocalRereads = trackState.localRereadSamples > 0;
      sampleFacts.push({
        label: "Analyzed Samples",
        value: String(trackState.analyzedSamples),
        note: usedLocalRereads
          ? "decoded from mapped sample payload bytes across the streaming pass and targeted local rereads"
          : "decoded from mapped sample payload bytes during the streaming parse",
      });
      sampleFacts.push({
        label: "Analyzed NAL Units",
        value: String(trackState.nalCount),
        note: usedLocalRereads
          ? "total length-prefixed NAL units inspected across the streaming pass and local rereads"
          : "total length-prefixed NAL units inspected in the current streaming window",
      });
      if (trackState.sampleClassCounts.size > 0) {
        const sliceClasses = [...trackState.sampleClassCounts.entries()]
          .sort((left, right) => right[1] - left[1])
          .map(([label, count]) => `${label} ${count}`)
          .join(", ");
        sampleFacts.push({
          label: "Slice Classes",
          value: sliceClasses,
          note: "decode-order slice classes inferred from AVC slice headers",
        });
      }
      if (trackState.localRereadSamples > 0) {
        sampleFacts.push({
          label: "Local Rereads",
          value: String(trackState.localRereadSamples),
          note: "sample payloads re-read from the local file after late metadata became available",
        });
      }
      if (trackState.remoteRereadSamples > 0) {
        sampleFacts.push({
          label: "Remote Range Fetches",
          value: String(trackState.remoteRereadSamples),
          note: "sample payloads re-fetched by user-driven HTTP byte-range reads after late metadata became available",
        });
      }
    }

    if (trackState.passedBeforeReady) {
      sampleDetails.push(
        "some mapped sample payload bytes passed before codec metadata or sample mapping were ready, so the streaming pass could not inspect them",
      );
      if (trackState.localRereadSamples > 0) {
        sampleDetails.push(
          "local random-access rereads recovered part of that missed payload analysis without buffering the whole file",
        );
      }
      if (trackState.remoteRereadSamples > 0) {
        sampleDetails.push(
          "user-driven remote byte-range fetches recovered part of that missed payload analysis without re-downloading the whole resource",
        );
      }
    }

    if (this.#remoteRereadBlockedReason !== null) {
      sampleDetails.push(this.#remoteRereadBlockedReason);
    }

    if (
      trackState.deferredLocations.length > 0 &&
      !trackState.protected &&
      !trackState.localRereadFailed &&
      !trackState.remoteRereadFailed &&
      this.#remoteRereadBlockedReason === null
    ) {
      sampleDetails.push(
        "some deferred sample ranges remain unanalyzed because the codec analysis window limit was reached",
      );
    }

    return {
      sampleFacts,
      sampleDetails,
      sampleSequence: trackState.sampleSequenceEntries
        .slice()
        .sort((left, right) => left.sampleIndex - right.sampleIndex)
        .slice(0, 48)
        .map((entry) => entry.label),
      nalTypes: [...trackState.nalTypeCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([label, count]) => ({ label, count })),
      issues,
    };
  }

  /**
   * @param {TrackState} trackState
   * @param {number} sampleIndex
   * @param {string} label
   */
  #recordSampleSequence(trackState, sampleIndex, label) {
    if (
      trackState.sampleSequenceEntries.some(
        (entry) => entry.sampleIndex === sampleIndex,
      )
    ) {
      return;
    }
    trackState.sampleSequenceEntries.push({ sampleIndex, label });
  }

  /**
   * @param {TrackState} trackState
   * @param {SampleLocation} location
   */
  #queueDeferredSample(trackState, location) {
    if (
      trackState.deferredLocations.some(
        (deferred) =>
          deferred.index === location.index &&
          deferred.offset === location.offset &&
          deferred.size === location.size,
      )
    ) {
      return;
    }
    trackState.deferredLocations.push(location);
  }
}

/**
 * @param {string} trackId
 * @returns {TrackState}
 */
function createTrackState(trackId) {
  return {
    trackId,
    trackLabel: `track ${trackId}`,
    codecFamily: "avc",
    lengthSize: null,
    protected: false,
    sampleDescriptionIndex: 1,
    locations: /** @type {SampleLocation[]} */ ([]),
    cursor: 0,
    partialSample: null,
    analyzedSamples: 0,
    nalCount: 0,
    idrSamples: 0,
    craSamples: 0,
    irapSamples: 0,
    samplesWithParameterSets: 0,
    passedBeforeReady: false,
    sampleClassCounts: new Map(),
    nalTypeCounts: new Map(),
    sampleSequenceEntries:
      /** @type {Array<{ sampleIndex: number, label: string }>} */ ([]),
    deferredLocations: /** @type {SampleLocation[]} */ ([]),
    localRereadSamples: 0,
    localRereadFailed: false,
    remoteRereadSamples: 0,
    remoteRereadFailed: false,
    issues: /** @type {string[]} */ ([]),
  };
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isRangeUnsupportedError(err) {
  return (
    err instanceof Error &&
    "name" in err &&
    err.name === "RangeNotSupportedError"
  );
}

/**
 * @param {number} index
 * @param {number} offset
 * @param {number} size
 * @returns {PartialSample}
 */
function createPartialSample(index, offset, size) {
  return {
    index,
    offset,
    size,
    nextOffset: offset,
    totalLength: 0,
    chunks: /** @type {Uint8Array[]} */ ([]),
  };
}

/**
 * @param {Uint8Array[]} chunks
 * @param {number} totalLength
 */
function concatChunks(chunks, totalLength) {
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

/**
 * @returns {Uint8Array}
 */
function createEmptyUint8Array() {
  return new Uint8Array(0);
}

/**
 * @returns {{
 *   sampleHasParameterSets: boolean,
 *   sampleHasIdr: boolean,
 *   sampleHasCra: boolean,
 *   sampleHasIrap: boolean,
 *   sampleClass: string | null,
 * }}
 */
function createPendingSampleSummary() {
  return {
    sampleHasParameterSets: false,
    sampleHasIdr: false,
    sampleHasCra: false,
    sampleHasIrap: false,
    sampleClass: null,
  };
}

/**
 * @param {Uint8Array} existing
 * @param {Uint8Array} chunk
 * @param {number} offset
 * @param {number} targetLength
 * @returns {{ bytes: Uint8Array, nextOffset: number }}
 */
function readPartialLength(existing, chunk, offset, targetLength) {
  const bytesNeeded = targetLength - existing.length;
  const bytesAvailable = chunk.length - offset;
  const bytesTaken = Math.min(bytesNeeded, bytesAvailable);
  if (bytesTaken <= 0) {
    return {
      bytes: existing,
      nextOffset: offset,
    };
  }
  const bytes = new Uint8Array(existing.length + bytesTaken);
  bytes.set(existing, 0);
  bytes.set(chunk.subarray(offset, offset + bytesTaken), existing.length);
  return {
    bytes,
    nextOffset: offset + bytesTaken,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} size
 */
function readUint(bytes, offset, size) {
  let value = 0;
  for (let index = 0; index < size; index++) {
    value = (value << 8) | bytes[offset + index];
  }
  return value;
}
