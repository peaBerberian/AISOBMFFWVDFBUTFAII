/**
 * @param {string} tabName
 */
export function switchToTab(tabName) {
  const tabElts = document.getElementsByClassName("tab");
  for (let tabIdx = 0; tabIdx < tabElts.length; tabIdx++) {
    const tabEl = /** @type {HTMLElement} */ (tabElts[tabIdx]);
    tabEl.classList.toggle("active", tabEl.dataset.tab === tabName);
  }

  const tabPanelElts = document.getElementsByClassName("tab-panel");
  for (let tabPanelIdx = 0; tabPanelIdx < tabPanelElts.length; tabPanelIdx++) {
    const tabPanel = tabPanelElts[tabPanelIdx];
    tabPanel.classList.remove("active");
  }
  document.getElementById(`tab-${tabName}`)?.classList.add("active");

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
  }

  updateTabIndicator();
  window.addEventListener("resize", updateTabIndicator);
}

function updateTabIndicator() {
  const tabs = document.getElementById("tabs");
  const activeTab = /** @type {HTMLElement | null} */ (
    document.querySelector(".tab.active")
  );
  if (!tabs || !activeTab) {
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
