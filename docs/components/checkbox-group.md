# Checkbox Group

A checkbox, alone or in a set. Inside `CheckboxGroup.Root`, the items share one array value, with an optional select-all `Parent`. Outside any Root, a lone `CheckboxGroup.Item` is the single checkbox: a checked, unchecked or mixed (`indeterminate`) choice with its own value. The Root is a `role="group"` named by its Label (a native `<fieldset>`/`<legend>` through `render` needs no role); each item is a real `<button role="checkbox">` with its own hidden native `<input type="checkbox">` that carries the value, validation and reset ([hidden-form-input](../guides/hidden-form-input.md)).

## When to use

- **Use it for** a yes/no choice that is submitted with a form or saved later (alone), or for a set of related options where the user may pick any number, submitted as one array, with an optional select-all `Parent` (in a Root).
- **Over native `<input type="checkbox">` elements**: it adds the `indeterminate` state as `aria-checked="mixed"`, the Control, Indicator, Label and Description as styleable parts with `data-state`, one array value for a set, the select-all mixed state, and one `required` rule for the set (at least one checked). A native checkbox is enough when the options are independent and need no styling.
- **Don't use it for** a setting that takes effect immediately: use [Switch](switch.md), or a [Toggle Group](toggle-group.md) item for a button that stays pressed. For exactly one choice among several, use [Radio Group](radio-group.md).

## Two shapes

- **Alone.** `CheckboxGroup.Item` outside any Root is the single checkbox: its own `checked` / `defaultChecked` / `onCheckedChange`, `name`, `value` and `uncheckedValue`. There is no group wrapper.
- **In a Root.** Inside `CheckboxGroup.Root` an Item belongs to the group: its `value` is its key in the group's array value, and the group's `name`, `required`, `disabled` and `readOnly` apply to it.

```tsx
import { CheckboxGroup } from "@rind-ui/react"

// Alone
<CheckboxGroup.Item name="terms" required onCheckedChange={(checked) => save(checked)}>
  <CheckboxGroup.ItemControl>
    <CheckboxGroup.ItemIndicator>
      {({ indeterminate }) => (indeterminate ? <DashIcon /> : <CheckIcon />)}
    </CheckboxGroup.ItemIndicator>
  </CheckboxGroup.ItemControl>
  <CheckboxGroup.ItemLabel>Accept the terms</CheckboxGroup.ItemLabel>
  <CheckboxGroup.ItemDescription>You can withdraw at any time.</CheckboxGroup.ItemDescription>
</CheckboxGroup.Item>

// In a Root
const toppings = ["ham", "cheese", "olives"]

<CheckboxGroup.Root allValues={toppings} name="topping" defaultValue={["ham"]}>
  <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
  <CheckboxGroup.Parent>
    <CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemIndicator />
    </CheckboxGroup.ItemControl>
    <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
  </CheckboxGroup.Parent>
  {toppings.map((value) => (
    <CheckboxGroup.Item key={value} value={value}>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>{() => <CheckIcon />}</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>{value}</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  ))}
</CheckboxGroup.Root>
```

## API

<!-- api:checkbox-group -->

## API of a lone Item

The group's `value`, `name`, `required`, `disabled` and `readOnly` apply to an Item in a Root; alone, it takes the props below.

<!-- api:checkbox -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `CheckboxGroup.Root` | `root` | `<div role="group">`; `render={<fieldset />}` drops the role. |
| `CheckboxGroup.Label` | `label` | `<span>` naming the group; `render={<legend />}` inside a fieldset. |
| `CheckboxGroup.Description` | `description` | `<p>`; in the group's `aria-describedby`. |
| `CheckboxGroup.ErrorMessage` | `error-message` | `<p>`; rendered only while the group is invalid. |
| `CheckboxGroup.Parent` | `root` of an Item, `data-parent` | An Item driven by the group; put `ItemControl`, `ItemIndicator` and `ItemLabel` inside. |
| `CheckboxGroup.Item` | `root` | `<div>`; holds the hidden input as its last child. |
| `CheckboxGroup.ItemControl` | `control` | `<button role="checkbox">` (or what `render` gives it). |
| `CheckboxGroup.ItemIndicator` | `indicator` | `<span aria-hidden>`; children may be a function of `{ checked, indeterminate }`. |
| `CheckboxGroup.ItemLabel` | `label` | `<label for>`; part of the click target ([control-label](../guides/control-label.md)). |
| `CheckboxGroup.ItemDescription` | `description` | `<div>`; in the Control's `aria-describedby`. |

An Item in a Root needs a `value` (an item without one is a development error). The item parts carry `data-scope="checkbox"`. `data-state` is `unchecked`, `checked` or `indeterminate` on every item part; `data-disabled`, `data-readonly`, `data-required` and `data-invalid` mirror the props (on the Root for the group).

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | Moves to the next / previous item (and the Parent). Every item is a tab stop. |
| Space | Toggles the focused item, or advances the Parent's cycle. An indeterminate Item becomes checked. |
| Arrow keys | Nothing: a checkbox group is not a roving-focus widget. |
| Enter | Does not toggle; inside a form it submits it (implicit submission, as for a native checkbox). |

A disabled Item does nothing; with `focusableWhenDisabled` it stays in the Tab order. A read-only Item is focusable and ignores activation.

## Select all

`allValues` lists every item value and is required with a Parent. The Parent is `checked` when all are selected, `unchecked` when none is, else mixed (`aria-checked="mixed"`). Activating it follows the APG cycle from a partial selection: select all, then none, then the remembered partial selection again. Any item toggle ends the cycle. Disabled items are never changed by the Parent: "all" and "none" leave them as they are. The cycle is the same for controlled groups (the proposal goes through `onValueChange`; a refused one ends the cycle).

## Required

`required` means at least one item checked: the form is invalid while the value is empty, with the browser's own message, and the first item is the focus target of a failed submit. The items themselves are not individually required once one is checked.

## Form participation of a group

`name` on the Root is submitted once per checked item (`value` of each item); an item's own `name` is ignored. A disabled item is omitted from `FormData` by the browser, although the group's `value` may still include it (it is selected, just not submittable). The Parent submits nothing. One form reset restores `defaultValue` for every item at once. See [hidden-form-input](../guides/hidden-form-input.md).

## Form participation of a lone Item

`name` and `value` (default `"on"`) are submitted while checked; `uncheckedValue` submits that value while unchecked and enabled. `required` makes the form invalid until checked, with the browser's own message. `form` associates it with a form elsewhere in the document. See [hidden-form-input](../guides/hidden-form-input.md).

## Accessibility notes

- **Group name.** `aria-labelledby` points at the Label only while a Label is rendered; with a native `<fieldset>` the `<legend>` names it and no `role` is set.
- **Item names.** Each item is named by its own Label ([control-label](../guides/control-label.md)); a label toggles only its item.
- **Parent.** `aria-controls` lists the currently rendered item ids.
- **Field.** Inside a [Field](field.md) the group registers as one control; the Field's ErrorMessage replaces the group's own.
- **Label wiring.** A labelable Control is named by `<label for>`, so a consumer `aria-label` is never doubled. A Control rendered as a `<div>` (`render={<div />}`) is named by `aria-labelledby` and its Label toggles it once. Wrapping the Item in your own `<label>` also works.
- **Mixed.** `aria-checked="mixed"` is exposed for `indeterminate`. The glyph is yours: draw a different shape for the dash, the theme never relies on colour alone.
- **Enter submits.** A checkbox is not a button; Enter belongs to the form.
- **`<form onChange>` caveat.** React's synthetic `onChange` on a `<form>` does not see changes of an Item (they come from the hidden input, written by the component). Use `onCheckedChange`, or a native `change` listener on the form element.
- **Reset.** A form reset restores the current `defaultChecked` prop. Changing that prop never changes the current value.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/checkbox-group.css` (the group) and `@rind-ui/theme/checkbox.css` (the items). The group sheet is structural only: a stacked grid with a gap, a native fieldset/legend normalised to a plain block, danger colour for the ErrorMessage, muted colour when disabled. The item sheet is structural only too: box with border, glyph in `currentColor` hidden with `visibility` while unchecked, filled box when checked or mixed, a hit area of `--rind-hit-area` with the Label as part of the target, duration tokens. Forced colors map checked and mixed to `Highlight`/`HighlightText`, disabled to `GrayText`, the border to `CanvasText`.

## Testing

Group contract actions: `toggle(label)`, `toggleParent()`. Queries: `value`, `parentState` (`"unchecked"`, `"mixed"`, `"checked"`), `isDisabled`, `isRequired`, `isInvalid`.

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

A lone Item is driven by `getCheckbox`. Contract actions: `toggle`, `check`, `uncheck`, `clickLabel`, `resetForm` (clicks a button named "Reset"). Queries: `checkedState`, `isChecked`, `isIndeterminate`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `name`, `description`, `formValue`.

```tsx
import { getCheckbox } from "@rind-ui/testing"

render(<Terms />)
const terms = getCheckbox(screen, { name: "Accept the terms" })
await terms.check()
await terms.via("keyboard").uncheck()
await terms.clickLabel()
expect(await terms.formValue()).toBe("on")
```

The same tests run with a Playwright `page`.

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

A lone Item: unchecked, checked and mixed:

<!-- aria:checkbox-group--alone-default -->
```yaml
- checkbox "Accept the terms"
- text: Accept the terms
```
<!-- /aria -->

<!-- aria:checkbox-group--alone-checked -->
```yaml
- checkbox "Accept the terms" [checked]
- text: Accept the terms
```
<!-- /aria -->

<!-- aria:checkbox-group--alone-indeterminate-story -->
```yaml
- checkbox "Select all" [checked=mixed]
- text: Select all
```
<!-- /aria -->

## Tested with

<!-- tested-with:checkbox-group -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
