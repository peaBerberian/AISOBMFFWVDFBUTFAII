import { inspectRemoteSource } from "./inspection/inspectRemoteSource.js";
import { parseLocalFile } from "./sources/local_file.js";
import {
  initializeFileDrop,
  initializeFileReaderInput,
  initializeUrlInput,
} from "./ui/SourceControls.js";
import { initializeTabNavigation } from "./ui/tabs/index.js";
import { requireElementById } from "./utils/dom.js";

initializeFileReaderInput(parseLocalFile);
initializeFileDrop(parseLocalFile);
initializeUrlInput(inspectRemoteSource);
initializeTabNavigation();
initializeGithubStars();

function initializeGithubStars() {
  if (!("fetch" in window)) {
    return;
  }
  const starsElt = requireElementById("github-stars", HTMLElement);

  const fetchStars = async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/peaBerberian/AISOBMFFWVDFBUTFAII",
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!response.ok) {
        return;
      }

      const repository = await response.json();
      if (typeof repository.stargazers_count !== "number") {
        return;
      }

      starsElt.textContent = new Intl.NumberFormat(undefined, {
        notation: repository.stargazers_count >= 1000 ? "compact" : "standard",
      }).format(repository.stargazers_count);
      starsElt.hidden = false;
    } catch {
      // Keep the project link unobtrusive if GitHub is unavailable.
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fetchStars);
  } else {
    globalThis.setTimeout(fetchStars, 1000);
  }
}
