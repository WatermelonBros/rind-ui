# Keyboard, composition and right-to-left

Components read keys as **logical keys** — `NEXT`, `PREV`, `FIRST`, `LAST`,
`PAGE_NEXT`, `PAGE_PREV`, `EXPAND`, `COLLAPSE`, `INCREASE`, `DECREASE`, `ACTIVATE`,
`DISMISS`, `CONTEXT_MENU` — so direction, orientation and platform are handled once.

```ts
const key = toLogicalKey(describeKey(event, env), { dir, orientation: "horizontal", platform })
```

- **Right-to-left**: ArrowLeft is `NEXT` in a horizontal RTL composite. Direction comes
  from the locale (`isRTL`, `directionOf`) or an explicit `dir`.
- **Orientation**: in a vertical list, Left/Right expand and collapse instead of moving.
- **Value controls** (`value: true`): arrows increase and decrease whatever the direction.
- **Platform**: `isMod` is ⌘ on Apple platforms and Control elsewhere; hotkeys use
  `Mod+K` notation (`parseHotkey`, `registerHotkey`).
- **IME composition**: keys pressed while composing (`isComposing`, keyCode 229, and the
  Enter Safari sends right after committing — quirk `safari-ime-commit-enter`) are never
  commands. Machines guard with `notComposing`.
- **Typeahead** resets after 1000 ms by default (`DEFAULT_TYPEAHEAD_TIMEOUT`), long enough
  for screen-reader and motor-impaired users; set it per component or with
  `RindProvider typeaheadTimeout`.
