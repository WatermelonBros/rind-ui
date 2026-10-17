# Hover Card

A preview of a link's destination, shown when the pointer rests on the link or when keyboard focus stays on it. The content is a non-modal `role="dialog"` positioned against the link by the shared positioning capability. The trigger is a real link: it keeps its role and `href`, and activating it follows the link.

## When to use

- **Use it for** a preview of a link's destination, shown when the pointer rests on the link or keyboard focus stays on it, such as a profile summary.
- **Over a `title` attribute**: it shows rich content in a positioned non-modal `role="dialog"`, opens on focus as well as hover, and closes with Escape.
- **Don't use it for** anything the user must be able to reach: touch users never see it, so everything in it must also be reachable by following the link. For a button that opens something, use a [Popover](popover.md). For a short text label, use a [Tooltip](tooltip.md).

```tsx
import { HoverCard } from "@rind-ui/react"

<HoverCard.Root>
  <HoverCard.Trigger href="/u/jane">Jane Doe</HoverCard.Trigger>
  <HoverCard.Portal>
    <HoverCard.Positioner>
      <HoverCard.Content>
        <strong>Jane Doe</strong>
        <p>Designer. 120 followers.</p>
        <HoverCard.Arrow />
      </HoverCard.Content>
    </HoverCard.Positioner>
  </HoverCard.Portal>
</HoverCard.Root>
```

Only `Root`, `Trigger`, `Positioner` and `Content` are required. `Portal` and `Arrow` are optional. Parts render when the card first opens and unmount after their exit animation; `keepMounted` keeps them in the document, hidden.

## API

<!-- api:hover-card -->

## The usage rule

A hover card is an enhancement. Everything in it must also be reachable by following the link: it is never the only path to that information or action. Do not put the only way to do something inside it, and do not hide required content there. Touch users and anyone who does not hover or wait never see it.

For that reason the trigger should be a link. In development a trigger without an `href` logs a warning: a button that opens something wants a Popover.

## Keyboard access

When a link is focused by Tab, the card opens after the same `openDelay` as for the pointer, so keyboard users get the preview too. Focus stays on the link; nothing moves into the card.

- Tab on the link enters the card (it sits right after its trigger in the Tab order, wherever it is rendered). Tab past its last control continues after the link; Shift+Tab from its first control returns to the link. This is key handling only: no focusable sentinel elements are rendered.
- Focus inside the card keeps it open. Leaving it closes it after `closeDelay`.
- Escape closes the topmost layer and keeps focus where it is.
- A card opened by clicking or pressing on the link does not trap anything: the link is followed.

## No touch

There is no touch behaviour: a tap on the trigger follows the link and opens nothing. This is deliberate, because a first tap that previews and a second that navigates breaks the link. Content that matters on touch devices belongs on the destination page.

## Naming

The content is named by `aria-label` / `aria-labelledby` you put on it, else by the trigger (the link's text). It is not modal, so the page stays in the virtual cursor's reach, and it takes no focus when it opens.

## Controlled use and reasons

`open` / `defaultOpen` / `onOpenChange(open, details)`. `details.reason` is `hover`, `focus` or `api` when opening, and `pointer-leave`, `blur`, `escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `disabled` or `api` when closing; `details.cancel()` keeps the current state. `actionsRef` gives `open()` and `close()`. After closing, the content carries `data-close-reason` (`escape-key`) until the next open.

## Delays

`openDelay` (default 700 ms) is how long the pointer rests, or keyboard focus stays, before the card opens. `closeDelay` (default 300 ms) is how long it stays after the pointer or focus leaves; moving onto the card, or re-entering the link, within that time keeps it open.

## Positioning

`positioning` takes the shared options (side, align, offsets, flip, shift, size, arrow); the Hover Card defaults to the popup preset below the link with a gap of 8. The positioner receives `data-side`, `data-align`, `data-anchor-hidden` and `data-placing`; the content's size is clamped by `--rind-available-width` / `--rind-available-height`, and `--rind-transform-origin` points at the link.

## Popover, Hover Card or Tooltip

- **Tooltip**: a short text label for a control, shown on hover or focus. Not interactive; never holds links or buttons.
- **Hover Card**: a richer, possibly interactive preview of a link, shown on hover or focus. Optional: the link has the same information behind it.
- **Popover**: content opened on purpose by a button, reachable by keyboard, mouse and touch. Use it whenever the content is needed, not just nice to have.

## Known assistive technology notes

- The card is announced as a dialog named by the link. Screen readers word this differently, and a virtual-cursor user may reach the card only by Tab from the link.
- Because focus does not move into the card, a screen reader user is not interrupted by a preview they did not ask for.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/hover-card.css`: a surface (background, border, radius, shadow, padding, width), clamped to the available size, entry (`@starting-style`) and exit (`[data-state="closed"]`) with the duration tokens and none under reduced motion, the arrow, and a forced-colors border, with `--rind-hover-card-*` tokens (`bg`, `color`, `border`, `radius`, `shadow`, `padding`, `width`, `duration`, `arrow-size`).

## Testing

The card is located through its trigger link (`name`); pass `role: "button"` for another trigger. Delays run on your fake timers: give `domEnv` the function that advances them, and the driver steps time until the card shows.

```tsx
import { domEnv, getHoverCard } from "@rind-ui/testing"
import { vi } from "vitest"

vi.useFakeTimers()
render(<UserLink />)
const env = domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
const card = getHoverCard(env, { name: "Jane Doe" }).via("pointer")
await card.show() // rests on the link through the open delay
expect(await card.isOpen()).toBe(true)
await card.via("keyboard").pressEscape()
expect(await card.closeReason()).toBe("escape-key")
```

`show()` through `via("keyboard")` Tabs onto the link instead. `enter()` Tabs into the card. `testMachine(hoverCardContract, …)` runs the machine graph against your own wrapper.

## Tested with

<!-- tested-with:hover-card -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
