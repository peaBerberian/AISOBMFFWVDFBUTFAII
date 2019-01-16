/* eslint-env node */
const path = require("path");
const shouldMinify = !!process.env.AISOBMFFWVDFBUTFAII_MINIFY;
const outputFilename = shouldMinify ?
  "aisobmffwvdfbutfaii.min.js" : "aisobmffwvdfbutfaii.js";

const config = {
  mode: shouldMinify ? "production" : "development",
  entry: path.join(__dirname, "./src/index.js"),
  output: {
    path: path.join(__dirname, "/build"),
    filename: outputFilename,
  },
};

module.exports = config;
