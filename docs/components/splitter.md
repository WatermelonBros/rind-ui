# Splitter

Resizable panels on one axis, with a focusable handle between each pair (APG Window Splitter). Sizes are percentages of the panels' space and are known before hydration: the server renders the final layout, so nothing shifts when the page becomes interactive.

## When to use

- **Use it for** a layout the user rearranges: a sidebar beside an editor, a list beside its detail, a terminal under a code pane.
- **Over CSS `resize`**: `resize` drags one element by its corner, has no keyboard support and exposes nothing to assistive technology. A Splitter gives every boundary a keyboard-operable `separator` with its value, limits in percent or pixels, collapsing, and one commit event per interaction to save the layout.
- **Don't use it for** choosing a number: use a [Slider](slider.md). Don't use it for a drawer the user only opens and closes: use a [Drawer](drawer.md) or a [Collapsible](collapsible.md). A decorative rule between sections is a [Separator](separator.md).

```tsx
import { Splitter } from "@rind-ui/react"

<Splitter.Root
  panels={[{ min: 15, collapsible: true }, { min: "240px" }]}
  defaultSizes={[25, 75]}
  onSizesCommit={(sizes) => save(sizes)}
>
  <Splitter.Panel index={0}>Files</Splitter.Panel>
  <Splitter.Handle index={0} aria-label="Files" />
  <Splitter.Panel index={1}>Editor</Splitter.Panel>
</Splitter.Root>
```

`panels` has one entry per Panel. A number is a percent of the panels' space; a `"240px"` string is pixels, converted with the measured size and re-converted whenever the Splitter resizes. On the server, and in a hidden container, pixel limits are ignored until there is a size to convert them with.

## API

<!-- api:splitter -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Splitter.Root` | `root` | `<div>`; a flex container on its `orientation`. |
| `Splitter.Panel` | `panel` | `<div>`; `index` is its entry in `panels`. Its style is `flex: <size> 1 0px`, so the handles never break the total. |
| `Splitter.Handle` | `handle` | `<div role="separator">`; `index` is the panel before it, its primary panel. |

`data-orientation` (the panel axis), `data-disabled` and `data-dragging` are on every part. A Panel adds `data-index`, `data-size` and, if collapsible, `data-state="collapsed" | "expanded"`; a Handle adds `data-index`, `data-focus` and `data-focus-visible`.

## Keyboard

| Key | Behaviour |
|---|---|
| Arrow Left / Right | Horizontal Splitter: moves the boundary by `step` percent (default 5). In right-to-left the first panel is on the right, so Arrow Left grows it. |
| Arrow Up / Down | Vertical Splitter: moves the boundary up / down. Arrow Down grows the top panel. |
| Home / End | Gives the primary panel its smallest / largest reachable size (Home may collapse it). |
| Enter | Collapses a collapsible primary panel, or restores the size it had before it collapsed. |
| Escape | During a drag: restores the sizes at the press. Does nothing otherwise. |

Arrows of the other axis and arrows with Alt, Control or Meta are left to the page. A step at a collapsible panel's `min` collapses it; a step from collapsed expands it to `min`.

## Sizes and commits

- `sizes` / `defaultSizes` hold one percent per panel. A wrong-length array falls back to `defaultSizes`, then to an equal split; any array is scaled to 100 and clamped to the limits before it renders.
- `onSizesChange` runs on every change, including each move of a drag.
- `onSizesCommit` runs **once** at the end of an interaction that changed the sizes: a release, a key. Never for a cancelled drag (Escape, `pointercancel`, a hidden page), a limit change or a parent's change.
- Dragging a collapsible panel below the halfway point between `collapsedSize` and `min` collapses it; dragging a collapsed one past that point opens it to `min`.

## Saving the layout

There is no built-in storage. Save the sizes in `onSizesCommit` and read them back into `defaultSizes`. Read them on the server (a cookie) to keep the server render exact; reading `localStorage` on the client renders the defaults first.

```tsx
<Splitter.Root
  panels={[{}, {}]}
  defaultSizes={savedSizes ?? [30, 70]}
  onSizesCommit={(sizes) => (document.cookie = `layout=${JSON.stringify(sizes)}; path=/`)}
>
```

## Accessibility notes

- **Role and value.** Each handle is a focusable `separator` whose `aria-valuenow` is the primary panel's size in percent, with `aria-valuemin` and `aria-valuemax` the sizes that panel can reach from this handle (its own limits narrowed by its neighbours'), and `aria-controls` the primary panel.
- **Orientation.** `aria-orientation` is the line's: `vertical` between side-by-side panels, `horizontal` between stacked ones.
- **Name.** A handle has no content: give it `aria-label` or `aria-labelledby`, usually the name of the panel before it. An unnamed handle warns in development.
- **Focus.** One tab stop per handle, in DOM order. A press focuses the handle without a focus ring, so the keys work after a click.
- **Dragging alternative (WCAG 2.5.7).** Every drag also has a key, and a single-pointer alternative is the consumer's: a button that collapses a panel or sets preset sizes through controlled `sizes` (see the Collapsible example).
- **Target size.** The theme's handle is a 1px line with an invisible hit area of at least `--rind-hit-area`.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/splitter.css`: the handle line for both orientations, its hit area, the resize cursor (also over the panels while dragging), the accent while hovered, dragged or focused, and forced-colors support. Tokens: `--rind-splitter-handle-size`, `--rind-splitter-handle-color`, `--rind-splitter-handle-active-color`, `--rind-splitter-cursor`, `--rind-splitter-cursor-vertical`. Panel content scrolling is yours: put a [Scroll Area](scroll-area.md) inside a Panel.

## Testing

Contract actions: `focusHandle`, `step`, `toEdge`, `toggleCollapse`, `setSize`, `pointerDown`, `pointerMove` (a percent of the panels' space from the press), `pointerUp`, `cancelDrag`. Queries: `sizes`, `isDragging`, `orientation`, `isCollapsed`, `bounds`.

```tsx
import { getSplitter } from "@rind-ui/testing"

render(<Workspace />)
const sidebar = getSplitter(screen, { name: "Files" })
await sidebar.step(0, "increase")
expect(await sidebar.sizes()).toEqual([30, 70])
await sidebar.toggleCollapse(0)
expect(await sidebar.isCollapsed(0)).toBe(true)
await sidebar.via("pointer").setSize(0, 40) // pointer steps need layout (a real browser)
```

Keyboard actions work in jsdom; the pointer actions need a layout engine and throw a clear error without one. The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:splitter -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
