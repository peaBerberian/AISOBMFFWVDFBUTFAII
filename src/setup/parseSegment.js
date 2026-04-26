import { parseEvents } from "isobmff-inspector";
import InspectionResultsView from "../ui/InspectionResultsView.js";
import ProgressBar from "../ui/ProgressBar.js";
import { createAbortableAsyncIterable } from "../utils/abortables.js";
import { toUint8Array } from "../utils/bytes.js";
import InspectionSession from "./InspectionSession.js";

/**
 * @typedef {{ severity: "warning" | "error", message: string }} ParseNotice
 * @typedef {import("../utils/box_size.js").BoxWithOptionalActualSize} PendingParsedBox
 */

/**
 * Run the streaming parser and render the box tree at the same time. When
 * finished, render the rest of the UI with the right information.
 *
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 * @param {import("./InspectionLifecycle.js").InspectionRun} run
 * @param {{
 *   supplementalMetadataPromise?: Promise<{
 *     boxes: Array<import("isobmff-inspector").ParsedBox>,
 *   } | null>,
 *   rangeReader?: ((start: number, endExclusive: number) => AsyncIterable<Uint8Array>) | null,
 * }} [options]
 */
export async function parseAndRenderSegment(input, run, options = {}) {
  const abortSignal = run.controller.signal;
  let boxCount = 0;
  InspectionResultsView.initializeForNewRender();
  ProgressBar.updateStatus("parsing…");

  let completed = false;
  /** @type {ParseNotice | null} */
  let inputHeuristicNotice = null;
  let supplementalMetadata = null;
  if (options.supplementalMetadataPromise) {
    try {
      supplementalMetadata = await options.supplementalMetadataPromise;
    } catch (err) {
      if (abortSignal.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      InspectionResultsView.renderNotice({
        severity: "warning",
        message: `Supplemental init metadata could not be loaded: ${message}`,
      });
    }
  }
  const inspectionSession = new InspectionSession({
    supplementalBoxes: supplementalMetadata?.boxes ?? [],
  });
  run.session = inspectionSession;
  const byteTrackedInput = createByteTrackedInput(
    input,
    abortSignal,
    inspectionSession.onInputBytes.bind(inspectionSession),
  );

  try {
    for await (const event of parseEvents(byteTrackedInput, {
      payloads: {
        include: ["mdat"],
        onChunk(info, chunk) {
          inspectionSession.onMdatPayload(info, chunk);
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
        const notice = inspectionSession.onBoxStart(box, depth);
        if (notice) {
          inputHeuristicNotice = notice;
          InspectionResultsView.renderNotice(notice);
        }
        InspectionResultsView.renderBoxTreeStart(box, depth, event.path);
        continue;
      }

      if (event.event === "box-complete") {
        boxCount++;
        if (boxCount % 5 === 0) {
          ProgressBar.updateStatus(`parsed ${boxCount} boxes…`);
        }

        const box = event.box;
        const depth = event.path.length - 1;
        const wasStarted = InspectionResultsView.completeStartedBox(box, depth);
        if (!wasStarted && depth !== 0) {
          throw new Error(
            `Unrecoverable invalidity for box ${event.path.join("/")}`,
          );
        }
        const completion = inspectionSession.onBoxComplete(box, depth, {
          path: event.path,
          started: wasStarted,
        });
        if (!wasStarted) {
          inputHeuristicNotice = completion.notice;
          if (completion.notice) {
            InspectionResultsView.renderNotice(completion.notice);
          }
          InspectionResultsView.appendStandaloneTopLevelBox(completion.box);
        }
      }
    }

    const emptyInputNotice = inspectionSession.getEmptyInputNotice();
    if (emptyInputNotice) {
      inputHeuristicNotice = emptyInputNotice;
      InspectionResultsView.renderNotice(emptyInputNotice);
    }

    if (options.rangeReader) {
      ProgressBar.updateStatus("deepening codec analysis by reading back…");
      await inspectionSession.completeLocalFileAnalysis(
        options.rangeReader,
        abortSignal,
      );
      if (abortSignal.aborted) {
        return;
      }
    }

    const topLevelBoxes = inspectionSession.getTopLevelBoxes();
    const codecDetailsResults = inspectionSession.getCodecDetailsResults(
      supplementalMetadata?.boxes ?? [],
    );
    InspectionResultsView.renderFullResults({
      topLevelBoxes,
      supplementalMetadata,
      codecDetailsResults,
      byteViewSession: inspectionSession.getByteViewSession(),
    });
    completed = true;
  } catch (err) {
    if (abortSignal.aborted) {
      return;
    }
    InspectionResultsView.clear();
    InspectionResultsView.finalizeFailedRender();
    const message = err instanceof Error ? err.message : err;
    ProgressBar.fail(`parse error: ${message}`);
    console.error("parse error", err);
  } finally {
    if (!abortSignal.aborted) {
      InspectionResultsView.finishRequest();
    }
    if (!abortSignal.aborted && completed) {
      if (inputHeuristicNotice?.severity === "error") {
        ProgressBar.fail(
          "Input does not look like ISOBMFF; tentative result shown.",
        );
      } else {
        ProgressBar.end("File parsed with success!");
      }
    }
  }
}

/**
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 * @param {AbortSignal} signal
 * @param {(absoluteOffset: number, bytes: Uint8Array) => void} onChunk
 * @returns {AsyncIterable<Uint8Array>}
 */
function createByteTrackedInput(input, signal, onChunk) {
  let source = input;
  if (hasBodyLike(source) && source.body) {
    source = source.body;
  } else if (hasStream(source) && typeof source.stream === "function") {
    source = source.stream();
  }

  /** @type {AsyncIterable<Uint8Array>} */
  let iterable;
  if (isReadableStream(source)) {
    iterable = createAbortableAsyncIterable(source, signal);
  } else if (isAsyncIterable(source)) {
    iterable = {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of source) {
          yield toUint8Array(chunk);
        }
      },
    };
  } else if (isIterable(source)) {
    iterable = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of source) {
          yield toUint8Array(chunk);
        }
      },
    };
  } else if (hasArrayBuffer(input) && typeof input.arrayBuffer === "function") {
    iterable = {
      async *[Symbol.asyncIterator]() {
        yield new Uint8Array(await input.arrayBuffer());
      },
    };
  } else {
    throw new TypeError("Unsupported parser input for byte capture.");
  }

  return {
    async *[Symbol.asyncIterator]() {
      let absoluteOffset = 0;
      for await (const chunk of iterable) {
        onChunk(absoluteOffset, chunk);
        absoluteOffset += chunk.byteLength;
        yield chunk;
      }
    },
  };
}

/**
 * @param {unknown} value
 * @returns {value is ReadableStream<import("isobmff-inspector").ISOBMFFByteChunk>}
 */
function isReadableStream(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "getReader" in value &&
    typeof value.getReader === "function"
  );
}

/**
 * @param {unknown} value
 * @returns {value is AsyncIterable<import("isobmff-inspector").ISOBMFFByteChunk>}
 */
function isAsyncIterable(value) {
  return (
    value !== null && typeof value === "object" && Symbol.asyncIterator in value
  );
}

/**
 * @param {unknown} value
 * @returns {value is Iterable<import("isobmff-inspector").ISOBMFFByteChunk>}
 */
function isIterable(value) {
  return (
    value !== null && typeof value === "object" && Symbol.iterator in value
  );
}

/**
 * @param {unknown} value
 * @returns {value is { body?: unknown }}
 */
function hasBodyLike(value) {
  return value !== null && typeof value === "object" && "body" in value;
}

/**
 * @param {unknown} value
 * @returns {value is { stream?: () => unknown }}
 */
function hasStream(value) {
  return value !== null && typeof value === "object" && "stream" in value;
}

/**
 * @param {unknown} value
 * @returns {value is { arrayBuffer: () => Promise<ArrayBuffer> }}
 */
function hasArrayBuffer(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  );
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
  const inspectionSession = new InspectionSession({
    strictFirstBoxValidation: true,
    recoverIncompleteTopLevelBoxes: false,
  });

  for await (const event of parseEvents(input)) {
    if (abortSignal.aborted) {
      return [];
    }

    if (event.event === "box-start") {
      inspectionSession.onBoxStart(
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

    inspectionSession.onBoxComplete(event.box, event.path.length - 1);
  }

  inspectionSession.getEmptyInputNotice();

  return inspectionSession.getTopLevelBoxes();
}
