## Why

A QR Code is how Reado hands a URL from a desktop to a phone ("Reado Anywhere"), and every
product with a pairing or share flow needs the same: a symbol a camera reads at once, a name
a screen reader can speak, and a way to save it. Only Ark UI ships a headless QR code, built
on `uqr`; its bug history and those of the encoders React apps use (qrcode.react,
react-qr-code, Nayuki's generator) are dominated by four things: **logos that silently
make the code unreadable** (level L, nothing checks the budget), **encoder boundaries** (too
long, non-ASCII, lone surrogates, the standard's Latin-1 default) that crash renders or
corrupt payloads, **no accessible name or text alternative** (NVDA skips an unnamed SVG),
and **downloads** that taint canvases, lose the logo or blur modules.

The brief asks for the encoder to be written from scratch in `@rind-ui/core` (no new
dependency). It is therefore the larger half of this change and is specified as its own
capability, `qr-encoder`, so it can be verified without a DOM: published vectors, a
round-trip decoder as oracle, differential fixtures against the reference implementations.

Research: [docs/research/qr-code.md](../../../docs/research/qr-code.md) (sources, the
algorithm, bug history, accessibility, decisions, and the open question on dependency vs
own encoder) · cross-cutting [accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md).

**Depends on** `add-foundations` and `add-a11y-foundations` (archived: machine runtime,
contracts, drivers, press, ids, messages), `hidden-content` (visually hidden text) and
`theme-accessibility` (modified below). No overlay, positioning or collection capability is
used.

## What Changes

- A pure encoder in `@rind-ui/core` (`@rind-ui/core/qr`): `encodeQr(input, options)` →
  result (never throws for data-dependent failures), ISO/IEC 18004 versions 1–40, levels
  L/M/Q/H, numeric / alphanumeric / byte modes, UTF-8 with an ECI segment for non-ASCII,
  Reed-Solomon, automatic or forced mask; `qrPath` (merged runs, quiet zone) and `renderQrSvg`
  (escaped, standalone). Testing helpers: a decoder, fixtures, a path parser.
- A `qr-code` component in `@rind-ui/core` (machine, connect, contract) and `@rind-ui/react`
  (parts): `Root`, `Frame`, `Pattern`, `Overlay`, `ValueText`, `DownloadTrigger`.
- Defaults chosen for scanning: level `M`, quiet zone 4 modules inside the `viewBox`, one
  `path`, `crispEdges`, dark on light independent of the colour scheme (and of forced
  colors — see below).
- `role="img"` with a name and the value exposed as the description (`ValueText`); empty and
  invalid values render an empty, hidden frame and a typed error callback instead of
  throwing.
- Overlay coverage reported as `data-covers` with a development warning when it exceeds
  half of what the level recovers or reaches a finder pattern.
- Download as PNG / JPEG / WebP / SVG at an integer module scale, overlay composited when it
  can be, degrading to the symbol alone (never throwing) when the canvas would be tainted.
- Contract (`qrCodeContract`) with a generic **decode invariant** (the rendered matrix
  decodes to the value), driver, theme, site examples, docs page.
- **Modified capability** `theme-accessibility`: `forced-color-adjust: none` is also allowed
  on the QR code frame, with explicit dark-on-light colours.

## Capabilities

### New Capabilities

- `qr-encoder`: the pure encoder, path and SVG helpers, with conformance and decodability
  requirements.
- `qr-code`: the component — value, encoding options, result states, rendering, name and
  description, overlay, download, messages, data attributes, contract and driver.

### Modified Capabilities

- `theme-accessibility`: the `forced-color-adjust: none` exception also covers the QR code
  frame (requirement "State Visible Without Colour").

## Non-goals

- A third-party encoder dependency (see the open question in design.md and the research
  note; choosing one needs a decision record).
- Kanji mode, Micro QR, rMQR, structured append, Aztec/PDF417/other symbologies; mixed-mode
  segment optimisation (a later size optimisation, same output contract).
- Decoding as a feature (scanner component, camera access): the decoder in the testing
  package is test-only.
- Styled symbols (rounded modules, gradient fills, custom finder shapes), reflectance
  inversion (`invert`), custom quiet-zone colours beyond CSS.
- Binary payloads through the component's `value` (the encoder accepts bytes; the
  component's `value` is a string in v1).
- Server-side file generation helpers beyond `renderQrSvg`.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/qr/{encode,segments,reed-solomon,matrix,mask,tables,path,svg}.ts`
  with its own package entry, `packages/core/src/components/qr-code/{qr-code.machine,qr-code.connect,qr-code.contract}.ts`,
  `packages/core/src/dom/{download,qr-export}.ts`, `packages/react/src/qr-code/*`,
  `packages/testing/src/qr/{decode,parse-path,fixtures}.ts` and the driver export,
  `packages/theme/src/qr-code.css`, site examples under `apps/site`, a docs page.
- No new runtime dependency. Test-time cross-checks use fixtures generated once from the
  reference implementations (a script that needs `uqr` and Nayuki's generator as
  devDependencies is an open question in design.md, not part of this change).
- `docs/components.md`: QR Code status → `spec`.
