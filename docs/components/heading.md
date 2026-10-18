# Heading

A heading whose level comes from where it is: sections nest, and each `Heading` renders the native `h1`–`h6` for its depth, so the document outline stays right without counting levels by hand.

## When to use

- **Use it for** headings in components that can sit at any depth, so the outline stays right without counting levels by hand.
- **Over a plain `<h1>`-`<h6>`**: each `Heading` picks its level from the enclosing `Heading.Level`, so a section can move without editing its headings. Use `level` to override.
- **Don't use it for** a page where the levels are fixed and known: a native `<h2>` is enough. It does not style text; it only chooses the element.

```tsx
import { Heading } from "@rind-ui/react"

<Heading>Settings</Heading>               {/* h2 */}
<Heading.Level>
  <Heading>Profile</Heading>              {/* h3 */}
  <Heading.Level>
    <Heading>Avatar</Heading>             {/* h4 */}
  </Heading.Level>
</Heading.Level>
```

Heading is stateless: it has no machine.

## API

<!-- api:heading -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Heading` | `root` | `<h{level}>` | The heading: `h2` outside any section. |
| `Heading.Level` | `—` | `<none>` | A section: sets the level of the headings below it. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `level` | `1 \| 2 \| 3 \| 4 \| 5 \| 6` | — | On `Heading`: overrides the nesting. On `Heading.Level`: the level below it (default: one more than around it). |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element: a non-heading gets `role="heading"` and `aria-level`, another `h1`–`h6` gets `aria-level`. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "heading" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-level` | "1"–"6": the computed level. |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

No actions.

Queries: `level`. Traits: none.
<!-- /api -->

## Level rules

- `level` on a `Heading` wins.
- Otherwise the nearest `Heading.Level` decides; a `Heading.Level` without `level` is one
  deeper than the level around it.
- Outside any section the level is **2**: the page is assumed to own its `h1`. An app
  shell anchors the root with `<Heading.Level level={1}>`.
- Levels stop at 6. A heading deeper than six sections renders `h6` and warns once in
  development; an invalid `level` (0, 7, 2.5) is clamped with a warning naming it.

Levels follow the component tree, not the DOM: a heading rendered through a `Portal`
keeps the level of the section it was written in.

## Size is not level

The theme sizes headings by `data-level`, but size and level are independent. To make a
card's `h2` titles smaller, change the size, not the level:

```css
.card {
  --rind-heading-2-font-size: var(--rind-text-md);
}
```

Rendering another element keeps the level exposed to assistive technology:
`render={<h4 />}` on a level-2 heading gets `aria-level="2"`, and `render={<div />}` gets
`role="heading"` and `aria-level`. Prefer styling by `data-level` (or your own class) over
swapping the element.

## Your own components

`useHeadingLevel()` returns the level for the current position, so a component of yours
can render the right element:

```tsx
function CardTitle({ children }: { children: React.ReactNode }) {
  const level = useHeadingLevel()
  const Tag = `h${level}` as const
  return <Tag className="card-title">{children}</Tag>
}
```

rind-ui's own heading parts (Dialog, Drawer and Popover titles, Accordion
headers) use the same rules, and each wraps its content in a `Heading.Level` one below its
title, so a `Heading` inside a dialog body nests under the dialog's title.

An empty exposed heading (no text, no `aria-label`) warns in development.

## Testing

```tsx
import { getHeading } from "@rind-ui/testing"

expect(await getHeading(screen, { name: "Profile" }).level()).toBe(3)
```

`level()` reads what assistive technology gets: `aria-level`, else the element's tag. The
same test runs with a Playwright `page` instead of `screen`. When two headings share the
name, the driver fails and lists both.

## Accessibility tree

Nested sections, and a heading rendered as a `<div>` (generated from the state examples):

<!-- aria:heading--nested-sections -->
```yaml
- heading "Settings" [level=2]
- heading "Profile" [level=3]
- heading "Avatar" [level=4]
```
<!-- /aria -->

<!-- aria:heading--as-div -->
```yaml
- heading "Section title" [level=2]
```
<!-- /aria -->

## Tested with

<!-- tested-with:heading -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
