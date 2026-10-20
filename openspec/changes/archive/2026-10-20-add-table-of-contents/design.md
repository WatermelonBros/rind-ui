## Context

See [table-of-contents.md](../../../docs/research/table-of-contents.md).

## Decisions

### 1. Reading position (`core/dom/reading-position.ts`, DOM)

- `collectHeadings(root, selector = "h2, h3")` returns `{ id, label, depth }` for each
  heading that has an id. `depth` is the heading level relative to the shallowest one found.
- `readingPosition({ ids, scrollRoot?, offset, ratio, onChange })` keeps one listener on
  `scroll` and `resize`, coalesced to one measurement per frame. It reports
  `{ current, visible }` only when one of them changes.
  - `current` is the last heading whose top is above the line
    `rootTop + offset + ratio × (rootHeight − offset)`.
  - Within 2 px of the end of the scroll range, `current` is instead the last heading whose
    top is inside the root.
  - Before the first heading, `current` is the first.
  - `visible` holds the ids whose section, from its heading to the next one, intersects the
    root.
  - Missing or hidden (`display: none`) targets are skipped.
- `onUserScroll` reports a wheel, a touch or a scrolling key, which ends a link's hold.
- No scrolling helper: a followed link is native fragment navigation, which honours
  `scroll-behavior` and `scroll-margin-top` and scrolls a container as well as the window.

### 2. Machine

States:
- `tracking`: the reading position drives `current`;
- `navigating`: after a click, `current` is the target, and position reports are recorded
  but not followed until the scroll settles (no new report for 150 ms: each report re-enters
  the state, restarting the `after` delay) or the user scrolls by wheel, touch or key.

Controllable `value` (the current id). Context: `visible`.

Events:
- `POSITION { current, visible }`;
- `NAVIGATE { id }`;
- `USER.SCROLL`;
- `VALUE.SYNCED`.

### 3. Connect

Parts `root`, `title`, `list`, `item`, `link`, `indicator`. Every part carries
`data-scope`, `data-part` and `data-instance`.
- Root: a `<nav>` named by the Title, or by `messages.label` ("On this page").
- List: `ol`.
- Item: `data-depth`, `data-current`, `data-visible`.
- Link: `href="#id"`, `aria-current="location"` when current, `data-current`,
  `data-visible`, `data-depth`.
- Indicator: `aria-hidden`. It sets `--rind-toc-indicator-top` and `-height`, measured from
  the current link by the List.

Ids come from the instance, so no two parts share one (zag#3378).

### 4. React

- `TableOfContents.Root` takes `items` (from `collectHeadings` or the consumer), `scrollRoot`,
  `offset`, `ratio`, `value`, `defaultValue` and `onValueChange`. It runs `readingPosition`
  after mount.
- `Link` clicks:
  - a modified or middle click stays native;
  - otherwise the browser follows the anchor, and the click sends `NAVIGATE`;
  - with keyboard or virtual modality, focus moves to the heading after the jump (with
    `tabindex="-1"` when it is not focusable), without scrolling.
- The List keeps the current item in view within its own scroller (`nearest`), never
  scrolling the page.

### 5. Contract

Located by the nav's name. Action: `follow(label)`, a link activation. Queries: `current`,
`visible`, `focusedHeading`. Scrolling is not a contract action (no environment primitive
scrolls a page): the DOM tests scroll the root directly.

### 6. Theme

`table-of-contents.css`, family `decoration`:
- a vertical rail with an indicator;
- nested items indented by `data-depth`;
- the current link in the accent text colour and weight;
- visible links in the text colour, the rest muted;
- forced colours.
