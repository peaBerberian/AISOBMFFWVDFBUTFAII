#!/usr/bin/env node

import { startBuildWatcher } from "./build.mjs";
import launchStaticServer from "./launch_static_server.mjs";

async function main() {
  const buildWatcher = await startBuildWatcher();
  const server = launchStaticServer("build", {
    httpPort: 8000,
    verbose: true,
  });

  server.listeningPromise.catch((error) => {
    buildWatcher.close();
    console.error(`ERROR: ${error}\n`);
    process.exit(1);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      buildWatcher.close();
      server.close();
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
