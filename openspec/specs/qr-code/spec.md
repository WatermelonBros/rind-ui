# qr-code Specification

## Purpose
Defines the QR Code component: a value rendered as a scannable SVG symbol with a built-in
quiet zone, an optional centred overlay (a logo), an accessible name and a text description
carrying the value, and a download trigger, built on the pure QR encoder, with its parts, ARIA,
`data-*` attributes, download behaviour and test contract.
## Requirements
### Requirement: Anatomy

A QR code SHALL consist of the parts `Root` (default `div`), `Frame` (`svg`), `Pattern`
(`path`, inside the frame), `Overlay` (optional, default `div`), `ValueText` (optional,
default `span`) and `DownloadTrigger` (optional, default `button`). Every rendered part SHALL
carry `data-scope="qr-code"`, `data-part` with its kebab-case part name and the instance's
`data-instance`. `ValueText` is an expected part: when rendered it SHALL be the description of
the frame; connect SHALL know whether it is rendered, also for server rendering. Each part
SHALL accept element substitution without changing behaviour.

#### Scenario: Parts are attributed

- **WHEN** a QR code renders all its parts
- **THEN** each carries `data-scope="qr-code"`, its own `data-part` and the same
  `data-instance`

#### Scenario: Value text is an expected part

- **WHEN** a QR code is server rendered with a `ValueText` child
- **THEN** the frame's `aria-describedby` references the value text's id in the server HTML

### Requirement: Value

The value SHALL be a controllable string: `value`, `defaultValue` (default `""`) and
`onValueChange(value)`. `setValue(value)` on the API SHALL change it. In controlled mode a
`setValue` call SHALL only call `onValueChange`. Every writer (prop change, `setValue`) SHALL
be reported once.

#### Scenario: Uncontrolled

- **WHEN** a QR code with `defaultValue="https://a.example"` has `setValue("https://b.example")`
  called
- **THEN** the symbol encodes the new value and `onValueChange` was called once with it

#### Scenario: Controlled

- **WHEN** a controlled QR code's `setValue` is called and the parent does not update `value`
- **THEN** `onValueChange` was called and the symbol is unchanged (regression: ark#4141,
  where a `setValue()` through the context did not emit)

### Requirement: Encoding Options

The component SHALL take `encoding` with the encoder's options and these defaults: `ecc`
`"M"`, `boostEcc` `false`, `minVersion` 1, `maxVersion` 40, `mask` automatic, `eci`
`"auto"`, and `quietZone` 4 (modules). The encoding SHALL be recomputed only when the value or
one of those option values changes, compared by value, never by object identity.

#### Scenario: Inline options object

- **WHEN** a parent passes `encoding={{ ecc: "M" }}` as a new object on every render and
  re-renders ten times with the same value
- **THEN** the encoder ran once (Reado does this; Zag's memo is keyed on the object's
  identity)

#### Scenario: Default level survives a logo

- **WHEN** a version-10 symbol is encoded with the default `ecc` and the 9 × 9 modules at
  its centre (about 2.5 % of its area) are cleared before decoding with the testing decoder
- **THEN** it decodes to the value (qrcode.react#395 and #125 were logos over a level-L
  symbol)

#### Scenario: Quiet zone

- **WHEN** a version-1 symbol is rendered with the defaults
- **THEN** the frame's `viewBox` is `0 0 29 29` (21 modules + 2 × 4) and no dark module is
  inside the quiet zone (nayuki#107: the quiet zone is the caller's job in the encoder, the
  component's here)

### Requirement: Result States

The root SHALL expose `data-state` `"ready"` when the value encoded, `"empty"` when the value
is the empty string and `"invalid"` when encoding failed. For `"empty"` and `"invalid"` the
`Pattern` SHALL render no modules (the frame keeps its size so layout does not jump) and the
frame SHALL be `aria-hidden` and have no `role="img"`, because there is no code to name. A
failed encoding SHALL call `onEncodeError({ error, neededBits, availableBits, maxBytes })`
once per distinct value and SHALL NOT throw during render. `DownloadTrigger` SHALL be
`aria-disabled` while the state is not `"ready"`.

#### Scenario: Value too long

- **WHEN** the value is 4000 bytes of text at level M
- **THEN** the page renders, `data-state="invalid"`, the frame has no modules and is
  `aria-hidden`, and `onEncodeError` was called with `error: "too-long"` (regression:
  react-qr-code#255, crash on long input)

#### Scenario: Empty value

- **WHEN** the value is `""`
- **THEN** `data-state="empty"`, the frame has its size and no modules, and no QR code is
  announced

#### Scenario: Recovery

- **WHEN** an invalid value is replaced by a valid one
- **THEN** the symbol renders and the frame becomes an image again

### Requirement: Frame And Pattern Rendering

`Frame` SHALL be an `svg` with `viewBox` `0 0 N N` where N is `size + 2 × quietZone` in module
units, `xmlns`, `shape-rendering="crispEdges"` and no fixed pixel size of its own (the
consumer sizes it with `width`/`height` or CSS; the theme gives it a default through
`--rind-qr-code-size`). `Pattern` SHALL be one `path` whose `d` is the encoder's merged-run
path, so it is a single node whatever the version and has no hairline seams between adjacent
modules. Neither part SHALL depend on `dir`: the symbol is never mirrored. The fill of the
pattern and the background of the frame SHALL come from CSS, never from interpolated
attributes.

#### Scenario: One path

- **WHEN** a version-40 symbol is rendered
- **THEN** the frame contains exactly one `path` and its `d` is shorter than one
  `M x,y h1 v1 h-1 z` per dark module would be

#### Scenario: Scaling

- **WHEN** the frame is rendered at 220 px and at 221 px
- **THEN** both show the whole symbol with the quiet zone and no clipped module row

#### Scenario: Right-to-left page

- **WHEN** the QR code is rendered inside `dir="rtl"`
- **THEN** its matrix is identical to the left-to-right rendering

### Requirement: Accessible Name And Description

When the state is `"ready"`, `Frame` SHALL have `role="img"` and an accessible name from, in
order, the consumer's `aria-labelledby`, the consumer's `aria-label`, `messages.label`
("QR code"). When `ValueText` is rendered it SHALL render the value as visually hidden text
(not `display: none`) by default and the frame's `aria-describedby` SHALL reference it, so the
value is exposed as the text alternative; a consumer-provided `aria-describedby` SHALL be
kept and the value text id appended. The module paths and the overlay's content SHALL NOT be
exposed separately. A logo that carries information SHALL be part of the name through the
consumer's `aria-label`.

#### Scenario: Named image

- **WHEN** a ready QR code is rendered with the defaults
- **THEN** `getByRole("img", { name: "QR code" })` finds the frame, and axe reports no
  violation (regression: qrcode.react#283, #319, where NVDA skipped an unnamed SVG)

#### Scenario: Translated name

- **WHEN** the consumer passes `aria-label="Codice QR per l'app"` (Reado passes a
  translated label)
- **THEN** that is the accessible name

#### Scenario: Value as description

- **WHEN** the value is `"WIFI:T:WPA;S:Home;P:secret;;"` and a `ValueText` is rendered
- **THEN** the frame's accessible description is that text

#### Scenario: Overlay image is not announced

- **WHEN** the overlay contains `<img alt="Reado">`
- **THEN** it is not found by role separately (the frame's `img` role has presentational
  children)

### Requirement: Overlay

`Overlay` SHALL be positioned over the centre of the frame and SHALL leave the symbol
unchanged: the modules under it stay in the matrix and are not removed. In the browser it
SHALL report, as `data-covers` (a number 0–100, updated when the overlay or frame resizes),
the percentage of the symbol's area (without the quiet zone) it covers, and in development builds SHALL log a warning,
once per combination, when that percentage exceeds half of what the level can recover (L 7 %,
M 15 %, Q 25 %, H 30 % of the codewords) or when the overlay reaches into any finder pattern
(it is larger than the symbol minus two finder patterns and their separators on a side). The
overlay SHALL NOT receive keyboard focus unless the consumer makes it focusable.

#### Scenario: Within budget

- **WHEN** a 9 × 9 module overlay sits over a version-10 symbol (57 × 57 modules) at level M
- **THEN** `data-covers` is `2` and nothing is logged

#### Scenario: Over budget

- **WHEN** a 25 × 25 module overlay (19 % of the symbol) is used at level M, or the 9 × 9
  overlay at level L with a version-1 symbol
- **THEN** a development warning names the level, the coverage and the budget (regression:
  qrcode.react#395)

#### Scenario: Overlay too large for the finders

- **WHEN** a 45 × 45 module overlay is used over a version-10 symbol (57 − 16 = 41 modules is
  the limit)
- **THEN** a development warning says it reaches the finder patterns

### Requirement: Download

`DownloadTrigger` SHALL take `mimeType` (`"image/png"`, `"image/jpeg"`, `"image/webp"` or
`"image/svg+xml"`), `quality` (0–1 for lossy types), `fileName` (default `"qr-code"` plus the
extension of the type) and `size` (the width in CSS pixels of the exported image, default
1024), and the API SHALL offer `getDataUrl(mimeType, options)` and `download(options)`.
Pressing the trigger SHALL be ignored when the click is `defaultPrevented`, when the state is
not `"ready"`, or while a download is in progress. The exported raster SHALL be drawn at an
integer number of pixels per module (rounded up from `size`), with smoothing off, on the
frame's own background colour (white when it is transparent) including the quiet zone, so
modules are sharp and never black-backed (JPEG). The `Overlay` SHALL be composited by default
at its position and size, including its background and outline; an SVG export SHALL be
self-contained (an overlay image inlined as a data URL, no external reference, no
`foreignObject`). If the overlay cannot be drawn (a cross-origin image that taints the
canvas), the download SHALL proceed with the symbol only and `onDownload` SHALL report
`overlay: "omitted"` — never throw an uncaught error. A file name SHALL have path separators
and control characters removed. The `Blob` URL SHALL be revoked after the click. `onDownload({
fileName, mimeType, overlay })` SHALL be called once per download, with `overlay` `"included"`,
`"omitted"` or `"none"`.

#### Scenario: PNG download

- **WHEN** the download trigger is pressed with `mimeType="image/png"` and
  `fileName="qr.png"`
- **THEN** a file named `qr.png` is downloaded whose decoded content is the value, and
  `onDownload` was called with `overlay: "none"`

#### Scenario: Overlay in the file

- **WHEN** the QR code has an overlay `<img src="data:…">` and is downloaded as PNG
- **THEN** the exported image contains the logo at the overlay's position (regression:
  zag#3277)

#### Scenario: Tainted canvas

- **WHEN** the overlay image is a cross-origin image without CORS and the user downloads a
  PNG
- **THEN** the symbol downloads without the logo, `onDownload` reports `overlay: "omitted"`
  and no error is thrown (regression: qrcode.react#359, #143)

#### Scenario: Self-contained SVG

- **WHEN** the QR code with a remote overlay image is downloaded as SVG
- **THEN** the file contains the image as a data URL or reports `overlay: "omitted"`, and
  has no external reference (regression: qrcode.react#379)

#### Scenario: Sharp at any zoom

- **WHEN** a PNG is exported at `size` 500 for a 29-module symbol on a page zoomed to 130 %
- **THEN** the image width is a multiple of 29 and no module edge is blurred (regression:
  qrcode.react#373)

#### Scenario: Hostile file name

- **WHEN** `fileName` is `"../../etc/x.png"`
- **THEN** the downloaded file name contains no `/` or `..` segment

#### Scenario: Double click

- **WHEN** the trigger is clicked twice before the first download settles
- **THEN** one file is produced

#### Scenario: Revoked URL

- **WHEN** a download finished
- **THEN** its `Blob` URL has been revoked

#### Scenario: Empty value

- **WHEN** the value is empty and the trigger is pressed
- **THEN** nothing is downloaded

### Requirement: Download Trigger Name

A download trigger that renders no content of its own SHALL be named by
`messages.download` (English default "Download QR code"); a trigger with text content SHALL be
named by that text.

#### Scenario: Icon-only trigger

- **WHEN** the trigger contains only an SVG icon and the consumer passes
  `messages={{ download: "Scarica" }}`
- **THEN** its accessible name is "Scarica"

### Requirement: Messages

Every string the component exposes to assistive technology SHALL come from a typed `messages`
object with English defaults: `label` ("QR code") and `download` ("Download QR code").
Overrides SHALL be accepted per component and through the provider.

#### Scenario: Partial override

- **WHEN** a consumer passes `messages={{ label: "Codice QR" }}`
- **THEN** the frame's name is "Codice QR" and the download trigger keeps its default

### Requirement: Server Rendering

Encoding and rendering of the frame and pattern SHALL be identical on the server and in the
browser and SHALL read no browser global. Download, overlay measurement and the development
warnings SHALL run only in the browser.

#### Scenario: Hydration

- **WHEN** a QR code is server rendered and hydrated
- **THEN** there is no hydration mismatch and the `d` attribute is byte-identical

### Requirement: Data Attributes

Every part SHALL carry `data-scope="qr-code"`, `data-part` and `data-instance`. Additionally:

- `root`: `data-state` (`"ready"`, `"empty"`, `"invalid"`), `data-version`, `data-ecc`,
  `data-modules` (the symbol's size without quiet zone); CSS variables `--rind-qr-code-modules`
  and `--rind-qr-code-quiet-zone` (module counts, unitless).
- `frame`: `data-state`.
- `pattern`: only the scoping attributes.
- `overlay`: `data-covers`.
- `download-trigger`: `data-state` (`"idle"` or `"downloading"`), `data-focus`,
  `data-focus-visible`, `data-pressed`; `data-disabled` while the state is not `"ready"`.

`value-text` SHALL carry only the scoping attributes.

#### Scenario: Styling hooks

- **WHEN** a version-3 level-M symbol is rendered
- **THEN** the root has `data-version="3"`, `data-ecc="M"`, `data-modules="29"`

### Requirement: QR Code Contract

The `qr-code` contract SHALL locate an instance through its frame (role `img`, accessible name
given by the driver's `name`, default "QR code"). It SHALL declare the states `ready` and
`downloading`, the actions `setValue` (through the API of the fixture, with a `$sync:value`
prop step) and `download` (pointer, touch, keyboard and virtual on the trigger, completing when
the download was recorded), and the queries `value`, `version`, `ecc`, `size`, `matrix` (the
module matrix parsed back from the rendered path and `viewBox`), `decoded` (the testing decoder
applied to `matrix`), `description`, `isEmpty`, `error` and `lastDownload`. A generic invariant
SHALL assert `decoded() === value()` for every state with a non-empty valid value. The
contract SHALL declare no overlay traits (`presence` and `layer` do not apply). Its event map
SHALL map `DOWNLOAD` to the `download` action, mark `DOWNLOAD.DONE` as skipped (timer/async
driven) and `VALUE.SET` through `$sync:value`.

#### Scenario: Driver round trip

- **WHEN** a test runs `const q = getQrCode(screen)` and `await q.setValue("hello")`, then `await
  q.download()`
- **THEN** `await q.decoded()` is `"hello"`, `await q.version()` is 1 and `await
  q.lastDownload()` has the file name

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page` instead of `screen`
- **THEN** it passes unchanged, the download being observed through Playwright's `download`
  event

### Requirement: Model-Based Coverage

`testMachine` over the qr-code contract SHALL cover every transition in every declared
modality, including `virtual`, and SHALL pass every generic and accessibility invariant plus
the decode invariant above. The encoder's own coverage SHALL come from the property tests of
the `qr-encoder` capability.

#### Scenario: Wrapper drops the name

- **WHEN** `testMachine(qrCodeContract, …)` runs on a wrapper whose frame has no `role="img"`
- **THEN** the generic name invariant fails

