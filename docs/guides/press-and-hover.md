# Press, hover and long press

`usePress` (React) / `createPress` (core) turn pointer, mouse, keyboard and screen-reader
input into one stream of machine events, so a part activates the same way however it is
used: `PRESS.START`, `PRESS.UP`, `PRESS.END`, `PRESS`, `PRESS.CANCEL`, plus `LONG_PRESS`
and `CONTEXT_MENU` when enabled.

```tsx
const press = usePress({ env, send, disabled: () => props.disabled === true })
<button {...press.props} />
```

## Rules it follows

- Activation is bound to `click` for pointers, so a screen reader's bare click (no
  pointer before it) activates exactly once; a keyboard press activates on Enter keydown
  or Space keyup depending on the element, like native buttons.
- Control+click on macOS is a context-menu request (`CONTEXT_MENU`), not a press.
- Touch releases pointer capture, so dragging off the part cancels; `touch-action`
  is set for parts carrying `data-rind-pressable` (injected once, CSP `nonce` supported).
- Hover never comes from touch, including the emulated mouse events iOS fires after a tap.
- Long press is opt-in (`longPress: { threshold }`, default 500 ms). The part must also
  render a localised hint (`longPressMessages.longPressHint`) referenced through
  `aria-describedby` (`describedByHint`), so the gesture is discoverable without sight.

## Data attributes

| Attribute | When |
|---|---|
| `data-pressed` | a press is in progress |
| `data-hover` | a mouse or pen is over the part (never touch) |
| `data-focus`, `data-focus-visible` | see [focus and modality](focus-and-modality.md) |
| `data-disabled` | the part is disabled |
| `data-rind-pressable` | the element uses press handling (theme: hit area, touch-action) |
