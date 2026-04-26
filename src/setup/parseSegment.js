import { parseEvents } from "isobmff-inspector";
import InspectionResultsView from "../ui/InspectionResultsView.js";
import ProgressBar from "../ui/ProgressBar.js";
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
 * @param {AbortSignal} abortSignal
 * @param {{
 *   supplementalMetadataPromise?: Promise<{
 *     boxes: Array<import("isobmff-inspector").ParsedBox>,
 *   } | null>,
 * }} [options]
 */
export async function parseAndRenderSegment(input, abortSignal, options = {}) {
  let boxCount = 0;
  InspectionResultsView.prepareForParsing();
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

  try {
    for await (const event of parseEvents(input, {
      payloads: {
        include: ["mdat"],
        onChunk(info, chunk) {
          inspectionSession.observePayloadChunk(info, chunk);
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
        InspectionResultsView.beginBox(box, depth, event.path);
        continue;
      }

      if (event.event === "box-complete") {
        boxCount++;
        if (boxCount % 5 === 0) {
          ProgressBar.updateStatus(`parsed ${boxCount} boxes…`);
        }

        const box = event.box;
        const depth = event.path.length - 1;
        const started = InspectionResultsView.completeBox(
          box,
          depth,
          event.path,
        );
        const completion = inspectionSession.onBoxComplete(box, depth, {
          started,
        });
        if (!started) {
          inputHeuristicNotice = completion.notice;
          if (completion.notice) {
            InspectionResultsView.renderNotice(completion.notice);
          }
          InspectionResultsView.appendTopLevelBox(completion.box);
        }
      }
    }

    const emptyInputNotice = inspectionSession.getEmptyInputNotice();
    if (emptyInputNotice) {
      inputHeuristicNotice = emptyInputNotice;
      InspectionResultsView.renderNotice(emptyInputNotice);
    }

    const finalizeData =
      inspectionSession.buildFinalizeData(supplementalMetadata);
    InspectionResultsView.finalize({
      topLevelBoxes: finalizeData.topLevelBoxes,
      supplementalMetadata,
      codecDetailsResults: finalizeData.codecDetailsResults,
    });
    completed = true;
  } catch (err) {
    if (abortSignal.aborted) {
      return;
    }
    InspectionResultsView.clear();
    InspectionResultsView.fail();
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
