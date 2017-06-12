/* eslint-env node */
const path = require("path");
const ClosureCompiler = require("webpack-closure-compiler");

const shouldMinify = process.env.AISOBMFFWVDFBUTFAII_MINIFY;

const outputFilename = shouldMinify ?
  "aisobmffwvdfbutfaii.min.js" : "aisobmffwvdfbutfaii.js";

const config = {
  entry: path.join(__dirname, "./src/index.jsx"),
  output: {
    path: path.join(__dirname, "/build"),
    filename: outputFilename,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: {
          loader: "babel-loader",
          options: {
            cacheDirectory: true,
            presets: [
              "react",
              ["es2015", { loose: true, modules: false }],
            ],
          },
        },
      },
    ],
  },
};

if (shouldMinify) {
  config.plugins = [new ClosureCompiler({
    options: {
      compilation_level: "SIMPLE",
      language_in: "ES5",
      warning_level: "VERBOSE",
    },
  })];
}

module.exports = config;
