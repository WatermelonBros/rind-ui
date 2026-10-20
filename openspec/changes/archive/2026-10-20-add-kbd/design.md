## Context

See [kbd.md](../../../docs/research/kbd.md).

## Decisions

### 1. Key model (`kbd.keys.ts`, pure)

- `parseKeys(input)`:
  - `"mod+shift+p"` becomes `[["mod", "shift", "p"]]` (one chord);
  - `"g i"` becomes `[["g"], ["i"]]` (a sequence of chords);
  - an array of strings is one chord.
- Key names are case-insensitive. Known names: `mod`, `meta` / `cmd` / `command`, `ctrl` /
  `control`, `alt` / `option`, `shift`, `enter` / `return`, `escape` / `esc`, `tab`,
  `space`, `backspace`, `delete`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`,
  `pagedown`, `capslock`, `fn`. Anything else is shown as written, upper-cased when it is a
  single letter.
- `resolveKey(key, apple)` returns `{ id, glyph, label }`:
  - `mod` becomes `meta` on Apple and `ctrl` elsewhere;
  - Apple glyphs: ⌘ ⌥ ⇧ ⌃ ↩ ⎋ ⇥ ⌫ ⌦ ↑ ↓ ← → ⇪;
  - non-Apple text: "Ctrl", "Alt", "Shift", "Win" / "Meta", "Enter", "Esc", "Tab",
    "Backspace", "Del"; arrows keep their glyph everywhere.
- `keyShortcuts(input, apple)` returns the `aria-keyshortcuts` value: chords joined with
  "+", using `Meta`, `Control`, `Alt` and `Shift`, then the key. A sequence has no
  `aria-keyshortcuts` form, so the function returns `undefined` for it.

### 2. Connect

`kbdConnect({ instance, chords, apple, messages, locale })` describes the parts.
- `root`: `<kbd dir="ltr">` with `data-platform="apple" | "other"`.
- `key(i, j)` per key:
  - `data-key`;
  - `glyph`, the visible text: `aria-hidden` when it differs from the spoken name;
  - `label`, the visually hidden name, present only when it differs.
- `separator`: `aria-hidden`, with `data-kind="chord" | "sequence"`. On Apple a chord has no
  visible separator; elsewhere it is "+". A sequence shows `messages.then` ("then") and
  speaks it in hidden text.
- `spoken`: the whole text, for the docs and the contract.

### 3. Platform

`apple` comes from `env.platform.apple`, with the environment's flags detected after
hydration. A `platform: "apple" | "other"` prop overrides it. On the server (no
environment) the default is `"other"`. The React part reads the environment's platform with
`useSyncExternalStore`, whose server snapshot is `"other"`, so hydration matches and the
glyphs switch on the client.

### 4. React

- `Kbd.Root` takes `keys`, `platform` and `messages`. Without children it renders the keys
  with separators. With children it renders a plain `<kbd>` holding them, for free text.
- Keys and separators are rendered by the Root (no separate components: a custom layout
  writes its own children).

### 5. Contract

Located by text, or as the only `kbd` in the target. No actions. Queries:
- `keys`: the `data-key` list;
- `platform`.

A `kbd` is generic and has no name of its own: what it says is tested through the name of the
control holding it (a button "Save Control plus S").

### 6. Theme

`kbd.css`, family `decoration`:
- key caps: border, bottom border thicker, radius, monospace small text, padding;
- the outer `<kbd>` is inline-flex with a small gap and no cap of its own;
- forced colours.
