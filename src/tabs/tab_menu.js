import { requireElementById } from "../dom.js";

/**
 * @param {string} tabName
 */
export function switchToTab(tabName) {
  const tabElts = document.getElementsByClassName("tab");
  for (let tabIdx = 0; tabIdx < tabElts.length; tabIdx++) {
    const tabEl = /** @type {HTMLElement} */ (tabElts[tabIdx]);
    const isActive = tabEl.dataset.tab === tabName;
    tabEl.classList.toggle("active", isActive);
    tabEl.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  const tabPanelElts = document.getElementsByClassName("tab-panel");
  for (let tabPanelIdx = 0; tabPanelIdx < tabPanelElts.length; tabPanelIdx++) {
    const tabPanel = /** @type {HTMLElement} */ (tabPanelElts[tabPanelIdx]);
    const isActive = tabPanel.id === `tab-${tabName}`;
    tabPanel.classList.toggle("active", isActive);
    tabPanel.hidden = !isActive;
  }

  updateTabIndicator();
}

export function initializeTabNavigation() {
  const tabElts = document.getElementsByClassName("tab");
  for (let tabIdx = 0; tabIdx < tabElts.length; tabIdx++) {
    const tabEl = /** @type {HTMLElement} */ (tabElts[tabIdx]);
    tabEl.addEventListener("click", () => {
      if (tabEl.dataset.tab) {
        switchToTab(tabEl.dataset.tab);
      }
    });
    tabEl.addEventListener("keydown", (evt) => {
      if (
        evt.key !== "ArrowLeft" &&
        evt.key !== "ArrowRight" &&
        evt.key !== "Home" &&
        evt.key !== "End"
      ) {
        return;
      }

      evt.preventDefault();
      const nextTab = getNextTab(tabEl, evt.key);
      nextTab?.focus();
      if (nextTab?.dataset.tab) {
        switchToTab(nextTab.dataset.tab);
      }
    });
  }

  updateTabIndicator();
  window.addEventListener("resize", updateTabIndicator);
}

/**
 * @param {HTMLElement} currentTab
 * @param {string} key
 * @returns {HTMLElement | null}
 */
function getNextTab(currentTab, key) {
  const tabs = Array.from(document.getElementsByClassName("tab")).filter(
    (tab) => tab instanceof HTMLElement,
  );
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex < 0) {
    return null;
  }
  if (key === "Home") {
    return tabs[0] ?? null;
  }
  if (key === "End") {
    return tabs.at(-1) ?? null;
  }
  const offset = key === "ArrowRight" ? 1 : -1;
  return tabs[(currentIndex + offset + tabs.length) % tabs.length] ?? null;
}

function updateTabIndicator() {
  const tabs = requireElementById("tabs", HTMLElement);
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  const tabsRect = tabs.getBoundingClientRect();
  const activeRect = activeTab.getBoundingClientRect();
  tabs.style.setProperty(
    "--active-tab-left",
    `${activeRect.left - tabsRect.left}px`,
  );
  tabs.style.setProperty("--active-tab-width", `${activeRect.width}px`);
}

/**
 * @returns {HTMLElement | null}
 */
function getActiveTab() {
  const tabElts = document.getElementsByClassName("tab");
  for (let tabIdx = 0; tabIdx < tabElts.length; tabIdx++) {
    const tabEl = tabElts[tabIdx];
    if (tabEl instanceof HTMLElement && tabEl.classList.contains("active")) {
      return tabEl;
    }
  }
  return null;
}
