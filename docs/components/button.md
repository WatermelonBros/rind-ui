# Button

A button that reports each activation once, from every input (mouse, touch, Enter, Space, a screen reader's click), with its modality; a pending state that keeps focus and announces itself; and the same behaviour whatever element it renders.

```tsx
import { Button } from "@rind-ui/react"

<Button onPress={({ modality }) => save()}>Save</Button>
```

## API

<!-- api:button -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Button` | `root` | `<button>` | A native `<button type="button">` by default. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | Never submits a form by accident; rendered as `button` while pending. |
| `disabled` | `boolean` | `false` | Native `disabled` on a `<button>`, `aria-disabled` elsewhere. |
| `focusableWhenDisabled` | `boolean` | `false` | Disabled but still in the Tab order (`aria-disabled`). |
| `pending` | `boolean` | `false` | Ignores activation and keeps focus (`aria-disabled`, never `disabled`); announces `messages.pending` when focused. |
| `onPress` | `(details: ButtonPressDetails) => void` | — | Once per activation, with `modality` and the modifier keys. |
| `onPressStart` | `(details: ButtonPressDetails) => void` | — | A press starts. |
| `onPressEnd` | `(details: ButtonPressDetails) => void` | — | A press ends, also when cancelled or released outside. |
| `messages` | `{ pending?: string }` | — | Overrides; default `pending: "Loading"`. |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element: `<a href>` stays a link and routes like a Link; anything else gets `role="button"` and `tabIndex`. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "button" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-state` | "idle" or "pending". |
| `root` | `data-pending` | While pending. |
| `root` | `data-disabled` | While disabled (also by a disabled `<fieldset>`) or pending. |
| `root` | `data-focus` | While focused. |
| `root` | `data-focus-visible` | While focused by keyboard or assistive technology. |
| `root` | `data-pressed` | While a press is in progress. |
| `root` | `data-hover` | While a mouse or pen is over it. |

### Keyboard

| Key | Action |
|---|---|
| Enter | Activates it (follows the link when rendered as `<a href>`). |
| Space | Activates it on release (not when rendered as a link). |
| Tab / Shift + Tab | Next / previous tabbable element; a disabled Button is skipped unless `focusableWhenDisabled`. |

### States

| State | Description |
|---|---|
| `idle` | Ready: presses call `onPress`. |
| `pending` | The `pending` prop is set: presses are ignored and focus stays. |

### Contract

| Action | Modalities |
|---|---|
| `press` | pointer, keyboard, touch, virtual |
| `pressWithSpace` | keyboard |

Queries: `isDisabled`, `isPending`, `isFocused`, `isFocusVisible`. Traits: none.
<!-- /api -->

## Use `onPress`, not `onClick`

`onPress` is called exactly once per activation, on release, with the `modality` (`pointer`,
`touch`, `keyboard`, `virtual`) and the modifier keys. A press released outside the button
calls `onPressStart` and `onPressEnd` but not `onPress`. Your `onClick` still receives the
native `click`, but it also fires for clicks that are not activations (a disabled
`focusableWhenDisabled` button, for one), so prefer `onPress`.

## Element rules (every button-like part)

These rules are shared by Button, Toggle, the Switch and Checkbox controls and every
trigger, through `buttonLikeProps` in `@rind-ui/core`:

- **Native by default**: a `<button type="button">`, so it never submits a form by
  accident. Only Button lets you pick `type="submit"` or `"reset"`.
- **`render={<a href>}`** stays a link: no `role="button"`, Enter only, and it routes like a
  [Link](link.md) (client routing, modifier clicks left to the browser).
- **Any other element** (`render={<div />}`) gets `role="button"` and `tabindex="0"`, and
  Enter, Space, a click and a bare `click` each activate it once.
- **Disabled**: the native `disabled` attribute on a `<button>`, `aria-disabled` and
  `tabindex="-1"` elsewhere. With `focusableWhenDisabled` it stays in the Tab order with
  `aria-disabled`. A disabled link loses its `href`. Nothing activates a disabled part,
  whatever handlers you add, and no inline `pointer-events` style is used.
- **Fieldsets**: inside a disabled `<fieldset>` (any ancestor, with HTML's first-`<legend>`
  exception) the part is disabled too, and follows the fieldset when it changes.

## Pending

```tsx
function SaveButton() {
  const [pending, setPending] = useState(false)
  return (
    <Button pending={pending} onPress={async () => { setPending(true); await save(); setPending(false) }}>
      {pending ? "Saving…" : "Save"}
    </Button>
  )
}
```

A pending Button ignores every activation but keeps focus (it is `aria-disabled`, never
`disabled`, which would drop focus), still gets hover (tooltips keep working), and a
`type="submit"` Button is rendered as `type="button"` so the form is not submitted twice.
(A form with a single text field still submits on Enter without any submit button, as
HTML specifies; guard your `onSubmit` with the pending flag there.)
When it becomes pending while focused, it announces `messages.pending` ("Loading") once,
politely. Localise it per instance (`messages={{ pending: "Caricamento" }}`) or for a tree
(`<RindProvider messages={{ button: { pending: "Caricamento" } }}>`).

With React's form actions, read the pending state from `useFormStatus` in a component
inside the form:

```tsx
import { useFormStatus } from "react-dom"

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" pending={pending}>Save</Button>
}
```

## Styling

Style it through the data attributes above, or import `@rind-ui/theme/button.css` (family
`action`: `data-variant` solid, soft, outline, ghost; `data-size` sm, md, lg; see
[component stylesheets](../theme/component-stylesheets.md)).

## Testing

```tsx
import { getButton } from "@rind-ui/testing"

const onPress = vi.fn()
render(<Button onPress={onPress}>Save</Button>)
await getButton(screen, { name: "Save" }).press()
await getButton(screen, { name: "Save" }).via("keyboard").pressWithSpace()
expect(onPress).toHaveBeenCalledTimes(2)
```

The same test runs with a Playwright `page`. A Button rendered as a link is located with
`{ name, role: "link" }`.

## Accessibility tree

Idle and pending (generated from the state stories):

<!-- aria:components-button--default -->
```yaml
- button "Save"
```
<!-- /aria -->

<!-- aria:components-button--pending-state -->
```yaml
- button "Saving…" [disabled]
```
<!-- /aria -->

## Tested with

<!-- tested-with:button -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
