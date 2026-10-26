## Why

AI answers cite their sources inline ([1], a source chip) and show a preview on hover. The kits
make the marker a non-focusable span under a hover-only trigger (AI Elements), give touch no
path at all (Base UI#4778), build URLs unguarded, and fetch favicons from a third party with the
page's URL. A citation is a link or a button whose preview is a keyboard-reachable hover card.

Research: [citation](../../../docs/research/citation.md) ·
[hover-card](../../../docs/research/hover-card.md)

Depends on: `add-hover-card` (machine, positioning, non-modal tab order), `add-link`,
`add-collapsible` (the sources list recipe), `add-theme-system`.

## What Changes

- A public **Citation** in `@rind-ui/core` and every framework package: parts `Root`, `Trigger`
  (an `<a>` for a safe http(s) URL, else a `<button>`), `Positioner`, `Content`, `Arrow`,
  `Source`, `SourceTitle`, `SourceUrl`, `SourceSnippet`, `SourceLink`, `CitedText`.
- Hover Card's open/close on hover and focus, plus `pinned` (a press on a button marker keeps
  the card open, also on touch); `pending` while the source has not arrived, upgraded in place.
- The marker named "Source 1: title"; nothing announced; no fetching.
- Pure helpers `safeHref`, `domainOf`, `splitByCitations` (character ranges → segments).
- `getCitation` driver, `citation.css`, site example, docs page.

## Capabilities

### New Capabilities

- `citation`: anatomy, marker kind and name, open and pinned, pending sources, helpers, data
  attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Parsing markdown or model text, fetching titles or favicons, PDF page links, citation
  styles, the sources panel layout, deduplication.

## Impact

- New: `packages/core/src/components/citation/`, framework parts, driver, theme file, site
  example and skin, `docs/components/citation.md`.
- Modified: `families.ts` (`citation` in `link`).
