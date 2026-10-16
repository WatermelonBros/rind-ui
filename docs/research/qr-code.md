# QR Code — research

Status: done · Wave: 3

A QR Code component renders a string as a QR symbol (an SVG the camera of a phone can
read), optionally with a logo over its middle and a way to download it as an image. It
has no interaction apart from the download button; all of its difficulty is the
**encoder** (ISO/IEC 18004: segmenting, Reed-Solomon, masking), **what makes a code
scannable** (quiet zone, contrast, error-correction budget when something covers the
middle) and **how it is named for assistive technology**. Only Ark UI ships a headless
component (Zag's `qr-code`, encoder from `uqr`); the other headless libraries do not.
The encoder comparison therefore also covers the libraries React apps actually use
(`qrcode.react`, `react-qr-code`, `node-qrcode`) and the two reference implementations
(Nayuki's generator, which `uqr` and `qrcode.react` port, and `kazuhikoarase/qrcode-generator`).

Sources read 2026-10-16. Zag / Ark: local clones
(`zag/packages/machines/qr-code/src/*`, `zag/shared/src/css/qr-code.css`,
`ark/packages/react/src/components/qr-code/*`). `uqr@0.1.3`: `dist/index.mjs`, read
read-only from `reado-web/node_modules/.pnpm/uqr@0.1.3`. `qrcode.react` `src/index.tsx`
fetched with `gh api`. Issue trackers: full issue lists pulled with `gh issue list
--state all` (zag, ark, unjs/uqr, nayuki/QR-Code-generator, zpao/qrcode.react,
rosskhanas/react-qr-code, soldair/node-qrcode, kazuhikoarase/qrcode-generator) and
filtered locally; every cited issue read. Reado: `components/atoms/QrCode.tsx` read
read-only (it renders Ark's `QrCode` with `encoding={{ ecc: "M" }}`, a `100%`-sized
SVG with `shapeRendering="crispEdges"`, `role="img"` and a translated `aria-label`, on a
light tile that doubles as the quiet zone, fill `var(--qr-ink)`).

## Pattern

- WAI-ARIA APG: none ([accessibility.md §1.5](accessibility.md): "QR Code / Avatar /
  Image (`img` + name)"). The rules are the [W3C images tutorial](https://www.w3.org/WAI/tutorials/images/)
  (an informative image has a text alternative; a long alternative goes into a
  description) and WCAG 1.1.1 / 1.4.11.
- Roles and attributes required: the symbol is an `img` — `<svg role="img">` with an
  accessible name; `role="img"` has presentational children, so the module paths are not
  read. The thing a sighted user gets from a QR code is its **content** (a URL, a Wi-Fi
  string), so the content is exposed as the description (`aria-describedby` → text).
- Keyboard: none. The download trigger is a native `button`.
- Not an APG pattern, but there is an ISO one: a QR symbol needs a **quiet zone** of 4
  modules and dark modules darker than light ones (ISO/IEC 18004, symbol structure and
  symbol contrast); readers designed for the standard may not read reflectance-reversed symbols.

## How the others built it

### Zag / Ark UI

- Source: `qr-code.{machine,connect,dom,types}.ts`, `qr-code.css`; Ark `qr-code-*.tsx`.
- API shape: parts `Root` (div, CSS variables `--qrcode-pixel-size/width/height`),
  `Frame` (`<svg viewBox>`), `Pattern` (`<path d>`), `Overlay` (div absolutely centred),
  `DownloadTrigger` (button, `mimeType`, `quality`, `fileName`). Props: `value` /
  `defaultValue` / `onValueChange`, `encoding` (uqr's options: `ecc`, `boostEcc`,
  `minVersion`, `maxVersion`, `maskPattern`, `border`, `invert`), `pixelSize`. API:
  `value`, `setValue`, `getDataUrl(type, quality)`.
- State model: one state `idle`; `encoded` is a memo keyed on `[value, encoding]`
  **identities**; events `VALUE.SET`, `DOWNLOAD_TRIGGER.CLICK`.
- Rendering: `connect` pushes one `M{x},{y}h{p}v{p}h-{p}z` per dark module into a single
  `d` (no run merging); the frame is `viewBox="0 0 size·pixel size"`; `size` includes
  uqr's default `border: 1`, so there is a one-module quiet zone nobody asked for; no
  `role`, no name, no `<title>`: the consumer (Reado) adds `role="img"` and
  `aria-label`.
- Download: `getDataUrl` serialises the SVG to a data URL and draws it on a canvas
  (`svgToDataUrl` in dom-query). The overlay is composited by hand in `qr-code.dom.ts`
  (zag#3277): it reads the overlay's `<img>` or `<svg>`, converts a remote image to a
  data URL through a `crossOrigin="anonymous"` canvas, reads `outline` as a margin and
  background as a rect, and clones the SVG with an `<image>`. The click handler builds an
  `<a download>` and clicks it.
- Notable: the Overlay part is the only logo support in a headless library, and it is
  included in the download.
- Problems: see Bug history. Read in source: `encode` runs again on every render when the
  consumer passes an inline `encoding` object (Reado does: `encoding={{ ecc: "M" }}`);
  `uqr`'s `toUtf8ByteArray` is `encodeURI`-based and **throws `URIError` on a lone
  surrogate**, which would crash a render; default `ecc` is `"L"` (the lowest) so any
  logo makes a code unreadable (qrcode.react#395); a value longer than the capacity
  throws from render; the empty string encodes as a valid but meaningless symbol;
  a `path` of ~30 bytes per dark module is ~450 KB of attribute text for a version 40
  symbol, which is also what makes adjacent squares show hairline seams in browsers
  (Reado sets `shapeRendering="crispEdges"` to hide it); the Overlay's position is plain
  CSS, so nothing tells the author how much of the symbol it hides.

### uqr (Zag's encoder)

- Source: `dist/index.mjs`. A port of Nayuki's generator: numeric / alphanumeric / byte
  segments (no kanji, no ECI), **one** segment per value (numeric if all digits, else
  alphanumeric if the whole value fits, else UTF-8 bytes), versions 1–40, four ECC levels,
  mask auto-selection by the standard's four penalties (`N1=3 N2=3 N3=40 N4=10`),
  `boostEcc` (default **false**), `border` (default **1**), `invert`, `maskPattern`,
  `renderSVG` (the colour options are interpolated unescaped, uqr#9). Throws `RangeError`
  `Data too long` past version 40.
- Notable: small (≈ 27 kB unminified), no dependencies, readable, bit-identical with
  Nayuki's output for the same inputs.
- Problems: no mixed-mode segmentation (a URL with one lowercase letter pays byte mode for
  the whole string); non-string input fails with "data is not iterable" (uqr#2); a
  maintainer-closed "minimal version" request shows the footprint question
  (uqr#8: "removing features is not a good path to be smaller").

### Nayuki QR Code generator

- Reference implementation in Java, TypeScript, Python, C, C++, Rust; `QrSegmentAdvanced`
  optimises mixed-mode segmentation by dynamic programming; supports ECI segments and
  kanji; `boostEcl` default true; no quiet zone (the caller draws it: #107). Its tracker is
  the best record of how a from-scratch encoder gets misread: see Bug history.

### qrcode.react

- Source: `src/index.tsx`. `QRCodeSVG` / `QRCodeCanvas`; Nayuki port; `level`, `minVersion`,
  `boostLevel` (default true), `marginSize` (spec margin 4 behind `includeMargin`),
  `title` (`<title>` as the first child of an `svg role="img"`),
  `imageSettings { src, width, height, x, y, opacity, excavate, crossOrigin }`.
- Notable: **merges horizontal runs of dark modules** into `M{x},{y}h{n}v1H{x}z`
  (`generatePath`), two paths in total (a light background rect and the dark path);
  `excavate` removes the modules under the image so nothing dark shows through it;
  `Path2D` for the canvas.
- Problems: default level `L` with a logo (#395, #125); remote logo taints the canvas and
  `toDataURL`/`toBlob` throw (#359, #198, #143); logo missing from a hand-rolled SVG
  download (#379); blurry canvas under fractional zoom (#373); no a11y at all until #284
  (v4: role/title) after NVDA skipped the SVG (#283).

### react-qr-code, node-qrcode, qrcode-generator

- `react-qr-code`: SVG only; `title` added after #166; non-ASCII corruption (#283) and a
  crash above the maximum length (#255, open) — both are encoder-boundary bugs.
- `node-qrcode` (`soldair`, 286 issues) and `kazuhikoarase/qrcode-generator` (80): tracker
  lists pulled and scanned for the same classes; no claim in this note rests on them.

## The algorithm (ISO/IEC 18004:2015, byte/numeric/alphanumeric subset)

Written down once here so the spec can say *what* and the tests can say *against which
vectors*. Nothing below is copied from a source file; it is the standard's structure as
implemented by Nayuki/uqr, checked against both.

1. **Segments.** Numeric (`0001`, 3 digits → 10 bits), alphanumeric (`0010`, the 45-character
   set `0-9A-Z space $%*+-./:`, 2 chars → 11 bits), byte (`0100`, 8 bits per byte), ECI
   (`0111`, assignment number). Character-count field widths: numeric 10/12/14, alphanumeric
   9/11/13, byte 8/16/16 for versions 1–9 / 10–26 / 27–40.
2. **Version** (1–40, side `17 + 4·v` modules): the smallest in `[minVersion, maxVersion]`
   whose data capacity (codewords × 8 bits, after the version's ECC blocks) holds the
   segments' bits. The capacity limits at version 40 are 7089 digits / 4296 alphanumerics /
   2953 bytes at L, 5596 / 3391 / 2331 at M, 3993 / 2420 / 1663 at Q, 3057 / 1852 / 1273 at H.
3. **Bit stream**: segments, terminator (up to 4 zero bits), pad to a byte, pad bytes
   `0xEC 0x11` alternately up to capacity.
4. **Error correction**: split into the version/level's blocks (two block sizes differing by
   one byte), Reed-Solomon over GF(2⁸) with polynomial `0x11D` per block, then
   **interleave** data codewords column by column and then ECC codewords.
5. **Matrix**: finder patterns with separators, timing patterns, alignment patterns
   (positions by version), the dark module, reserved format areas and, from version 7,
   version information (BCH(18,6)); data bits placed in 2-module-wide columns zigzagging
   up and down from the bottom right, skipping column 6; remainder bits are zero.
6. **Mask**: 8 patterns; for each, apply, add format information (BCH(15,5) XOR `0x5412`;
   level bits `L=01 M=00 Q=11 H=10` — note these are not the ordinal order), score with
   the four penalty rules (runs ≥ 5: 3 + extra; 2×2 blocks: 3 each; finder-like 1:1:3:1:1
   patterns with 4 light modules either side: 40 each; dark/light imbalance: 10 per 5 %
   step from 50 %), keep the lowest.
7. **Quiet zone**: 4 modules, not part of the symbol; the renderer adds it.

## Accessibility

Apply [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) (Image /
Avatar rows).

- **Role and name.** `<svg role="img">` with a name is the only form NVDA reads
  reliably: qrcode.react#283 shows NVDA skipping an unnamed `svg`, and the fix
  (qrcode.react v4) added the role and a `<title>`. Name by priority: consumer
  `aria-label` / `aria-labelledby`, else `messages.label` ("QR code").
- **Value as text alternative.** A name of "QR code" tells a screen-reader user nothing
  a sighted user gets from looking at it. The value is exposed as the **description**:
  `aria-describedby` points at a visually hidden `ValueText` part (hidden-content's
  visually hidden style, not `display: none`, so the description resolves). Long values
  (a 300-character vCard) are a long description, not a name — which is why they are not
  put in the name.
- **Overlay.** A logo is decorative when the name already says what the code is; an
  `<img alt>` inside the Overlay keeps its own alt and is exposed *inside* the `img`
  role's presentational subtree, i.e. not announced. A logo that carries information goes
  into the name.
- **Download trigger.** A native `button`; a name from its content, else
  `messages.download` ("Download QR code"). Downloading is the accessible way to get the
  code into another app, which is why it ships.
- **Contrast and reversal.** WCAG 1.4.11 asks 3:1 for graphical objects, but scanning needs
  more: **dark modules on a lighter ground**, preferably black on white. The theme defines
  `--rind-qr-code-fg`/`-bg` once, independent of the colour scheme (Reado's `--qr-ink` on a
  light tile is the same idea; react-qr-code#294 is a code on a dark page that lost its
  light ground). There is no `invert` option.
- **Forced colors.** The mapping of forced colors can invert the symbol (white modules
  on a black `Canvas` in dark OS themes), which most scanners cannot read. The theme sets
  `forced-color-adjust: none` on the Frame with explicit colours: a QR code is an image
  whose appearance is its function (WCAG 1.4.11 exempts it where "a particular
  presentation of graphics is essential").
- **Motion / RTL.** None. The symbol is never mirrored in RTL (a mirrored code is a
  different, usually unreadable, code): nothing in the Frame depends on `dir`.
- **Target size.** The download button follows the shared button theme (24 × 24 CSS px
  minimum).
- **Native platform** ([native-platform.md](native-platform.md)): SVG `<path>` for the
  symbol; `<canvas>`/`toBlob` only for raster download; `<a download>` + `Blob` URL
  (revoked after use) for the file. No native API encodes QR codes (the Barcode Detection
  API decodes; it is useful as an independent oracle in browser tests where available).

## Bug history

Required. Zag/Ark are the only headless implementations; the encoder libraries carry the
rest. Radix, Base UI, React Aria, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte have
no QR component (their trackers have no matching issue to read).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [#3277](https://github.com/chakra-ui/zag/issues/3277) | Downloaded image lacks the Overlay logo | download rendered the SVG only | closed (compositing added) | download includes the overlay by default; test it |
| Zag | [#2165](https://github.com/chakra-ui/zag/issues/2165) | SVG `viewBox` rendered differently in Vue CSR vs SSR | `normalizeProps` produced an illegal attribute name for `viewBox` in client rendering (as reported) | closed | SVG attribute names are tested through the React adapter in server and client render (the symbol must not overflow its frame) |
| Ark | [#4141](https://github.com/chakra-ui/ark/issues/4141) | Vue `QrCode.Root` does not emit value changes from `setValue()` | `setValue()` through the context did not update a controlled Root or emit (as reported) | closed | `onValueChange` for every writer, tested through the api |
| zpao/qrcode.react | [#283](https://github.com/zpao/qrcode.react/issues/283) | NVDA skips the QR SVG entirely | SVG without role/name | closed (v4: `role="img"` + `title`, #284) | role and name are not optional |
| zpao/qrcode.react | [#395](https://github.com/zpao/qrcode.react/issues/395) | Specific URL at level L unreadable | the embedded image covered too much of an L-level symbol (maintainer: "always a risk… worth updating docs") | closed, no code change | default level `M`; dev warning when the overlay covers more than the level can recover |
| zpao/qrcode.react | [#125](https://github.com/zpao/qrcode.react/issues/125) | Scan fails with a centre logo | same; `excavate` removes even more modules | closed (docs) | the overlay does not excavate silently; coverage is checked against the ECC budget |
| zpao/qrcode.react | [#356](https://github.com/zpao/qrcode.react/issues/356) | Output differs from other libraries at the same level | `boostLevel` on by default raises the level silently | closed | `boostEcc` is explicit and off by default; `ecc` means what it says |
| zpao/qrcode.react | [#225](https://github.com/zpao/qrcode.react/issues/225) | "Data too long" for a vCard with a photo | capacity is finite (2953 bytes at L) | closed (docs) | an over-capacity value is a typed error surfaced to the consumer, never a render crash |
| zpao/qrcode.react | [#199](https://github.com/zpao/qrcode.react/issues/199) | `level="h"` throws `ecl.ordinal` of undefined | untyped runtime lookup | closed | the level is a typed union and an invalid one is a dev error, not a TypeError |
| zpao/qrcode.react | [#359](https://github.com/zpao/qrcode.react/issues/359), [#143](https://github.com/zpao/qrcode.react/issues/143) | Download throws "Tainted canvases may not be exported" | remote logo drawn on the canvas without CORS | closed (`crossOrigin`) | raster download of a remote logo needs CORS; fall back to the symbol and report it, never throw uncaught |
| zpao/qrcode.react | [#379](https://github.com/zpao/qrcode.react/issues/379) | Logo missing from the downloaded SVG | `<image href>` to a remote URL is not self-contained | closed | an SVG export inlines the logo as a data URL (the reporter serialised the live node, which keeps a remote `<image href>`) |
| zpao/qrcode.react | [#373](https://github.com/zpao/qrcode.react/issues/373) | Canvas blurry at fractional zoom | non-integer module size | open | raster export draws at an integer module scale with smoothing off; the SVG uses `shape-rendering: crispEdges` |
| zpao/qrcode.react | [#113](https://github.com/zpao/qrcode.react/issues/113) | Invalid SVG attribute `shapeRendering` | React prop name emitted as the attribute name (as reported) | closed | the SVG attribute is `shape-rendering`; test the serialised string |
| rosskhanas/react-qr-code | [#283](https://github.com/rosskhanas/react-qr-code/issues/283) | Korean/Japanese/emoji payloads read back corrupted | no UTF-8 / ECI handling | closed | encode as UTF-8 and declare it with an ECI segment when not plain ASCII |
| rosskhanas/react-qr-code | [#255](https://github.com/rosskhanas/react-qr-code/issues/255) | Page crashes above ~2953 characters | exception from the encoder inside render | open | `encode` returns a result; the component renders an error state |
| rosskhanas/react-qr-code | [#294](https://github.com/rosskhanas/react-qr-code/issues/294) | Code on a dark page unreadable | no quiet zone / background | closed ("pass colours") | quiet zone and light background belong to the frame, independent of the scheme |
| rosskhanas/react-qr-code | [#166](https://github.com/rosskhanas/react-qr-code/issues/166) | No way to name the SVG | no title | closed | name and description are parts of the contract |
| Nayuki | [#154](https://github.com/nayuki/QR-Code-generator/issues/154), [#9](https://github.com/nayuki/QR-Code-generator/issues/9) | UTF-8 text without an ECI segment decodes as Latin-1 in some readers; binary needs ECI | the standard's default byte encoding is ISO 8859-1; readers differ | closed (ECI segment API added) | declare UTF-8 explicitly for non-ASCII; open question on the default |
| Nayuki | [#199](https://github.com/nayuki/QR-Code-generator/issues/199), [#73](https://github.com/nayuki/QR-Code-generator/issues/73) | Accented letters decoded as Kanji; `\r\n` lost | the **reader** guessed Shift JIS / filtered newlines | closed ("scanner bug") | test against more than one decoder; document that readers differ |
| Nayuki | [#32](https://github.com/nayuki/QR-Code-generator/issues/32) | Reporter believed version 40 was unreachable ("`>=` should be `>`") and expected any 2953-character string to fit | not a bug: the loop tests capacity before throwing; capacity is in UTF-8 **bytes**, JS strings are UTF-16 and a character can need up to 4 bytes (maintainer's answer) | closed | boundary tests at exactly the version-40 capacity per level, and an error that reports bytes needed vs available |
| Nayuki | [#166](https://github.com/nayuki/QR-Code-generator/issues/166) | "Maximum 20 characters" in version 2-Q though the table says 29 | lowercase letters are not alphanumeric mode; the whole value falls to byte mode | closed | document mode selection; mixed-mode segmentation is an open question |
| Nayuki | [#214](https://github.com/nayuki/QR-Code-generator/issues/214) | Python alignment-pattern step differs from the other ports | integer division vs ceiling in the step formula | closed (all ports bit-identical) | table-driven alignment positions + a test over all 40 versions |
| Nayuki | [#71](https://github.com/nayuki/QR-Code-generator/issues/71) | zbar cannot read "00000" | unresolved in the thread; the comments discuss a mirrored rendering by the reporter | closed | decode the module matrix in tests, not a picture |
| Nayuki | [#104](https://github.com/nayuki/QR-Code-generator/issues/104) | Binary payload read back with `EF BF BD` | the reader decoded bytes as UTF-8 text | closed ("scanner") | binary payloads are an `encodeBytes` path with explicit ECI; value type `string | Uint8Array` |
| Nayuki | [#107](https://github.com/nayuki/QR-Code-generator/issues/107) | No margin in the output | quiet zone left to the caller | closed | quiet zone default 4, configurable |
| unjs/uqr | [#9](https://github.com/unjs/uqr/issues/9) | `renderSVG` colour options injected unescaped | string interpolation | closed | colours come from CSS, never interpolated; the standalone SVG string escapes attributes |
| unjs/uqr | [#2](https://github.com/unjs/uqr/issues/2) | Non-string input: "data is not iterable" | no input validation | closed | the encoder validates its input and returns an error result |

## Known pitfalls

- **Charset.** UTF-8 bytes read as ISO 8859-1 by strict readers and ISO 8859-1 read as
  UTF-8 by guessing ones; only an ECI segment is unambiguous (Nayuki #154/#9, react-qr-code
  #283). UTF-16 string length is not byte length: a 2953-character string can need 4× that
  (Nayuki #32 comment).
- **Lone surrogates.** `encodeURI` throws; `TextEncoder` substitutes U+FFFD. (Found in
  `uqr` source; no issue filed.)
- **Capacity.** The limits are per level *and* per mode; mixed content falls to byte mode
  (Nayuki #166).
- **Logo.** Anything over the symbol spends the error-correction budget; ECC level is the
  only mitigation (qrcode.react #395, #125). The finder patterns (three corners) and the
  alignment pattern must stay clear.
- **Seams and blur.** Adjacent squares anti-alias into hairlines unless merged or rendered
  with `crispEdges`; fractional scales blur a canvas (qrcode.react #373).
- **Download.** CORS-tainted canvases; `Blob` URLs must be revoked; Safari ignores
  `download` on data URLs in some contexts; file names with path separators.
- **SSR.** The encoder is pure and deterministic, so server and client render the same
  `<path>`; the download is browser-only.
- **RTL / dark mode.** Neither may mirror or invert the symbol.

## Testing notes

The encoder is pure, so it is tested in Node with no DOM: known vectors from the
standard (ISO/IEC 18004 Annex I example `01234567` at version 1-M, with its published
codewords and final matrix), Nayuki's published output for a set of values at each level
and at the capacity boundaries, a **round-trip decoder** written in the testing package
(format information → unmask → de-interleave → Reed-Solomon syndromes all zero → parse the
segments back to the value) so that every property test (random strings, all versions, all
levels, all eight masks forced) proves the matrix decodes to its input, and — in the browser
project only — `BarcodeDetector` as an independent oracle where the engine has it. The
component is tested through its driver: queries for the module matrix, version, level and
the description; actions for the download, recorded by a download spy in the DOM adapter and
Playwright's `download` event in the browser adapter. Hard parts: the download (canvas and
`Blob` in jsdom → the adapter provides a recording seam), the logo compositing (needs layout)
and the overlay coverage check (needs layout; a pure function over rectangles is unit-tested
in Node).

## Decisions

- Parts: `Root`, `Frame` (svg, `role="img"`), `Pattern` (path), `Overlay`, `ValueText`
  (visually hidden description, an expected part), `DownloadTrigger`.
- Machine: single state `ready`; controllable `value`; computed `encoded` (a result, never a
  throw); `DOWNLOAD` event with a recorded `lastDownload`.
- `data-*`: Root `data-state` (`ready | empty | invalid`), `data-version`, `data-ecc`,
  `data-size`; Frame `data-empty`; Overlay `data-covers` (percentage of area); CSS variables
  `--rind-qr-modules`, `--rind-qr-quiet-zone`.
- Contract: located by the Frame (`role=img`, name) — a QR code is always rendered, unlike
  an overlay; actions `setValue` (api), `download`; queries `value`, `version`, `ecc`,
  `size`, `matrix`, `description`, `isEmpty`, `error`, `lastDownload`.
- Deliberately different from Zag/Ark: own encoder in `@rind-ui/core` (no `uqr`); default
  `ecc` `M` (not `L`); quiet zone 4 modules by default and part of the viewBox; encoding
  options compared by value, not identity; path built from merged runs; `role="img"`, name
  and description are built in; error result instead of throwing from render; ECI for
  non-ASCII; no `invert`; an overlay-coverage dev warning; `getDataUrl`/`download` handle
  CORS failure explicitly; pure `renderQrSvg` string function for non-DOM use.

## Open questions

- **Dependency vs own encoder.** The brief asks for the algorithm from scratch. A
  well-tested alternative is Nayuki's generator (MIT, ≈ 1000 lines TS, bit-identical with
  `uqr`) or `uqr` itself (≈ 27 kB, 0 dependencies); either would remove the largest risk
  (a subtle encoder bug) at the cost of a decision record and a dependency. Mitigation in
  this change: round-trip decoder + differential tests against Nayuki/`uqr` fixtures
  (generated once by a script that uses them as **devDependencies** — which also needs a
  decision record: open question for the owner).
- ECI default: `"auto"` (declare UTF-8 only for non-ASCII values, the current choice) or
  never (Nayuki/uqr/qrcode.react behaviour, maximum reader compatibility for URLs)?
- Mixed-mode segmentation (Nayuki's `QrSegmentAdvanced`) for smaller symbols: not in v1.
- Kanji mode, Micro QR, rMQR, structured append: Non-goals; none has a consumer.
- Style options Zag users ask for in other libraries (rounded modules, custom finder
  patterns, gradient fills): CSS on `Pattern` cannot do per-module shapes; deferred.
