# Signature Pad — research

Status: done · Wave: 3

A Signature Pad is a surface where the user signs with a finger, stylus or mouse. It
keeps the signature as strokes, can clear or undo them, takes part in a form (required,
submitted value, reset) and exports an image (SVG, PNG, JPEG). The hard parts are input
fidelity (pointer types, palm and second-finger rejection, iOS Scribble, coalesced events,
dots), geometry that survives resizing and device pixel ratios, and what a keyboard or
screen-reader user can do with a control whose input is a path drawn by hand.

Of the nine libraries only Zag / Ark ships one (Chakra v3 re-exports Ark's). Outside them,
`szimek/signature_pad` (canvas, framework-free) is the reference implementation, and
`react-signature-canvas` wraps it for React. Its tracker (548 issues) holds most of the
field's bug history. Zag draws with `perfect-freehand`, so that tracker is read too.

Builds on [image-cropper.md](image-cropper.md) (pointer-first gesture on a surface,
keyboard alternative), [qr-code.md](qr-code.md) (SVG → raster export, `dom/qr-export.ts`,
`dom/download.ts`), [field.md](field.md) and [form.md](form.md) (hidden input, constraint
validity, reset), and the cross-cutting notes [accessibility.md](accessibility.md) §5
(drags), §7 (announcer), §8, [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
causes A, C, J, K, and [native-platform.md](native-platform.md) (no native primitive).

Sources read (local shallow clones, 2026-10-26):

| Library | Files |
|---|---|
| Zag (`4a2c1bb`) | `packages/machines/signature-pad/src/{signature-pad.machine,signature-pad.connect,signature-pad.dom,signature-pad.types,signature-pad.anatomy,signature-pad.props,get-svg-path}.ts`, `CHANGELOG.md`; `packages/utilities/dom-query/src/data-url.ts` |
| Ark | `packages/react/src/components/signature-pad/{signature-pad-root,signature-pad-control,signature-pad-segment,signature-pad-hidden-input,signature-pad-label,signature-pad-clear-trigger,signature-pad-guide}.tsx`, `examples/{basic,controlled,image-preview,with-field}.tsx`, `tests/signature-pad.test.tsx` |
| signature_pad (`949dff3`) | `src/{signature_pad,point,bezier,throttle,signature_event_target}.ts`, `README.md` |
| react-signature-canvas | the tracker (resize, data mutation, stylus) |
| perfect-freehand | `README.md`, the tracker (single points, duplicate points, skipped input) |
| rind-ui | `core/src/dom/{pointer-drag,hidden-input,constraint-validity,qr-export,download,css-zoom}.ts`, `components/image-cropper/image-cropper.connect.ts` |

Radix, Base UI, React Aria, Headless UI, Ariakit, Reka UI, Bits UI, Kobalte and Mantine
ship no Signature Pad. None has an open request on its tracker ("signature", 2026-10-26).

## Pattern

- WAI-ARIA APG: **none**. [accessibility.md](accessibility.md) §1.5 lists Signature Pad
  under "no APG pattern", with the closest composition "application + keyboard
  alternative". This note revises that (see Accessibility): the surface is an image of the
  signature, and the keyboard path is the buttons around it plus a non-drawn alternative.
- WCAG is explicit that this input is exempt:
  - 2.1.1 Keyboard exempts functions whose input "depends on the path of the user's
    movement", and freehand drawing is the standard example.
  - 2.5.1 Pointer Gestures and 2.5.7 Dragging exempt path-based input when the path is
    essential.
  - Exempt from drawing by keyboard does **not** mean exempt from the form. A form that
    *requires* a drawn signature locks out keyboard-only, switch and screen-reader users
    unless it offers another way to sign (a typed name, a checkbox attestation). That is
    the consumer's form decision, but the component and its docs must make it easy.
- Roles and attributes:
  - The drawing surface: a named image of the current signature (`role="img"`, named by
    the Label).
  - Real buttons for Clear and Undo.
  - A hidden form input for the value.
- Keyboard: Tab reaches Clear and Undo (and the consumer's alternative field). Nothing is
  drawn by keyboard.

## How the others built it

| | Zag / Ark | signature_pad | react-signature-canvas |
|---|---|---|---|
| Surface | `div` Control + absolutely placed `svg` Segment | `canvas` | `canvas` (signature_pad) |
| Stroke model | `paths: string[]` (SVG path data, outline polygons) | `PointGroup[]` (points with `x, y, pressure, time` + pen options) | same as signature_pad |
| Rendering | `perfect-freehand` outline, filled | variable-width Béziers on canvas; width from **velocity** | same |
| Pressure | `simulatePressure: false`; real `event.pressure` passed to perfect-freehand | recorded, not used for width | — |
| Input | Pointer Events, capture on the Control, document `trackPointerMove` | Pointer Events; **touch events on iOS** (Scribble); one locked pointer id | same, older version |
| Throttle / min distance | none | 16 ms throttle, 5 px min distance | same |
| Undo | none | `toData().pop()` + `fromData` (demo only) | via `fromData` |
| Resize | SVG keeps its paths; coordinates are px of the Control | **canvas cleared by the browser**; README tells you to `redraw()` | `clearOnResize` (default true) |
| Export | `getDataUrl(type, quality)`: clone SVG → `Image` → canvas at DPR | `toDataURL(type)`, `toSVG()` | + `getTrimmedCanvas()` |
| Form | `HiddenInput` (consumer passes `value`), `name`, `required` | none | none |
| A11y | `role="application"`, `aria-roledescription="signature pad"`, `aria-label` "signature pad", `tabIndex=0` | none | none |

### Zag.js / Ark UI

- Source: `signature-pad.machine.ts` (138 lines), `signature-pad.connect.ts` (167 lines).
  Ark's parts are thin: Root, Label, Control, Segment (renders the paths and the in-progress
  path), Guide, ClearTrigger, HiddenInput.
- API:
  - Props: `paths` / `defaultPaths` / `onDraw({ paths, currentPath })`,
    `onDrawEnd({ paths, getDataUrl })`, `drawing` (perfect-freehand `StrokeOptions` +
    `fill`), `disabled`, `readOnly`, `required`, `name`, `translations` (`control`,
    `clearTrigger`), `ids`, `dir`.
  - API object: `empty`, `drawing`, `paths`, `currentPath`, `clear()`, `getDataUrl()`.
- State model: `idle | drawing`.
  - `POINTER_DOWN` → `drawing` (`addPoint`).
  - In `drawing`, the `trackPointerMove` effect sends `POINTER_MOVE` (`addPoint` +
    `onDraw`) and `POINTER_UP` → `idle` (`endStroke` appends `currentPath` to `paths`, then
    `onDrawEnd`).
  - Root-level `CLEAR`.
  - Each `addPoint` recomputes the whole perfect-freehand outline of the current stroke.
- Notable:
  - SVG rendering: the drawing is DOM, so it survives resize and DPR without redrawing,
    and the theme can style it.
  - Committed strokes and the stroke in progress are separate (`paths` vs `currentPath`),
    so a controlled `paths` is not rewritten on every move. That fix came late (156940f).
  - Points are relative to the Control's box at event time.
  - The Control has `touch-action: none` and `user-select: none` inline.
  - A press on the ClearTrigger (inside the Control) does not start a stroke.
  - `getDataUrl` resolves `""` when empty (a 1.x fix, 6ef9950).
- Problems (from the source; the tracker has few signature reports):
  - **Accessibility**:
    - `role="application"` on a focusable `div` that has no keyboard function. It switches
      NVDA and JAWS out of browse mode into a control that does nothing. The
      `role="application"` was added only to silence axe's `aria-roledescription` rule
      (changelog 9072eb4), not for behaviour.
    - The name is a fixed `aria-label` ("signature pad"); the visible Label is never in it
      (WCAG 2.5.3).
    - Nothing tells a screen-reader user whether the pad is signed.
  - **Label**:
    - `for` points at the hidden input's id. When `HiddenInput` is not rendered (Ark's
      basic example) the `for` dangles.
    - When it is rendered it is `hidden`, so the label activation focuses nothing; an
      `onClick` focuses the Control instead.
  - **`required` never validates**:
    - The hidden input is `readOnly`, and a `readonly` input is barred from constraint
      validation.
    - Its `value` is whatever the consumer passes, and no example passes one.
  - **Clear**:
    - The ClearTrigger is `hidden` while empty or drawing.
    - After a keyboard press it hides itself, and focus falls to `<body>`.
    - `focusCanvasEl` then calls `scope.getActiveElement()?.focus()`, which refocuses the
      element that just lost focus rather than the Control.
  - **Export**:
    - `dom-query/data-url.ts` sets `image.onload` but no `onerror`, so a failed decode
      leaves the promise pending forever.
    - Size comes from `getBoundingClientRect()`: an SVG inside a closed dialog or a hidden
      tab exports a 0×0 image.
    - The fill colour is read from an inline style. The docs warn that it "must be a valid
      CSS color string, not a css variable", because a cloned, serialised SVG loses CSS
      variables and stylesheet rules.
  - **Stored as path strings**:
    - The value is perfect-freehand outline polygons. They cannot be re-rendered with
      another width or smoothing, rescaled to a new box, or replayed.
    - Undo is a pop on strings, which works, but nothing else does.
  - **No undo, no multi-pointer rejection**:
    - A second finger's `pointerdown` is a new `POINTER_DOWN` while `drawing`: ignored by
      the machine, but its moves are tracked by the document listener.
    - `trackPointerMove` follows whichever pointer moves.
  - Fixed in the changelog:
    - `dir` accepted but never forwarded (zag#3158, a83c537).
    - Controlled `paths` rewritten during a stroke (156940f).
    - Ark Vue ignored controlled `paths` (ark#3951).
    - `getDataUrl` after clear returned the old image (6ef9950).
    - React "controlled input without onChange" warning on the hidden input (6ef9950).
    - `data-required` added to the label (#2673).
    - The label got an `id` for Field composition (83de2ce).

### signature_pad (szimek)

- Source: `signature_pad.ts` (970 lines), `bezier.ts`, `point.ts`, `throttle.ts`.
- API: `new SignaturePad(canvas, options)`; `clear`, `redraw`, `isEmpty`,
  `toData`/`fromData`, `toDataURL`/`fromDataURL`, `toSVG`, `on`/`off`. Events:
  `beginStroke` (cancelable), `beforeUpdateStroke`, `afterUpdateStroke`, `endStroke`.
- Options: `minWidth`, `maxWidth`, `velocityFilterWeight`, `minDistance` (5),
  `throttle` (16), `dotSize`, `penColor`, `backgroundColor`, `compositeOperation`.
- Notable, and earned through the tracker:
  - **One locked pointer**: `_strokePointerId = event.persistentDeviceId ||
    event.pointerId`. Every move or up from another id is ignored. This fixed the jump
    between two fingers (#787) and palm + Surface Pen (#827).
    - It replaced an `isPrimary` check that broke touch in Firefox after a pen had been
      used once (#834: Firefox reports `isPrimary=false` for touch until restart).
  - **Touch events on iOS**: the Apple Pencil's "Scribble" handwriting feature swallows
    pointer events, so strokes go missing (#518, Apple forum 664108). The library listens
    to `touchstart`/`touchmove` on iOS instead.
  - **Listeners on the canvas's own window** (`ownerDocument.defaultView`): it works in a
    `window.open` popup (#636) and an iframe (#702).
    - `pointercancel` ends the stroke without a last point.
    - A move with the primary button no longer pressed also ends it (a missed `pointerup`
      outside the frame).
  - **`beginStroke` is cancelable**, the hook that lets a consumer reject a pointer type.
  - Dots: the first point of a stroke draws a dot, so a tap leaves a mark.
  - Erase uses `compositeOperation: "destination-out"`.
- Problems (the README's own sections):
  - **Resizing a canvas clears it.** The README asks the consumer to listen to `resize`,
    rescale for DPR, then call `clear()` or `redraw()`. This is the single largest issue
    class (see Bug history).
  - **DPR is the consumer's job**: `toSVG` and `fromDataURL` mix CSS and device pixels
    (#885, #630, #753, #679, #153).
  - JPEG export on a transparent canvas is black (#858, #584, #45, #147).
  - Width varies with speed, not pressure. "Fixed stroke width" is `minWidth === maxWidth`
    (#821); pressure was requested (#379) and closed in favour of a callback.
  - Erase and undo do not compose (#421).
  - Dots go missing on fast signing on slow phones (#716, open): begin and end events
    interleave.
  - No accessibility of any kind, and no issue ever asked for it (searched "access",
    "aria", "keyboard", "screen reader", "label": zero hits).

### react-signature-canvas

A React wrapper of an older signature_pad (2.3.2). Its tracker adds:

- The canvas clears itself on iOS when the URL bar shows or hides, because that resizes
  the viewport (#65, open).
- Turning off its clear-on-resize leaves the strokes misaligned with the pointer (#43, #47,
  #57).
- `fromData` mutates the array passed in (#56).
- `onBegin` does not fire for `fromData` (#82).
- Strokes are missing with a Surface Pen (#135/#136, fixed upstream in signature_pad 5).

### perfect-freehand (what Zag draws with)

- A function from input points `[x, y, pressure]` to the polygon outline of a
  variable-width stroke. Options: `size`, `thinning`, `smoothing`, `streamline`,
  `simulatePressure`, start and end tapers.
- Its tracker:
  - A single point, or two identical points, produced `NaN` outlines (#19, #29, fixed).
  - Dots on i's went missing (#1).
  - Drawing needs `touch-action: none` on the surface, or Chrome cancels the pointer
    events (#2).
  - Fast drawing skips input points (#83, open). The fix is on the input side:
    `getCoalescedEvents()`.
- Not a dependency rind-ui may take without a decision record (CLAUDE.md, decision 0009).

## Accessibility

Applying [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md):

- **The surface is an image, not an application.**
  - `role="application"` (Zag) is wrong for a surface with no keyboard function. It takes
    the screen reader out of browse mode, and a press of Enter or Space does nothing.
  - Our Control is `role="img"`, named by the Label (`aria-labelledby`). Its state is
    described: `aria-describedby` points at a visually hidden status from `messages`, such
    as "Not signed" or "Signed".
  - The Control is **not** a Tab stop. It is focusable programmatically (`tabIndex=-1`) so
    a failed submit can focus it, the way constraint validity focuses any invalid control.
  - A pointer user draws on it; a keyboard user has nothing to do there.
- **Name.** Visible Label first (2.5.3). A consumer `aria-label` only without a Label. The
  Clear and Undo buttons are named from `messages` plus the Label, e.g. "Clear signature",
  so several pads on a page have distinct buttons (the Clipboard decision, WCAG 2.4.6).
- **Alternative.** The docs and the site example pair the pad with a non-drawn way to
  sign, such as "Type your full name instead". It is a Text Field in the same form; the
  form's rule accepts either. The pad itself does not own a typed mode in v1 (Open
  questions).
- **Clear and Undo** are real `<button type="button">`s, outside the drawing surface's hit
  area.
  - When there is nothing to clear or undo they are `aria-disabled` (`focusableWhenDisabled`),
    never `disabled` or `hidden`. Focus stays on them (rule 11; the same bug #326 fixed on
    the site's dialog), where Zag hides the trigger and drops focus.
  - The result is announced through the Announcer, politely, e.g. "Signature cleared" or
    "Last stroke removed", because the visual change is the only other signal.
- **Pointer press semantics do not apply.** Drawing starts on `pointerdown` (not on
  release, 2.5.2); the path is essential.
  - An AT "press" (a bare `click`, cause A) on the surface draws nothing and must not
    throw.
  - TalkBack and VoiceOver touch users draw with the pass-through gesture (double-tap and
    hold, then draw). This is verified by hand, not assumed (cause J).
- **Forced colors** (cause K): strokes are painted with `currentColor` (`CanvasText`), the
  guide with `GrayText`. The surface border survives because it is a border, not a
  shadow.
- **Status, not live.** The pad is not a live region. Drawing announces nothing (pointer
  users see it, and screen-reader users read the described state). Only Clear and Undo
  announce.
- **Required.**
  - `aria-required` is not allowed on `role="img"`. Required-ness reaches AT through the
    Label ("required" in its text or marker, as Field does) and the hidden input's
    validity message on submit.
  - `aria-invalid` is not allowed on `img` either. The invalid state is `data-invalid` on
    the parts, plus the Field's ErrorMessage, which is `aria-describedby`-linked to the
    Control.
- **Reduced motion, RTL.** No motion. `dir` affects layout only; strokes are not mirrored.
- **Native platform.** No native primitive. `<canvas>` is not chosen (below); `<input>`
  has no drawing type; EditContext is for text. Rasterising for export uses the same
  SVG → `Image` → canvas path as QR Code.

## Bug history

Search: signature_pad (548 issues, all read by title, ~45 read in full), Zag and Ark
("signature", issues and PRs), react-signature-canvas (≈80), perfect-freehand (≈60), open
and closed.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| signature_pad | [#243](https://github.com/szimek/signature_pad/issues/243), [#139](https://github.com/szimek/signature_pad/issues/139), [#370](https://github.com/szimek/signature_pad/issues/370), [#125](https://github.com/szimek/signature_pad/issues/125), [#146](https://github.com/szimek/signature_pad/issues/146), [#259](https://github.com/szimek/signature_pad/issues/259) | ink invisible, or drawing works only after a window resize (modals, hidden tabs) | canvas sized while its box was 0×0 (`display:none`) | consumer workaround: size it when shown | SVG with coordinates taken at event time: no size at mount to get wrong |
| signature_pad | [#161](https://github.com/szimek/signature_pad/issues/161), [#618](https://github.com/szimek/signature_pad/issues/618), [#230](https://github.com/szimek/signature_pad/issues/230), [#80](https://github.com/szimek/signature_pad/issues/80), [#86](https://github.com/szimek/signature_pad/issues/86) | signature erased on resize or orientation change | setting `canvas.width` clears the bitmap | README: redraw yourself | strokes are data, drawn by the DOM; a resize rescales them and never clears |
| react-signature-canvas | [#65](https://github.com/agilgur5/react-signature-canvas/issues/65) (open) | canvas wipes itself on iOS while signing | the URL bar's show/hide is a resize | open | same; no resize handler at all |
| react-signature-canvas | [#43](https://github.com/agilgur5/react-signature-canvas/issues/43), [#57](https://github.com/agilgur5/react-signature-canvas/issues/57) | ink offset from the pointer after a CSS resize | drawing buffer and CSS size disagree | closed (opt-in clearing) | map pointer → stroke space through the current rect on every event |
| signature_pad | [#885](https://github.com/szimek/signature_pad/issues/885), [#630](https://github.com/szimek/signature_pad/issues/630), [#753](https://github.com/szimek/signature_pad/issues/753), [#679](https://github.com/szimek/signature_pad/issues/679), [#153](https://github.com/szimek/signature_pad/issues/153) | SVG/PNG export cut to a quarter, or at the wrong size, at DPR 2 | viewBox from device pixels, drawing in CSS pixels | README: scale the canvas | stroke space is CSS px of the box; DPR only at rasterisation, as an explicit `scale` |
| signature_pad | [#713](https://github.com/szimek/signature_pad/issues/713), [#179](https://github.com/szimek/signature_pad/issues/179), [#670](https://github.com/szimek/signature_pad/issues/670) | wrong position under CSS `scale` or zoom | client offset not divided by the rendered/layout size ratio | won't fix | divide by `rect.width / box width`; `dom/css-zoom.ts` already handles `zoom`. Rotation is not supported, and documented |
| signature_pad | [#787](https://github.com/szimek/signature_pad/issues/787), [#827](https://github.com/szimek/signature_pad/issues/827), [#352](https://github.com/szimek/signature_pad/issues/352) | line jumps between two fingers, or between palm and pen | every pointer feeds the same stroke | fixed 5.0.9 (lock to one pointer id) | the stroke belongs to the pointer that started it; others are ignored until it ends |
| signature_pad | [#834](https://github.com/szimek/signature_pad/issues/834) | touch stops drawing in Firefox after a pen was used | `isPrimary=false` for touch once a pen was seen (Firefox) | fixed (check removed) | lock by `pointerId`, never by `isPrimary` |
| signature_pad | [#518](https://github.com/szimek/signature_pad/issues/518) | Apple Pencil strokes partly missing | iPadOS Scribble intercepts pointer events | fixed 4.0.1 (touch events on iOS) | non-passive `touchstart` with `preventDefault` on the surface; verify on an iPad (Open questions) |
| signature_pad | [#825](https://github.com/szimek/signature_pad/issues/825), [#626](https://github.com/szimek/signature_pad/issues/626), [#197](https://github.com/szimek/signature_pad/issues/197), [#244](https://github.com/szimek/signature_pad/issues/244) | page scrolls instead of drawing (Chrome 136, iOS app, Firefox iOS) | `touch-action` missing on an ancestor in WKWebView; a Chrome 136 passive-listener regression | Chrome fixed; consumer CSS | `touch-action: none` and `overscroll-behavior: contain` on the Control from connect, not the theme |
| perfect-freehand | [#2](https://github.com/steveruizok/perfect-freehand/issues/2) | Chrome Android cancels the stroke | no `touch-action: none` | docs | same |
| signature_pad | [#532](https://github.com/szimek/signature_pad/issues/532) | iOS selects the page and offers "Copy" while signing | text selection on long touch | `user-select: none` | `user-select` and `-webkit-touch-callout: none` on the Control |
| signature_pad | [#723](https://github.com/szimek/signature_pad/issues/723) | buttons unresponsive after a fast stroke (Chrome Android) | pointer capture not released after a fast lift | Chrome bug | release capture on `pointerup`, end on `lostpointercapture` (`pointer-drag` does) |
| signature_pad | [#702](https://github.com/szimek/signature_pad/issues/702), [#636](https://github.com/szimek/signature_pad/issues/636), [#823](https://github.com/szimek/signature_pad/issues/823) | stroke never ends in an iframe or a `window.open` popup | listeners on the global `window`, a missed `pointerup` | fixed (owner window; end when buttons are released) | listeners on the Control's `ownerDocument`; a move with `buttons === 0` ends the stroke |
| signature_pad | [#120](https://github.com/szimek/signature_pad/issues/120) | tapping an i-dot gives two dots | touch plus emulated mouse events | fixed (pointer events) | Pointer Events only; one stroke per pointer id |
| signature_pad | [#716](https://github.com/szimek/signature_pad/issues/716) (open) | dots missing when signing fast on slow phones | begin and end of consecutive dots interleave | open | a stroke is keyed by its pointer id; an `up` for another id does not end it |
| perfect-freehand | [#1](https://github.com/steveruizok/perfect-freehand/issues/1), [#19](https://github.com/steveruizok/perfect-freehand/issues/19), [#29](https://github.com/steveruizok/perfect-freehand/issues/29) | missing dots; `NaN` paths for one point or two equal points | division by a zero-length segment | fixed | a one-point stroke renders as a dot; duplicate points are dropped before geometry; a geometry test for both |
| perfect-freehand | [#83](https://github.com/steveruizok/perfect-freehand/issues/83) (open) | fast strokes look angular, points skipped | one point per `pointermove`; the browser coalesces | open | use `getCoalescedEvents()` when present |
| signature_pad | [#858](https://github.com/szimek/signature_pad/issues/858), [#584](https://github.com/szimek/signature_pad/issues/584), [#45](https://github.com/szimek/signature_pad/issues/45), [#147](https://github.com/szimek/signature_pad/issues/147) | JPEG export is a black box | transparent pixels become black in JPEG | docs: set `backgroundColor` | JPEG (and any format without alpha) paints a background, white by default |
| signature_pad | [#490](https://github.com/szimek/signature_pad/issues/490) | ~2% of stored signatures are `data:,` | `toDataURL` on a 0-size or lost canvas; and `isEmpty()` passes after a single tap | closed | value is computed from strokes, not read back from pixels; minimum-ink validation is an Open question |
| signature_pad | [#840](https://github.com/szimek/signature_pad/issues/840), [#23](https://github.com/szimek/signature_pad/issues/23) | `isEmpty()` true after loading a saved signature | `fromDataURL` draws pixels but no data | closed | the only way in is strokes (`defaultValue`/`value`); an image cannot be loaded as a value |
| signature_pad | [#421](https://github.com/szimek/signature_pad/issues/421), [#302](https://github.com/szimek/signature_pad/issues/302) | undo after erase, or with dynamic colour, redraws wrong | undo replays data with the current pen options | stale | v1 has no eraser; undo pops a stroke and each stroke is self-contained |
| react-signature-canvas | [#56](https://github.com/agilgur5/react-signature-canvas/issues/56) | the array given to `fromData` is mutated | internal push into the caller's array | open (milestone) | `readonly` stroke types; the machine copies on write |
| Zag | 156940f, [ark#3951](https://github.com/chakra-ui/ark/issues/3951) | controlled `paths` rewritten while drawing; Vue ignored `paths` | the in-progress stroke lived inside the value | fixed | the value changes only on stroke end, clear and undo; the stroke in progress is separate |
| Zag | [#3158](https://github.com/chakra-ui/zag/issues/3158) | `dir` ignored | not forwarded by connect | fixed | covered by the generic invariant that `dir` reaches every part |
| Zag | 6ef9950 | `getDataUrl` after clear returns the old image; React warning on the hidden input | stale snapshot; `value` without `onChange` | fixed | export reads current strokes; the hidden input is managed by `dom/hidden-input` |
| Zag | `signature-pad.connect.ts` (source) | `required` never blocks submit | the hidden input is `readonly` (barred from validation), and its value is consumer-provided | open | the constraint input is not `readonly`; its value is the computed value |
| Zag | `signature-pad.connect.ts` (source) | focus to `<body>` after Clear by keyboard | Clear is `hidden` when empty | open | `aria-disabled`, focus stays |
| Zag | `dom-query/data-url.ts` (source) | export promise never settles on a decode error; 0×0 image when hidden | no `onerror`; size from `getBoundingClientRect` | open | reject on error; size from the stroke space, not the layout box |

## Known pitfalls

- **Canvas clears on resize** (the most common bug, in every canvas implementation):
  avoided by drawing SVG from stroke data.
- **Zero-size at mount** (modals, tabs, `display:none`): nothing may be measured at mount.
  Measure at the first `pointerdown`.
- **Device pixels vs CSS pixels**: one stroke space in CSS px; DPR appears only when
  rasterising.
- **Several pointers**: lock to the starting `pointerId`. Never use `isPrimary`
  (Firefox).
- **iOS**:
  - Scribble eats Pencil events.
  - Long press selects text and shows the callout.
  - The URL bar resizes the viewport.
  - WKWebView ignores `touch-action` unless an ancestor has it too.
- **Missed `pointerup`** (iframe, popup, capture lost, fast lifts on Android): end on
  `pointercancel`, `lostpointercapture`, or a move with `buttons === 0`.
- **Dots and degenerate strokes**: one point, or repeated points, must render and must not
  produce `NaN`.
- **Export**:
  - JPEG needs a background.
  - CSS variables and stylesheet colours vanish from a serialised SVG, so inline the
    computed stroke colour.
  - An `Image` decode can fail.
  - A hidden element has no size.
- **"Empty" is a weak check**: a tap is a stroke. Teams expect `required` to mean "really
  signed".
- **Keyboard and screen-reader users** cannot sign by drawing. A form that requires drawing
  without an alternative is inaccessible however the pad is labelled.

## Testing notes

- **Node (no DOM)**: everything that matters is pure.
  - The machine: `idle | drawing`, pointer lock, clear/undo, controlled value, value
    events only at stroke end.
  - The geometry: point dedupe, smoothing to path data, a one-point dot, scaling the
    stroke space into a box.
  - The SVG serialiser (strokes → `<svg>` string with inline colour and viewBox).
  - Every bug-table row with a pure cause gets a test here: duplicate points, one point,
    two pointers interleaved, an `up` for a foreign id.
- **jsdom**: no layout. `getBoundingClientRect` is stubbed through the Env, so pointer →
  stroke mapping, CSS scale (rect vs box ratio) and zero-size are deterministic.
- **Browser, three engines**:
  - Real Pointer Events through Playwright `mouse` and `touchscreen`.
  - Multi-touch is a CDP `Input.dispatchTouchEvent` with two touch points, Chromium only.
    Firefox and WebKit run the two-pointer case through synthetic `PointerEvent`s with
    distinct ids.
  - Rasterising (PNG/JPEG) is checked by decoding the Blob and sampling pixels: non-empty,
    background white for JPEG, size = box × `scale`.
- **Driver** (`getSignaturePad`):
  - Actions: `draw(points, { pointerType, pointerId })` (down, moves, up in the surface's
    own coordinates), `tap(x, y)`, `drawWithTwoPointers()`, `cancelStroke()`
    (`pointercancel`), `clear()`, `undo()` (pointer and keyboard on the buttons).
  - Queries: `isEmpty`, `strokeCount`, `formValue`, `isRequired`, `isInvalid`, `name`
    (the Control's accessible name), `statusText`, `announcements`, `clearState` /
    `undoState` (`aria-disabled`).
- **Manual protocol**:
  - iPad + Apple Pencil (Scribble on).
  - Android Chrome fast strokes (#723).
  - Surface Pen + palm.
  - VoiceOver iOS and TalkBack pass-through drawing.
  - NVDA browse mode stays on when tabbing past the pad.
  - The status is read as "Signed" or "Not signed".

## Decisions

- **Rendering: SVG, not canvas.** The drawing is `<path>` elements in an `<svg>` whose
  `viewBox` is the stroke space.
  - No clearing on resize, no DPR handling, themeable with CSS (`currentColor`, forced
    colors), and inspectable by tests.
  - Canvas's one advantage, speed with thousands of points, does not matter at signature
    scale.
- **Stroke model** (the value): `readonly Stroke[]`, where `Stroke = { points: readonly
  { x, y, pressure, t }[] }` in CSS px of the Control's box when the first stroke started.
  - The box size is stored with the value (`{ width, height, strokes }`). Later resizes
    scale the drawing uniformly (`preserveAspectRatio="xMidYMid meet"`).
  - Points, not path strings, so the value can be re-rendered, rescaled, replayed and
    exported at any size.
  - Pressure and time are recorded for later variable width (Open questions).
- **Drawing**:
  - A smoothed centreline: quadratic midpoints, the same curve family as Zag's
    `get-svg-path`.
  - Drawn with `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
    and a width from the theme (`--rind-signature-stroke-width`, default 2.5 px).
  - A one-point stroke is a dot (zero-length path with a round cap).
  - Points closer than `minDistance` (default 1 px, after coalesced events) are dropped.
  - No new dependency: perfect-freehand is not used.
- **Parts**:
  - `Root`.
  - `Label`.
  - `Control`: the surface, `role="img"`, named by Label, described by Status.
  - `Segment`: the `svg`, `aria-hidden` (its meaning is on Control).
  - `Guide`: the baseline, `aria-hidden`.
  - `Status`: visually hidden text, "Not signed" or "Signed", from `messages`.
  - `ClearTrigger`.
  - `UndoTrigger`.
  - `HiddenInput`: from `dom/hidden-input`, rendered by Root, not by the consumer.
  - Required: Root, Control, Segment.
- **Machine**:
  - States `idle | drawing`.
  - Events:
    - `POINTER.DOWN { pointerId, point }` → `drawing`, locks that id.
    - `POINTER.MOVE { pointerId, points[] }` (coalesced), ignored for other ids.
    - `POINTER.UP { pointerId }` → commit.
    - `POINTER.CANCEL` → commit what was drawn (a partial stroke is still ink; signature_pad
      does the same).
    - `CLEAR`, `UNDO`, `RESET` (form reset, back to `defaultValue`).
  - Props: `value` / `defaultValue` / `onValueChange` (only on commit, clear, undo, reset),
    `disabled`, `readOnly` (shows, submits, does not draw), `required`, `name`,
    `formValue` (below), `messages`, `dir`, `lang`.
  - `CLEAR` and `UNDO` are ignored while `drawing` and when nothing is drawn.
- **Form value**:
  - The SVG of the strokes as a `data:image/svg+xml` URL. It is computed synchronously
    from the strokes in core, so `required`, submit and reset work without a canvas.
  - `formValue: "svg" | "json"` (JSON = the stroke model).
  - A raster value is out: it is async, and a form submits synchronously.
  - The hidden constraint input is not `readonly`, and is `valueMissing` while empty.
- **Export** (`api.toBlob({ type, scale, background })` and `api.download(fileName)`):
  - Reuses QR Code's SVG → `Image` → canvas path (`dom/qr-export.ts` becomes a shared
    `dom/svg-raster.ts`) and `dom/download.ts`.
  - Size comes from the stroke space × `scale` (default 2), never from layout.
  - JPEG and WebP paint `background` (default white).
  - The computed stroke colour is inlined before serialising.
  - A decode error rejects.
  - Empty: rejects with a typed `EmptySignatureError` rather than resolving `""`.
- **Environment**: `SchedulerEnv` (none needed while drawing), `AnnouncerEnv` (clear and
  undo results), `ModalityEnv`. Pointer mapping lives in a new `dom/stroke-input.ts`:
  - Pointer capture.
  - Listeners on the owner document.
  - `getCoalescedEvents`.
  - The end conditions above.
  - CSS-scale and `zoom` correction through `dom/css-zoom.ts`.
  - The iOS `touchstart` `preventDefault`.
  
  It is a sibling of `pointer-drag.ts`, which maps to one axis and does not fit.
- **`data-*`**:
  - `data-scope="signature-pad"`, `data-part`.
  - `data-state="idle|drawing"`.
  - `data-empty`, `data-disabled`, `data-readonly`, `data-required`, `data-invalid`.
  - `data-focus-visible` on the triggers.
- **Contract**: locate by the Label's text (the Control's name), else the only pad in the
  target. Actions and queries as in Testing notes. Env gains a multi-pointer draw (an
  ordered list of `{ pointerId, type, x, y }` events) on a Part.
- **Theme** (`signature-pad.css`):
  - The Control in the `field` family (border, radius, invalid and disabled styles).
  - Ink `currentColor` from `--rind-fg`.
  - Guide as a dashed baseline with an "×".
  - Clear and Undo as ghost icon buttons (`x`/`rotate-ccw`, `undo` from the icon set),
    24×24 minimum, placed in a corner outside the drawing hit area.
  - Forced-colors rules.
- **Deliberately different from the others, and why**:
  - `role="img"` + Status, not `role="application"`. Nothing in the surface responds to
    keys.
  - The Label names the Control and the buttons; Zag uses a fixed "signature pad".
  - Strokes as points, not outline strings (Zag) or pixels (signature_pad).
  - SVG with a stroke space, not canvas: no resize or DPR bug class.
  - One locked `pointerId`, coalesced events, every end condition (Zag tracks any pointer).
  - `required` validates, and the value is computed; Zag's readonly input never
    validates.
  - Clear and Undo stay rendered and focusable (`aria-disabled`), and announce.
  - Undo built in (Zag has none; signature_pad has a demo).
  - Export rejects on error and sizes from data.
  - No variable stroke width in v1, and no dependency for it.

## Open questions

- **Variable width (pressure / velocity).**
  - A filled outline (perfect-freehand's algorithm, MIT) looks more like ink, but needs a
    port of about 300 lines or a dependency.
  - A dependency needs a decision record (0009). Pressure is already recorded, so this can
    come later without changing the value model.
- **Typed alternative.** Should the pad own a "type your name" mode (Text Field rendered in
  a script font, value = typed name)? v1 documents the pattern with a separate Text Field.
  Revisit with the first consumer request.
- **Minimum ink for `required`.** A single tap satisfies `required`
  (signature_pad#490 comments). A `minLength` (total stroke length in px) or
  `validate(strokes)` hook? Not in v1; the driver exposes `strokeCount` so consumers can
  add a rule.
- **iOS Scribble.** Verify on an iPad with an Apple Pencil whether `touch-action: none` +
  `preventDefault` on `touchstart` is enough with Pointer Events, or whether signature_pad's
  touch-event path is still needed (its fix dates from iPadOS 14).
- **`role="img"` on a focusable element.** A failed submit focuses the Control
  (`tabIndex=-1`). Check that NVDA, JAWS and VoiceOver read the name and the Status on that
  focus, and that axe raises nothing. The fallback is to focus the ClearTrigger.
- **VoiceOver iOS direct touch.** Does any role make VoiceOver hand touches to the surface
  without the pass-through gesture? `role="application"` was believed to on older iOS.
  Needs a device test before the docs promise anything.
- **Loading an image as the value.** Not supported: only strokes. A "show a previously
  saved signature" use case is a plain `<img>`.
