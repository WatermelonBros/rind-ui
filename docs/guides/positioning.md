# Positioning

Popover, Menu, Select, Combobox, Tooltip and every other popup anchored to something share one
positioning capability in `@rind-ui/core` (`dom/position`, built on `@floating-ui/dom`). A
machine tracks its popup only through `env.position`, from an effect scoped to its open
state; coordinates and sizes go straight to CSS custom properties and only the discrete
results (side, align, anchor hidden, first placement) come back as a `POSITION.PLACED` event.

## Options

A component starts from a preset (below); the consumer's `positioning` props win over it.

| Option | Default (`popup`) | Meaning |
| --- | --- | --- |
| `side` | `bottom` | `top`, `right`, `bottom`, `left`, or logical `inline-start` / `inline-end` (resolved against the anchor's `dir`) |
| `align` | `center` | `start`, `center`, `end` |
| `sideOffset` / `alignOffset` | `0` / `0` | Gap from the anchor and shift along it, in px |
| `collisionPadding` | `8` | Space kept to the boundary: a number or `{ top?, right?, bottom?, left? }` |
| `collisionBoundary` | clipping ancestors and viewport | An element or a function returning one |
| `collisionAvoidance` | `{ side: "flip", align: "flip", fallbackAxis: "end" }` | Per axis `flip`, `shift` or `none`; `fallbackAxis` picks where it goes when neither side fits |
| `sticky` | `false` | Shifting may move the popup over its anchor on the side axis |
| `arrowPadding` | `0` | Keeps the arrow this far from the popup's corners |
| `strategy` | `auto` | `auto`, `absolute` or `fixed` (see below) |
| `tracking` | `auto` | `auto` (observers), `frame` (every frame), `none` (once) |
| `sideLock` | `none` | `open`: the first placement's side and align are kept until close |
| `inline` | `false` | An anchor wrapping across lines is placed against the line nearest the pointer (or a `{ x, y }`) |
| `mode` | `auto` | `manual`: no coordinates written, the consumer positions it with CSS |

The anchor is the component's trigger or control by default; a component can also take a
viewport **point** (`{ x, y }`, a context menu) or a **virtual** anchor (`{ get }` returning
a rectangle-like, for a map marker or a text selection; call `reposition()` when it moves).

## Presets

| Preset | For | side / align | Collision (side / align / fallback) | sideLock |
| --- | --- | --- | --- | --- |
| `popup` | Popover, Hover Card, Tooltip, pickers, Tour | bottom / center | flip / flip / end | none |
| `dropdown` | Select, Combobox, Menu, Navigation Menu | bottom / start | flip / shift / none | open |
| `submenu` | Submenus | inline-end / start | flip / shift / none | none |
| `pointer` | Context Menu root | right / start | flip / flip / none | none, tracking `none` |

Lists in a `dropdown` cap their height with `--rind-available-height` instead of moving.

## Attributes

The positioner and the content carry `data-side` (physical: `top | right | bottom | left`),
`data-align`, `data-anchor-hidden` (the anchor scrolled out of view or has no box) and
`data-placing` (present until the first placement). The arrow carries `data-side` and
`data-anchor-hidden`, plus `data-uncentered` when it cannot point at the anchor's centre.

## CSS variables

Written on the positioner, readable by any descendant:

| Variable | Value |
| --- | --- |
| `--rind-available-width`, `--rind-available-height` | Room left in the boundary on the chosen side. Seeded `100vw` / `100vh`, so rules using them are valid while the popup is measured |
| `--rind-anchor-width`, `--rind-anchor-height` | The anchor's size, snapped to the device pixel ratio (a select list as wide as its trigger) |
| `--rind-transform-origin` | Where the popup grows from: the arrow tip, the anchor edge or the point |
| `--rind-arrow-x`, `--rind-arrow-y` | The arrow's cross-axis offset |
| `--rind-x`, `--rind-y`, `--rind-position` | The coordinates and strategy the positioner is placed with |

The theme (`positioner.css`) caps the content with the available size and scrolls it
(`overflow: auto`), so it reflows at 320 px; it derives the z-index from `--layer-index`; and
it draws the arrow with borders in `currentcolor`, so it survives forced colors.

## The first frame

A popup opens fixed at the viewport origin, transparent, with no pointer events but still
focusable, marked `data-placing`. Measuring happens in the same frame, then the first
placement is written and `data-placing` goes away. Initial focus waits for that placement, so
focus never scrolls the page toward the origin. Animations and transitions are off while
`data-placing` is present (the theme does it; with your own CSS, do the same).

## Strategy

`auto` resolves on open: `fixed` in the top layer (open popover, modal dialog, fullscreen), for
point anchors, for virtual anchors without a `contextElement` and under a fixed ancestor;
`absolute` otherwise, which follows document scroll for free. Force one with `strategy`.

## Manual mode

`mode: "manual"` writes no coordinates; the trigger gets an `anchor-name` and the positioner a
`position-anchor` that points at it, so CSS anchor positioning does the placing:

```css
[data-scope="popover"][data-part="positioner"] {
  position: fixed;
  position-area: bottom;
  position-try-fallbacks: flip-block;
}
```

Raw `anchor-name` / `position-anchor` work too (set `anchor-name` on the trigger, `position-anchor`
with the same name on the positioner), for anchors you own. The seeded
`--rind-available-*` variables stay valid but are not updated.

## Testing

A contract spreads `positioningQueries` (`side`, `align`, `isAnchorHidden`, `isPlaced`),
read from attributes only:

```ts
queries: { ...positioningQueries, isOpen: /* ... */ },
```

Machine tests in Node use `fakePositioning()` from `@rind-ui/testing` to see what was tracked
and to emit placements. The `anchored` trait adds `layoutInvariant`, a generic invariant over
real geometry (the popup stays in the viewport, near its anchor, flips when it has to).

## Known limitations

- **CSS `zoom` on an ancestor** with `absolute` positioning misplaces the popup
  ([floating-ui#3497](https://github.com/floating-ui/floating-ui/issues/3497)); use
  `strategy: "fixed"` there.
- **iOS Safari on-screen keyboard** and **pinch-zoom**, and Android Chrome's keyboard, cannot
  be emulated; they are verified by hand on devices (see the
  [manual protocol](../accessibility/manual-protocol.md)).
