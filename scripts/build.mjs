import { watch } from "node:fs";
import fs from "node:fs/promises";
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

const styleSources = [
  "base.css",
  "progress.css",
  "shell.css",
  "box-tree.css",
  "values.css",
  "info.css",
  "sizes.css",
].map((filename) => path.join("src", "styles", filename));

async function buildStyles() {
  const styles = await Promise.all(
    styleSources.map((source) => fs.readFile(source, "utf8")),
  );
  await fs.mkdir("build", { recursive: true });
  await fs.writeFile(
    "build/style.css",
    `${styles.map((style) => style.trimEnd()).join("\n\n")}\n`,
  );
}

function watchStyles() {
  let queued = false;

  const rebuild = async () => {
    if (queued) {
      return;
    }

    queued = true;
    queueMicrotask(async () => {
      try {
        await buildStyles();
        console.log("rebuilt build/style.css");
      } catch (error) {
        console.error(error);
      } finally {
        queued = false;
      }
    });
  };

  watch(path.join("src", "styles"), (_eventType, filename) => {
    if (!filename?.endsWith(".css")) {
      return;
    }

    rebuild();
  });
}

async function run() {
  await buildStyles();

  if (shouldWatch) {
    watchStyles();
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
