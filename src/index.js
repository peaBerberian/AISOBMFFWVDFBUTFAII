import inspectISOBMFF from "isobmff-inspector";
import render from "./renderer.js";

// -- Feature switching based on the various API support --

if (window.File && window.FileReader && window.Uint8Array) {

  /**
   * @param {Event} evt
   * @returns {Boolean}
   */
  function onFileSelection(evt) {
    const files = evt.target.files; // FileList object

    if (!files.length) {
      return;
    }

    const file = files[0];
    const reader = new FileReader();

    // TODO read progressively to skip mdat and whatnot
    reader.onload = (evt) => {
      const arr = new Uint8Array(evt.target.result);
      const res = inspectISOBMFF(arr);
      render(res);
    };

    reader.readAsArrayBuffer(file);
    return false;
  }

  document.getElementById("file-input")
    .addEventListener("change", onFileSelection, false);

} else {
  const localSegmentInput = document.getElementById("choices-local-segment");
  localSegmentInput.style.display = "none";

  const choiceSeparator = document.getElementById("choices-separator");
  choiceSeparator.style.display = "none";
}

if (window.fetch && window.Uint8Array) {

  /**
   * @param {Event} evt
   */
  function onUrlValidation(url) {
    fetch(url)
      .then(response => response.arrayBuffer())
      .then((arrayBuffer) => {
        const parsed = inspectISOBMFF(new Uint8Array(arrayBuffer));
        render(parsed);
      });
  }

  /**
   * @returns {Boolean}
   */
  function onButtonClicking() {
    const url = document.getElementById("url-input").value;
    if (url) {
      onUrlValidation(url);
      return false;
    }
  }

  /**
   * @param {Event} evt
   * @returns {Boolean}
   */
  function onInputKeyPress(evt) {
    const keyCode = evt.keyCode || evt.which;
    if (keyCode == 13) {
      const url = evt.target.value;
      if (url) {
        onUrlValidation(url);
      }
      return false;
    }
  }

  document.getElementById("url-input")
    .addEventListener("keypress", onInputKeyPress, false);

  document.getElementById("url-button")
    .addEventListener("click", onButtonClicking, false);
} else {
  const choiceSeparator = document.getElementById("choices-separator");
  choiceSeparator.style.display = "none";

  const urlSegmentInput = document.getElementById("choices-url-segment");
  urlSegmentInput.style.display = "none";
}
