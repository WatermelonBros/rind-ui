# Label

A native `<label>` that names a control through `for` or by wrapping it, and fixes what native labels get wrong: no text selection on double click, focus forwarding for controls a label cannot name, and a development check of what `for` points at.

## When to use

- **Use it for** naming a control, by `htmlFor` or by wrapping it.
- **Over a native `<label>`**: it is one, and adds no text selection on double click, focus forwarding for controls a label cannot name, and a development check of what `htmlFor` points at.
- **Don't use it for** a full field with description and error: use a [Field](field.md). To name a group of controls, use a [Fieldset](fieldset.md).

```tsx
import { Label } from "@rind-ui/react"

<Label htmlFor="email">Email</Label>
<input id="email" />
```

The Label is stateless: it has no machine. Its interaction rules are shared by every
rind-ui label; see [Labels](../guides/labels.md).

## API

<!-- api:label -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Label (Label.Root)` | `root` | `<label>` | A native `<label>`: no role, no ARIA. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `htmlFor` | `string` | — | The id of the control it names. Kept on the server; dropped after mount when it names a non-labelable element (focus is forwarded instead, with a development warning). |
| `id` | `string` | — | Generated when absent, the same on the server and the client. |
| `render` | `ReactElement \| (props) => ReactNode` | — | Another element: a non-`<label>` forwards focus to `htmlFor`'s element itself. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "label" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

| Action | Modalities |
|---|---|
| `click` | pointer, virtual |
| `doubleClick` | pointer, virtual |

Queries: `text`, `controlName`, `isControlFocused`, `selectedText`. Traits: none.
<!-- /api -->

## A label focuses, it never opens

Clicking a Label focuses its control. For a control that opens a popup (Select, Combobox,
Menu, Date Picker), the click focuses the trigger and does **not** open the popup, as a
native label does for a `<select>`.

## Non-labelable targets

When `htmlFor` names an element a `<label>` cannot label (a `div` with a role), the Label
warns in development, renders without `for` after mount, and focuses that element on click.
Name the element with `aria-labelledby` pointing at the Label's `id` (generated when you
pass none, and stable across server and client).

## Required indicator

```tsx
<Label htmlFor="email">
  Email <span aria-hidden="true">*</span>
</Label>
<input id="email" required />
```

## Testing

```tsx
import { getLabel } from "@rind-ui/testing"

const label = getLabel(screen, { text: "Email" })
await label.click()
expect(await label.isControlFocused()).toBe(true)
expect(await label.controlName()).toBe("Email")
await label.doubleClick()
expect(await label.selectedText()).toBe("")
```

The same test runs with a Playwright `page`.

## Accessibility tree

A Label for an input (generated from the state story):

<!-- aria:label--for-input -->
```yaml
- text: Email
- textbox "Email"
```
<!-- /aria -->

## Tested with

<!-- tested-with:label -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
