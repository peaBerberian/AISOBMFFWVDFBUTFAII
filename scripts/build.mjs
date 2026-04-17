import path from "node:path";
import esbuild from "esbuild";

const shouldMinify = process.env.AISOBMFFWVDFBUTFAII_MINIFY === "true";
const shouldWatch = process.argv.includes("--watch");
const outputFilename = shouldMinify
  ? "aisobmffwvdfbutfaii.min.js"
  : "aisobmffwvdfbutfaii.js";

const buildOptions = {
  bundle: true,
  // TODO: use __dirname equivalent
  entryPoints: ["src/index.js"],
  format: "iife",
  legalComments: "none",
  logLevel: "info",
  minify: shouldMinify,
  // TODO: use __dirname equivalent
  outfile: path.join("build", outputFilename),
  platform: "browser",
};

async function run() {
  if (shouldWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    return;
  }

  await esbuild.build(buildOptions);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
