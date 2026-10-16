# Separator

A static divider between groups of content or controls. It is never focusable and has no
state; the same rules decide the role and orientation of every divider in rind-ui
(Toolbar, Menu, the listbox popups).

```tsx
import { Separator } from "@rind-ui/react"

<p>Account</p>
<Separator.Root />
<p>Billing</p>
```

Separator is stateless: it has no machine.

## API

<!-- api:separator -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Separator.Root` | `root` | `<div>` | The divider: `role="separator"` (implicit on `<hr>`), never focusable. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Its own orientation; wins over the container's default (a toolbar's separators are vertical). |
| `decorative` | `boolean` | `false` | Purely visual: `role="none"`, removed from the accessibility tree. |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element, for example `<hr />` (rendered without children). |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "separator" (the host's scope when rendered by another component) |
| `root` | `data-part` | "root" ("separator" under a host scope) |
| `root` | `data-instance` | The instance id. |
| `root` | `data-orientation` | "horizontal" \| "vertical": its own orientation. |
| `root` | `data-decorative` | Present when decorative or when the context forces `role="none"`. |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

No actions.

Queries: `orientation`, `isDecorative`, `isExposed`. Traits: none.
<!-- /api -->

## Role by context

| Context | Default | `decorative` |
|---|---|---|
| `content` (default), `menu`, `toolbar` | `role="separator"` (none on `<hr>`, its implicit role); `aria-orientation="vertical"` only when vertical | `role="none"`, no `aria-orientation`, no name |
| `listbox` (Listbox, Select, Combobox, Autocomplete popups) | always `role="none"`: `separator` is not an allowed child of a listbox | same |

A container passes its context (and, for a toolbar, the perpendicular default orientation)
with `SeparatorHostContext`; an explicit `orientation` on the separator always wins.
`data-orientation` is the separator's own orientation, never its container's.

```tsx
<div role="toolbar" aria-label="Format">
  <SeparatorHostContext value={{ context: "toolbar", defaultOrientation: "vertical" }}>
    <button type="button">Bold</button>
    <Separator.Root />            {/* vertical */}
    <button type="button">Italic</button>
  </SeparatorHostContext>
</div>
```

`<Separator.Root render={<hr />} />` renders no children. A name (`aria-label`,
`aria-labelledby`) is forwarded on a semantic separator and dropped, with a development
warning, on a `none` one.

## Separator or Splitter

A separator is never focusable and carries no `aria-value*`. A `tabIndex` of 0 or more, or
any `aria-value*`, warns in development: a focusable, valued separator is a window splitter,
so use the Splitter component for resizable dividers.

## Text divider

The separator role's children are presentational, so text never goes inside it. Put the text
beside two decorative rules:

```tsx
<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
  <Separator.Root decorative style={{ flex: 1 }} />
  <span>or</span>
  <Separator.Root decorative style={{ flex: 1 }} />
</div>
```

## Styling

The theme draws a border (so it survives forced colors) and a vertical separator stretches
to the cross size of its flex row. Tokens: `--rind-separator-color`,
`--rind-separator-thickness`, `--rind-separator-spacing`.

## Testing

```tsx
import { getSeparator } from "@rind-ui/testing"

const separator = getSeparator(screen, { within: toolbar })
expect(await separator.orientation()).toBe("vertical")
expect(await separator.isDecorative()).toBe(false)
```

`getSeparator(screen, { name })` locates a named separator by role and name; without a name
it takes the one separator inside `within` (or the target) and, when several match, fails
listing every match. The same test runs with a Playwright `page`.

## Accessibility tree

<!-- aria:separator--in-toolbar -->
```yaml
- toolbar "Format":
  - button "Bold"
  - separator
  - button "Italic"
```
<!-- /aria -->

<!-- aria:separator--in-listbox -->
```yaml
- listbox "Fruit":
  - option "Apple"
  - option "Pear"
```
<!-- /aria -->

## Tested with

<!-- tested-with:separator -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
