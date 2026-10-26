## Why

Signature capture ships as a component only in Ark/Zag and as the canvas library
signature_pad (and wrappers). Both carry the same bug classes: the canvas clears or misaligns
on resize and DPR changes, strokes jump between two pointers, strokes never end in iframes or
after a lost capture, the page scrolls instead of drawing, JPEG export is black, `required`
never validates (Zag's readonly input), the Clear button hides under the keyboard focus, and
the surface is announced as an "application" with no keyboard function. A signature pad built
on stroke data rendered as SVG avoids the first class entirely.

Research: [signature-pad](../../../docs/research/signature-pad.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

Depends on: `add-foundations`, `add-a11y-foundations`, `add-button`, `add-field` (Label,
hidden input, form reset), `add-qr-code` (SVG rasterising, download), `add-theme-system`.

## What Changes

- A public **Signature Pad** in `@rind-ui/core` and every framework package: parts `Root`,
  `Label`, `Control`, `Segment`, `Guide`, `Status`, `ClearTrigger`, `UndoTrigger`, and a
  hidden form input rendered by `Root`.
- The value is stroke data (`{ width, height, strokes: { points: { x, y, pressure, t }[] }[] }`),
  drawn as smoothed SVG paths in `currentColor`; controlled and uncontrolled; value events only
  when a stroke ends, on clear, undo and form reset.
- A new `dom/stroke-input.ts`: one locked `pointerId`, coalesced events, every end condition,
  CSS scale and zoom correction, iOS touch handling; a new `dom/svg-raster.ts` (SVG → image →
  canvas → Blob).
- Form value: an SVG data URL (or the JSON stroke model), computed synchronously; `required`
  validates.
- Export: `toBlob({ type, scale, background })` and `download(fileName)`.
- `getSignaturePad` driver, the contract Env's multi-pointer `draw`, `signature-pad.css`,
  site example and skin, docs page.

## Capabilities

### New Capabilities

- `signature-pad`: anatomy, value model, drawing input, rendering, clear and undo, form value
  and validation, export, accessibility, data attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Variable stroke width (pressure or velocity): pressure is recorded so it can come later
  without changing the value model; no dependency now.
- A typed-name mode: the docs pair the pad with a Text Field alternative.
- Loading an image as the value; an eraser; minimum-ink validation (the driver exposes
  `strokeCount` for an app rule).

## Impact

- New: `packages/core/src/components/signature-pad/`, `packages/core/src/dom/stroke-input.ts`,
  `packages/core/src/dom/svg-raster.ts`, the five framework packages, the driver, theme file,
  site example and skin, `docs/components/signature-pad.md`.
- Modified: the contract Env and the DOM and Playwright
  adapters gain a multi-pointer `draw`; `families.ts` (`signature-pad` in `field`).
- No new dependency.
