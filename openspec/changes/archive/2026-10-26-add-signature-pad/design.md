## Context

Research: [docs/research/signature-pad.md](../../../docs/research/signature-pad.md), whose
"Decisions" section this design adopts; this file records only what the spec needs to be
exact, and the answers to the research's open questions.

## Decisions

### 1. Value model

```ts
interface SignaturePoint { readonly x: number; readonly y: number; readonly pressure: number; readonly t: number }
interface SignatureStroke { readonly points: readonly SignaturePoint[] }
interface SignatureValue { readonly width: number; readonly height: number; readonly strokes: readonly SignatureStroke[] }
```

`width` / `height`: the Control's box in CSS px when the first stroke of an empty pad began
(the stroke space). Points are in that space. `t`: ms since the stroke began. Empty value:
`{ width: 0, height: 0, strokes: [] }`. Values are never mutated: each change is a new object
(react-signature-canvas#56).

### 2. Machine

States `idle`, `drawing`. Context: `value` (bindable: `value` / `defaultValue` /
`onValueChange`), `stroke` (the stroke in progress, outside the value: Zag 156940f),
`pointerId`.

- `POINTER.DOWN { pointerId, point, box }` in `idle`, unless disabled or read-only: lock the
  id, start the stroke; on an empty value take `box` as the stroke space.
- `POINTER.MOVE { pointerId, points }`: other ids ignored; points closer than `minDistance`
  (1 px) to the last are dropped.
- `POINTER.UP { pointerId }` and `POINTER.CANCEL { pointerId }` for the locked id: commit the
  stroke (a partial stroke is ink) → `idle`, `onValueChange`.
- `CLEAR`, `UNDO`: ignored while `drawing` or empty; otherwise a new value and an
  announcement (`messages.cleared`, `messages.undone`), polite.
- `RESET` (form reset): back to `defaultValue`.

### 3. Rendering

Each stroke is one `<path>` in the Segment's `<svg viewBox="0 0 width height"
preserveAspectRatio="xMidYMid meet">`: quadratic curves through midpoints; one point is a
zero-length segment with a round cap (a dot). `stroke="currentColor"`, round caps and joins,
width `var(--rind-signature-pad-stroke-width, 2.5px)` via the `stroke-width` CSS property.
Geometry is a pure function of the points (`signaturePath(stroke)`).

### 4. Pointer input (`dom/stroke-input.ts`)

Pointer Events only. `pointerdown` on the Control (primary button or touch/pen contact) →
`setPointerCapture`; moves read `getCoalescedEvents()` when present; the stroke ends on
`pointerup`, `pointercancel`, `lostpointercapture`, or a move with `buttons === 0`. Listeners
on the Control's `ownerDocument`. A point is mapped from client coordinates through the
Control's current rect and the rect-to-box ratio (CSS `scale`) and `dom/css-zoom.ts`, then into
the stroke space. A non-passive `touchstart` with `preventDefault` on the Control (iOS
Scribble). Connect sets `touch-action: none`, `overscroll-behavior: contain`,
`user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none` on the
Control.

### 5. Form

A hidden input (`dom/hidden-input`) rendered by Root, with `name`, `required`, `disabled`,
not `readonly`. Its value: `formValue: "svg"` (default) → a `data:image/svg+xml` URL of the
strokes with the ink colour inlined (`inkColor`, default `"#000"`); `"json"` → the stroke
model as JSON; empty → `""` (so `valueMissing` when required). A failed submit focuses the
Control (`tabIndex=-1`).

### 6. Export

`api.toBlob({ type = "image/png", scale = 2, background })`: the strokes' SVG (ink colour from
the Control's computed `color`) rasterised by `dom/svg-raster.ts` at `width × scale` by
`height × scale`; `image/jpeg` and `image/webp` paint `background` (default `#fff`), PNG keeps
transparency unless `background` is given. Rejects with `EmptySignatureError` when empty and
with the decode error when the image fails. `api.download(fileName, options)` uses
`dom/download.ts`.

### 7. Accessibility

Control: `role="img"`, `aria-labelledby` = Label (or the consumer's `aria-label`),
`aria-describedby` = Status (+ the Field's description and error), `tabIndex=-1`. Status:
visually hidden text, `messages.empty` ("Not signed") or `messages.signed` ("Signed"). Segment
and Guide: `aria-hidden`. ClearTrigger / UndoTrigger: buttons named `messages.clear` /
`messages.undo` followed by the Label ("Clear signature"), `aria-disabled` when there is
nothing to do (focusable, never hidden). Drawing announces nothing.

### 8. Attributes

`data-scope="signature-pad"`, `data-part`, `data-instance`, `data-state` (`idle`, `drawing`),
`data-empty`, `data-disabled`, `data-readonly`, `data-required`, `data-invalid` on every
part; `data-focus` / `data-focus-visible` on the triggers.

### 9. Open questions settled

- Variable width: not in v1 (non-goal); pressure is recorded.
- Typed alternative: a documented pattern, not a mode.
- Minimum ink: not in v1; `strokeCount` in the driver and the render state.
- `role="img"` + `tabIndex=-1`: kept; axe and the three screen readers are checked in the
  tests and the manual protocol; fallback (focus the ClearTrigger) only if a reader fails.

### 10. Contract and tests

Contract: locate by the Label's text, else the only pad. Actions `draw(points, options)`,
`tap(x, y)`, `drawWithTwoPointers`, `cancelStroke`, `clear`, `undo`. Queries `isEmpty`,
`strokeCount`, `formValue`, `name`, `statusText`, `clearDisabled`, `undoDisabled`.
Invariants: the in-progress stroke never appears in the value; triggers never hidden; the
Status text matches emptiness. The contract Env gains `Part.drawPointers(events)` (an ordered
list of `{ pointerId, pointerType, kind: "down" | "move" | "up" | "cancel", x, y }` in the
part's own coordinates), implemented by the DOM and Playwright adapters.

## Risks / Trade-offs

- SVG with thousands of points is slower than canvas; irrelevant at signature scale.
- iOS pass-through drawing with VoiceOver is verified by hand, not promised by the docs.
