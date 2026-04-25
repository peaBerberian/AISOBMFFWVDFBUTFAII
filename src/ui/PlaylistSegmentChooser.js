import { requireElementById } from "../utils/dom.js";
import { createCompactSource } from "../utils/source-utils.js";

const chooserElt = requireElementById("segment-chooser", HTMLElement);

/**
 * @typedef {{
 *   label: string,
 *   url: string,
 *   byteRange: [number, number|undefined]|undefined;
 *   type?: string,
 * }} SegmentChoice
 *
 * @typedef {{
 *   title: string,
 *   summary: string[],
 *   fields: Array<[string, string]>,
 *   choices: SegmentChoice[],
 *   loadLabel?: string,
 *   loadDescription?: string,
 *   onLoadChoices?: (() => Promise<void> | void),
 * }} SegmentChoiceCard
 */

/**
 * @param {string} sourceUrl
 * @param {import("../extractors/dash/types.js").DashTree} tree
 * @param {(
 *   segmentUrl: string,
 *   byteRange: [number, number|undefined]|undefined
 * ) => void} onInspect
 * @param {(representation: import("../extractors/dash/types.js").RepresentationTree) => Promise<void> | void} [onLoadRepresentation]
 */
export function showDashSegmentChooser(
  sourceUrl,
  tree,
  onInspect,
  onLoadRepresentation,
) {
  /** @type {SegmentChoiceCard[]} */
  const cards = [];
  for (let periodIndex = 0; periodIndex < tree.periods.length; periodIndex++) {
    const period = tree.periods[periodIndex];
    for (
      let adaptationIndex = 0;
      adaptationIndex < period.adaptationSets.length;
      adaptationIndex++
    ) {
      const adaptation = period.adaptationSets[adaptationIndex];
      for (
        let representationIndex = 0;
        representationIndex < adaptation.representations.length;
        representationIndex++
      ) {
        const representation = adaptation.representations[representationIndex];
        if (
          representation.segments.length === 0 &&
          !representation.sidxPending
        ) {
          continue;
        }
        cards.push({
          title: formatDashTitle(representation, representationIndex),
          summary: [
            `Period ${period.id || periodIndex + 1}`,
            adaptation.mimeType || representation.mimeType || "unknown type",
            formatBandwidth(representation.bandwidth),
          ],
          fields: [
            ["Adaptation Set", adaptation.id || `${adaptationIndex + 1}`],
            ["Language", adaptation.lang || "n/a"],
            ["Codecs", representation.codecs || adaptation.codecs || "n/a"],
            [
              "Segments",
              representation.sidxPending
                ? representation.segments.length > 0
                  ? `${representation.segments.length} loaded + more via SIDX`
                  : "Load via SIDX on demand"
                : `${representation.segments.length}`,
            ],
          ],
          choices: representation.segments.map((segment, segmentIndex) => ({
            label: formatDashSegmentLabel(segment, segmentIndex),
            url: segment.url,
            byteRange: segment.byteRange,
            type: segment.type,
          })),
          loadLabel: representation.sidxPending
            ? "Load segment list"
            : undefined,
          loadDescription: representation.sidxPending
            ? "Fetch the SIDX for this representation and enumerate its media segments."
            : undefined,
          onLoadChoices:
            representation.sidxPending && onLoadRepresentation
              ? () => onLoadRepresentation(representation)
              : undefined,
        });
      }
    }
  }

  renderChooser({
    title: "Select an MP4 segment from that DASH content",
    intro:
      "The MPD was fetched successfully. Pick an initialization or media segment to start inspecting it.",
    sourceUrl,
    cards,
    onInspect,
  });
}

/**
 * @param {string} sourceUrl
 * @param {import("../extractors/hls/index.js").ExtractionResult} extraction
 * @param {(
 *   segmentUrl: string,
 *   byteRange: [number, number|undefined]|undefined
 * ) => void} onInspect
 * @param {(result: import("../extractors/hls/index.js").PlaylistResult) => Promise<void> | void} [onLoadResult]
 */
export function showHlsSegmentChooser(
  sourceUrl,
  extraction,
  onInspect,
  onLoadResult,
) {
  /** @type {SegmentChoiceCard[]} */
  const cards = [];

  for (
    let resultIndex = 0;
    resultIndex < extraction.results.length;
    resultIndex++
  ) {
    const result = extraction.results[resultIndex];
    const choices = result.segments === null ? [] : collectHlsChoices(result);
    if (!choices.length && result.segments !== null) {
      continue;
    }
    cards.push({
      title: formatHlsTitle(result, resultIndex),
      summary: [
        `Root playlist: ${extraction.playlistKind}`,
        result.kind,
        result.segments === null
          ? "segment list not loaded"
          : `${result.segments.length} segment${result.segments.length === 1 ? "" : "s"}`,
      ],
      fields: getHlsFields(result),
      choices,
      loadLabel: result.segments === null ? "Load segment list" : undefined,
      loadDescription:
        result.segments === null
          ? "Fetch this media playlist and enumerate its initialization map and media segments."
          : undefined,
      onLoadChoices:
        result.segments === null && onLoadResult
          ? () => onLoadResult(result)
          : undefined,
    });
  }

  renderChooser({
    title: "Choose an HLS segment",
    intro:
      "The playlist was resolved successfully. Pick an initialization map or media segment to inspect.",
    sourceUrl,
    cards,
    onInspect,
  });
}

export function hideSegmentChooser() {
  chooserElt.hidden = true;
  chooserElt.replaceChildren();
}

export function hasVisibleSegmentChooser() {
  return !chooserElt.hidden;
}

/**
 * @param {{
 *   title: string,
 *   intro: string,
 *   sourceUrl: string,
 *   cards: SegmentChoiceCard[],
 *   onInspect: (
 *     segmentUrl: string,
 *     byteRange: [number, number|undefined]|undefined
 *   ) => void
 * }} input
 */
function renderChooser(input) {
  chooserElt.replaceChildren();

  const header = document.createElement("div");
  header.className = "segment-chooser-header";

  const title = document.createElement("h2");
  title.className = "segment-chooser-title";
  title.textContent = input.title;
  header.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "segment-chooser-intro";
  intro.textContent = input.intro;
  header.appendChild(intro);

  chooserElt.appendChild(header);

  const cardsWrap = document.createElement("div");
  cardsWrap.className = "segment-choice-grid";
  chooserElt.appendChild(cardsWrap);

  for (let cardIndex = 0; cardIndex < input.cards.length; cardIndex++) {
    cardsWrap.appendChild(
      createChoiceCard(input.cards[cardIndex], input.onInspect),
    );
  }

  chooserElt.hidden = false;
}

/**
 * @param {SegmentChoiceCard} card
 * @param {(
 *   segmentUrl: string,
 *   byteRange: [number, number|undefined]|undefined
 * ) => void} onInspect
 */
function createChoiceCard(card, onInspect) {
  const article = document.createElement("article");
  article.className = "segment-choice-card";

  const heading = document.createElement("h3");
  heading.className = "segment-choice-title";
  heading.textContent = card.title;
  article.appendChild(heading);

  const summary = document.createElement("p");
  summary.className = "segment-choice-summary";
  summary.textContent = card.summary.filter(Boolean).join("  •  ");
  article.appendChild(summary);

  const fields = document.createElement("dl");
  fields.className = "segment-choice-fields";
  for (let fieldIndex = 0; fieldIndex < card.fields.length; fieldIndex++) {
    const [name, value] = card.fields[fieldIndex];
    if (!value) {
      continue;
    }
    const dt = document.createElement("dt");
    dt.textContent = name;
    const dd = document.createElement("dd");
    dd.textContent = value;
    fields.appendChild(dt);
    fields.appendChild(dd);
  }
  article.appendChild(fields);

  if (card.onLoadChoices) {
    const loadControls = document.createElement("div");
    loadControls.className = "segment-choice-controls";
    article.appendChild(loadControls);
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "segment-choice-button";
    loadButton.textContent = card.loadLabel || "Load";
    article.appendChild(loadButton);
    loadButton.addEventListener("click", async () => {
      loadButton.disabled = true;
      loadButton.textContent = "Loading...";
      try {
        await card.onLoadChoices?.();
      } catch {
        loadButton.disabled = false;
        loadButton.textContent = card.loadLabel || "Load";
      }
    });
  }

  if (!card.choices.length) {
    return article;
  }

  const controls = document.createElement("div");
  controls.className = "segment-choice-controls";
  article.appendChild(controls);

  const indexInput = /** @type {HTMLInputElement} */ (
    document.createElement("input")
  );
  indexInput.className = "segment-choice-index";
  indexInput.type = "number";
  indexInput.min = "1";
  indexInput.max = `${card.choices.length}`;
  indexInput.step = "1";
  indexInput.setAttribute("aria-label", "Selected segment index");
  controls.appendChild(indexInput);

  const countLabel = document.createElement("div");
  countLabel.className = "segment-choice-count";
  controls.appendChild(countLabel);

  const inspectButton = document.createElement("button");
  inspectButton.type = "button";
  inspectButton.className = "segment-choice-button";
  inspectButton.textContent = "Inspect";
  controls.appendChild(inspectButton);

  const shortcuts = document.createElement("div");
  shortcuts.className = "segment-choice-shortcuts";
  article.appendChild(shortcuts);

  const selectedLabel = document.createElement("p");
  selectedLabel.className = "segment-choice-selected-label";
  article.appendChild(selectedLabel);

  const selectedUrl = document.createElement("div");
  selectedUrl.className = "segment-choice-selected-url";
  article.appendChild(selectedUrl);

  let selectedIndex = getInitialChoiceIndex(card.choices);

  /** @param {number} nextIndex */
  function updateSelection(nextIndex) {
    selectedIndex = clampChoiceIndex(nextIndex, card.choices.length);
    const choice = card.choices[selectedIndex];
    indexInput.value = `${selectedIndex + 1}`;
    countLabel.textContent = `of ${card.choices.length}`;
    selectedLabel.textContent = `Selected entry: ${choice.label}`;
    selectedLabel.title = choice.label;
    selectedUrl.replaceChildren(
      createCompactSource("Selected URL", choice.url),
    );
    updateShortcutState(shortcuts, selectedIndex);
  }

  addShortcutButton(shortcuts, "First", 0, () => {
    updateSelection(0);
  });
  appendTypeShortcut(
    shortcuts,
    card.choices,
    "init",
    "First init",
    updateSelection,
  );
  appendTypeShortcut(
    shortcuts,
    card.choices,
    "media",
    "First media",
    updateSelection,
  );
  appendTypeShortcut(
    shortcuts,
    card.choices,
    "index",
    "First index",
    updateSelection,
  );
  addShortcutButton(shortcuts, "Last", card.choices.length - 1, () => {
    updateSelection(card.choices.length - 1);
  });

  indexInput.addEventListener("change", () => {
    updateSelection((Number(indexInput.value) || 1) - 1);
  });
  indexInput.addEventListener("blur", () => {
    updateSelection((Number(indexInput.value) || 1) - 1);
  });
  inspectButton.addEventListener("click", () => {
    onInspect(
      card.choices[selectedIndex].url,
      card.choices[selectedIndex].byteRange,
    );
  });

  updateSelection(selectedIndex);
  return article;
}

/**
 * @param {import("../extractors/hls/index.js").PlaylistResult} result
 * @returns {SegmentChoice[]}
 */
function collectHlsChoices(result) {
  if (result.segments === null) {
    return [];
  }
  /** @type {SegmentChoice[]} */
  const choices = [];
  const seen = new Set();

  for (
    let segmentIndex = 0;
    segmentIndex < result.segments.length;
    segmentIndex++
  ) {
    const segment = result.segments[segmentIndex];
    if (segment.map) {
      const mapKey = `${segment.map.url}::${formatByteRange(segment.map.byteRange)}`;
      if (!seen.has(mapKey)) {
        seen.add(mapKey);
        choices.push({
          label: `init map ${choices.length + 1} · ${formatByteRange(segment.map.byteRange) || "full resource"} · ${formatUrlLabel(segment.map.url)}`,
          url: segment.map.url,
          byteRange: segment.map.byteRange ?? undefined,
          type: "init",
        });
      }
    }

    const key = `${segment.url}::${formatByteRange(segment.byteRange)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    choices.push({
      label: formatHlsSegmentLabel(segment, segmentIndex),
      url: segment.url,
      byteRange: segment.byteRange ?? undefined,
      type: "media",
    });
  }

  return choices;
}

/**
 * @param {import("../extractors/hls/index.js").PlaylistResult} result
 * @param {number} resultIndex
 */
function formatHlsTitle(result, resultIndex) {
  if ("attributes" in result && result.attributes) {
    if (result.kind === "variant") {
      return (
        result.attributes.stableVariantId ||
        result.attributes.resolution ||
        result.attributes.codecs ||
        `Variant ${resultIndex + 1}`
      );
    }
    return (
      result.attributes.name ||
      result.attributes.language ||
      result.attributes.groupId ||
      `Rendition ${resultIndex + 1}`
    );
  }
  return result.kind === "plain" ? "Playlist" : `Media ${resultIndex + 1}`;
}

/**
 * @param {import("../extractors/hls/index.js").PlaylistResult} result
 * @returns {Array<[string, string]>}
 */
function getHlsFields(result) {
  if (!("attributes" in result) || !result.attributes) {
    return [
      [
        "Segments",
        result.segments === null ? "Not loaded" : `${result.segments.length}`,
      ],
    ];
  }

  if (result.kind === "variant") {
    return [
      ["Bandwidth", formatNumericValue(result.attributes.bandwidth)],
      ["Average", formatNumericValue(result.attributes.averageBandwidth)],
      ["Resolution", result.attributes.resolution || "n/a"],
      ["Codecs", result.attributes.codecs || "n/a"],
      ["Audio Group", result.attributes.audio || "n/a"],
      [
        "Segments",
        result.segments === null ? "Not loaded" : `${result.segments.length}`,
      ],
    ];
  }

  return [
    ["Type", result.attributes.type || "n/a"],
    ["Name", result.attributes.name || "n/a"],
    ["Language", result.attributes.language || "n/a"],
    ["Group", result.attributes.groupId || "n/a"],
    ["Channels", result.attributes.channels || "n/a"],
    [
      "Segments",
      result.segments === null ? "Not loaded" : `${result.segments.length}`,
    ],
  ];
}

/**
 * @param {import("../extractors/dash/types.js").RepresentationTree} representation
 * @param {number} representationIndex
 */
function formatDashTitle(representation, representationIndex) {
  return (
    representation.id ||
    formatBandwidth(representation.bandwidth) ||
    representation.codecs ||
    `Representation ${representationIndex + 1}`
  );
}

/**
 * @param {import("../extractors/dash/types.js").SegmentItem} segment
 * @param {number} segmentIndex
 */
function formatDashSegmentLabel(segment, segmentIndex) {
  return `${segment.type} ${segmentIndex + 1} · ${formatUrlLabel(segment.url)}`;
}

/**
 * @param {import("../extractors/hls/index.js").ISOBMFFSegment} segment
 * @param {number} segmentIndex
 */
function formatHlsSegmentLabel(segment, segmentIndex) {
  const details = [
    `segment ${segmentIndex + 1}`,
    formatDuration(segment.duration),
    formatByteRange(segment.byteRange),
    segment.title,
    segment.discontinuity ? "discontinuity" : "",
    formatUrlLabel(segment.url),
  ].filter(Boolean);
  return details.join(" · ");
}

/**
 * @param {SegmentChoice[]} choices
 */
function getInitialChoiceIndex(choices) {
  for (let i = 0; i < choices.length; i++) {
    if (choices[i].type === "init") {
      return i;
    }
  }
  for (let i = 0; i < choices.length; i++) {
    if (choices[i].type === "media") {
      return i;
    }
  }
  return 0;
}

/**
 * @param {number} index
 * @param {number} length
 */
function clampChoiceIndex(index, length) {
  if (length <= 1) {
    return 0;
  }
  if (Number.isNaN(index) || index < 0) {
    return 0;
  }
  if (index >= length) {
    return length - 1;
  }
  return index;
}

/**
 * @param {HTMLElement} wrap
 * @param {SegmentChoice[]} choices
 * @param {string} type
 * @param {string} label
 * @param {(index: number) => void} onChoose
 */
function appendTypeShortcut(wrap, choices, type, label, onChoose) {
  const index = choices.findIndex((choice) => choice.type === type);
  if (index < 0) {
    return;
  }
  addShortcutButton(wrap, label, index, () => {
    onChoose(index);
  });
}

/**
 * @param {HTMLElement} wrap
 * @param {string} label
 * @param {number} index
 * @param {() => void} onClick
 */
function addShortcutButton(wrap, label, index, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "segment-choice-chip";
  button.textContent = label;
  button.dataset.choiceIndex = `${index}`;
  button.addEventListener("click", onClick);
  wrap.appendChild(button);
}

/**
 * @param {HTMLElement} wrap
 * @param {number} selectedIndex
 */
function updateShortcutState(wrap, selectedIndex) {
  const buttons = wrap.getElementsByClassName("segment-choice-chip");
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    button.classList.toggle(
      "is-active",
      Number(button.dataset.choiceIndex) === selectedIndex,
    );
  }
}

/**
 * @param {number | null | undefined} value
 */
function formatNumericValue(value) {
  return typeof value === "number" ? value.toLocaleString() : "n/a";
}

/**
 * @param {number | null | undefined} bandwidth
 */
function formatBandwidth(bandwidth) {
  if (typeof bandwidth !== "number") {
    return "";
  }
  return `${bandwidth.toLocaleString()} bps`;
}

/**
 * @param {number | null | undefined} duration
 */
function formatDuration(duration) {
  return typeof duration === "number" ? `${duration.toFixed(3)} s` : "";
}

/**
 * @param {[number, number|undefined] | null | undefined} byteRange
 */
function formatByteRange(byteRange) {
  if (!byteRange) {
    return "";
  }
  return `${byteRange[0]}-${byteRange[1] ?? ""}`;
}

/**
 * @param {string} url
 */
function formatUrlLabel(url) {
  try {
    const parsed = new URL(url, window.location.href);
    const parts = parsed.pathname.split("/");
    const tail = parts[parts.length - 1];
    return tail || parsed.hostname || url;
  } catch {
    return url;
  }
}
