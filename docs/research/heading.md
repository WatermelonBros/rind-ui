# Heading — research

Status: done · Wave: 2

A heading whose level comes from where it is, not from a number the author has to keep
in sync: a section inside a section gets `h3` without anyone counting. Screen-reader
users navigate pages by headings (the H key, the rotor, the headings list) and by level
(1–6 keys); a skipped or repeated level misplaces content in that outline. The same
logic serves every rind-ui part that is a heading — Dialog and Popover titles, Accordion
headers — and the consumer's own card titles.

Sources: shallow clones read 2026-10-14: Ariakit
`packages/ariakit-react-components/src/heading/{heading,heading-level,heading-context}.tsx`
and `dialog/dialog.tsx`; React Aria Components `src/Heading.tsx` and its users
(`Dialog.tsx`, `Calendar.tsx`) via `git show`. Bug history: `gh search issues` (`heading`,
`heading level`, `Heading`, `HeadingLevel`) over the ten trackers in [README.md](README.md)
plus Chakra UI; ~150 hits (mostly unrelated "header" matches), 12 read in full.

## Pattern

- WAI-ARIA APG: **none** for a heading component; the APG examples use native `h2`/`h3`
  for dialog titles and accordion headers. HTML: `h1`–`h6` (implicit role `heading`,
  level from the tag). ARIA: `role="heading"` with `aria-level` (required) on any other
  element. The HTML "outline algorithm" (`<section>` resets `h1`) was never implemented
  by browsers or AT and was removed from the spec (2022), so nesting must be computed
  by the author — or by a component.
- Keyboard: none; headings are not focusable.
- WCAG: 1.3.1 (structure is programmatic), 2.4.6 (headings describe topics), 2.4.10
  (section headings, AAA). No rule forbids skipped levels, but skipping misleads level
  navigation; axe `heading-order` (best practice) and `empty-heading` apply.
- AT: `aria-level` above 6 is allowed by ARIA but poorly supported (some AT clamp, some
  read it, `h7` does not exist in HTML); every library clamps to 6.

## How the others built it

### Ariakit

- `HeadingLevel` (provider, renders nothing): `nextLevel = clamp(level ||
  contextLevel + 1, 1, 6)`. Outside any provider the context is `0`, so the first
  `HeadingLevel` is level 1.
- `Heading`: `level = useContext(HeadingContext) || 1`; renders `h{level}`; when the
  rendered tag (from `useTagName`) is not `h1`–`h6` (substituted with `render`), adds
  `role="heading"` and `aria-level`.
- `DialogHeading` / `PopoverHeading` / `HovercardHeading` / `MenuHeading` /
  `SelectHeading` / `ComboboxHeading` all reuse `useHeading` and register their id for
  `aria-labelledby`.
- **`Dialog` wraps its content in `<HeadingLevel level={modal ? 1 : undefined}>`**: a
  modal dialog restarts at `h1` (it is the whole accessible document while open, the
  rest is inert); a non-modal one continues the surrounding level + 1. React context
  follows portals, so the level comes from the dialog's place in the component tree,
  not from the portal's DOM position.

### React Aria Components

- `Heading` with `level` (default **3**; `h${level}`), consumed through a slot context
  (`HeadingContext`) so containers can preset it: `Dialog` passes `level: 2` to its title
  slot; `Calendar` renders an `aria-hidden` level-2 heading for the visible month.
- No automatic nesting: each container picks a fixed level. Spectrum v3 had Dialog
  headings at `h3` until [RS#2632](https://github.com/adobe/react-spectrum/issues/2632)
  ("should use H2 … assuming the page has an H1"); docs once claimed the default was 1
  while it rendered `h3` ([RS#1348](https://github.com/adobe/react-spectrum/issues/1348)).
- `level` is semantics, not size: [RS#7671](https://github.com/adobe/react-spectrum/issues/7671)
  (`DisclosureTitle level` did not change the size — by design, "Do not use heading
  elements to resize text"); [RS#5077](https://github.com/adobe/react-spectrum/issues/5077)
  asked to override `aria-level` independently of the tag for responsive layouts —
  closed "working as intended": pick the level for the outline, style the size
  separately.

### Others

- Radix: no Heading; titles are fixed `h2` (Dialog) and Accordion `Header` is `h3`;
  [RX#1590](https://github.com/radix-ui/primitives/issues/1590): users wanted
  `Primitive.h1`…`h6` for their own Heading — internal-only, "use `asChild`".
- Base UI: Accordion header defaults to `h3`; [BU#1678](https://github.com/mui/base-ui/issues/1678)
  (closed, not planned): the hero demo jumps from `h1` to `h3`; proposal to default to
  `div` rejected — "it's impossible to pick a default heading level that will satisfy
  everybody, but a heading element with the incorrect level … is easy to spot", and
  `render` to fix it is a burden. Automatic levels remove that burden.
- Chakra UI: [CH#4396](https://github.com/chakra-ui/chakra-ui/issues/4396) asked for
  Tenon UI's `LevelBoundary` ("nest LevelBoundaries … and the level will be just
  right") — declined, "publish it as a separate package".
- Kobalte, Reka, Bits, Zag/Ark, Headless UI: no Heading.

### In rind-ui already

- `add-dialog`: Title `h2`. `add-popover`: Title `h2`. `add-accordion`: Header `h3`
  default, `headingLevel` 2–6, `role="heading"` + `aria-level` when substituted with a
  non-heading. `add-alert-dialog`, `add-drawer`, `add-hover-card`: titles follow Dialog /
  Popover. Each change specifies its own fixed default; none reads a context.

### Reado

Headings are hand-written `h1`–`h3` per view (`Settings.tsx`, `Welcome.tsx`,
`ExtensionPage.tsx`, dialogs such as `TextDialog.tsx`, `PromptDialog.tsx`). No outline logic. Migration is opportunistic: page sections that nest
(`Settings` groups) become `Heading.Level` + `Heading`.

## Accessibility

Applying [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md):

- **Native first.** The part renders `h1`–`h6`; `role="heading"` + `aria-level` only
  when the consumer substitutes a non-heading element (rule 4: no repeated implicit
  role). Substituting a *different* native heading (`render={<h4 />}` where the level is
  2) keeps the computed level with `aria-level="2"` — the outline is what the component
  promises; the tag is the consumer's styling hook.
- **Level from context.** `level` prop (explicit) > the nearest `Heading.Level` >
  the root default. Root default **2**: rind-ui assumes the page owns its `h1`
  (RS#2632's reasoning; and a stray `h1` per widget is the worse failure). A
  `Heading.Level` without `level` is one deeper than its parent; with `level` it sets
  the level for its subtree (an app shell can anchor `level={1}` for the page title).
- **Clamped to 1–6**, with a development warning when the computed level exceeds 6
  (outline too deep) or an explicit level is out of range.
- **Empty heading** (no text content and no name) is a development warning (axe
  `empty-heading`).
- **Portals**: the level follows the component tree (React context), so a popover's
  title continues its trigger's outline. **Modal dialogs**: Ariakit restarts at `h1`; we
  keep the APG/RS#2632 convention — title `h2`, content headings `h3` — because AT users
  in a modal still navigate by level and a page `h1` stays outside but present in the
  history; a request to Dialog-family changes specifies Content as a `Heading.Level` one
  deeper than the title.
- **Size is not level** (RS#7671, RS#5077): the theme sizes headings from `data-level`
  by default and a consumer overrides the size with CSS; changing the look never needs
  a different level.
- **Double reading**: a dialog's title referenced by `aria-labelledby` *and* read in
  content is a known NVDA case (RX#3377, AT note §1.4); the Heading itself adds no
  relations — the hosting component owns ids and `aria-labelledby`.
- **Forced colors / motion / RTL**: not applicable (text).
- **Native platform**: `h1`–`h6`; nothing to polyfill. `hgroup` (subtitle grouping) is
  consumer markup.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Spectrum | [#2632](https://github.com/adobe/react-spectrum/issues/2632) | Dialog headings `h3`; should be `h2` | Fixed slot default 3 | Fixed: Dialog title level 2 | Dialog-family titles `h2`, content one deeper |
| React Spectrum | [#1348](https://github.com/adobe/react-spectrum/issues/1348) | Docs say default level 1, renders `h3` | Undocumented default | Fixed (docs) | The default is part of the API facts (generated docs) |
| React Spectrum | [#5077](https://github.com/adobe/react-spectrum/issues/5077) | Wants `aria-level` different from the tag for responsive sizes | Level used for size | Closed, not planned | Level = outline; size = CSS (`data-level` hook, overridable) |
| React Spectrum | [#7671](https://github.com/adobe/react-spectrum/issues/7671) | `level` on `DisclosureTitle` does not change its size | Level is semantics | By design | Same |
| Base UI | [#1678](https://github.com/mui/base-ui/issues/1678) | Accordion `h3` default skips `h2` in the docs demo | Fixed default level | Closed, not planned ("no default satisfies everybody") | Context-derived level removes the guess |
| Radix | [#1590](https://github.com/radix-ui/primitives/issues/1590) | No `h1`–`h6` primitives for a custom Heading | Internal primitive set | `asChild` | Ship Heading; `render` keeps level semantics |
| Chakra UI | [#4396](https://github.com/chakra-ui/chakra-ui/issues/4396) | Request: Tenon-style `LevelBoundary` | — | Declined | Ship `Heading.Level` (Ariakit's model) |
| Radix | [#3377](https://github.com/radix-ui/primitives/issues/3377) | NVDA reads the dialog heading (and the autofocused checkbox) twice on open | Dialog name from the Title, then NVDA re-reads the focus context including the heading | Closed | Heading adds no relations; hosts own `aria-labelledby` |
| Ariakit | `dialog.tsx` (source) | Modal dialog restarts heading levels at 1 | Design choice | — | Considered; rejected for APG `h2` convention (see Accessibility) |
| Ariakit | `heading-level.tsx` (source) | Silent clamp at 6 | — | — | Clamp + development warning |
| React Aria | `Calendar.tsx` (source) | `aria-hidden` level-2 heading for the visible range | Visual heading duplicated for AT elsewhere | — | `aria-hidden` passes through; a hidden heading still takes a level (consumer's choice) |

## Known pitfalls

- Fixed defaults (`h2`, `h3`) that are wrong for half the pages (BU#1678, RS#2632).
- Level used to size text (RS#7671).
- `role="heading"` without `aria-level` (defaults to 2 in ARIA, often unexpected).
- `role="heading"` repeated on a native `h2` (rule 4).
- Portalled content measured by DOM position instead of component position.
- Levels deeper than 6.

## Testing notes

- Pure function of props and context: unit tests over explicit/context/default ×
  tag (`h2`, `h4`, `div`) × clamping; React tests for nesting, portals and SSR (same
  tag on server and client).
- ARIA snapshot of a three-level nested story; axe `heading-order` / `empty-heading`.
- Driver: `getHeading(screen, { name })` (role `heading` + exact name) → `level()`.

## Decisions

- **Parts**: `Heading` (`h{level}`); `Heading.Level` (context only, renders no element;
  `level?: 1–6`). Core: `headingProps({ level, tag }, log)` and `resolveHeadingLevel(explicit,
  context)`; React: `useHeadingLevel()` for other parts and consumer components.
- **No machine**: stateless, connect-only (Separator precedent).
- **`data-*`**: `data-scope="heading"`, `data-part="root"`, `data-level="1"…"6"`;
  consumer `data-size`/`data-tone` passed through (no family: typography only).
- **Contract**: locate by role `heading` + exact name; query `level()`; no actions; no
  traits.
- **Shared**: other parts that are headings (Dialog/Alert Dialog/Drawer/Popover/Hover
  Card titles, Accordion headers) compute their attributes with `headingProps` and read
  the context — requested from those changes.
- **Deliberately different**: root default 2 (Ariakit 1, RAC 3); modal dialogs do not
  restart at 1 (Ariakit); a substituted native heading of another level keeps the
  computed level via `aria-level`; clamp warns.

## Open questions

- Should Dialog-family titles default to the context level (`h{ctx}`) instead of a
  fixed `h2` when opened from deep inside a page? Kept at `h2` (APG); revisit if
  device testing shows level navigation in modals benefits.
