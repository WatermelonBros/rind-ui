## Context

The research note ([marquee.md](../../../docs/research/marquee.md)) compares Zag / Ark,
react-fast-marquee, Magic UI and Nuxt UI, the APG Carousel rotation rules and WCAG 2.2.2,
and records the bug history behind each scenario. Only Ark ships a marquee among the nine
libraries. No implementation read handles pausing, reduced motion and hidden copies
together.

## Goals / Non-Goals

**Goals:**
- A layout-free machine: sizes, hover, focus and the motion preference arrive as events,
  so every transition runs in Node.
- Motion in CSS, so a paused marquee resumes from where it stopped (G4) at no cost per
  frame. JS only measures, keeps progress and seeks.
- The server HTML is the full content and one copy. Nothing reads `matchMedia` or layout
  during render.

**Non-Goals:**
- Reusing Carousel (not built yet) or Toast's machine. The pause-reason lesson is reused,
  not the code.

## Decisions

### 1. Split: machine decides, CSS moves, `core/dom` keeps time

The theme's keyframes translate each copy by `-100%` of its own size on the axis
(mirrored under `:dir(rtl)`), at `--rind-marquee-duration`, linear, infinite. The theme
runs the animation only while `data-state="running"`. It sets
`animation-play-state: paused` for `paused`, and no animation for `idle` and `static`.
The machine never ticks. `core/dom/marquee-motion.ts` does what CSS cannot: it measures,
rescales or mirrors `currentTime` when the timing changes, and seeks to a focused
element. It finds the animations with `getAnimations()` on the copies, so a consumer's own
keyframes work the same way.

### 2. Machine

States `idle`, `running`, `paused`, `static`. Context:
- `paused`: the user's pause, controllable through `paused` / `defaultPaused` /
  `onPausedChange`;
- `hovered`;
- `reduced`: initially `false` on server and client alike;
- `size`: `{ viewport, content } | null`.

Events:

```ts
| { type: "MEASURED"; viewport: number; content: number } // px on the axis; content = one copy with its trailing gap
| { type: "MOTION.CHANGED"; reduced: boolean }            // sent on mount, then on every change
| { type: "TRIGGER.PRESS"; modality: Modality }
| { type: "POINTER.ENTER" } | { type: "POINTER.LEAVE" }  // never from touch
| { type: "FOCUS.ENTER"; modality: Modality }            // focus moved into the Viewport
| { type: "PAUSED.SYNCED" }                               // the controlled prop changed
```

- Each event updates the context, then goes to the first state that holds, in this
  order: `static` (`reduced`), `idle` (`size` null or a zero size), `paused` (`paused`, or
  `hovered` with `pauseOnHover`), `running`. The order is written as guarded transitions,
  so the target set is typed.
- `TRIGGER.PRESS` proposes `!paused` with reason `trigger`. `FOCUS.ENTER` with modality
  `keyboard` or `virtual` proposes `true` with reason `focus` when not already paused.
  With `pointer` or `touch` it changes nothing. Focus leaving sends nothing (APG: only the
  user restarts). Uncontrolled, the proposal is applied. Controlled, it waits for the
  prop (`PAUSED.SYNCED`), as in Rating.
- `POINTER.LEAVE` clears `hovered` only. It never clears `paused`.
- `MEASURED` with a zero or non-finite size sets `size` to null (→ `idle`). `speed` below
  1 or non-finite is treated as 1 and logs a development warning.
- Derived (pure functions, exported for connect and tests):
  - `marqueeCopies`: 1 in `static`. With `autoFill` and a size,
    `min(32, ceil(viewport / content) + 1)`. Otherwise 2.
  - `marqueeDuration` = `content / speed` seconds, `null` without a size.

### 3. Connect

Parts `root`, `pause-trigger`, `viewport`, `content`. Every part carries
`data-scope="marquee"`, `data-part`, `data-instance`, `data-state`, `data-orientation`
and `data-reverse` (when reversed).

- Root: no role. `role`, `aria-label` and `aria-labelledby` pass through from the
  consumer.
- PauseTrigger: `type="button"`, `aria-label` = `messages.pause` or `messages.play` from
  the user pause. No `aria-pressed`. `data-paused` while the user pause holds. `hidden`
  in `static`.
- Viewport: `id`. Structural inline style: `display: flex`, the axis direction,
  `overflow: clip` (`visible` in `static`), `contain: inline-size` when horizontal (its
  size never depends on its copies, RFM#66). `--rind-marquee-duration` (seconds) once
  measured.
- Content: `data-index`. Copies: `data-copy`, `aria-hidden="true"`. Structural
  style: `display: flex`, `flex-shrink: 0`, the axis direction,
  `gap: var(--rind-marquee-gap, 1rem)` and the same value as trailing padding on the axis,
  so `-100%` lands exactly on the next copy. Without `autoFill`, a minimum size of 100% of
  the viewport on the axis. In `static`, `flex-wrap: wrap`.

Messages: `pause` ("Pause animation"), `play` ("Play animation").

### 4. `core/dom/marquee-motion.ts`

- `observeMarquee(viewport, firstCopy, axis, scheduler, onSize)`: one ResizeObserver on
  both elements, coalesced to one report per animation frame, reported only on change.
- `retime(copies, from, to)`: on every copy's running animations,
  `currentTime = currentTime × to / from`. It runs in the layout effect of the commit that
  changed the duration, before paint.
- `mirror(copies)`: on a `reverse` change, `currentTime = d − (currentTime mod d)`, where
  `d` is the duration.
- `reveal(target, viewport, copies, axis, dir, reversed)`: if the target's box is not
  inside the viewport's box, it sets every copy's `currentTime` so that the target's
  start (logical, on the axis) sits at the viewport's start. The time comes from the
  target's offset in its copy divided by the copy's size, mirrored when reversed.
  `scrollLeft` / `scrollTop` are never written.
- `untabbable(copy)`: sets `tabindex="-1"` on every tabbable element inside a copy. It
  uses the `tabbable-content` query and re-applies on DOM mutation inside the copy. The
  copy is not made `inert`, so its links stay clickable.

### 5. React

- `Marquee.Root` owns the machine. It subscribes to `env.motion` on mount (first value,
  then changes → `MOTION.CHANGED`) and provides the context.
- `Marquee.PauseTrigger`: a press sends `TRIGGER.PRESS` with its modality.
- `Marquee.Viewport`:
  - sends `POINTER.ENTER` / `POINTER.LEAVE` on `pointerenter` / `pointerleave`, except
    when `pointerType` is `touch`;
  - on `focusin`, sends `FOCUS.ENTER` with the current modality, then, for keyboard or
    virtual focus, calls `reveal` with the target;
  - runs `observeMarquee`, plus `retime` and `mirror` when the duration or `reverse`
    changed since the last commit.
- `Marquee.Content`: renders the copies. Index 0 is the consumer's element and children.
  Indexes 1..n are the same `render` element and children with the copy attributes, and
  `untabbable` runs on each.
- Development warning after mount when the content contains an element with an `id`:
  the copies would duplicate it.

### 6. Contract

`locate`: `data-scope="marquee"` / `data-part="root"`, narrowed by the Root's accessible
name when the consumer named it. It has no role of its own.

Actions:
- `togglePause` (pointer, keyboard, virtual);
- `hover` and `leave` (pointer; a touch hover is a no-op by contract);
- `focusContent(name?)`: Tab from the trigger, or focus by role and name.

Queries: `state`, `isPaused`, `triggerLabel`, `copies`, `duration`
(`--rind-marquee-duration`).

Trait: `directional`.

Invariants:
- exactly one copy is exposed;
- every other copy is `aria-hidden` and contains no element with `tabIndex >= 0`;
- the trigger's label agrees with `isPaused`;
- `static` ⇔ reduced motion, with one copy and the trigger hidden;
- `running` ⇒ the user pause is off and no hovering pointer pauses it.

### 7. Model configurations

Default, `autoFill`, vertical, `reverse`, `dir="rtl"`, `pauseOnHover={false}`, controlled
`paused`, and reduced motion. Pointer, keyboard and virtual modalities in browser mode;
keyboard and virtual in jsdom (no layout: `MEASURED` is faked through an injected size).

### 8. Theme

`marquee.css`, family `decoration` (no variant or size; tokens `--rind-marquee-*`):
- keyframes `rind-marquee-x` (and the `:dir(rtl)` mirror) and `rind-marquee-y`;
- `animation-direction: reverse` on `data-reverse`;
- `backface-visibility: hidden` on copies (Firefox and iOS flicker at the wrap);
- edge fade with `mask-image` sized by `--rind-marquee-fade` (0 turns it off);
- vertical: a default block size (`--rind-marquee-block-size`), `auto` in `static`;
- `@media (prefers-reduced-motion: reduce)` also removes the animation (no JS, no
  motion);
- PauseTrigger: at least 24 × 24 px; a pause or play icon from `data-paused`; the outline
  focus ring; forced colours with `ButtonText` / `Highlight`.

## Risks / Trade-offs

- Without `autoFill`, short content leaves a blank stretch before it repeats. That is the
  cost of not measuring for the copy count. `autoFill` fills it.
- Focus reveal moves the band under the user's eyes once, when focus enters. That is
  better than a focused link outside the clip box (2.4.11).
- Seeking relies on `getAnimations()`. A consumer who animates with a JS library instead
  of CSS gets measured sizes and pause states, but no retime or reveal.
- Copies are not `inert`, so they stay clickable (a logo link in a copy works). The cost
  is that find-in-page finds the text more than once, and that a pointer can focus an
  element inside an `aria-hidden` copy. Screen reader users do not reach copies, because
  they are hidden and untabbable.
