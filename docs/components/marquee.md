# Marquee

A band of content that scrolls by on a loop: logos, a ticker, a row of testimonials. The motion is CSS (each copy translates by its own size), so pausing holds the band where it is and resuming continues from there. The script only measures, keeps the motion continuous when its timing changes, and seeks so a focused link is in view. It follows WCAG 2.2.2: a PauseTrigger stops it, hovering pauses it, keyboard focus pauses it until the user plays it again, and reduced motion shows the content once, wrapped and still.

## When to use

- **Use it for** decorative or repeated content whose meaning does not depend on being read in full: customer logos, a "what's new" ticker, a social-proof strip.
- **Over a hand-built `@keyframes` band**: copies that assistive technology reads once and Tab skips, a pause control and hover / focus pauses (2.2.2), reduced motion, no seam with `autoFill`, and no jump when the speed, size or direction changes.
- **Don't use it for** essential information (prices, alerts, legal text): moving text is hard to read, and a user who needs it has to stop it first. Show it still. Don't use it for slides the user steps through: that is a carousel.

```tsx
import { Marquee } from "@rind-ui/react"

<Marquee.Root role="region" aria-label="Customers" speed={50}>
  <Marquee.PauseTrigger />
  <Marquee.Viewport>
    <Marquee.Content>
      {customers.map((c) => (
        <a key={c.name} href={c.url}>
          <img src={c.logo} alt={c.name} loading="eager" />
        </a>
      ))}
    </Marquee.Content>
  </Marquee.Viewport>
</Marquee.Root>
```

## API

<!-- api:marquee -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Marquee.Root` | `root` | `<div>`, no role of its own; `role`, `aria-label`, `aria-labelledby` pass through. |
| `Marquee.PauseTrigger` | `pause-trigger` | `<button>` named "Pause animation" / "Play animation"; empty, the theme draws the pause or play icon. `hidden` under reduced motion. |
| `Marquee.Viewport` | `viewport` | `<div>` that clips the band (`overflow: clip`, never scrolled). |
| `Marquee.Content` | `content` | Rendered once as the original (`data-index="0"`), then as copies (`data-copy`, `aria-hidden`). |

Every part carries `data-state`, `data-orientation` and `data-reverse` while reversed.

## States

| State | Meaning |
|---|---|
| `idle` | Not measured yet (the server render, a hidden or zero-size band): no motion. |
| `running` | Moving. |
| `paused` | Held by the user pause or a hovering mouse or pen, where it is. |
| `static` | Reduced motion: one copy, wrapped, no motion, no PauseTrigger. |

The user pause is controllable: `paused`, `defaultPaused`, `onPausedChange(paused, { reason })` with reason `"trigger"` or `"focus"`. Hover never changes it; leaving never clears it.

## Copies

The band needs copies of the content to loop without a seam: 2, or with `autoFill` enough to fill the Viewport plus one (at most 32). Copies are `aria-hidden` and every tabbable element in them gets `tabindex="-1"`, also ones rendered later. They are not `inert`, so a click on a logo in a copy still works.

- **Ids**: an element with an `id` inside the Content is repeated by the copies; a development warning says so. Use classes.
- **Images**: give them `loading="eager"`. A lazy image in a copy outside the viewport may never load before it scrolls in.
- **Find in page** finds the text once per copy.

## Speed and continuity

`speed` is in CSS pixels per second (default 50); the duration, one copy over the speed, is set as `--rind-marquee-duration` on the Viewport. When the size, the speed or `reverse` changes, the band keeps its place: the animation's progress is rescaled (or mirrored) before the next paint.

## Keyboard

| Key | Action |
|---|---|
| Enter, Space | On the PauseTrigger: pauses or plays. |
| Tab | Into the band: pauses it until the user plays it again, and brings the focused element into view. |

## Accessibility notes

- **Pause, stop, hide (2.2.2).** A PauseTrigger, hover and keyboard focus pause; reduced motion stops the band entirely, also before the script runs (the theme's media query).
- **Read once.** Only the original is exposed; the copies are hidden and untabbable.
- **Focus in view (2.4.11).** Focus entering the band seeks the focused element to the Viewport's start, without scrolling.
- **Name the region.** Give the Root a `role` and a name when the band is meaningful, or hide the Viewport with `aria-hidden` when it is decoration (the content is elsewhere).

## Testing

```tsx
import { getMarquee } from "@rind-ui/testing"

const band = getMarquee(screen, { name: "Customers" })
expect(await band.state()).toBe("running")
await band.togglePause()
expect(await band.isPaused()).toBe(true)
expect(await band.triggerLabel()).toBe("Play animation")
```

Contract actions: `measure`, `togglePause`, `hover`, `leave`, `focusContent`. Queries: `state`, `isPaused`, `triggerLabel`, `copies`, `duration`.

## Tested with

<!-- tested-with:marquee -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
