# Collapsible

A trigger that shows and hides one region. Closed content stays findable by the browser's search (`closedContent="until-found"`, the default), or is hidden, or is removed.

## When to use

- **Use it for** one trigger that shows and hides one region: "Show details", an advanced-options block, an expandable note.
- **Over `<details>`**: it animates height through a published CSS variable, lets you control the open state, and chooses how closed content is kept (findable by the browser's search, hidden, or removed). `<details>` is enough when you need no animation or control.
- **Don't use it for** a list of sections: use [Accordion](accordion.md). For floating content anchored to a trigger, use [Popover](popover.md).

```tsx
import { Collapsible } from "@rind-ui/react"

<Collapsible.Root>
  <Collapsible.Trigger>
    <Collapsible.Indicator>▸</Collapsible.Indicator>
    Details
  </Collapsible.Trigger>
  <Collapsible.Content>
    <div style={{ padding: "var(--rind-space-2)" }}>Hidden until opened.</div>
  </Collapsible.Content>
</Collapsible.Root>
```

## API

<!-- api:collapsible -->

## Transitions

The Content publishes its size as `--rind-collapsible-content-height` and `-width`: `0px` when closed, a pixel value while opening or closing, `auto` at rest (so the content keeps following its own size). The theme transitions `height` on that variable. Animate with a transition on the variable, not with keyframes: keyframes would race the measurement. `data-reveal` is set on the Content for an instant reveal (find-in-page, first render); the theme drops the transition there. Durations are `0s` under `prefers-reduced-motion`.

## Focus rings and `overflow: hidden`

The Content clips while it animates, so a focus ring of a child at its edge would be cut. Put padding on an inner wrapper, not on the Content, and leave room for the ring's offset inside it (see the example above).

## CSS resets that break find-in-page

Closed `until-found` content is `hidden="until-found"`, which the browser can still search and reveal. A reset like `[hidden] { display: none }` makes it unfindable. The theme has no such rule; in development the Content warns when it computes `display: none`. Remove the reset, or use `closedContent="hidden"`.

## Driver

```ts
import { getCollapsible } from "@rind-ui/testing"

const details = getCollapsible(container, { name: "Details" })
await details.open()
await details.isOpen() // true
await details.close()
```

The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:collapsible -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
