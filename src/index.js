import inspectISOBMFF from "isobmff-inspector";
import render from "./renderer.js";

// -- Feature switching based on the various API support --

if (window.File && window.FileReader && window.Uint8Array) {
  /**
   * @param {Event} evt
   * @returns {Boolean}
   */
  function onFileSelection(evt) {
    const fileInputElt = /** @type {HTMLInputElement | null} */ (evt.target);
    if (fileInputElt === null) {
      return;
    }

    /** @type FileList | null */
    const files = fileInputElt.files; // FileList object

    if (files !== null && !files.length) {
      return;
    }

    inspectISOBMFF(files[0])
      .then(
        /** @param {*} data */
        (data) => {
          render(data);
        },
      )
      .catch(
        /** @param {unknown} err */
        (err) => {
          // TODO: Also display error in UI
          console.error(
            "An error happened which prevented parsing the segment",
            err,
          );
        },
      );
    return false;
  }

  document
    .getElementById("file-input")
    .addEventListener("change", onFileSelection, false);
} else {
  const localSegmentInput = document.getElementById("choices-local-segment");
  localSegmentInput.style.display = "none";

  const choiceSeparator = document.getElementById("choices-separator");
  choiceSeparator.style.display = "none";
}

if (window.fetch && window.Uint8Array) {
  /**
   * @param {string} url
   */
  function onUrlValidation(url) {
    fetch(url)
      .then((response) => inspectISOBMFF(response))
      .then(
        (parsed) => {
          render(parsed);
        },
        (error) => {
          // TODO: Also display error in UI
          console.error("Parsing error:", error);
        },
      );
  }

  /**
   * @returns {Boolean}
   */
  function onButtonClicking() {
    const urlInput = /** @type {HTMLInputElement} */ (
      document.getElementById("url-input")
    );
    const url = urlInput.value;
    if (url) {
      onUrlValidation(url);
      return false;
    }
  }

  /**
   * @param {KeyboardEvent} evt
   * @returns {Boolean}
   */
  function onInputKeyPress(evt) {
    const keyCode = evt.keyCode || evt.which;
    if (keyCode === 13) {
      const urlInput = /** @type {HTMLInputElement | null} */ (evt.target);
      const url = urlInput?.value;
      if (url) {
        onUrlValidation(url);
      }
      return false;
    }
  }

  document
    .getElementById("url-input")
    .addEventListener("keypress", onInputKeyPress, false);

  document
    .getElementById("url-button")
    .addEventListener("click", onButtonClicking, false);
} else {
  const choiceSeparator = document.getElementById("choices-separator");
  choiceSeparator.style.display = "none";

  const urlSegmentInput = document.getElementById("choices-url-segment");
  urlSegmentInput.style.display = "none";
}
