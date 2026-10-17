# Fieldset

A native `<fieldset>` that names and describes a group of related controls, shows a group-level error, and disables every control inside it, native and rind-ui alike, portalled parts included.

## When to use

- **Use it for** naming and describing a group of related controls, such as an address or a set of options, and showing one error for the group.
- **Over a bare `<fieldset>`**: it adds a description and a group error message, and its `disabled` also reaches rind-ui controls, portalled parts included.
- **Don't use it for** a single control: use a [Field](field.md). If a plain `<fieldset>` and `<legend>` are all you need, the native elements are enough.

```tsx
import { Fieldset } from "@rind-ui/react"

<Fieldset.Root>
  <Fieldset.Legend>Shipping address</Fieldset.Legend>
  <Fieldset.Description>All fields are required.</Fieldset.Description>
  {/* controls */}
  <Fieldset.ErrorMessage>Enter a full address.</Fieldset.ErrorMessage>
</Fieldset.Root>
```

The Fieldset is stateless: it has no machine. `disabled` and `invalid` are props.

## API

<!-- api:fieldset -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Fieldset.Root` | `root` | `<fieldset>` | The group; named by its Legend, described by Description and ErrorMessage. |
| `Fieldset.Legend` | `legend` | `<legend>` | The group's name; render it as the root's first child. |
| `Fieldset.Description` | `description` | `<p>` | Help text for the whole group. |
| `Fieldset.ErrorMessage` | `error-message` | `<p>` | Rendered only while `invalid` (or with `forceMount`); not a live region. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `disabled` | `boolean` | `false` | On Root: disables every control inside, native and rind-ui, portalled parts included (the first Legend's content is exempt). |
| `invalid` | `boolean` | `false` | On Root: shows the ErrorMessage. Never passed to the controls inside. |
| `forceMount` | `boolean` | `false` | On ErrorMessage: keep it mounted while not invalid. |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Every part. A substituted Root gets `role="group"` and `aria-disabled` but cannot disable native controls. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "fieldset" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-disabled` | While disabled, by its own prop or an enclosing Fieldset. |
| `root` | `data-invalid` | While `invalid`. |
| `legend` | `data-scope` | "fieldset" |
| `legend` | `data-part` | "legend" |
| `legend` | `data-instance` | The instance id. |
| `legend` | `data-disabled` | While disabled, by its own prop or an enclosing Fieldset. |
| `legend` | `data-invalid` | While `invalid`. |
| `description` | `data-scope` | "fieldset" |
| `description` | `data-part` | "description" |
| `description` | `data-instance` | The instance id. |
| `description` | `data-disabled` | While disabled, by its own prop or an enclosing Fieldset. |
| `description` | `data-invalid` | While `invalid`. |
| `error-message` | `data-scope` | "fieldset" |
| `error-message` | `data-part` | "error-message" |
| `error-message` | `data-instance` | The instance id. |
| `error-message` | `data-disabled` | While disabled, by its own prop or an enclosing Fieldset. |
| `error-message` | `data-invalid` | While `invalid`. |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

No actions.

Queries: `name`, `description`, `isDisabled`, `isInvalid`, `errors`. Traits: none.
<!-- /api -->

## Name and description

- Render the Legend as the root's **first child**: a native `<legend>` names the group with
  no ARIA at all. A substituted Legend (`render={<div />}`) or root makes the root use
  `aria-labelledby` instead.
- `aria-describedby` lists the Description and, while it is rendered, the ErrorMessage
  (description first), plus your own ids. It is omitted when empty, never `""`.
- The ErrorMessage is rendered only while `invalid`, and it is not a live region: move
  focus or announce the error yourself when it appears. `invalid` is never passed to the
  controls inside; each keeps its own validity.

## Disabled propagation

A disabled Fieldset disables:

- native controls, through the native `disabled` attribute;
- every rind-ui control, also when rendered as a `div` or portalled out of the fieldset,
  through a context each control reads together with its own `disabled` prop;
- nested Fieldsets.

As in HTML, controls inside the Legend stay enabled (a "select all" checkbox), and disabled
values are not submitted.

A Root substituted by another element (`render={<div />}`) gets `role="group"` and
`aria-disabled`, and still disables rind-ui controls, but **cannot disable native ones**; a
development warning says so.

## Fieldset or Field?

Use a **Field** for one control with its label, description and error. Use a **Fieldset**
for a group of controls that share a name ("Shipping address", "Notifications"), such as a
radio set or a block of fields.

## Testing

```tsx
import { getFieldset } from "@rind-ui/testing"

const fieldset = getFieldset(screen, { name: "Shipping address" })
expect(await fieldset.isDisabled()).toBe(true)
expect(await fieldset.description()).toBe("All fields are required.")
expect(await fieldset.errors()).toBeNull()
```

The same test runs with a Playwright `page`.

## Accessibility tree

An address group, and the same group disabled (generated from the state examples):

<!-- aria:fieldset--address-group -->
```yaml
- group "Shipping address":
  - text: Shipping address
  - paragraph: Where we send the parcel.
  - text: Street
  - textbox "Street"
  - text: City
  - textbox "City"
```
<!-- /aria -->

<!-- aria:fieldset--disabled-story -->
```yaml
- group "Shipping address":
  - text: Shipping address Street
  - textbox "Street" [disabled]
  - button "Save" [disabled]
```
<!-- /aria -->

## Tested with

<!-- tested-with:fieldset -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
