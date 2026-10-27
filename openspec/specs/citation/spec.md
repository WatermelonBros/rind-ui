# citation Specification

## Purpose
TBD - created by archiving change add-citation. Update Purpose after archive.
## Requirements
### Requirement: Citation Marker

A Citation's Trigger SHALL be an `<a href>` when its source has an http or https URL, else a
`<button type="button">`; it SHALL never be a non-focusable element once the source is known.
Its accessible name SHALL be `messages.name(index, title)` and SHALL contain the visible index.

#### Scenario: A real link (regression: AI Elements span)

- **WHEN** a Citation with index 1 and a source `{ title: "Example", url: "https://example.com" }`
  is rendered
- **THEN** a link named "Source 1: Example" points at `https://example.com`

#### Scenario: Unsafe URL

- **WHEN** the source URL is `javascript:alert(1)`
- **THEN** the marker is a button and no link is rendered

### Requirement: Citation Card

Hovering or focusing the marker SHALL open a non-modal card (Hover Card's behaviour and
delays) showing the source's title, domain and snippet; Tab from the marker SHALL reach the
card's link; Escape SHALL close it. Nothing SHALL be announced.

#### Scenario: Keyboard

- **WHEN** the marker is focused with Tab, and Tab is pressed again
- **THEN** the card is open and the focus is on its link

### Requirement: Citation Pinned

A press on a button marker SHALL toggle `pinned`; a pinned card SHALL stay open without hover
until the marker is pressed again, Escape is pressed or the pointer presses outside. A link
marker SHALL follow its link and SHALL never be pinned.

#### Scenario: Touch (regression: Base UI#4778)

- **WHEN** a button marker is tapped
- **THEN** the card opens and stays open after the finger lifts

### Requirement: Citation Pending

Without a source, the marker SHALL render as plain text with `data-state="pending"`, not
focusable; when the source arrives it SHALL become the link or button in place.

#### Scenario: Late source

- **WHEN** a citation renders before its source and the source arrives
- **THEN** the same position holds a focusable marker named with the source's title

### Requirement: Citation Helpers

`safeHref` SHALL return the URL only for the allowed schemes (http and https by default) and
never throw; `domainOf` SHALL return the hostname without `www.`; `splitByCitations` SHALL
return text and citation segments in order from character ranges, dropping overlapping and
out-of-range ones.

#### Scenario: Split

- **WHEN** `splitByCitations("Paris is big.", [{ start: 0, end: 5, index: 1 }])` runs
- **THEN** it returns `[{ kind: "cite", text: "Paris", index: 1 }, { kind: "text", text: " is big." }]`

### Requirement: Citation Data Attributes

The Trigger SHALL carry `data-scope="citation"`, `data-part`, `data-instance`, `data-state`
(`closed`, `open`, `pinned`, `pending`), `data-kind` and `data-pinned` when pinned; `Source`
SHALL carry `data-index`.

#### Scenario: Pinned

- **WHEN** a button marker is pressed
- **THEN** it has `data-state="pinned"` and `data-pinned`

### Requirement: Citation Messages

The strings SHALL come from `messages`: `name(index, title)` and `pending(index)`, with English
defaults.

#### Scenario: Localised name

- **WHEN** `messages.name` returns "Fonte 1: Esempio"
- **THEN** the marker is named "Fonte 1: Esempio"

### Requirement: Citation Contract

The contract SHALL locate the marker by name, else the first, and provide the actions `show`,
`pin`, `hide` and the queries `isOpen`, `isPinned`, `kind`, `href`, `sourceTitle`.

#### Scenario: Driver

- **WHEN** a test calls `show()` on a link marker
- **THEN** `isOpen()` is true and `sourceTitle()` is the source's title

### Requirement: Citation Theme

`@rind-ui/theme` SHALL style the marker as a small superscript chip (link family), at least
24 × 24 px of target, and the card as a hover card with a clipped snippet.

#### Scenario: Target size

- **WHEN** a marker is rendered
- **THEN** its target is at least 24 × 24 CSS px

