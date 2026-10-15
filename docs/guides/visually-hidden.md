# VisuallyHidden

Content read by assistive technology but not shown — never `display: none` or
`visibility: hidden`, which also hide it from screen readers.

```tsx
<VisuallyHidden>Sort ascending</VisuallyHidden>
<VisuallyHidden focusable render={(p) => <a href="#main" {...p} />}>Skip to content</VisuallyHidden>
```

`focusable` makes it visible while focused (skip links). The element carries
`data-visually-hidden` while hidden. Core exports the same style
(`visuallyHiddenStyle`) and `hiddenInputProps` for native inputs kept in the
accessibility tree behind a custom control.
