# Focus and input modality

Every focusable part carries `data-focus` while focused and `data-focus-visible` only when
the focus came from the keyboard or from assistive technology, so a theme draws the focus
ring for keyboard and screen-reader users and never after a mouse click.

## How it works

One tracker per window listens (capture phase) to keyboard, pointer and focus events and
reports the last input as a `Modality`: `keyboard`, `pointer`, `touch` or `virtual`.
`virtual` is a screen reader's or switch control's synthetic click: a `click` with no
pointer before it, or the platform-specific signatures recorded as quirks
(`ios-vo-zero-size-pointer`, `chromium-at-click-1x1`). Text inputs always show the ring,
like the browser's own `:focus-visible`.

```tsx
const env = useEnvironment()
const [focused, setFocused] = useState(false)
const modality = useModality(env.modality, focused)
// focusAttrs gives data-focus / data-focus-visible
<button {...focusAttrs(focused, modality)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
```

Machines receive the modality on every press (`event.modality`) and guard with
`isKeyboard`, `isVirtual` or `isKeyboardOrVirtual` — e.g. a menu focuses its first item
when opened from the keyboard or a screen reader, not from a click.

To move focus programmatically without showing a ring after a click, use
`focusSafely(element, env, cause)`.

## Styling

```css
[data-focus-visible] { outline: 2px solid var(--rind-focus-color); outline-offset: 2px; }
```

`@rind-ui/theme` does this, keeps the ring under forced colors and turns the browser's own
ring off on parts that are not `data-focus-visible`.
