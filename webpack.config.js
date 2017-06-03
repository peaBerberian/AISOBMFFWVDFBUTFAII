/* eslint-env node */
const path = require("path");
const ClosureCompiler = require("webpack-closure-compiler");

const shouldMinify = process.env.AISOBMFFWVDFBUTFAII_MINIFY;

const outputFilename = shouldMinify ?
  "aisobmffwvdfbutfaii.min.js" : "aisobmffwvdfbutfaii.js";

const config = {
  entry: path.join(__dirname, "./src/index.js"),
  output: {
    path: path.join(__dirname, "/build"),
    filename: outputFilename,
  },
};

if (shouldMinify) {
  config.plugins = [new ClosureCompiler({
    options: {
      compilation_level: "SIMPLE",
      language_in: "ES7",
      warning_level: "VERBOSE",
    },
  })];
}

module.exports = config;
