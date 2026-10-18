# Scroll Area

A native scroll container whose scrollbars are drawn by you. The browser keeps doing all the
scrolling: wheel, touch, momentum, keyboard, zoom, find-in-page, right-to-left and forced
colors work as in any `overflow: auto` element. The component hides the native bars, measures,
and draws a thumb you can drag.

## When to use

- **Use it for** a scroll container whose scrollbars you want to style, such as a panel, a
  list or a code block.
- **Over `overflow: auto`**: it draws the scrollbars as parts you style (track and draggable
  thumb, with `type` setting when they show), while the browser still does all the
  scrolling. It also adds a tab stop for text-only content that overflows.
- **Don't use it for** the page itself, or when the native scrollbar is fine: a plain
  `overflow: auto` element is enough.
- **Don't use it for** a long list that must keep only some rows in the DOM: the component
  scrolls its content but does not virtualise it.

```tsx
import { ScrollArea } from "@rind-ui/react"

<ScrollArea.Root>
  <ScrollArea.Viewport aria-label="Release notes">
    <ScrollArea.Content>{notes}</ScrollArea.Content>
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar>
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
</ScrollArea.Root>
```

## API

<!-- api:scroll-area -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `ScrollArea.Root` | `root` | `<div>` | Holds the state; exposes `--rind-scroll-area-corner-width` / `-height`. No role. |
| `ScrollArea.Viewport` | `viewport` | `<div>` | The native scroll container. A tab stop only when it overflows and its content has nothing focusable; `role="region"` when you name it. |
| `ScrollArea.Content` | `content` | `<div>` | Your content: what is measured. Required, and the only element between the Viewport and your children. |
| `ScrollArea.Scrollbar` | `scrollbar` | `<div>` | `orientation` `vertical` (default) or `horizontal`; `aria-hidden`, never takes focus. |
| `ScrollArea.Thumb` | `thumb` | `<div>` | Dragged with a mouse, pen or finger; sized through `--rind-scroll-area-thumb-size`. |
| `ScrollArea.Corner` | `corner` | `<div>` | Fills the corner between two scrollbars; `aria-hidden`. |

### Props

| Part | Prop | Type | Default | Description |
|---|---|---|---|---|
| `ScrollArea.Root` | `type` | `"hover" \| "scroll" \| "auto" \| "always"` | `"hover"` | Root: when scrollbars show. `hover`: pointer, focus or scroll; `scroll`: while scrolling; `auto`: whenever the axis overflows; `always`. |
| `ScrollArea.Root` | `hideDelay` | `number` | `600` | Root: milliseconds the scrollbars stay after the last hover, focus or scroll. |
| `ScrollArea.Root` | `trackPress` | `"page" \| "jump"` | `"page"` | Root: a press on the track scrolls one page toward it, or jumps there and drags. |
| `ScrollArea.Root` | `actionsRef` | `Ref<{ measure(): void }>` | — | Root: call `measure()` after a change the observers cannot see (a deep descendant resized). |
| `ScrollArea.Root` | `render` | `element \| (props, state) => element` | — | Substitutes the rendered element. |
| `ScrollArea.Root` | `children` | `ReactNode` | — | The Viewport, Scrollbars and Corner. |
| `ScrollArea.Viewport` | `render` | `element \| (props, state) => element` | — | Substitutes the rendered element. |
| `ScrollArea.Content` | `render` | `element \| (props, state) => element` | — | Substitutes the rendered element. |
| `ScrollArea.Scrollbar` | `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Scrollbar: its axis. |
| `ScrollArea.Scrollbar` | `render` | `element \| (props, state) => element` | — | Substitutes the rendered element. |
| `ScrollArea.Thumb` | `render` | `element \| (props, state) => element` | — | Substitutes the rendered element. |
| `ScrollArea.Corner` | `render` | `element \| (props, state) => element` | — | Substitutes the rendered element. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "scroll-area" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-overflow-x` | The content overflows horizontally (after the first measure). |
| `root` | `data-overflow-y` | The content overflows vertically (after the first measure). |
| `root` | `data-overflow-x-start` | Content is hidden beyond the inline start (the right under RTL). |
| `root` | `data-overflow-x-end` | Content is hidden beyond the inline end. |
| `root` | `data-overflow-y-start` | Content is hidden above. |
| `root` | `data-overflow-y-end` | Content is hidden below. |
| `root` | `data-hovering` | A mouse or pen is over the area. |
| `root` | `data-scrolling` | A user scroll is in progress. |
| `viewport` | `data-scope` | "scroll-area" |
| `viewport` | `data-part` | "viewport" |
| `viewport` | `data-instance` | The instance id. |
| `viewport` | `data-overflow-x` | The content overflows horizontally (after the first measure). |
| `viewport` | `data-overflow-y` | The content overflows vertically (after the first measure). |
| `viewport` | `data-overflow-x-start` | Content is hidden beyond the inline start (the right under RTL). |
| `viewport` | `data-overflow-x-end` | Content is hidden beyond the inline end. |
| `viewport` | `data-overflow-y-start` | Content is hidden above. |
| `viewport` | `data-overflow-y-end` | Content is hidden below. |
| `viewport` | `data-tab-stop` | The tab-stop rule holds (overflowing, nothing focusable inside). |
| `viewport` | `data-focus` | The Viewport has focus. |
| `viewport` | `data-focus-visible` | The Viewport has keyboard focus. |
| `content` | `data-scope` | "scroll-area" |
| `content` | `data-part` | "content" |
| `content` | `data-instance` | The instance id. |
| `content` | `data-overflow-x` | The content overflows horizontally (after the first measure). |
| `content` | `data-overflow-y` | The content overflows vertically (after the first measure). |
| `scrollbar` | `data-scope` | "scroll-area" |
| `scrollbar` | `data-part` | "scrollbar" |
| `scrollbar` | `data-instance` | The instance id. |
| `scrollbar` | `data-orientation` | "vertical" or "horizontal". |
| `scrollbar` | `data-state` | "visible" or "hidden". |
| `scrollbar` | `data-scrolling` | Its axis is scrolling. |
| `scrollbar` | `data-dragging` | Its thumb is being dragged. |
| `scrollbar` | `data-hovering` | The pointer is over it. |
| `thumb` | `data-scope` | "scroll-area" |
| `thumb` | `data-part` | "thumb" |
| `thumb` | `data-instance` | The instance id. |
| `thumb` | `data-orientation` | "vertical" or "horizontal". |
| `thumb` | `data-dragging` | It is being dragged. |
| `corner` | `data-scope` | "scroll-area" |
| `corner` | `data-part` | "corner" |
| `corner` | `data-instance` | The instance id. |
| `corner` | `data-state` | "visible" when both scrollbars are, else "hidden". |

### Keyboard

| Key | Action |
|---|---|
| Arrow keys, PageUp/PageDown, Home/End, Space | Native scrolling of the Viewport (when it or its content has focus). |

### States

| State | Description |
|---|---|
| `idle` | Nothing engages the area; `hover` and `scroll` scrollbars are hidden. |
| `engaged` | Hovered, focused, scrolled or on a scrollbar. |
| `lingering` | Recently engaged: scrollbars stay for `hideDelay`. |
| `dragging` | A thumb is being dragged. |

### Contract

| Action | Modalities |
|---|---|
| `focusViewport` | keyboard, pointer |
| `scroll` | keyboard, pointer |
| `dragThumb` | pointer, touch |
| `pressTrack` | pointer, keyboard |
| `hover` | pointer |
| `unhover` | pointer |

Queries: `hasOverflow`, `isScrollbarVisible`, `atStart`, `atEnd`, `isDragging`, `isTabStop`. Traits: `directional`.
<!-- /api -->

## Sizing

Give the Root (or the Viewport) a size: the Viewport fills the Root and scrolls what does not
fit. `ScrollArea.Content` is required: it is what is measured and the only element the
component puts between the Viewport and your children, so `text-overflow: ellipsis`, sticky
headers and absolutely positioned descendants behave as in a plain scroll container.

The size is re-measured, at most once per frame, when the Viewport scrolls, when the
Viewport, the Content or one of its direct children resizes, and when children are added or
removed. A change deeper than that which changes no observed box (a descendant that widens
without resizing its parent) is not seen: call `measure()` on the Root's `actionsRef`.

## When the scrollbars show

| `type` | Scrollbar visible |
|---|---|
| `hover` (default) | the axis overflows and the pointer is over the area, focus is inside it, the user scrolled or is dragging, or less than `hideDelay` (600 ms) passed since |
| `scroll` | the axis overflows and the user scrolls or drags, the pointer is on a scrollbar, or less than `hideDelay` passed since |
| `auto` | the axis overflows |
| `always` | always |

Only mouse and pen hover counts; a programmatic scroll (`scrollIntoView` at load) moves the
thumb without showing the bar. Hidden scrollbars stay mounted (`data-state="hidden"`), so
showing them never re-creates the thumb.

## Keyboard and the tab stop

Scrolling with the keyboard is the browser's: Arrow keys, PageUp/PageDown, Home/End and Space
scroll the Viewport whenever it or something inside it has focus. The component handles no
key.

The Viewport is in the Tab order (`tabindex="0"`) only when it overflows and its content has
nothing focusable: text-only content in a dialog is then still reachable and scrollable, also
in Safari, which does not stop on scroll containers by itself. Content with buttons or links
adds no extra stop: arrow keys on them scroll the Viewport. The tab stop appears after the
first measurement (never in the server HTML), is kept while the Viewport has focus, and your
own `tabIndex` overrides it.

A Viewport that is a tab stop needs a name: give it `aria-label` or `aria-labelledby`, which
also makes it a `region` landmark. Without a name, development builds warn.

## Pointer

Dragging a thumb (mouse, pen or finger) scrolls the Viewport; releasing anywhere keeps the
position. While dragging, `scroll-snap-type` is turned off and restored after. A press on the
track scrolls one page toward it (`trackPress="page"`), or jumps there and continues as a drag
(`trackPress="jump"`). A finger on the track does nothing, so it pans the page. A wheel over a
scrollbar scrolls the Viewport; at the end it goes on to the page, unless the Viewport has
`overscroll-behavior: contain`. Ctrl+wheel is always left to zoom.

## Styling

The theme reads `--rind-scroll-area-*` tokens (thickness, padding, track and thumb colours,
thumb minimum size, corner, fade duration). Without the theme, the component injects one rule
in an anonymous cascade layer (so any rule of yours wins) that hides the native bars and gives
the Viewport `overflow: auto`. Style the parts on their data attributes:

```css
[data-scope="scroll-area"][data-part="scrollbar"][data-state="hidden"] {
  opacity: 0;
  pointer-events: none;
}
[data-scope="scroll-area"][data-part="thumb"][data-orientation="vertical"] {
  block-size: var(--rind-scroll-area-thumb-size);
  min-block-size: 18px;
}
```

Fade masks: `data-overflow-y-start` / `-end` say content is hidden beyond an edge, and
`--rind-scroll-area-overflow-y-start` / `-end` on the Viewport say how much (in px), so a mask
can grow with it.

Native bars where they serve better, in forced-colors mode or on touch screens (a custom thumb
follows asynchronous touch scrolling with a lag on some devices):

```css
@media (forced-colors: active), (pointer: coarse) {
  [data-scope="scroll-area"][data-part="viewport"] { scrollbar-width: auto }
  [data-scope="scroll-area"][data-part="scrollbar"] { display: none }
}
```

## Coming from another Scroll Area component

- `scrollHideDelay` becomes `hideDelay` on Root.
- There is no implicit `display: table` wrapper: render `ScrollArea.Content` around your
  children.
- `scrollToEdge` / `scrollTo` helpers: call `Element.scrollTo` on the Viewport's ref.
- `data-overflow-*` attributes are the same; `data-state` (visible / hidden) is added on the
  Scrollbar.

## Testing

```tsx
import { getScrollArea } from "@rind-ui/testing"

const area = getScrollArea(screen, { name: "Release notes" })
await area.isTabStop() // true for text-only overflowing content
await area.scroll("y", "end") // Home / End / PageDown / PageUp with the keyboard modality
await area.atEnd("y") // true
await area.dragThumb("y", 0.5) // pointer and touch
```

Scrolling needs layout: pointer actions run in browser mode or with a Playwright `page`; with
the keyboard modality, use a driver whose keys are real (Playwright), because synthetic key
events do not scroll.

## Tested with

<!-- tested-with:scroll-area -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
