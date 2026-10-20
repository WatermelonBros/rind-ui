# kbd Specification

## Purpose
TBD - created by archiving change add-kbd. Update Purpose after archive.
## Requirements
### Requirement: Anatomy

A Kbd SHALL be a `<kbd>` (`Root`, `dir="ltr"`) that holds one `<kbd>` (`data-part="key"`)
per key and a separator (`data-part="separator"`) between keys, whose visible text is
`aria-hidden`. With children instead of `keys`, it SHALL render the children in the Root. The
Root SHALL accept the `render` prop.

#### Scenario: Nested keys

- **WHEN** `<Kbd.Root keys="ctrl+k" />` is rendered on a non-Apple platform
- **THEN** a `kbd` holds two `kbd` elements, "Ctrl" and "K", with a "+" between them

### Requirement: Key Model

`keys` SHALL accept a chord string (`"mod+shift+p"`), a sequence separated by spaces
(`"g i"`), or an array of key names, case-insensitively. `mod` SHALL be Command on Apple and
Control elsewhere. Unknown names SHALL be shown as written, with a single letter upper-cased.

#### Scenario: mod

- **WHEN** `keys="mod+k"` is rendered on Apple and on Windows
- **THEN** Apple shows "⌘K" and Windows shows "Ctrl+K"

### Requirement: Spoken Text

Every glyph SHALL be `aria-hidden` and paired with a visually hidden name (`messages`), so
the accessible text names every key. A sequence SHALL say "then" between its chords.

#### Scenario: Glyphs are named (HeroUI abbr)

- **WHEN** `keys="mod+shift+p"` is rendered on Apple
- **THEN** the visible text is "⌘⇧P" and the accessible text is "Command plus Shift plus P"

#### Scenario: Sequence

- **WHEN** `keys="g i"` is rendered
- **THEN** the accessible text is "G then I"

### Requirement: Platform

The platform SHALL come from the environment, and a `platform` prop SHALL override it. The
server render SHALL use the non-Apple form, so hydration matches.

#### Scenario: Override

- **WHEN** `platform="apple"` is passed on Windows
- **THEN** the Apple glyphs are shown

### Requirement: Key Shortcuts

`keyShortcuts(keys, apple)` SHALL return the `aria-keyshortcuts` value for a chord
("Meta+Shift+P", "Control+K"), and `undefined` for a sequence.

#### Scenario: Linked to a control (React Spectrum #6478)

- **WHEN** a button takes `aria-keyshortcuts={keyShortcuts("mod+s", apple)}` on Windows
- **THEN** its attribute is "Control+S"

### Requirement: Data Attributes

Parts SHALL carry `data-scope="kbd"`, `data-part` and `data-instance`. The Root SHALL carry
`data-platform`, every Key SHALL carry `data-key`, and every Separator SHALL carry
`data-kind`.

#### Scenario: Key ids

- **WHEN** `keys="mod+k"` is rendered on Apple
- **THEN** the Keys carry `data-key="meta"` and `data-key="k"`

### Requirement: Contract

The Kbd SHALL ship `kbdContract` with the queries `keys` and `platform`, and a `getKbd`
driver. A `kbd` has no accessible name of its own, so the spoken text SHALL be checked through
the name of the control that holds it.

#### Scenario: Driver

- **WHEN** a test reads `keys()` of `keys="mod+k"` on Apple
- **THEN** it is `["meta", "k"]`

### Requirement: Theme

`@rind-ui/theme` SHALL ship `kbd.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`: key caps, no cap on the outer `kbd`, and forced-colours
support.

#### Scenario: Caps

- **WHEN** the theme is loaded
- **THEN** each Key has a border and the Root has none

