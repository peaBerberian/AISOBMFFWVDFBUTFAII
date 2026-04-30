import InspectionCoordinator from "../inspection/InspectionCoordinator.js";
import { parseInspectionStream } from "../inspection/parseInspectionStream.js";
import LocalFileReader from "./LocalFileReader.js";

/**
 * Parse a local file while preserving the app's single active parse lifecycle.
 * @param {Blob} file
 */
export function parseLocalFile(file) {
  const { parseHandle, sourceHandle } = InspectionCoordinator.begin();
  const signal = parseHandle.controller.signal;

  const namedFile = /** @type {{ name?: string }} */ (file);
  const reader = new LocalFileReader(file, signal);

  sourceHandle.dispatch({
    type: "local-file-selected",
    source: {
      selectedLabel: "Local file",
      selectedValue: namedFile.name || "Unnamed file",
    },
    status: {
      message: "Loading local file...",
      state: "start",
      progress:
        file.size > 0
          ? { phase: "parse", loadedBytes: 0, totalBytes: file.size }
          : { phase: "parse", indeterminate: true },
    },
  });
  parseInspectionStream(reader.toParserInput(), parseHandle, {
    rangeReader: reader.readRange.bind(reader),
    inputTotalBytes: file.size,
  }).finally(() => {
    InspectionCoordinator.finish(parseHandle);
  });
}
