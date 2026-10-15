# Autosize

A textarea that takes the height of its content, used by Text Field's `autosize` and later by Prompt Input and Editable. Native first, measured only where the browser cannot do it.

- **Native**: where `CSS.supports("field-sizing", "content")`, the textarea gets
  `field-sizing: content`, and `rows` becomes a minimum block size. No code measures
  anything.
- **Fallback** (older browsers): the height is measured after every value commit
  (including controlled and programmatic values and form resets), when the width changes
  and when fonts load, and written in the **next animation frame** (so a resize never
  causes another in the same frame: no "ResizeObserver loop" error). Fractional borders are
  measured exactly. It never touches `value`, the selection, the undo stack or events, and
  stops everything on unmount.

Bounds: the minimum is `rows` (an empty textarea keeps it); the maximum is your
`max-block-size`, after which it scrolls. Vertical resizing by the user is turned off while
autosize is on.

```css
[data-scope="text-field"][data-part="textarea"] {
  max-block-size: 12lh;
}
```

The core module is `autosize(textarea, env)` in `@rind-ui/core` (returns `measure()` and
`dispose()`), for components that render their own textarea.
