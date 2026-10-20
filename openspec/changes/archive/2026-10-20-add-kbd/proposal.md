## Why

Shortcut hints ("⌘K", "Ctrl+Shift+P") appear in menus, command palettes, tooltips and
docs. The libraries that ship a Kbd either style a bare `<kbd>` or map keys to glyphs that
screen readers read as nonsense ("place of interest sign"), with platform mistakes (HeroUI
renders ⌘ for the Windows key). None of them links the shortcut to `aria-keyshortcuts` on
the control (React Spectrum #6478).

Research: [kbd](../../../docs/research/kbd.md)

Depends on: `add-foundations` (environment, platform), `add-theme-system`.

## What Changes

- A public **Kbd** in `@rind-ui/core` (connect, contract, messages, meta, the key model in
  `kbd.keys.ts`) and `@rind-ui/react` (`Kbd.Root`, which renders the keys and separators). No machine.
- Keys as names or a string (`"mod+shift+p"`, `"g i"` for a sequence), resolved for the
  platform:
  - Apple: glyphs without separators;
  - others: words with "+".
- Each glyph `aria-hidden`, with a visually hidden spoken name; sequences spoken with "then".
- `keyShortcuts(keys, platform)` returns the `aria-keyshortcuts` value for the control.
- `getKbd` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `kbd`.
