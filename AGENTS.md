# Repository Guidelines

## Project Shape

This repository is a static browser application for inspecting ISOBMFF / MP4
content. There is no server-side code. `build/index.html` loads
`build/style.css` and the browser bundle generated from `src/index.js`.

The app can inspect:

- local files through the browser file APIs
- direct remote MP4 / ISOBMFF segment URLs
- DASH manifests, by resolving segment choices from the MPD
- HLS playlists, by resolving fMP4 / ISOBMFF resources from the playlist

Low-level ISOBMFF parsing is provided by the `isobmff-inspector` dependency.
This repository owns source selection (including manifest probing), UI state,
post-processing (e.g. analyzing GOPs, sample data...), and rendering around
that parser.
Avoid duplicating parser logic here unless it is clearly UI-facing.

## Important Files

- `src/index.js`: app entry point
- `src/inspection/InspectionCoordinator.js`: singleton coordinator for the
  single active inspection; bridges inspection events to UI side effects.
- `src/inspection/parseInspectionStream.js`: streams parser events into
  `InspectionParseHandle` without importing UI modules.
- `src/inspection/InspectionParseCollector.js`: parse-time collection of facts
  that need to survive parsing without retaining whole media payloads.
- `src/inspection/byte-view/*.js`: byte-view capture and lookup APIs.
- `src/sources/filetype_detection.js`: probes remote resources and classifies them (as
  DASH, HLS, direct ISOBMFF content...) before the main inspection flow.
- `src/sources/dash_resource.js`: resolves DASH source choices and reports
  source-resolution actions.
- `src/sources/hls_resource.js`: resolves HLS source choices and reports
  source-resolution actions.
- `src/sources/local_file.js`: streams local files into inspection parsing.
- `src/sources/extractors/dash/*.js`: DASH manifest parsing and ISOBMFF segment
  extraction.
- `src/sources/extractors/hls/*.js`: HLS playlist parsing and ISOBMFF resource
  extraction.
- `src/post-process/**/*.js`: derived analysis built from parsed boxes.
- `src/ui/SourceControls.js`: DOM wiring for local-file, drag/drop, URL, and
  example-source controls.
- `src/ui/ProgressBar.js`: progress, status, easing, and cancel-button state.
- `src/ui/InspectionResultsView.js`: owns the whole results area lifecycle:
  stale/loading state, parse-time preparation, incremental box tree mounting,
  notices, and derived tab finalization.
- `src/ui/PlaylistSegmentChooser.js`: chooser UI for DASH/HLS segment
  selection.
- `src/ui/tabs/index.js`: tab-level exports and navigation wiring.
- `src/ui/tabs/tree/*`: incremental box tree rendering, tree-position map
- `src/ui/tabs/info/*`: summary from derived media info.
- `src/ui/tabs/samples.js`: sample-table UI (expose pts/dts if found...)
- `src/ui/tabs/sizes.js`: box-size summaries, maps, and tables.
- `src/ui/tabs/codec_details.js`: data parsed from mdat iself
- `src/utils/*.js`: shared formatting, dom, byte math, source-label, and scheduling
- `src/styles/*.css`: authored CSS sources, concatenated in a fixed order by the
  build script.
- `scripts/build.mjs`: CSS concatenation plus esbuild bundling and watch mode.
- `build/index.html`: static shell and required DOM IDs for the application.

## Commands

- `npm run build`: concatenates CSS into `build/style.css` and builds
  `build/aisobmffwvdfbutfaii.js`.
- `npm run min`: same build, but minifies the bundle into
  `build/aisobmffwvdfbutfaii.min.js`.
- `npm run watch`: rebuilds JS through esbuild watch mode and rebuilds
  `build/style.css` when `src/styles/*.css` changes.
- `npm run lint`: runs Biome checks.
- `npm run typecheck`: runs TypeScript against the JSDoc-typed JavaScript.
- `npm run check`: runs `lint` then `typecheck`.
- `npm run format`: applies Biome formatting.

Run `npm run check` before handing off code changes.

## Architecture Notes

The main runtime flow is:

1. `src/index.js` starts a new inspection lifecycle and aborts any previous one.
2. Local files are streamed directly, while remote URLs are first classified by
   `src/sources/filetype_detection.js`.
3. DASH and HLS sources are resolved into selectable segment resources before
   inspection continues.
4. `src/inspection/parseInspectionStream.js` streams parser events into
   `InspectionParseHandle`; parser events and payload chunks use specialized
   ingestion methods for the hot path.
5. `src/inspection/InspectionCoordinator.js` receives inspection events and
   updates `ProgressBar`, `InspectionResultsView`, `InspectionSourceElement`,
   and `PlaylistSegmentChooser`.
6. `src/ui/InspectionResultsView.js` owns the results shell and derived tabs,
   including incremental box-tree mounting and post-parse rendering.

Keep the single-active-inspection model intact. New work should continue to
respect the shared `AbortController`, progress UI, stale-results handling, and
playlist chooser lifecycle.

Keep UI side effects out of `src/sources`. Source modules should fetch, probe,
resolve, and stream source data, then report semantic transitions through the
inspection. DOM wiring belongs in `src/ui` modules, and coordinator-owned UI
side effects should stay in `InspectionCoordinator`.

## CSS Organization

CSS is split by feature ownership:

- `base.css`: variables, reset, and page-wide defaults.
- `shared.css`: shared section, caret, and stat-card primitives reused across tabs.
- `progress.css`: progress bar, status line, and cancel button.
- `shell.css`: header, source selection, tabs, and general shell layout.
- `playlist.css`: DASH/HLS chooser cards and controls.
- `box-tree.css`: box tree structure and tree-position map.
- `values.css`: parsed value tables, flags, issues, and inline formatting.
- `info.css`: media-info summary, track, fragment, GOP, and issue sections.
- `samples.css`: sample controls and sample table.
- `sizes.css`: size summaries, size map, and sortable box-size tables.
- `codec.css`: style specific to the "codec details" tab

`scripts/build.mjs` picks up every `.css` file in `src/styles` automatically.
`base.css` and `shared.css` are forced to the front; the remaining CSS files are
concatenated in alphabetical order.

Prefer adding styles to the file that owns the rendered UI. Reuse existing CSS
variables before introducing new colors or spacing constants.

## JavaScript Conventions

The codebase uses browser-native DOM APIs and ES modules bundled by esbuild. Do
not introduce a framework for local UI work.

Use JSDoc types for non-obvious structures and imported parser-derived types.
That is how the project gets useful TypeScript checking while staying in plain
JavaScript.

Preserve abort behavior. Long-running work, stream consumption, fetches, and any
manifest or segment resolution should observe the provided `AbortSignal`.

Rendering code generally builds DOM nodes directly. Prefer `textContent` and
existing helpers over raw `innerHTML` when inserting parser or remote data.

For static page-shell elements that must exist in `build/index.html`, use
`requireElementById(id, ElementConstructor)` from `src/utils/dom.js`. Use the
most specific constructor possible, such as `HTMLInputElement` or
`HTMLButtonElement`.

Keep optional or lazy UI explicit. For example, chooser content, tooltips, or
tab-specific controls should be created with local nullable state and clear
creation branches instead of pretending they are permanent shell elements.

Keep results-shell ownership centralized. If work needs to clear, reserve,
finalize, or mark the inspection results area as stale/loading, route that as
an inspection action/event handled by `src/inspection/InspectionCoordinator.js`
instead of open-coding DOM resets in `src/index.js`, `src/sources`, or parser
streaming code.

Do not use `querySelector` or `querySelectorAll`. Prefer IDs plus
`requireElementById` for shell elements, `getElementsByClassName` with explicit
index-based loops for class collections, and direct child traversal for local
checks.

`HTMLCollection` is handled with index-based loops in this codebase so it stays
compatible with the current TypeScript and DOM lib settings.

## UI Behavior Notes

Starting a new inspection aborts the previous one, clears chooser state, marks
existing results as stale, and resets progress/cancel wiring.

Remote URL inspection is intentionally two-stage:

- first probe the URL to determine whether it is a DASH manifest, HLS playlist,
  or direct segment-like content
- then either show the segment chooser or stream the selected segment into the
  parser

The box tree renders incrementally from parser events through
`InspectionParseHandle` events handled by `InspectionCoordinator`. Derived tabs
are rendered after parsing finishes, using completed projections from
`src/post-process/projections.js` and the accumulated top-level boxes.

The samples tab is conditional. It is shown only when post-processed media info
can expose sample views worth rendering.

The size view treats `mdat` specially for the "excluding mdat" view. Keep
that behavior explicit if changing size calculations or labels.

Whatever is done, it is **very** important to not keep huge chunks of the data in
memory, to keep things efficient. Everything should be done in a streaming
manner, only extracting actual interesting information and not the whole media
data.

## Dependency Boundaries

`isobmff-inspector` remains the source of truth for ISOBMFF parsing. UI code may
format, filter, annotate, summarize, and visualize parsed data, but should not
reimplement parser behavior that belongs in that dependency.

The DASH and HLS extractors in this repository are source-selection helpers.
They should stay focused on resolving inspectable ISOBMFF resources, not on
building a general-purpose streaming client or rendering UI.

Network access is browser `fetch` from user-provided URLs. Keep the app
compatible with static hosting and client-only execution.
