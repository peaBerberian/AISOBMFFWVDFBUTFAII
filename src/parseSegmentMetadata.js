import { parseEvents } from "isobmff-inspector";

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
 * @param {import("isobmff-inspector").ISOBMFFInput} input
 * @param {AbortSignal} abortSignal
 * @returns {Promise<Array<import("isobmff-inspector").ParsedBox>>}
 */
export default async function parseSegmentMetadata(input, abortSignal) {
  /** @type {Array<import("isobmff-inspector").ParsedBox>} */
  const topLevelBoxes = [];
  let inspectedFirstTopLevelBox = false;
  let openTopLevelBox = false;

  for await (const event of parseEvents(input)) {
    if (abortSignal.aborted) {
      return [];
    }

    if (event.event === "box-start") {
      if (event.path.length === 1) {
        openTopLevelBox = true;
        if (!inspectedFirstTopLevelBox) {
          inspectedFirstTopLevelBox = true;
          validateFirstBox({
            type: event.type,
            size: event.size,
            headerSize: event.headerSize,
          });
        }
      }
      continue;
    }

    if (event.path.length !== 1) {
      continue;
    }

    if (!openTopLevelBox) {
      throwIncompleteHeader(event.box);
    }

    openTopLevelBox = false;
    topLevelBoxes.push(event.box);
  }

  if (!inspectedFirstTopLevelBox) {
    throw new Error(
      "This input is empty, so it does not look like an ISOBMFF file.",
    );
  }

  return topLevelBoxes;
}

/**
 * @param {{
 *   type: string,
 *   size: number,
 *   headerSize: number,
 * }} box
 */
function validateFirstBox(box) {
  if (!/^[\x20-\x7e]{4}$/.test(box.type)) {
    throw new Error(
      "The first top-level box type is not a printable four-character code, so this input is unlikely to be ISOBMFF.",
    );
  }

  if (box.size !== 0 && box.size < box.headerSize) {
    return;
  }

  if (!USUAL_FIRST_BOX_TYPES.has(box.type)) {
    throw new Error(
      `The first top-level box is "${box.type}", which is not a usual ISOBMFF entry box.`,
    );
  }
}

/**
 * @param {import("isobmff-inspector").ParsedBox} box
 */
function throwIncompleteHeader(box) {
  const parserIssue = box.issues.find((issue) => issue.severity === "error");
  throw new Error(
    parserIssue
      ? `This input does not start with a complete ISOBMFF box header. ${parserIssue.message}`
      : "This input does not start with a complete ISOBMFF box header.",
  );
}
