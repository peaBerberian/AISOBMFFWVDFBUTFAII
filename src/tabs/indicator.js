export default function updateTabIndicator() {
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
