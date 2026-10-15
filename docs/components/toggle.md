# Toggle

A two-state button: it is on or off, and says so with `aria-pressed`. Use it for a setting that applies immediately (Bold, Mute, Pin).

```tsx
import { Toggle } from "@rind-ui/react"

<Toggle.Root defaultPressed onPressedChange={(pressed) => save(pressed)}>
  Bold
</Toggle.Root>
```

## API

<!-- api:toggle -->

## Keyboard

Both Enter and Space toggle it, as for every button (a checkbox only answers to Space). Disabled, it does nothing; with `focusableWhenDisabled` it stays in the Tab order.

## The label must not change

The accessible name stays the same in both states; `aria-pressed` conveys the state (APG Button). A toggle labelled "Mute" that becomes "Unmute" is announced as "Unmute, pressed", which reads as the opposite. In development a name that changes with the state logs a warning. For an icon-only toggle, swap the icon, not the name:

```tsx
<Toggle.Root aria-label="Mute">
  <Toggle.Indicator fallback={<SpeakerIcon />}>
    <SpeakerOffIcon />
  </Toggle.Indicator>
</Toggle.Root>
```

The Indicator is `aria-hidden` and renders its children while on, `fallback` while off.

## Toggle, Switch or Checkbox

- **Toggle**: a button whose pressed state changes something now (formatting, mute). Enter and Space.
- **Switch**: an on/off setting, like a light switch, read as "on"/"off"; Space.
- **Checkbox**: a choice that is submitted with a form or selected among others; Space.

If it would be submitted with a form, it is not a Toggle.

## Coming from Base UI

Base UI's `data-pressed` means "on". Here `data-state` is `on` or `off`, and `data-pressed` is a press in progress (as on every button), so map `[data-pressed]` styles to `[data-state="on"]`.

## Styling

Style it through the data attributes above, or import `@rind-ui/theme/toggle.css`: structural only. On is an inner outline plus a background token, so it never relies on colour alone; forced colors map on to `Highlight` and disabled to `GrayText`. The target is at least 24 by 24 px.

## Testing

```tsx
import { getToggle } from "@rind-ui/testing"

render(<Toggle.Root>Bold</Toggle.Root>)
const bold = getToggle(screen, { name: "Bold" })
await bold.setPressed(true)
await bold.isPressed() // true
await bold.via("keyboard").activateWithEnter(false)
```

The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:toggle -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
