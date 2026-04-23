import { el, requireElementById } from "../../dom.js";
import { fmtBytes } from "../utils";
import deriveMediaInfo from "./read";
import { getSampleKindLabel, getSampleKindTitle, numberFormat } from "./utils";

/**
 * @param {Array<import("isobmff-inspector").ParsedBox>} boxes
 */
export default function renderMediaInfo(boxes) {
  const container = requireElementById("media-info", HTMLElement);
  container.innerHTML = "";
  if (!boxes.length) {
    return;
  }

  const info = deriveMediaInfo(boxes);
  container.appendChild(renderSummary(info));
  container.appendChild(renderGops(info));
  container.appendChild(renderFragments(info.fragments));
  container.appendChild(renderTracks(info.tracks));
  container.appendChild(renderHints(info.hints));
}

/**
 * @param {import("./read").MediaInfo} info
 */
function renderSummary(info) {
  const section = createSection("summary");
  const summary = el("div", "info-summary");
  addStat(summary, "type", info.segmentType);
  addStat(summary, "duration", info.durationLabel);
  addStat(summary, "tracks", String(info.trackCount));
  addStat(summary, "fragmented", info.isFragmented ? "yes" : "no");
  addStat(summary, "fast start", fastStartLabel(info.fastStart));
  addStat(summary, "major brand", info.majorBrand ?? "unknown");
  addStat(
    summary,
    "compatible",
    info.compatibleBrands.length ? info.compatibleBrands.join(", ") : "unknown",
  );
  addStat(summary, "file size", fmtBytes(info.totalSize));
  addStat(summary, "metadata", fmtBytes(info.metadataSize));
  section.body.appendChild(summary);
  return section.section;
}

/**
 * @param {import("./read").MediaInfo} info
 */
function renderGops(info) {
  const allGops = [
    ...info.tracks.map((track) => ({
      label: `track ${track.id || "?"}`,
      gops: track.gops,
      note: track.gop,
      frameArrangement: track.frameArrangement,
      sampleTimeline: track.sampleTimeline,
    })),
    ...info.fragments.map((fragment, index) => ({
      label: `fragment ${fragment.sequence || index + 1} / track ${fragment.trackId}`,
      gops: fragment.gops,
      note:
        fragment.gops.length > 1
          ? `${numberFormat(fragment.gops.length)} GOPs from sample flags`
          : null,
      frameArrangement: fragment.frameArrangement,
      sampleTimeline: fragment.sampleTimeline,
    })),
  ].filter(
    (entry) =>
      entry.gops.length > 1 ||
      entry.note ||
      entry.frameArrangement != null ||
      entry.sampleTimeline != null,
  );

  if (!allGops.length) {
    return document.createDocumentFragment();
  }

  const section = createSection("GOPs");
  const list = el("div", "info-gop-list");
  for (const entry of allGops) {
    const row = el("div", "info-gop-row");
    const label = el("div", "info-gop-label");
    label.textContent = entry.note
      ? `${entry.label} - ${entry.note}`
      : entry.label;
    row.appendChild(label);
    if (entry.gops.length > 1) {
      row.appendChild(renderGopBar(entry.gops));
    }
    if (entry.frameArrangement) {
      const arrangement = el("div", "info-frame-arrangement");
      arrangement.textContent = entry.frameArrangement;
      row.appendChild(arrangement);
    }
    if (entry.sampleTimeline) {
      row.appendChild(renderSampleTimeline(entry.sampleTimeline));
    }
    list.appendChild(row);
  }
  section.body.appendChild(list);
  return section.section;
}

/**
 * @param {import("./read").FragmentInfo[]} fragments
 */
function renderFragments(fragments) {
  if (!fragments.length) {
    return document.createDocumentFragment();
  }

  const section = createSection("fragments");
  const list = el("div", "info-track-list");
  fragments.forEach((fragment, index) => {
    const card = el("article", "info-track");
    const title = el("div", "info-track-title");
    const kind = el("span", "info-track-kind info-track-kind-metadata");
    kind.textContent = "fragment";
    const heading = el("h3");
    heading.textContent = `fragment ${fragment.sequence || index + 1}`;
    title.appendChild(kind);
    title.appendChild(heading);
    card.appendChild(title);

    const facts = /** @type {HTMLDListElement} */ (el("dl", "info-facts"));
    addFact(facts, "track", fragment.trackId);
    addFact(facts, "tfdt", fragment.baseDecodeTime);
    addFact(facts, "decode window", fragment.decodeWindow);
    addFact(facts, "samples", numberFormat(fragment.sampleCount));
    addFact(facts, "duration", fragment.duration);
    addFact(facts, "sample size", fragment.sampleSize);
    for (const detail of fragment.sampleSizeDetails) {
      addFact(facts, "size detail", detail);
    }
    addFact(facts, "timing", fragment.timing);
    for (const detail of fragment.timingDetails) {
      addFact(facts, "timing detail", detail);
    }
    addFact(
      facts,
      "GOP",
      fragment.gops.length
        ? `${numberFormat(fragment.gops.length)} groups from sample flags`
        : "not available from this segment metadata",
    );
    card.appendChild(facts);
    list.appendChild(card);
  });
  section.body.appendChild(list);
  return section.section;
}

/**
 * @param {import("./read").TrackInfo[]} tracks
 */
function renderTracks(tracks) {
  if (!tracks.length) {
    return document.createDocumentFragment();
  }

  const section = createSection("tracks");
  const list = el("div", "info-track-list");
  tracks.forEach((track, index) => {
    const card = el("article", "info-track");
    const title = el("div", "info-track-title");
    const kind = el("span", `info-track-kind info-track-kind-${track.kind}`);
    kind.textContent = track.kind;
    const heading = el("h3");
    heading.textContent = `track ${track.id || index + 1}`;
    title.appendChild(kind);
    title.appendChild(heading);
    card.appendChild(title);

    const facts = /** @type {HTMLDListElement} */ (el("dl", "info-facts"));
    addFact(facts, "codec", track.codec);
    addFact(facts, "duration", track.durationLabel);
    addFact(facts, "size", track.dimensions);
    addFact(facts, "audio", track.audio);
    addFact(facts, "language", track.language);
    addFact(facts, "samples", track.samples);
    addFact(facts, "sync", track.syncSamples);
    addFact(facts, "sample size", track.sampleSize);
    for (const detail of track.sampleSizeDetails) {
      addFact(facts, "size detail", detail);
    }
    addFact(facts, "timing", track.timing);
    for (const detail of track.timingDetails) {
      addFact(facts, "timing detail", detail);
    }
    addFact(facts, "GOP", track.gop);
    for (const detail of track.details) {
      addFact(facts, "detail", detail);
    }
    card.appendChild(facts);
    list.appendChild(card);
  });
  section.body.appendChild(list);
  return section.section;
}

/**
 * @param {string[]} hints
 */
function renderHints(hints) {
  const section = createSection("observations");
  if (!hints.length) {
    const empty = el("div", "info-empty");
    empty.textContent = "No notable observations from parsed metadata.";
    section.body.appendChild(empty);
    return section.section;
  }

  const list = el("ul", "info-hints");
  for (const hint of hints) {
    const item = el("li");
    item.textContent = hint;
    list.appendChild(item);
  }
  section.body.appendChild(list);
  return section.section;
}

/**
 * @param {string} title
 */
function createSection(title) {
  const section = /** @type {HTMLDetailsElement} */ (
    el("details", "info-section")
  );
  section.open = true;
  const summary = el("summary", "info-section-title");
  const caret = el("span", "box-caret");
  caret.setAttribute("aria-hidden", "true");
  const label = el("span", "info-section-label");
  label.textContent = title;
  summary.appendChild(caret);
  summary.appendChild(label);
  const body = el("div", "info-section-body");
  section.appendChild(summary);
  section.appendChild(body);
  return { section, body };
}

/**
 * @param {HTMLElement} parent
 * @param {string} label
 * @param {string} value
 */
function addStat(parent, label, value) {
  if (!shouldShowStat(value)) {
    return;
  }
  const item = el("div", "info-stat");
  const labelEl = el("span", "info-stat-label");
  labelEl.textContent = label;
  const valueEl = el("span", "info-stat-value");
  valueEl.textContent = value;
  item.appendChild(labelEl);
  item.appendChild(valueEl);
  parent.appendChild(item);
}

/**
 * @param {string} value
 */
function shouldShowStat(value) {
  return value !== "unknown" && value !== "0";
}

/**
 * @param {HTMLDListElement} list
 * @param {string} key
 * @param {string | null} value
 */
function addFact(list, key, value) {
  if (!value) {
    return;
  }
  const term = el("dt");
  term.textContent = key;
  const detail = el("dd");
  detail.textContent = value;
  list.appendChild(term);
  list.appendChild(detail);
}

/**
 * @param {import("./read").GopRun[]} gops
 */
function renderGopBar(gops) {
  const total = gops.reduce((sum, gop) => sum + gop.sampleCount, 0) || 1;
  const bar = el("div", "info-gop-bar");
  for (const gop of gops) {
    const segment = el("span", "info-gop-segment");
    segment.style.setProperty(
      "--gop-width",
      `${(gop.sampleCount / total) * 100}%`,
    );
    segment.title =
      gop.totalBytes != null
        ? `sample ${gop.startSample}, ${numberFormat(gop.sampleCount)} samples, ${fmtBytes(gop.totalBytes)}`
        : `sample ${gop.startSample}, ${numberFormat(gop.sampleCount)} samples`;
    bar.appendChild(segment);
  }
  return bar;
}

/**
 * @param {import("./read").SampleTimeline} timeline
 */
function renderSampleTimeline(timeline) {
  if (!hasKnownSampleTimelineSignal(timeline)) {
    return document.createDocumentFragment();
  }

  const wrap = el("div", "info-sample-timeline");
  const summary = el("div", "info-sample-summary");
  summary.textContent = getSampleTimelineSummary(timeline);
  wrap.appendChild(summary);

  const strip = el("div", "info-sample-strip");
  for (const sample of timeline.samples) {
    const item = el("span", `info-sample info-sample-${sample.kind}`);
    item.textContent = sample.label;
    item.title = sample.title;
    strip.appendChild(item);
  }
  wrap.appendChild(strip);

  const legend = el("div", "info-sample-legend");
  for (const kind of /** @type {import("./utils").SampleClass[]} */ ([
    "sync",
    "reordered",
    "discardable",
    "dependent",
    "non-sync",
    "unknown",
  ])) {
    if (timeline.counts[kind] === 0) {
      continue;
    }
    const item = el("span", "info-sample-legend-item");
    const marker = el("span", `info-sample-marker info-sample-${kind}`);
    marker.textContent = getSampleKindLabel(kind);
    const text = el("span");
    text.textContent = `${getSampleKindTitle(kind)} (${numberFormat(timeline.counts[kind])})`;
    item.appendChild(marker);
    item.appendChild(text);
    legend.appendChild(item);
  }
  wrap.appendChild(legend);
  return wrap;
}

/**
 * @param {import("./read").SampleTimeline} timeline
 */
function hasKnownSampleTimelineSignal(timeline) {
  return Object.entries(timeline.counts).some(
    ([kind, count]) => kind !== "unknown" && count > 0,
  );
}

/**
 * @param {import("./read").SampleTimeline} timeline
 */
function getSampleTimelineSummary(timeline) {
  const parts = [
    `sample timeline: ${numberFormat(timeline.totalSamples)} samples`,
  ];
  if (timeline.limited) {
    parts.push(`showing first ${numberFormat(timeline.samples.length)}`);
  }
  return parts.join(", ");
}

/**
 * @param {"yes" | "no" | "unknown"} value
 */
function fastStartLabel(value) {
  if (value === "yes") {
    return "yes";
  }
  if (value === "no") {
    return "no";
  }
  return "unknown";
}
