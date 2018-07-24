/* eslint-env node */
const path = require("path");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");

const shouldMinify = process.env.AISOBMFFWVDFBUTFAII_MINIFY;

const outputFilename = shouldMinify ?
  "aisobmffwvdfbutfaii.min.js" : "aisobmffwvdfbutfaii.js";

const config = {
  mode: "production",
  entry: path.join(__dirname, "./src/index.js"),
  output: {
    path: path.join(__dirname, "/build"),
    filename: outputFilename,
  },
  optimization: {
    minimizer: shouldMinify ? [new UglifyJsPlugin()] : [
      new UglifyJsPlugin({
        uglifyOptions: {
          compress: {
            keep_infinity: true,
            inline: false,
            reduce_funcs: false, // does not work well on commentated funcs.
                                 // TODO open issue on uglify
          },
          keep_fnames: true,
          keep_classnames: true,
          keep_fargs: true,
          mangle: false,
          output: {
            beautify: true,
            comments: true,
          },
        },
      }),
    ],
  },
};

module.exports = config;
