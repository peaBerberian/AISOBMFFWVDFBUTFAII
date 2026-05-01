import { parseEvents } from "isobmff-inspector";
import InspectionParseCollector from "./InspectionParseCollector.js";

/**
 * @typedef {{ severity: "warning" | "error", message: string }} ParseNotice
 * @typedef {import("../utils/box_size.js").BoxWithOptionalActualSize} PendingParsedBox
 */

/**
 * Run the streaming parser and publish parse events into inspection state.
 *
 * @param {AsyncIterable<Uint8Array>} input
 * @param {import("./InspectionParseHandle.js").default} inspection
 * @param {{
 *   supplementalMetadataPromise?: Promise<{
 *     boxes: Array<import("isobmff-inspector").ParsedBox>,
 *   } | null>,
 *   rangeReader?: ((start: number, endExclusive: number) => AsyncIterable<Uint8Array>) | null,
 *   inputTotalBytes?: number | null,
 * }} [options]
 */
export async function parseInspectionStream(input, inspection, options = {}) {
  const abortSignal = inspection.controller.signal;
  inspection.signalParseBegin({ inputTotalBytes: options.inputTotalBytes });

  let supplementalMetadata = null;
  if (options.supplementalMetadataPromise) {
    try {
      supplementalMetadata = await options.supplementalMetadataPromise;
    } catch (err) {
      if (abortSignal.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      /** @type {ParseNotice} */
      const notice = {
        severity: "warning",
        message: `Supplemental init metadata could not be loaded: ${message}`,
      };
      inspection.addNotice(notice);
    }
  }
  inspection.prepareParseCollector(supplementalMetadata);

  const progressReporter = createParseProgressReporter(
    inspection,
    options.inputTotalBytes ?? null,
  );
  const byteTrackedInput = trackByteInput(input, (absoluteOffset, chunk) => {
    inspection.captureByteViewInputChunk(absoluteOffset, chunk);
    progressReporter(absoluteOffset + chunk.byteLength);
  });

  try {
    for await (const event of parseEvents(byteTrackedInput, {
      payloads: {
        include: ["mdat"],
        onChunk(info, chunk) {
          inspection.onMdatPayload(info, chunk);
        },
      },
    })) {
      if (abortSignal.aborted) {
        return;
      }

      if (event.event === "box-start") {
        const depth = event.path.length - 1;

        /** @type {PendingParsedBox} */
        const box = {
          type: event.type,
          size: event.size,
          offset: event.offset,
          headerSize: event.headerSize,
          sizeField: event.sizeField,
          uuid: event.uuid,
          values: [],
          issues: [],
          children: [],
        };
        inspection.onParserBoxStart(box, depth, event.path);
        continue;
      }

      if (event.event === "box-complete") {
        inspection.onParserBoxComplete(
          event.box,
          event.path.length - 1,
          event.path,
        );
      }
    }

    inspection.addEmptyInputNotice();
    progressReporter(options.inputTotalBytes ?? null, true);

    if (options.rangeReader) {
      await inspection.completeLocalFileAnalysis(
        options.rangeReader,
        abortSignal,
      );
      if (abortSignal.aborted) {
        return;
      }
    }

    inspection.completeFromParseCollector();
  } catch (err) {
    if (abortSignal.aborted) {
      return;
    }
    const message = err instanceof Error ? err.message : err;
    inspection.signalParseError(new Error(`parse error: ${message}`));
    console.error("parse error", err);
  } finally {
    if (!abortSignal.aborted) {
      inspection.signalParseSuccess();
    }
  }
}

/**
 * @param {import("./InspectionParseHandle.js").default} inspection
 * @param {number | null} totalBytes
 * @returns {(loadedBytes: number | null, force?: boolean) => void}
 */
function createParseProgressReporter(inspection, totalBytes) {
  let lastReportTime = 0;
  let lastReportedBytes = 0;
  const byteStep =
    typeof totalBytes === "number" && totalBytes > 0
      ? Math.max(totalBytes / 100, 256 * 1024)
      : 1024 * 1024;
  return (loadedBytes, force = false) => {
    if (loadedBytes === null) {
      return;
    }
    const now = performance.now();
    if (
      !force &&
      loadedBytes - lastReportedBytes < byteStep &&
      now - lastReportTime < 120
    ) {
      return;
    }
    lastReportTime = now;
    lastReportedBytes = loadedBytes;
    inspection.signalParseByteProgress(loadedBytes, totalBytes);
  };
}

/**
 * This method is intended for cases where you just want the parsed metadata
 * of a segment, without having the associated rendering running at the same
 * time that metadata is constructed.
 *
 * This can be needed e.g. when the corresponding metadata is helping with the
 * parsing of the real segment, but isn't the actual focus, like an
 * initialization segment linked to the media segment the user chose.
 *
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 * @param {AbortSignal} abortSignal
 * @returns {Promise<Array<import("isobmff-inspector").ParsedBox>>}
 */
export async function parseSegmentWithoutRender(input, abortSignal) {
  const parseCollector = new InspectionParseCollector({
    strictFirstBoxValidation: true,
    recoverIncompleteTopLevelBoxes: false,
  });

  for await (const event of parseEvents(input)) {
    if (abortSignal.aborted) {
      return [];
    }

    if (event.event === "box-start") {
      parseCollector.onBoxStart(
        {
          type: event.type,
          size: event.size,
          headerSize: event.headerSize,
          offset: event.offset,
        },
        event.path.length - 1,
      );
      continue;
    }

    parseCollector.onBoxComplete(event.box, event.path.length - 1);
  }

  parseCollector.getEmptyInputNotice();

  return parseCollector.getTopLevelBoxes();
}

/**
 * @param {AsyncIterable<Uint8Array>} input
 * @param {(absoluteOffset: number, bytes: Uint8Array) => void} onChunk
 * @returns {AsyncIterable<Uint8Array>}
 */
export function trackByteInput(input, onChunk) {
  return {
    async *[Symbol.asyncIterator]() {
      let absoluteOffset = 0;
      for await (const chunk of input) {
        onChunk(absoluteOffset, chunk);
        absoluteOffset += chunk.byteLength;
        yield chunk;
      }
    },
  };
}
