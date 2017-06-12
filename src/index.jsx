import parseBoxes from "./parser.js";
import render from "./renderer.js";
import React from "react";
import ReactDOM from "react-dom";

// Check for the various File API support.
if (!window.File || !window.FileReader) {
  const div = document.createElement("div");
  div.innerHTML = "Your browser is not compatible.";
  document.body.appendChild(div);
  throw new Error("Your browser is not compatible.");
}

function handleFileSelection(evt) {
  const files = evt.target.files; // FileList object

  if (!files.length) {
    return;
  }

  const file = files[0];
  const reader = new FileReader();

  // TODO read progressively to skip mdat and whatnot
  reader.onload = (evt) => {
    const arr = new Uint8Array(evt.target.result);
    const res = parseBoxes(arr);
    render(res);
  };

  reader.readAsArrayBuffer(file);
}

document.getElementById("file-input")
  .addEventListener("change", handleFileSelection, false);

ReactDOM.render(<div />, document.getElementById("file-description"));
