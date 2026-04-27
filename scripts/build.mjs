import { watch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

const stylesDirectory = path.join("src", "styles");
const prioritizedStyleFilenames = ["base.css", "shared.css"];

async function getStyleSources() {
  const presentFiles = await fs.readdir(stylesDirectory, {
    withFileTypes: true,
  });
  const cssFilenames = presentFiles
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => entry.name);

  const missingRequiredFiles = prioritizedStyleFilenames.filter(
    (filename) => !cssFilenames.includes(filename),
  );
  if (missingRequiredFiles.length > 0) {
    throw new Error(
      `Missing required CSS file(s) in ${stylesDirectory}: ${missingRequiredFiles.join(
        ", ",
      )}`,
    );
  }

  const remainingFilenames = cssFilenames
    .filter((filename) => !prioritizedStyleFilenames.includes(filename))
    .sort((left, right) => left.localeCompare(right));

  return [...prioritizedStyleFilenames, ...remainingFilenames].map((filename) =>
    path.join(stylesDirectory, filename),
  );
}

export async function buildStyles() {
  const styleSources = await getStyleSources();
  const styles = await Promise.all(
    styleSources.map((source) => fs.readFile(source, "utf8")),
  );
  await fs.mkdir("build", { recursive: true });
  await fs.writeFile(
    "build/style.css",
    `${styles.map((style) => style.trimEnd()).join("\n\n")}\n`,
  );
}

export function watchStyles() {
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

  const watcher = watch(stylesDirectory, (_eventType, filename) => {
    if (!filename?.endsWith(".css")) {
      return;
    }

    rebuild();
  });

  return {
    close() {
      watcher.close();
    },
  };
}

export async function runBuild() {
  await buildStyles();

  if (shouldWatch) {
    const styleWatcher = watchStyles();
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log("[watch] build finished, watching for changes...");
    return {
      close() {
        styleWatcher.close();
        void context.dispose();
      },
    };
  }

  await esbuild.build(buildOptions);
  return null;
}

export async function startBuildWatcher() {
  await buildStyles();
  await esbuild.build(buildOptions);
  const styleWatcher = watchStyles();
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log("[watch] build finished, watching for changes...");
  return {
    close() {
      styleWatcher.close();
      void context.dispose();
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBuild().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
