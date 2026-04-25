import { parseEvents } from "isobmff-inspector";
import InspectionResultsView from "./ui/InspectionResultsView.js";
import ProgressBar from "./ui/ProgressBar.js";

const USUAL_FIRST_BOX_TYPES = new Set([
  "ftyp",
  "styp",
  "sidx",
  "moov",
  "moof",
  "mdat",
  "free",
  "skip",
  "wide",
  "emsg",
  "prft",
  "uuid",
]);

/**
 * @typedef {{ severity: "warning" | "error", message: string }} ParseNotice
 * @typedef {import("./utils/box_size.js").BoxWithOptionalActualSize} PendingParsedBox
 */

/**
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 * @param {AbortSignal} abortSignal
 * @param {{
 *   supplementalMetadataPromise?: Promise<{
 *     boxes: Array<import("isobmff-inspector").ParsedBox>,
 *   } | null>,
 * }} [options]
 */
export default async function parseAndRenderSegment(
  input,
  abortSignal,
  options = {},
) {
  let boxCount = 0;
  InspectionResultsView.prepareForParsing();
  ProgressBar.updateStatus("parsing…");

  let completed = false;
  let inspectedFirstTopLevelBox = false;
  /** @type {ParseNotice | null} */
  let inputHeuristicNotice = null;
  let supplementalMetadata = null;

  try {
    for await (const event of parseEvents(input)) {
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
        if (depth === 0 && !inspectedFirstTopLevelBox) {
          inspectedFirstTopLevelBox = true;
          inputHeuristicNotice = getInputHeuristicNotice(box);
          if (inputHeuristicNotice) {
            InspectionResultsView.renderNotice(inputHeuristicNotice);
          }
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
        if (!InspectionResultsView.completeBox(box, depth, event.path)) {
          inspectedFirstTopLevelBox = true;
          inputHeuristicNotice = getIncompleteHeaderNotice(box);
          InspectionResultsView.renderNotice(inputHeuristicNotice);
          InspectionResultsView.appendRecoveredTopLevelBox(box);
        }
      }
    }

    if (!inspectedFirstTopLevelBox) {
      inputHeuristicNotice = {
        severity: "error",
        message:
          "This input is empty, so it does not look like an ISOBMFF file.",
      };
      InspectionResultsView.renderNotice(inputHeuristicNotice);
    }

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

    InspectionResultsView.finalize(supplementalMetadata);
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
 * @param {import("isobmff-inspector").ParsedBox} box
 * @returns {ParseNotice}
 */
function getIncompleteHeaderNotice(box) {
  const parserIssue = box.issues.find((issue) => issue.severity === "error");
  return {
    severity: "error",
    message: parserIssue
      ? `This input does not start with a complete ISOBMFF box header. ${parserIssue.message} The result below is tentative.`
      : "This input does not start with a complete ISOBMFF box header. The result below is tentative.",
  };
}

/**
 * This is intentionally a UI heuristic, not parser validation. It catches
 * common wrong inputs early while still letting the parser show any tentative
 * structure it can recover.
 * @param {PendingParsedBox} box
 * @returns {ParseNotice | null}
 */
function getInputHeuristicNotice(box) {
  if (!/^[\x20-\x7e]{4}$/.test(box.type)) {
    return {
      severity: "error",
      message:
        "The first top-level box type is not a printable four-character code, so this input is unlikely to be ISOBMFF. The result below is tentative.",
    };
  }

  if (box.size !== 0 && box.size < box.headerSize) {
    return null;
  }

  if (!USUAL_FIRST_BOX_TYPES.has(box.type)) {
    return {
      severity: "error",
      message: `The first top-level box is "${box.type}", which is not a usual ISOBMFF entry box. This input may not be ISOBMFF; the result below is tentative.`,
    };
  }

  return null;
}
