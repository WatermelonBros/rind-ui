## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-theme-system` (with `theme-accessibility`) are applied; this change uses their APIs unchanged (all on main)
- [x] 0.2 Owner answers the open questions in design.md (own encoder vs dependency, fixture generation, ECI default) before section 1 starts; if a dependency is chosen, write the decision record and shrink section 1 to an adapter plus 1.7 — decided (coordinator, 2026-10-16): own encoder, fixtures generated offline and committed as JSON, ECI `"auto"`; recorded in design.md

## 1. Encoder (`packages/core/src/qr`, entry `@rind-ui/core/qr`)

- [x] 1.1 `segments.ts`: numeric / alphanumeric / byte mode choice, bit packing, count-field widths per version range, ECI (26) for non-ASCII strings with `eci: "auto"`, hand-rolled UTF-8 (lone surrogate → U+FFFD), `Uint8Array` input; node tests for every "Input And Character Encoding" and "Segment Mode Selection" scenario
- [x] 1.2 `tables.ts` + version selection: ECC codewords per block and block counts for versions 1–40 × 4 levels, capacities, alignment positions; tests for the capacity numbers, exact boundaries (version 1 and 40), forced `minVersion`, `"too-long"` payload, and alignment positions for all 40 versions against the standard's table
- [x] 1.3 `reed-solomon.ts` and block splitting / interleaving; tests: ISO Annex I codewords (`16 32 12 86 97 128 236 17 …` / `165 36 212 193 237 54 199 135 44 85`), multi-block interleave at version 5-Q, all-syndromes-zero for every version and level
- [x] 1.4 `matrix.ts`: finder / separator / timing / alignment / dark module, format information (BCH(15,5), `0x537`, `0x5412`) and version information (BCH(18,6), `0x1F25`), zigzag placement; tests with the 15-bit and 18-bit words in the spec and "function patterns survive masking"
- [x] 1.5 `mask.ts`: the eight predicates and the four penalty rules, auto and forced mask, tie-breaking; test that auto equals the minimum penalty; 100 ms budget test at version 40-H
- [x] 1.6 `encode.ts`: option and input validation (`invalid-option`, `invalid-input`), result type, `boostEcc`; `path.ts` (`qrPath`, merged runs, quiet zone), `svg.ts` (`renderQrSvg`, escaping, `shape-rendering`); the package entry and exports map, no runtime dependency — `@rind-ui/core/qr` entry: exports map in packages/core/package.json + tsdown entry
- [x] 1.7 Testing helpers in `@rind-ui/testing`: the decoder (format → unmask → de-interleave → syndromes → segments), `parseQrPath`, fixture set; property tests over random values × versions × levels × eight masks; damaged-symbol test; differential fixtures against the reference implementations; `BarcodeDetector` oracle in the browser project where available — `parseQrPath` lives in `@rind-ui/core/qr` (the contract's `matrix()` query uses it) and is re-exported by @rind-ui/testing; `BarcodeDetector` test skips where the engine lacks it

## 2. Machine (`core/components/qr-code/qr-code.machine.ts`)

- [x] 2.1 Controllable `value`; `encoded` memo keyed on option values; states `ready` / `downloading`; events `VALUE.SET`, `DOWNLOAD`, `DOWNLOAD.DONE`, `DOWNLOAD.FAILED`, `PARTS.CHANGED`, `OVERLAY.MEASURED`; `onEncodeError` once per distinct value — the machine takes a memoised `encode(value)` and an `encodingKey` instead of an `encoded` computed value (the uncontrolled value lives in the machine); extra bare event `ENCODING.CHANGED` (onProps) re-measures the overlay; `onEncodeError` is reported by the React Root after commit
- [x] 2.2 `core/dom/download.ts` (`saveBlob`, `sanitizeFileName`, URL revocation) and `core/dom/qr-export.ts` (integer-scale raster on the frame's background, overlay compositing for `<img>` and inline `<svg>`, tainted-canvas second pass, SVG export with inlined overlay); `exportImage` effect; `watchOverlay` effect and the pure coverage function
- [x] 2.3 Node tests of every transition, including controlled value proposals, the inline-options memo, double click while downloading, invalid and empty values; browser tests of the export (decode the downloaded PNG / SVG), tainted overlay, hostile file name, revocation, zoom 130 % — Node tests cover proposals, the memo and the empty/invalid guards; the download transitions (double click, revocation, file names) are DOM/browser tests (Node has no canvas or DOM)

## 3. Connect (`qr-code.connect.ts`)

- [x] 3.1 Root (state attributes, variables), Frame (`viewBox` with quiet zone, `xmlns`, `shape-rendering`, `role="img"` + name + description only when ready, `aria-hidden` otherwise), Pattern (`qrPath`), Overlay (inline centring, `data-covers`, development warnings), ValueText (visually hidden, expected part), DownloadTrigger (`type="button"`, press, `aria-disabled` when not ready, name from content else `messages.download`) — Overlay centring is an inline one-column grid (frame and overlay share cell 1 / 1) instead of absolute positioning, so it centres on the frame even with a DownloadTrigger inside Root; Root carries `data-last-download` for the driver; ValueText renders nothing without a symbol
- [x] 3.2 `messages` object with English defaults (`label`, `download`)

## 4. Parts (`@rind-ui/react`)

- [x] 4.1 `QrCode.Root`, `Frame`, `Pattern`, `Overlay`, `ValueText`, `DownloadTrigger`; `render` prop on every part; parts report mount/unmount (`PARTS.CHANGED`)
- [x] 4.2 Tests: SSR with byte-identical `d` and `aria-describedby` in the server HTML, Strict Mode, element substitution, RTL (matrix unchanged), inline options object (one encode) — the inline-options memo is tested on `createQrEncoder` (Node), which the Root uses per instance

## 5. Contract and driver

- [x] 5.1 `qr-code.contract.ts`: anatomy, locate by frame role + name, actions (`setValue`, `download` with pointer / touch / keyboard / virtual), queries incl. `matrix` and `decoded`, states, event map, the decode invariant — `qrCodeContractWith(decode)`: the decoder is injected (core cannot import @rind-ui/testing); `setValue` types into the page's control labelled "Value"; `DOWNLOAD`, `VALUE.SET` and the layout/async events are skips (covered by DOM/browser tests), `$props:value` and `$props:encodingKey` are prop steps
- [x] 5.2 `getQrCode` driver export in `@rind-ui/testing`; the same driver test passes in the browser project, the jsdom project (download recorded through the adapter's seam) and through the Playwright adapter

## 6. Tests

- [x] 6.1 Model-based: `testMachine(qrCodeContract)` over `ready` / `downloading`, pointer / keyboard / virtual, browser and jsdom projects, with the decode invariant — every QR event is API-, async- or layout-driven, so the walk covers mount plus the `$props:value` / `$props:encodingKey` steps over three classes, with the decode invariant; `downloading` is reached in the DOM/browser tests
- [x] 6.2 Browser tests for every `qr-code` scenario, each regression scenario reproducing the cited issue first (react-qr-code#255 / #283, qrcode.react#283 / #319 / #395 / #125 / #359 / #379 / #373 / #113, nayuki#32 / #154 / #104 / #214, uqr#9 / #2, zag#3277, ark#4141)
- [x] 6.3 Partial ARIA snapshots per state example (ready, ready with value text and overlay, empty, invalid) in the three engines; axe on each — in the Playwright fixture (`fixtures/qr-code`): inline ARIA snapshots for ready (value text + overlay), empty and invalid, and axe, in the three engines (the site-examples snapshot harness of retire-storybook §2 does not exist yet)
- [x] 6.4 Manual tier-1 check added to the release protocol: scan ten generated codes (digits, URL, Wi-Fi string, non-ASCII, with a logo at L / M / H) with iOS Camera and Android Google Lens; NVDA and VoiceOver read of the name and description — docs/releasing.md "Manual checks before a release"

## 7. Theme, site examples, docs

- [x] 7.1 `packages/theme/src/qr-code.css` (decision 0007): tier-3 tokens `--rind-qr-code-*` (size, fg, bg, radius, padding, overlay size / radius / outline) defaulting to fixed black and white in both schemes; styles read only tier 3 and select on `data-*`; forced-colors frame with `forced-color-adjust: none` and explicit colours (the modified `theme-accessibility` requirement, with its scenario); download trigger on the shared button theme (24 px target); imported from `index.css` — the trigger has its own outline-key rules (it carries `data-scope="qr-code"`, so the Button stylesheet does not match it); black and white are `oklch(from <role token> 0|1 0 0)` (the theme lint forbids literal colours); `qr-code` added to the `decoration` family
- [x] 7.2 Site examples (apps/site examples harness, see openspec/changes/retire-storybook): default, with overlay logo (image and inline SVG), sizes, levels, quiet zone, value text visible, download as PNG / SVG, controlled value with a live input, invalid and empty values, RTL, forced colors and dark mode, driver usage; state examples for every contract state (`ready`, `downloading`) — "value text visible" is shown as the Basic example's description; forced colors/dark mode and the driver usage are on the docs page and in the Playwright fixture
- [x] 7.3 Docs page (generated API facts + guide): encoding options and why `M`, quiet zone, logos and the error-correction budget, name and description, download and CORS, SSR, the standalone `encodeQr` / `renderQrSvg` entry, testing with the driver, known scanner differences (nayuki#199 / #73), migration from Ark's QR Code — no other library named (site rule)
- [x] 7.4 Mark `docs/research/qr-code.md` done on archive; changeset for `@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing`, `@rind-ui/theme`; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
