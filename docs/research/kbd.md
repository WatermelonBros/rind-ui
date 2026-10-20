# Kbd — research

Shows a keyboard shortcut ("⌘K", "Ctrl+Shift+P", "G then I") the way the user's platform
writes it, and says it right to a screen reader. There is no behaviour to manage, so the hard
parts are three:

- **naming**: symbols like ⌘ ⌥ ⇧ are read as "place of interest sign", "option key" or
  skipped altogether;
- **platform**: a "mod" key is ⌘ on Apple and Ctrl elsewhere, decided without a hydration
  mismatch;
- **linking**: the same shortcut belongs in `aria-keyshortcuts` on the control it triggers.

Sources read (October 2026): React Aria Components `Keyboard.tsx`; HeroUI
`packages/react/src/components/kbd/` (`kbd.tsx`, `kbd.constants.ts`); shadcn/ui
`registry/bases/*/ui/kbd.tsx`; Chakra, Mantine (`Kbd`); the trackers of React Spectrum,
HeroUI, Mantine, shadcn and Chakra; MDN `<kbd>` and `aria-keyshortcuts`.

## Pattern

No APG pattern. HTML: `<kbd>` is "user input"; a key combination is a `<kbd>` that holds one
`<kbd>` per key (the HTML spec's nesting example). `<kbd>` has no ARIA role (generic), so
`aria-label` on it is not reliably exposed (naming is prohibited on generic). The spoken text
must therefore be **text content**: a visually hidden name next to an `aria-hidden` symbol.

`aria-keyshortcuts` (on the control the shortcut activates) takes the
`Modifier+Key` syntax, with `Control`, `Alt`, `Shift` and `Meta` (the Command key) and
spaces between alternatives.

## How the others built it

### React Aria Components (`Keyboard`)

- `<kbd dir="ltr">` with props from context (a Menu item's shortcut slot). No key model, no
  symbols, no platform logic. `dir="ltr"` keeps "Ctrl+K" from flipping in RTL text.
- React Spectrum #6478 (open): `aria-keyshortcuts` cannot be set on RAC Button; the shortcut
  shown by `Keyboard` and the attribute are not linked.

### HeroUI (`Kbd`, `Kbd.Abbr`, `Kbd.Content`)

- `keyValue` maps to a symbol (`kbdKeysMap`) inside `<abbr title="Command">`.
- `abbr title` is not read by most screen readers (title is a fallback, rarely announced).
  The symbol is what is read.
- Platform bugs in the maps: `win` renders ⌘ and `alt` renders ⌥ everywhere; `ctrl` is ⌃
  (the Mac glyph) on Windows.

### shadcn/ui (`Kbd`, `KbdGroup`)

- Styled `<kbd>`; `KbdGroup` wraps several. `pointer-events-none`. No naming, no platform.

### Chakra, Mantine (`Kbd`)

- A styled `<kbd>`; the consumer writes the text.

### Not shipped

Radix, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt, Bits, Zag / Ark.

## Accessibility

- **Symbols need names**: ⌘ ("place of interest sign" in VoiceOver, nothing in NVDA by
  default), ⌥ ⇧ ⌃ ⏎ ⌫ ⎋ arrows. Render the glyph `aria-hidden` and a visually hidden word
  ("Command", "Shift"); letters and words ("K", "Ctrl", "Esc") need no extra name.
- **Combination vs sequence**: "Ctrl+K" (together) and "G then I" (one after the other)
  must be told apart in the spoken text, not only by spacing.
- **Not interactive**: no focus, no role; the shortcut it shows works elsewhere.
- **`aria-keyshortcuts`** on the control is what makes the shortcut discoverable from the
  control itself (React Spectrum #6478): the same key list should produce both.
- **Direction**: shortcuts read left to right in RTL text (`dir="ltr"`, React Aria).
- **Contrast**: key caps are often muted; the text inside must still meet 4.5:1.

## Platform

- Apple (macOS, iOS, iPadOS): ⌘ ⌥ ⇧ ⌃ glyphs, no separator ("⌘⇧P").
- Others: words joined by "+" ("Ctrl+Shift+P").
- `mod` resolves to Meta on Apple and Control elsewhere (the shortcut libraries' convention).
- Detection: our `detectPlatform` (`core/dom/platform.ts`) through the environment. On the
  server the platform is unknown: render the non-Apple form and switch after hydration,
  or take a `platform` prop / provider value when the server knows it (user agent).

## Bug history (the patterns)

- Glyphs read as nonsense or skipped (the reason HeroUI wraps them in `abbr`, which does not
  fix it).
- Wrong glyph for the platform (HeroUI `win` → ⌘, `alt` → ⌥).
- Shortcut shown but not exposed on the control (React Spectrum #6478).
- RTL flipping of "Ctrl+K" (React Aria's `dir="ltr"`).

## Decisions

1. **A key model, not free text**: `keys` is a list of key names (`"mod"`, `"shift"`, `"k"`,
   `"enter"`, …) or a string (`"mod+shift+p"`, `"g i"` for a sequence). Free children stay
   possible for anything else.
2. **Platform-resolved rendering**: Apple glyphs without separators, others words with "+";
   `platform` from the environment, overridable per component.
3. **Spoken text is text content**: each glyph `aria-hidden` with a visually hidden name; the
   whole reads "Command Shift P" (`messages`), sequences "G then I".
4. **Parts**: `Root` (outer `<kbd dir="ltr">`), `Key` (inner `<kbd>` per key, `data-key`),
   `Separator` (`aria-hidden` "+" or the sequence word, hidden from the spoken text which says
   "then" itself).
5. **`keyShortcuts(keys, platform)`** in core returns the `aria-keyshortcuts` value for the
   control ("Meta+Shift+P"), from the same key list.
6. **No machine**: stateless (like Separator); connect plus the platform from the
   environment.

## Open questions

- Localised key names (German "Strg" for Ctrl) come from `messages`; the default is English.
