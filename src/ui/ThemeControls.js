import { requireElementById } from "../utils/dom.js";

const THEME_STORAGE_KEY = "aisobmff-inspector-theme";
const THEMES = new Set(["light", "foundry", "dark"]);

export function initializeThemeControls() {
  const selectElt = requireElementById("theme-select", HTMLSelectElement);
  const initialTheme = getStoredTheme();

  applyTheme(initialTheme);
  selectElt.value = initialTheme;

  selectElt.addEventListener("change", () => {
    const theme = parseTheme(selectElt.value);
    applyTheme(theme);
    storeTheme(theme);
  });
}

/**
 * @param {string} theme
 * @returns {"light" | "foundry" | "dark"}
 */
function parseTheme(theme) {
  if (theme === "foundry" || theme === "dark") {
    return theme;
  }
  return "light";
}

/**
 * @returns {"light" | "foundry" | "dark"}
 */
function getStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme !== null && THEMES.has(storedTheme)) {
      return parseTheme(storedTheme);
    }
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
  return "light";
}

/**
 * @param {"light" | "foundry" | "dark"} theme
 */
function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = theme;
  }
  document.dispatchEvent(
    new CustomEvent("themechange", {
      detail: { theme },
    }),
  );
}

/**
 * @param {"light" | "foundry" | "dark"} theme
 */
function storeTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme switching still works for the current page load.
  }
}
