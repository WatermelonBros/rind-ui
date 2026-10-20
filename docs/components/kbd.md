# Kbd

A keyboard shortcut, shown the way the user's platform writes it and said right to a screen reader. `keys="mod+shift+p"` renders ⌘⇧P on Apple and Ctrl+Shift+P elsewhere; every glyph is hidden from assistive technology next to its spoken name, so it reads "Command plus Shift plus P", never "place of interest sign". The same keys give the control its `aria-keyshortcuts`.

## When to use

- **Use it for** shortcut hints in menus, buttons, tooltips, command palettes and help pages.
- **Over a styled `<kbd>`**:
  - platform-resolved keys (`mod` is ⌘ or Ctrl, no ⌘ on Windows as in some kits);
  - glyphs named for screen readers (an `abbr` title is not read);
  - sequences ("G then I");
  - `aria-keyshortcuts` from the same keys, so the control announces its shortcut;
  - left-to-right in RTL text.
- **Don't use it for** code (`<code>`) or for key names in running prose that need no styling.

```tsx
import { Button, Kbd, useKeyShortcuts } from "@rind-ui/react"

function SearchButton() {
  const shortcut = useKeyShortcuts("mod+k")
  return (
    <Button aria-keyshortcuts={shortcut}>
      Search <Kbd.Root keys="mod+k" />
    </Button>
  )
}
```

## API

<!-- api:kbd -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Kbd.Root` | `root` | `<kbd dir="ltr">`; the keys and separators, or your children as written. |
| (rendered) | `key` | `<kbd>` per key: the glyph (`aria-hidden` when it is not its name) and a visually hidden name. |
| (rendered) | `separator` | "+" between keys (nothing on Apple), "then" between chords; spoken "plus" / "then". |

## Keys

| Written | Apple | Elsewhere | Spoken |
|---|---|---|---|
| `mod` | ⌘ | Ctrl | Command / Control |
| `shift`, `alt`, `ctrl` | ⇧ ⌥ ⌃ | Shift, Alt, Ctrl | Shift, Option / Alt, Control |
| `enter`, `escape`, `backspace`, `delete`, `tab` | ↩ ⎋ ⌫ ⌦ ⇥ | Enter, Esc, Backspace, Del, Tab | their names |
| `up`, `down`, `left`, `right` | ↑ ↓ ← → | ↑ ↓ ← → | Up Arrow, … |
| `"g i"` | G then I | G then I | G then I |

Aliases: `cmd`, `command`, `win`, `option`, `control`, `return`, `esc`, `del`, `arrowup`, …. Other keys show as written (a single letter upper-cased). `useKeyShortcuts(keys)` (React) and `keyShortcuts(keys, apple)` (core) return the `aria-keyshortcuts` value ("Control+K"); a sequence has none.

## Accessibility notes

- **Names, not glyphs**: each glyph is `aria-hidden` beside its visually hidden name (`messages.keyName`); words like "between keys" are `messages.chord` ("plus") and `messages.sequence` ("then").
- **No name of its own**: a `kbd` is generic; what it says becomes part of the name of the control around it ("Search Command plus K").
- **`aria-keyshortcuts`** on the control lets assistive technology announce the shortcut from the control itself.
- **Platform**: from the environment after hydration; the server renders the non-Apple form, so the HTML matches. `platform` overrides it.

## Testing

```tsx
import { getKbd } from "@rind-ui/testing"

const kbd = getKbd(container)
expect(await kbd.keys()).toEqual(["meta", "k"])
expect(await kbd.platform()).toBe("apple")
expect(screen.getByRole("button", { name: "Search Command plus K" })).toBeTruthy()
```

Queries: `keys`, `platform`.

## Tested with

<!-- tested-with:kbd -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
