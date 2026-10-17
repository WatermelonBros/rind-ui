# Radio Group

One choice out of several. The Root is a `role="radiogroup"` named by its Label; each Item has a real `<button role="radio">` control and a hidden native `<input type="radio">` that carries the value, validation and reset ([hidden-form-input](../guides/hidden-form-input.md)). Arrow keys move focus **and** check, as the native radio group does.

```tsx
import { RadioGroup } from "@rind-ui/react"

<RadioGroup.Root name="size" defaultValue="medium" onValueChange={(size) => save(size)}>
  <RadioGroup.Label>Size</RadioGroup.Label>
  <RadioGroup.Description>Pick one.</RadioGroup.Description>
  {["small", "medium", "large"].map((value) => (
    <RadioGroup.Item key={value} value={value}>
      <RadioGroup.ItemControl>
        <RadioGroup.ItemIndicator />
      </RadioGroup.ItemControl>
      <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
    </RadioGroup.Item>
  ))}
  <RadioGroup.ErrorMessage>Choose a size to continue.</RadioGroup.ErrorMessage>
</RadioGroup.Root>
```

## API

<!-- api:radio-group -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `RadioGroup.Root` | `root` | `<div role="radiogroup">`; `data-orientation`. |
| `RadioGroup.Label` | `label` | `<span>` naming the group (a radiogroup is not labelable, so not a `<label>`). |
| `RadioGroup.Description` | `description` | `<p>`; in the group's `aria-describedby`. |
| `RadioGroup.ErrorMessage` | `error-message` | `<p>`; rendered only while the group is invalid. |
| `RadioGroup.Item` | `item` | `<div>`; holds the hidden input as its last child. |
| `RadioGroup.ItemControl` | `item-control` | `<button role="radio">` (or what `render` gives it); put the Indicator inside. |
| `RadioGroup.ItemIndicator` | `item-indicator` | `<span aria-hidden>`; mounted only while its item is checked. |
| `RadioGroup.ItemLabel` | `item-label` | `<label for>`; part of the click target ([control-label](../guides/control-label.md)). |
| `RadioGroup.ItemDescription` | `item-description` | `<p>`; in the control's `aria-describedby`. |

`data-state` is `checked` or `unchecked` on the item parts; `data-disabled`, `data-readonly` and `data-invalid` mirror the state, `data-required` and `data-orientation` are on the Root. The control also carries `data-highlighted` while it is the roving focus target and the button-like `data-focus`, `data-focus-visible`, `data-pressed` and `data-hover`.

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | The group is one tab stop: the checked radio, else the first enabled one. |
| Arrow Down / Right | Moves to the next enabled radio and checks it; wraps from the last to the first. |
| Arrow Up / Left | Moves to the previous enabled radio and checks it; wraps. |
| Space | Checks the focused radio (a no-op if it already is). |
| Enter | Does not check; inside a form it submits it (implicit submission). |

Every arrow moves whatever the `orientation` (it only sets `aria-orientation` and `data-orientation`), as a native radio group does; in RTL, Left and Right swap. Disabled radios are skipped. With `focusableWhenDisabled` a disabled group stays one tab stop and ignores keys.

## Why focus never checks

Focusing a radio by a script, a dialog returning focus or the screen-reader cursor does not check it (radix#938): only an arrow, a press or Space does. The tab stop follows the checked radio, so Tab back into the group lands on the choice, and an arrow from a focused radio checks the next one. `driver.focusRadio(name)` shows the difference from `check(name)`.

## Form participation

`name` on the Root is shared by every item's input (default: derived from the Root id, so two groups never form one browser group, ariakit#3833) and submitted once with the checked item's `value`. `form` associates the group with a form elsewhere. A form reset restores `defaultValue` once for the whole group; a disabled item is omitted by the browser. The hidden input is a sibling of the control, never inside it (reka-ui#1597). See [hidden-form-input](../guides/hidden-form-input.md).

## Read-only, required and invalid

- **`readOnly`**: radios stay focusable, arrows and presses change nothing; `aria-readonly="true"` on the Root.
- **`required`**: the form is invalid until one radio is checked (the browser's own message); `aria-required="true"`.
- **`invalid`**: `aria-invalid="true"` and `data-invalid`; the ErrorMessage mounts and joins the group's `aria-describedby`.

Assistive-technology limits: VoiceOver and TalkBack do not announce `aria-readonly` or `aria-invalid` on a `radiogroup` (react-aria#2580, #2581). The attributes are still exposed, and the description carries the message, so put the reason in a Description or ErrorMessage instead of relying on the state announcement.

## Accessibility notes

- **Group name.** `aria-labelledby` points at the Label while one is rendered, else give the Root an `aria-label`; a development warning logs a nameless group.
- **Item names.** A labelable control is named by `<label for>`; one rendered as a `<div>` is named by `aria-labelledby`.
- **Checked cue.** The dot is a `currentColor` circle, so the state does not rely on colour alone; under forced colors the ring is `ButtonText`, the dot `Highlight` and disabled `GrayText`.
- **Field.** Inside a [Field](field.md) the group registers as one control (the items keep their ids, base-ui#4121); the Field's Label, Description and ErrorMessage replace the group's own.

## Radio Group, Segmented Control or Toggle Group

- **Radio Group**: a form value, one choice, visible indicator per option; arrows check. Use it for settings and forms.
- **Segmented Control**: the same single choice drawn as a joined strip of buttons, usually to switch a view. Prefer it over a Radio Group only when the options are short and the look is the point.
- **Toggle Group**: a set of independent or single-or-multiple pressed toggle buttons (a toolbar of formatting buttons); it is not a form control and keys do not select.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/radio-group.css`: structural only (a vertical stack or, for `data-orientation="horizontal"`, a wrapping row; a ring as the control's border and a `currentColor` circle as the dot; the Label as part of a hit area of `--rind-hit-area`; forced-colors mapping; tier-3 `--rind-radio-group-*` tokens). The focus ring comes from `base.css`.

## Testing

Contract actions: `check(name)` (pointer and touch press the radio; keyboard focuses the group and arrows until it is checked), `focusRadio(name)`, `arrowNext()`, `leave()` (focuses a button named "After"). Queries: `radios`, `checked`, `focusedRadio`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `formValue`.

```tsx
import { getRadioGroup } from "@rind-ui/testing"

render(<SizePicker />)
const group = getRadioGroup(screen, { name: "Size" })
await group.check("Medium")
expect(await group.checked()).toBe("Medium")
expect(await group.formValue()).toEqual([["size", "medium"]])
await group.via("keyboard").check("Large")
await group.focusRadio("Small")
expect(await group.checked()).toBe("Large") // focus alone never checks
```

The same test runs with a Playwright `page`.

## Accessibility tree

Default, read-only and required with an error (generated from the stories; read-only and required are not exposed by every browser's tree):

<!-- aria:radio-group--default -->
```yaml
- radiogroup "Size":
  - text: Size
  - radio "Small"
  - text: Small
  - radio "Medium" [checked]
  - text: Medium
  - radio "Large"
  - text: Large
- button "After"
```
<!-- /aria -->

<!-- aria:radio-group--read-only -->
```yaml
- radiogroup "Size":
  - text: Size
  - radio "Small"
  - text: Small
  - radio "Medium" [checked]
  - text: Medium
  - radio "Large"
  - text: Large
- button "After"
```
<!-- /aria -->

<!-- aria:radio-group--required-invalid -->
```yaml
- radiogroup "Size" [invalid]:
  - text: Size
  - paragraph: Pick one.
  - radio "Small"
  - text: Small
  - radio "Medium"
  - text: Medium
  - radio "Large"
  - text: Large
  - paragraph: Choose a size to continue.
- button "After"
```
<!-- /aria -->

## Tested with

<!-- tested-with:radio-group -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
