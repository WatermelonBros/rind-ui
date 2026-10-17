# Tooltip

A short text shown when the pointer rests on a trigger or the trigger receives keyboard focus. It supplements the trigger; it is not a place for anything interactive. The content is `role="tooltip"`, never focusable, positioned against the trigger by the shared positioning capability.

## When to use

- **Use it for** a short, non-interactive hint on a control that is already usable without it: a keyboard shortcut, or the name of an icon-only button (`type="label"`).
- **Over the native `title` attribute**: it opens on keyboard focus as well as hover, closes with Escape, can be hovered without vanishing, is positioned against the trigger, can be styled, and is linked to the trigger with `aria-describedby` or `aria-labelledby`.
- **Don't use it for** anything touch users need, since a tap does not open it, or for interactive content: use a [Popover](popover.md), or a [Hover Card](hover-card.md) for a richer preview on hover. Don't use it to explain a natively disabled button; it can never be hovered or focused.

```tsx
import { Tooltip } from "@rind-ui/react"

<Tooltip.Root>
  <Tooltip.Trigger>Save</Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Positioner>
      <Tooltip.Content>
        Save the document (Ctrl+S)
        <Tooltip.Arrow />
      </Tooltip.Content>
    </Tooltip.Positioner>
  </Tooltip.Portal>
</Tooltip.Root>
```

Only `Root`, `Trigger`, `Positioner` and `Content` are required. Unlike the Popover, the content is always mounted and `hidden` while closed (see below).

## API

<!-- api:tooltip -->

## Description or label

`type="description"` (the default) is for a control that already has a name: the content is `role="tooltip"` and the trigger gets `aria-describedby`, so a screen reader reads "Save, button, Save the document (Ctrl+S)".

`type="label"` is for an icon-only control with no other name: the trigger gets `aria-labelledby` and the content is its accessible name. Do not give the trigger its own `aria-label` as well.

Your own `aria-describedby` / `aria-labelledby` on the trigger are kept, first, and the tooltip id is appended. The references exist as soon as the content is mounted, open or not, so the description is read on focus and in browse mode without hovering (react-spectrum#2101).

## Opening and closing

- **Pointer**: resting on the trigger starts `openDelay` (700 ms); leaving the hover zone starts `closeDelay` (300 ms). The zone is the trigger, the content and the gap between them, so the pointer can travel onto the content (WCAG 1.4.13 hoverable) without it closing. Moving back into the zone cancels the close.
- **Keyboard**: focus that comes from the keyboard opens it at once, with no delay; blur closes it. Focus from a pointer press does not open it.
- **Escape** closes it (dismissable) while focus stays on the trigger. It does not consume the key if another layer is above.
- **Press**: pressing the trigger closes it (`closeOnPress`) and it stays closed until the pointer leaves and returns. The tooltip never calls `preventDefault` or `stopPropagation`, so it composes with a Menu or Popover on the same trigger.
- `onOpenChange(open, details)`: `details.reason` is `hover`, `focus`, `api`, `pointer-leave`, `blur`, `escape-key`, `outside-press`, `trigger-press`, `group` or `disabled`; `details.cancel()` vetoes it. `open` / `defaultOpen` control it; `actionsRef` gives `open()` and `close()`.

## Touch and disabled controls

A tooltip is hover-and-focus only. Touch has no hover, so never put information in a tooltip that touch users need: a tap on the trigger does not open it. For a hint that must work on touch and keyboard, use a toggletip, which is a small `Popover` opened by an info button (see the Popover page).

A natively `disabled` button cannot be focused or hovered, so it never shows its tooltip (a development warning says so). To explain why a control is unavailable, keep it focusable with `focusableWhenDisabled` (the Button then uses `aria-disabled` instead of `disabled`) and put the tooltip on it.

## Group behaviour

Tooltips share a delay group: when one closes, the next tooltip you hover or focus within `skipDelay` (300 ms) opens at once, and the previous one closes without animation. Both get `data-instant` for that transition, so style it without a transition (the theme does). `skipDelay={0}` turns the group off. This makes a toolbar feel immediate without opening every tooltip you sweep across.

Both behaviours are shared capabilities, not Tooltip internals: `hover-intent` (rest detection, the safe area towards the content, touch ignored) and `delay-group` are written once in `core/dom` for reuse by the Menu submenus and other hover-driven components.

## Positioning

`positioning` takes the shared options; the Tooltip defaults to the popup preset on top with a gap of 8. The positioner receives `data-side`, `data-align`, `data-anchor-hidden` and `data-placing`; `--rind-transform-origin` points at the trigger and `--rind-available-width` clamps the content.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/tooltip.css`: a compact inverted surface (background, text, radius, padding, font size), a maximum width clamped to the available width, entry (`@starting-style`) and exit (`[data-state="closed"]`) with the duration tokens, no transition for `[data-instant]` or under reduced motion, the arrow, and a forced-colors border, with `--rind-tooltip-*` tokens (`bg`, `color`, `padding`, `radius`, `font-size`, `max-width`, `duration`, `arrow-size`). The sheet never overrides `[hidden]`.

## Testing

The tooltip is located through its trigger (`name`, and `role` for a link). Delays are waited out by advancing time, so the same driver calls work with real timers and with fake ones: pass the adapter's `advanceTimers`.

```tsx
import { getTooltip } from "@rind-ui/testing"

render(<SaveButton />)
const tooltip = getTooltip(screen, { name: "Save" })
await tooltip.show()          // hover, waiting out openDelay
expect(await tooltip.text()).toBe("Save the document (Ctrl+S)")
expect(await tooltip.description()).toBe("Save the document (Ctrl+S)")
await tooltip.pressEscape()
expect(await tooltip.isOpen()).toBe(false)
```

With vitest fake timers, create the environment with `advanceTimers: vi.advanceTimersByTime` so `show()` and `hide()` advance the clock instead of waiting. `testMachine(tooltipContract, …)` runs the machine graph against your own wrapper.

## Tested with

<!-- tested-with:tooltip -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
