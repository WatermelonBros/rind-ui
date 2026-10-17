# Popover

A floating panel anchored to a trigger. It is non-modal by default: the page stays usable, a press or focus outside closes it, and Tab continues from the trigger into the content. The content is `role="dialog"`, positioned against the trigger (or an `Anchor`) by the shared positioning capability.

## When to use

- **Use it for** a floating panel anchored to a trigger: extra details, a small form, a toggletip.
- **Over a plain element**: it adds `role="dialog"` with a name, positioning against the trigger, dismissal by outside press, focus or Escape, focus moved into the content and returned on close, and Tab order that continues from the trigger.
- **Don't use it for** content that must be dealt with first: use [Dialog](dialog.md). Don't use it for a list of actions: use [Menu](menu.md). Don't use it for a short label on hover or focus: use [Tooltip](tooltip.md).
- **Don't use it for** content that only needs to show and hide in place: use [Collapsible](collapsible.md).

```tsx
import { Popover } from "@rind-ui/react"

<Popover.Root>
  <Popover.Trigger>Share</Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner>
      <Popover.Content>
        <Popover.Title>Share this page</Popover.Title>
        <Popover.Description>Anyone with the link can view it.</Popover.Description>
        <input aria-label="Link" readOnly value="https://example.com/p/1" />
        <Popover.CloseTrigger>Done</Popover.CloseTrigger>
        <Popover.Arrow />
      </Popover.Content>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

Only `Root`, `Trigger`, `Positioner` and `Content` are required. `Portal`, `Anchor`, `Arrow`, `Indicator`, `Title`, `Description` and `CloseTrigger` are optional. Parts render when the popover first opens and unmount after their exit animation; `keepMounted` keeps them in the document, hidden.

## API

<!-- api:popover -->

## Modal and non-modal

`modal={false}` (the default) makes nothing inert, locks no scroll and contains no focus; the content has no `aria-modal`. A press outside, focus moving outside, or Escape closes it (`closeOnInteractOutside`, `closeOnEscape`); `persistentElements` lists elements (a toast region) that count as inside.

`modal` makes the outside inert, locks scroll, wraps Tab inside the content and sets `aria-modal`. Use it only when the content must be dealt with first; that is a Dialog's job, so prefer the Dialog unless you need anchoring. A modal popover should render a `Popover.CloseTrigger`: touch screen-reader users have no Escape key (a development warning says so). The content carries `data-modal`.

## Tab order

Non-modal content is usually portalled to the end of `body`, but it sits in the Tab order right after its trigger: Tab on the trigger enters the content, Tab past its last control continues after the trigger, Shift+Tab from its first control returns to the trigger. This is key handling only: no focusable sentinel elements are rendered (they confuse axe and VoiceOver). A popover opened from inside another popover is its child; Tab leaving the child continues in the parent.

## Naming

An open popover needs an accessible name, chosen in this order: `Popover.Title`, then your own `aria-label` / `aria-labelledby` on the content, then (non-modal only) the trigger's name. A modal popover without a title or label logs a development error. The title and description ids are added to `aria-labelledby` and `aria-describedby` only while those parts are rendered.

`Popover.Title` is an `h2` by default; `level={3}` changes it, and a `Heading` inside the content renders one level below it. An icon-only `Popover.CloseTrigger` is named by `messages.close` (default "Close").

## Focus

Focus moves into the content after the first placement, never before: focusing an unplaced popup scrolls the page. The default target is `data-autofocus`, then the first tabbable element, then the content (the content itself when opened by touch). `initialFocus` is a function returning an element (or `null` for the default rule). On close, focus returns to the trigger; `finalFocus` is `null` (the trigger), a function of the close reason, or `false` (focus stays where it is, e.g. when the user clicked another control to dismiss).

## Controlled use and reasons

`open` / `defaultOpen` / `onOpenChange(open, details)`. `details.reason` is one of `trigger`, `close-trigger`, `escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `open`, `api`; `details.cancel()` keeps it open. Veto a dismissal early with `onEscapeKeyDown` or `onInteractOutside` and `event.preventDefault()`. `actionsRef` gives `open()`, `close()` and `reposition()` (for an anchor that moved in a way tracking cannot see). After closing, the content carries `data-close-reason` (`escape-key`) until the next open.

A parent coordinator (a composite such as a combobox) may own `open`, and re-scope the `data-scope` of every part through the `scope` option.

## Positioning

`positioning` takes the shared options (side, align, offsets, flip, shift, size, arrow); the Popover defaults to the popup preset with a gap of 8. The positioner receives `data-side`, `data-align`, `data-anchor-hidden` and `data-placing`; the content's size is clamped by `--rind-available-width` / `--rind-available-height`, and `--rind-transform-origin` points at the anchor. Render `Popover.Anchor` to position against another element than the trigger.

## Toggletip recipe

A toggletip is a small non-modal popover with a short text, opened by an info button. Name the trigger with what it explains and give the content no title:

```tsx
<Popover.Root>
  <Popover.Trigger aria-label="About the fee">i</Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner>
      <Popover.Content>A 2% fee applies to card payments.</Popover.Content>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

The content is named by the trigger ("About the fee, dialog"). Use a Tooltip for a hover-only hint and a Popover when the content must be reachable by keyboard and touch.

## Known assistive technology notes

- **iOS VoiceOver**: portalled content comes after the page in the swipe order, so a swipe from the trigger does not reach it. Focus moves into the content on open, which puts the swipe cursor there; swiping past its last element leaves it. Verified on devices in the release protocol.
- **Screen readers and the non-modal name**: the content is named by the trigger when it has no title or label; NVDA, JAWS and VoiceOver word this differently.
- No `aria-modal` is set when non-modal, so the page stays in the virtual cursor's reach.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/popover.css`: a surface (background, border, radius, shadow, padding), clamped to the available size, entry (`@starting-style`) and exit (`[data-state="closed"]`) with the duration tokens and none under reduced motion, a stronger shadow for `[data-modal]`, the arrow, and a forced-colors border, with `--rind-popover-*` tokens (`bg`, `color`, `border`, `radius`, `shadow`, `modal-shadow`, `padding`, `max-width`, `max-height`, `duration`, `arrow-size`).

## Testing

The popover is located through its trigger (`name`); pass `modal: true` for a modal one.

```tsx
import { getPopover } from "@rind-ui/testing"

render(<ShareMenu />)
const popover = getPopover(screen, { name: "Share" })
await popover.open()
expect(await popover.isPlaced()).toBe(true)
await popover.pressEscape()
expect(await popover.closeReason()).toBe("escape-key")
```

`open()` waits for the open state, the first placement and focus inside, in that order. `testMachine(popoverContract, …)` (or `modalPopoverContract`) runs the machine graph against your own wrapper.

## Tested with

<!-- tested-with:popover -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
