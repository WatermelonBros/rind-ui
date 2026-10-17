# Accordion

A set of headers, each toggling one panel. Every item is a [Collapsible](collapsible.md), so closed panels stay findable by the browser's search (`closedContent="until-found"`, the default).

```tsx
import { Accordion } from "@rind-ui/react"

<Accordion.Root defaultValue={["shipping"]}>
  <Accordion.Item value="shipping">
    <Accordion.Header>
      <Accordion.Trigger>
        Shipping
        <Accordion.Indicator>▸</Accordion.Indicator>
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content>
      <div style={{ padding: "var(--rind-space-2)" }}>Ships in two days.</div>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
```

## API

<!-- api:accordion -->

## Keyboard (APG 2026)

Tab, Enter and Space are all the pattern requires: the triggers are plain buttons. Arrow keys, Home and End between triggers are optional in the 2026 APG, so they are off by default; set `keyboardNavigation` to get them. The arrows follow `orientation` and `dir` (Left and Right swap under RTL).

## Heading level

Each Header renders a heading. Its level is `headingLevel` if given, else the level of the surrounding `Heading.Level`, else 3. Content is wrapped in a `Heading.Level` one deeper, so a `Heading` inside a panel is one level below its header. The trigger must be the header's only element (a development warning says otherwise).

## Region rule

An open panel is `role="region"` labelled by its trigger when the accordion has at most 6 items or is single (not `multiple`); beyond that many regions become landmark noise, so the role is dropped. `contentRole="region" | "none"` overrides the rule. A closed panel never has a role.

## `collapsible` defaults to true

In single mode the open item can be closed again: the default follows the APG behaviour. `collapsible={false}` locks the open trigger: it stays focusable, is `aria-disabled`, and ignores activation. `collapsible` is ignored with `multiple`.

## Driver

```ts
import { getAccordion } from "@rind-ui/testing"

const faq = getAccordion(container, { item: "Shipping" })
await faq.expand("Shipping")
await faq.expanded() // ["Shipping"]
await faq.contentText("Shipping")
await faq.focusNext() // with keyboardNavigation
```

The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:accordion -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
