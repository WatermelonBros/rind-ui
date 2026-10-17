# Checkbox Group

A set of [Checkboxes](checkbox.md) that share one array value, with an optional select-all `Parent`. The Root is a `role="group"` named by its Label (a native `<fieldset>`/`<legend>` through `render` needs no role); each item is a Checkbox with its own hidden native input ([hidden-form-input](../guides/hidden-form-input.md)).

## When to use

- **Use it for** a set of related options where the user may pick any number, submitted as one array, with an optional select-all `Parent`.
- **Over several `<input type="checkbox">` in a `<fieldset>`**: it shares one array value, adds the select-all mixed state, and applies one `required` rule (at least one checked). Native checkboxes are enough when the options are independent.
- **Don't use it for** a single yes/no: use [Checkbox](checkbox.md). For exactly one choice, use [Radio Group](radio-group.md).

```tsx
import { Checkbox, CheckboxGroup } from "@rind-ui/react"

const toppings = ["ham", "cheese", "olives"]

<CheckboxGroup.Root allValues={toppings} name="topping" defaultValue={["ham"]}>
  <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
  <CheckboxGroup.Parent>
    <Checkbox.Control>
      <Checkbox.Indicator />
    </Checkbox.Control>
    <Checkbox.Label>All toppings</Checkbox.Label>
  </CheckboxGroup.Parent>
  {toppings.map((value) => (
    <Checkbox.Root key={value} value={value}>
      <Checkbox.Control>
        <Checkbox.Indicator>{() => <CheckIcon />}</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>{value}</Checkbox.Label>
    </Checkbox.Root>
  ))}
</CheckboxGroup.Root>
```

## API

<!-- api:checkbox-group -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `CheckboxGroup.Root` | `root` | `<div role="group">`; `render={<fieldset />}` drops the role. |
| `CheckboxGroup.Label` | `label` | `<span>` naming the group; `render={<legend />}` inside a fieldset. |
| `CheckboxGroup.Description` | `description` | `<p>`; in the group's `aria-describedby`. |
| `CheckboxGroup.ErrorMessage` | `error-message` | `<p>`; rendered only while the group is invalid. |
| `CheckboxGroup.Parent` | `root` of a Checkbox, `data-parent` | A Checkbox driven by the group; put `Checkbox.Control`, `Indicator` and `Label` inside. |

Items are plain `Checkbox.Root value="…"` inside the group Root (an item without `value` is a development error). `data-disabled`, `data-readonly`, `data-required` and `data-invalid` mirror the props on the Root.

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | Moves to the next / previous item (and the Parent). Every item is a tab stop. |
| Space | Toggles the focused item, or advances the Parent's cycle. |
| Arrow keys | Nothing: a checkbox group is not a roving-focus widget. |
| Enter | Does not toggle; inside a form it submits it. |

## Select all

`allValues` lists every item value and is required with a Parent. The Parent is `checked` when all are selected, `unchecked` when none is, else mixed (`aria-checked="mixed"`). Activating it follows the APG cycle from a partial selection: select all, then none, then the remembered partial selection again. Any item toggle ends the cycle. Disabled items are never changed by the Parent: "all" and "none" leave them as they are. The cycle is the same for controlled groups (the proposal goes through `onValueChange`; a refused one ends the cycle).

## Required

`required` means at least one item checked: the form is invalid while the value is empty, with the browser's own message, and the first item is the focus target of a failed submit. The items themselves are not individually required once one is checked.

## Form participation

`name` on the Root is submitted once per checked item (`value` of each item); an item's own `name` is ignored. A disabled item is omitted from `FormData` by the browser, although the group's `value` may still include it (it is selected, just not submittable). The Parent submits nothing. One form reset restores `defaultValue` for every item at once. See [hidden-form-input](../guides/hidden-form-input.md).

## Accessibility notes

- **Group name.** `aria-labelledby` points at the Label only while a Label is rendered; with a native `<fieldset>` the `<legend>` names it and no `role` is set.
- **Item names.** Each item is named by its own Label ([control-label](../guides/control-label.md)); a label toggles only its item.
- **Parent.** `aria-controls` lists the currently rendered item ids.
- **Field.** Inside a [Field](field.md) the group registers as one control; the Field's ErrorMessage replaces the group's own.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/checkbox-group.css`: structural only (a stacked grid with a gap, a native fieldset/legend normalised to a plain block, danger colour for the ErrorMessage, muted colour when disabled). The items are styled by `checkbox.css`.

## Testing

Contract actions: `toggle(label)`, `toggleParent()`. Queries: `value`, `parentState` (`"unchecked"`, `"mixed"`, `"checked"`), `isDisabled`, `isRequired`, `isInvalid`.

```tsx
import { getCheckboxGroup } from "@rind-ui/testing"

render(<Toppings />)
const group = getCheckboxGroup(screen, { name: "Toppings" })
await group.toggle("Ham")
expect(await group.value()).toEqual(["ham"])
expect(await group.parentState()).toBe("mixed")
await group.via("keyboard").toggleParent()
expect(await group.parentState()).toBe("checked")
```

The same test runs with a Playwright `page`.

## Accessibility tree

Group with a Parent: unchecked, mixed and checked (generated from the state examples):

<!-- aria:checkbox-group--default -->
```yaml
- group "Toppings":
  - text: Toppings
  - checkbox "Ham"
  - text: Ham
  - checkbox "Cheese" [checked]
  - text: Cheese
  - checkbox "Olives"
  - text: Olives
```
<!-- /aria -->

<!-- aria:checkbox-group--parent-unchecked -->
```yaml
- group "Toppings":
  - text: Toppings
  - checkbox "All toppings"
  - text: All toppings
  - checkbox "Ham"
  - text: Ham
  - checkbox "Cheese"
  - text: Cheese
  - checkbox "Olives"
  - text: Olives
```
<!-- /aria -->

<!-- aria:checkbox-group--parent-mixed -->
```yaml
- group "Toppings":
  - text: Toppings
  - checkbox "All toppings" [checked=mixed]
  - text: All toppings
  - checkbox "Ham" [checked]
  - text: Ham
  - checkbox "Cheese"
  - text: Cheese
  - checkbox "Olives"
  - text: Olives
```
<!-- /aria -->

<!-- aria:checkbox-group--parent-checked -->
```yaml
- group "Toppings":
  - text: Toppings
  - checkbox "All toppings" [checked]
  - text: All toppings
  - checkbox "Ham" [checked]
  - text: Ham
  - checkbox "Cheese" [checked]
  - text: Cheese
  - checkbox "Olives" [checked]
  - text: Olives
```
<!-- /aria -->

## Tested with

<!-- tested-with:checkbox-group -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
