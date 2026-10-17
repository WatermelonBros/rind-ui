## Context

See proposal.md for why. The research, the algorithm summary and the bug history are in
[docs/research/qr-code.md](../../../docs/research/qr-code.md); its Decisions section is
binding unless this document says otherwise.

| From | Used for |
|---|---|
| `add-foundations` | `setup()/machine()`, controllable `value`, `contract()` with `$sync` prop steps, drivers, `testMachine` and generic invariants |
| `add-a11y-foundations` | press events on `DownloadTrigger`, `data-focus*`, `partId()`, `messages` with provider overrides, expected parts for SSR relations |
| `hidden-content` | the visually hidden style for `ValueText` |
| `react-adapter` | element substitution, instance scoping attributes, merged consumer props |
| `theme-accessibility` | modified: forced-colors exception for the symbol frame |

No overlay, positioning, collection or announcer capability is used: a QR code opens
nothing and announces nothing.

## Goals / Non-Goals

**Goals:**
- A correct, small, dependency-free encoder that is verified by decoding its own output
  and by differential fixtures, so the largest risk of writing it from scratch is covered
  by tests rather than by trust.
- A component whose defaults produce a scannable, named, SSR-stable symbol, and whose
  failure modes (too long, empty, tainted canvas) are states and results, not exceptions.

**Non-Goals:** the proposal's Non-goals.

## Decisions

### 1. Encoder layout (`@rind-ui/core/qr`)

```ts
// packages/core/src/qr/encode.ts
export type QrEcc = "L" | "M" | "Q" | "H"
export interface QrOptions {
  readonly ecc?: QrEcc                 // default "M"
  readonly boostEcc?: boolean          // default false
  readonly minVersion?: number         // 1
  readonly maxVersion?: number         // 40
  readonly mask?: number               // -1 (auto) | 0..7
  readonly eci?: "auto" | "none"       // "auto"
}
export type QrSegmentInfo =
  | { readonly mode: "numeric" | "alphanumeric" | "byte"; readonly chars: number }
  | { readonly mode: "eci"; readonly assignment: number }
export type QrResult =
  | { readonly ok: true; readonly version: number; readonly ecc: QrEcc; readonly mask: number
      readonly size: number; readonly modules: readonly (readonly boolean[])[]
      readonly segments: readonly QrSegmentInfo[] }
  | { readonly ok: false; readonly error: "too-long"; readonly neededBits: number
      readonly availableBits: number; readonly maxBytes: number }
  | { readonly ok: false; readonly error: "invalid-option"; readonly option: keyof QrOptions }
  | { readonly ok: false; readonly error: "invalid-input" }
export function encodeQr(input: string | Uint8Array, options?: QrOptions): QrResult
```

Modules, one concern per file: `segments.ts` (mode choice, bit packing, ECI, UTF-8 through
`TextEncoder`-equivalent semantics: a hand-rolled encoder is 15 lines and removes the
dependence on a global), `tables.ts` (ECC codewords per block and block counts, 4 × 41
entries each, plus the alignment-position function `3 + ⌊v/7⌋` centres with Nayuki's step,
verified against the ISO table in a test), `reed-solomon.ts` (GF(2⁸) log/antilog tables built
once at module load, generator polynomial by degree, remainder), `matrix.ts` (function
patterns, format and version words, zigzag placement, on a flat `Uint8Array` with a parallel
"is function module" mask), `mask.ts` (the eight predicates, penalty scoring with run
histories — the hot loop, ~8 × size² work), `path.ts` (`qrPath`), `svg.ts` (`renderQrSvg`,
attribute escaping).

The public `modules` is a frozen row-major `boolean[][]` built once at the end (31 k booleans
at version 40: negligible next to mask scoring). Internally everything else is typed arrays.

*Alternatives:* depend on `uqr` (27 kB, bit-identical, already used by Zag) or Nayuki's
TypeScript generator (MIT) — the lowest-risk path, rejected **by the brief**, not by
engineering; kept as the open question below. Port of Nayuki's `QrSegmentAdvanced` mixed-mode
optimisation — a later size optimisation behind the same result type.

### 2. ECI and character encoding

`eci: "auto"` writes `0111` + assignment 26 (8 bits) before a byte segment whose source
string had a character above U+007F; ASCII-only strings never get it. Rationale: the
standard's default byte interpretation is ISO 8859-1 and readers disagree on guessing
(nayuki#154, react-qr-code#283); URLs, the main payload, are ASCII and stay free of the
12-bit overhead and of any reader that mishandles ECI. `Uint8Array` input is bytes with no
ECI (nayuki#9, #104). Decided with the owner as an open question: `"none"` as the default
is the other defensible choice.

### 3. Result, not exceptions

`encodeQr` validates input and options first (types, ranges, `minVersion <= maxVersion`,
level in the closed set), then segments, then picks the version; every failure is a typed
result. Programmer errors that cannot be data-dependent (a non-function where a function is
required) are not possible in this API, so nothing throws. The component maps `ok: false`
to `data-state="invalid"` and a once-per-value `onEncodeError`; development builds also
`env.logger.warn`.

### 4. Component machine

```ts
type QrEvent =
  | { type: "VALUE.SET"; value: string }
  | { type: "DOWNLOAD"; mimeType: QrMime; quality?: number; fileName?: string; size?: number; modality: Modality }
  | { type: "DOWNLOAD.DONE"; details: DownloadDetails } | { type: "DOWNLOAD.FAILED" }
  | { type: "PARTS.CHANGED"; valueText: boolean; overlay: boolean }
  | { type: "OVERLAY.MEASURED"; modulesCovered: number; reachesFinder: boolean }

qrCodeMachine = setup({ guards: { isDownloadable }, … }).machine({
  initial: "ready",
  values: { value: "context" },                    // controllable string
  computed: { encoded: memo by (value, ecc, boostEcc, minVersion, maxVersion, mask, eci) },
  states: {
    ready: { effects: ["watchOverlay"],
             on: { "VALUE.SET": { actions: ["setValue"] },
                   DOWNLOAD: { guard: "isDownloadable", target: "downloading" },
                   "PARTS.CHANGED": …, "OVERLAY.MEASURED": { actions: ["setCoverage"] } } },
    downloading: { effects: ["exportImage"],
                   on: { "DOWNLOAD.DONE": { target: "ready", actions: ["recordDownload"] },
                         "DOWNLOAD.FAILED": { target: "ready" }, "VALUE.SET": { actions: ["setValue"] } } },
  },
})
```

- `encoded` is a memo keyed on the *values* (a tuple of primitives), not on the `encoding`
  object, so Reado's inline `encoding={{ ecc: "M" }}` never re-encodes.
- `downloading` is a state so a double click is ignored by construction and the trigger can
  show `data-state="downloading"`; `exportImage` is the one effect with DOM (canvas, `Blob`,
  an anchor), cleaned up (URL revoked, listeners removed) on exit.
- `watchOverlay` (browser only, development-gated for the warning, always for `data-covers`):
  a `ResizeObserver` on the frame and the overlay computes the covered module rectangle in
  module units from their rectangles and the `viewBox`; it only sends `OVERLAY.MEASURED`.

### 5. Connect and parts

`Root` carries the state attributes and the variables; `Frame` is the `svg` with `viewBox`,
`xmlns`, `shape-rendering`, and, only when `ready`, `role="img"` + name + description;
`Pattern` is the single `path` with `d = qrPath(modules, { quietZone })`. `ValueText` is an
expected part (`PARTS.CHANGED`) so `aria-describedby` is correct in the server HTML; its
default content is the value. The frame's name resolves consumer `aria-labelledby` →
`aria-label` → `messages.label`; the description merges a consumer `aria-describedby` with
the value text id. `Overlay` is `position: absolute; inset-block-start: 50%; inset-inline-start: 50%;
translate: -50% -50%` inline (so it works without the theme) with `data-covers`; `translate`
is logical-safe because the symbol is never mirrored.

### 6. Download

```ts
// core/dom/download.ts — shared with later components (Signature Pad, Image Cropper)
export function saveBlob(env: Environment, blob: Blob, fileName: string): void   // anchor + objectURL, revoked after click
export function sanitizeFileName(name: string, fallback: string): string
// core/dom/qr-export.ts
export function exportQr(env, { encoded, quietZone, mimeType, quality, size, frame, overlay }): Promise<{ blob: Blob; overlay: "included" | "omitted" | "none" }>
```

Raster: `scale = ceil(size / totalModules)`, canvas `totalModules × scale` square, smoothing
off, background = the frame's computed `background-color` (white when transparent), modules
drawn from the same `qrPath` through `Path2D` (rect fallback when unavailable), the overlay
drawn with `drawImage` at its rectangle in module units × scale after drawing its own
background / outline from computed style. An overlay that is an `<img>` is drawn directly (its
`crossOrigin` and CORS decide whether the canvas is tainted: `toBlob` throwing a
`SecurityError` triggers a second pass without the overlay, reported as `overlay:
"omitted"`); an inline `<svg>` overlay is serialised and drawn through an `Image`; anything else
(text, emoji, components) is `"omitted"` — documented, with the advice to use an image.
SVG export is `renderQrSvg` plus an `<image href>` whose source is a data URL when it can be
read (same-origin or CORS) and omitted otherwise — never a remote reference (qrcode.react#379).
*Alternative:* Zag's approach (serialise the live SVG, clone, strip `foreignObject`, re-insert
the overlay as `<image>`, read `outline` as a margin): works but depends on layout reading of
arbitrary overlay content; here the supported overlay content is explicit.

### 7. Contract, driver and the decode invariant

```ts
export const qrCodeContract = contract("qr-code", {
  anatomy: ["root","frame","pattern","overlay","value-text","download-trigger"],
  locate: { part: "frame", role: "img", name: true },           // getQrCode(screen, { name? })
  actions: {
    setValue: { api: ({ props }, value) => props.setValue(value), done: q => q.value() === value },
    download: { pointer: ({ part }) => part("download-trigger").click(), keyboard: …, done: q => q.lastDownload() !== undefined },
  },
  queries: { value, version, ecc, size, matrix, decoded, description, isEmpty, error, lastDownload },
  states: { ready: {}, downloading: { downloading: true } },
  events: { "VALUE.SET": "$sync:value", DOWNLOAD: "download", "DOWNLOAD.DONE": { skip: "async" },
            "DOWNLOAD.FAILED": { skip: "browser only" }, "PARTS.CHANGED": { skip: "mount bookkeeping" },
            "OVERLAY.MEASURED": { skip: "layout driven; browser tests" } },
  traits: () => [],
  invariants: [ ({ q }) => q.isEmpty() || q.error() || q.decoded() === q.value() ],   // the decode invariant
})
```

`matrix()` parses the rendered `d` and `viewBox` back into modules (`parse-path.ts`), so the
renderer is checked end to end, not only the encoder; `decoded()` runs the testing decoder
on it. `lastDownload` is recorded by the machine (`recordDownload`) so the DOM adapter
needs no file-system access: the Playwright adapter additionally waits for its `download`
event and compares file names, the DOM adapter spies on the anchor click.

### 8. Theme (decision 0007)

Tier-3 tokens `--rind-qr-code-size` (default 11rem), `-fg` (`#000`), `-bg` (`#fff`),
`-radius` (frame corners), `-padding` (extra padding outside the quiet zone), `-overlay-size`
(25 %), `-overlay-radius`, `-overlay-outline-width`, `-overlay-outline-color`. The foreground
and background are black and white in both colour schemes. Under `forced-colors: active` the
frame sets `forced-color-adjust: none` with the same explicit colours (modified
`theme-accessibility`); the download trigger and everything else follow the usual forced-colors
rules.

## Reado coverage

| Reado relies on (`atoms/QrCode.tsx`) | Specified in |
|---|---|
| `QrCode.Root value`, `encoding={{ ecc: "M" }}` inline object | Value, Encoding Options ("Inline options object"; `M` is now the default) |
| `Frame width/height={size}`, 220 px default | Frame And Pattern Rendering (consumer sizing, `--rind-qr-code-size`) |
| `shapeRendering="crispEdges"` to hide hairline seams | Frame And Pattern Rendering (built in, single merged path) |
| `role="img"` + translated `aria-label` | Accessible Name And Description |
| `Pattern fill="var(--qr-ink)"` on a light tile that doubles as the quiet zone | Frame And Pattern Rendering (fill from CSS), Encoding Options (`quietZone` 4: Reado drops the tile padding or sets `quietZone: 0`) |
| "Always dark-on-light regardless of theme" | theme tokens (§8), modified `theme-accessibility` |

## Requests to other changes

Nothing is edited in another change.

1. **`theme-accessibility` (archived capability, from `add-theme-system`)** — the
   `forced-color-adjust: none` exception ("only on colour swatches") must also cover the QR
   code frame, or forced colors and dark schemes invert the symbol and most scanners cannot
   read it. This change carries the MODIFIED requirement itself (spec delta
   `specs/theme-accessibility`); the owner of the theme should confirm the wording.
2. **`add-tour` and later image-producing components (Signature Pad, Image Cropper)** — may
   reuse `core/dom/download.ts` (`saveBlob`, `sanitizeFileName`), specified once here.

## Open questions

**Decided (owner, through the coordinator, 2026-10-16):** own encoder in `@rind-ui/core`, no
runtime dependency; the differential fixtures are generated once offline from `uqr` 0.1.3 and
Nayuki's generator v1.8.0 in a scratch directory outside the repository and committed as JSON
with a README saying how (`packages/testing/src/qr/fixtures/`), so no reference package is a
dependency of any manifest; the ECI default is `"auto"`. The remaining questions below are
kept for the record.

- **Own encoder vs `uqr` / Nayuki as a dependency.** The brief says write it; the
  conservative engineering answer is a ≈27 kB, dependency-free, bit-identical library. The
  tests in this change (published vectors, a round-trip decoder as oracle over all versions,
  levels and masks, differential fixtures) are designed so that if a bug survives them it would
  also have survived adopting the dependency. If the owner prefers the dependency, the
  `qr-encoder` requirements stay (they become the wrapper's contract) and tasks 1.x shrink to
  an adapter plus the same tests; that needs a decision record.
- A test-only dependency for generating the differential fixtures once (`uqr`, Nayuki's
  generator as devDependencies, or checking in fixtures produced out of tree): needs a
  decision record too; until then fixtures are produced by a one-off script outside the repo and
  committed.
- ECI default `"auto"` vs `"none"` (above).
- Whether the component should accept binary payloads (`value: string | Uint8Array`); the
  encoder already does.
- `data-covers` and the development warning assume the overlay is centred. A moved overlay
  (consumer CSS) is measured correctly (rectangles), but "reaches a finder" assumes the
  standard finder positions, which is right for every version.

## Risks / Trade-offs

- [An encoder bug that every test shares with the implementation] → three independent
  oracles: published vectors (ISO Annex I codewords and format/version words are in the
  spec), the reference implementations' output as fixtures, and `BarcodeDetector` in
  browsers that have it; plus a manual scan of ten generated codes with an iOS camera and
  Android Google Lens, listed in the release protocol.
- [`TextEncoder`-equivalent hand-rolled UTF-8] → 15 lines, tested against the platform's
  `TextEncoder` over all code points in Node.
- [Mask scoring cost at version 40] → typed arrays; the 100 ms budget is a test; if CI is
  slower the budget is a measured constant, not removed.
- [Canvas export differences between engines] → the export is covered in Chromium, Firefox
  and WebKit by comparing the decoded content, not pixels.
- [Overlay measurement needs layout] → browser project only; the pure rectangle function is
  unit-tested in Node.

## Migration

Reado's `QrCode` atom becomes `QrCode.Root` / `Frame` / `Pattern` with `aria-label` kept;
the encoding option moves to the default; its light tile's padding becomes the built-in quiet
zone (or `quietZone: 0` to keep the current look); `--qr-ink` maps to `--rind-qr-code-fg`.
