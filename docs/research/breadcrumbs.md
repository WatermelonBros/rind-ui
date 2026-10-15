# Breadcrumbs — research

Status: done · Wave: 2

Two libraries ship it (React Aria Components, Kobalte); Radix declined it
([RX#2050](https://github.com/radix-ui/primitives/issues/2050), closed "not planned") and Base
UI points users at `nav > ol > li > a` ([BU#2852](https://github.com/mui/base-ui/issues/2852),
open). The component is small; its hard parts are the **current item** (focus, AT reachability,
`aria-current` value), **separators** that must not be read, **collapsing** middle items into a
menu, and composing items that are not links (Reado's path segments are menu buttons). Link
behaviour (anchor first, disabled, routing, modifier clicks) is decided in [link.md](link.md)
and reused through add-link's `link-navigation`.

Sources read (scratchpad clones, HEAD of 2026-10-14):

| Library | Files |
|---|---|
| React Aria | `packages/react-aria/src/breadcrumbs/{useBreadcrumbs,useBreadcrumbItem}.ts`, `intl/breadcrumbs/*.json`, `react-aria-components/src/Breadcrumbs.tsx`, `@react-spectrum/s2/src/Breadcrumbs.tsx` (collapsing) |
| Kobalte | `packages/core/src/breadcrumbs/{breadcrumbs-root,breadcrumbs-link,breadcrumbs-separator,breadcrumbs.intl}.tsx` |
| Reado | `src/components/molecules/Breadcrumb.tsx` (read-only; migrates) |
| rind-ui specs | add-link (this wave), add-menu, add-separator, add-collections (static item parts), add-a11y-foundations (messages) |

## Pattern

- WAI-ARIA APG: [Breadcrumb](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/) —
  a `nav` landmark labelled "Breadcrumb" (`aria-label` or `aria-labelledby`), an ordered list
  of links, `aria-current="page"` on the link to the current page, separators added with CSS
  so screen readers do not read them.
- Roles: `navigation` (from `<nav>`), `list`/`listitem` (from `<ol>/<li>`), `link`.
- Keyboard: none beyond Tab; no arrow-key composite. RA and Kobalte have none; Chakra's arrow
  keys were raised and not adopted in RX#2050's discussion. A breadcrumb trail is a set of
  ordinary links, and a single Tab stop would hide them from users who Tab through links.

## How the others built it

### React Aria (useBreadcrumbs, RAC Breadcrumbs, S2)

- Hooks: `useBreadcrumbs` gives `aria-label` (default localised "Breadcrumbs", 34 locales);
  `useBreadcrumbItem` wraps `useLink` with `isDisabled: isDisabled || isCurrent`,
  `aria-current` = the consumer's value or `"page"`; a heading `elementType` gets no link
  props; the current item gets `tabIndex=-1` only with `autoFocus`.
- RAC: `<Breadcrumbs>` renders **`<ol>`** (not `<nav>`; the label goes on the list) as a
  collection; `<Breadcrumb>` renders `<li>` and provides `LinkContext` with
  `aria-current="page"` and `isDisabled` for the **last** item (`node.nextKey == null`) —
  automatic, not configurable; `onAction(key)` when a crumb is pressed. `data-current`,
  `data-disabled` on the `li`.
- S2 collapsing: renders every item in a hidden measuring list; a ResizeObserver plus
  `document.fonts.ready` recompute how many trailing items fit; keeps the first item, puts
  the rest of the hidden range in a `Menu` behind an icon button labelled from intl
  ("More items"), max 4 visible. Separators (chevrons) are `aria-hidden` icons inside each
  `li`. The current item is rendered as text (`div`), not a link.
- Problems: see Bug history — focus lost when a crumb becomes current, TalkBack skipping the
  current item, the automatic current/disabled last item, unlabelled overflow button.

### Kobalte (Breadcrumbs)

- `Breadcrumbs.Root` renders `<nav aria-label={translations.breadcrumbs}>` and holds a
  `separator` default (`"/"`) in context; the consumer writes `<ol>/<li>` themselves.
  `Breadcrumbs.Link` = `Link.Root` with `disabled || current`, `aria-current` = value or
  `"page"`, `data-current`; `Breadcrumbs.Separator` = `<span aria-hidden="true">` whose content
  defaults to the root's `separator`.
- Notable: explicit `current` (no automatic last item); separator glyph hidden from AT.
- Problems: separator children ignored ([KB#566](https://github.com/kobaltedev/kobalte/issues/566),
  fixed); SSR crash in its i18n formatter ([KB#248](https://github.com/kobaltedev/kobalte/issues/248));
  an upgrade is open ([KB#663](https://github.com/kobaltedev/kobalte/issues/663), depends on
  the Link upgrade KB#662).

### Reado (consumer)

`Breadcrumb.tsx` renders `<nav aria-label>`, back/forward icon buttons, then one **menu
trigger per path segment** (a folder lists its siblings, the file lists its symbols), chevron
icons between segments, and toolbar buttons at the end. No `<ol>`, no links, no
`aria-current`. Migration needs: items whose control is a Menu trigger (not a link); the
current item (the file) also a menu trigger; other controls inside the `nav` but outside the
list. Those requirements shape the parts below.

## Accessibility

- **Landmark name**: `nav` named from `messages.label` ("Breadcrumbs"), overridable by
  `aria-label`/`aria-labelledby`. A page with several navs needs distinct names (landmark
  rule; axe `landmark-unique`).
- **List**: `<ol>` so AT announces "list, 4 items" and positions. Separators must not be list
  items (they would inflate the count) and must not be read: either CSS (`li + li::before`,
  with an empty alt `content: "/" / ""` so speech skips it) or an element inside the `li` with
  `aria-hidden="true"`. add-separator's `separatorProps` is **not** used: its decorative
  output is `role="none"`, which still exposes a text glyph ("slash") to AT.
- **Current item**: `aria-current="page"` by default; `"location"` for a path that is not a
  page (Reado's file path), `"step"` belongs to a step list ([RA#6561](https://github.com/adobe/react-spectrum/issues/6561)
  — Steps is a separate component). APG keeps the current item a link; RA and S2 make it a
  disabled link or text. Either way it must stay **reachable**: TalkBack skips a
  non-focusable `role="link"` ([RA#3998](https://github.com/adobe/react-spectrum/issues/3998)),
  and an element that loses `href`/`tabIndex` while focused drops focus to `<body>`
  ([RA#2592](https://github.com/adobe/react-spectrum/issues/2592),
  [RA#5294](https://github.com/adobe/react-spectrum/issues/5294)).
- **Collapsed items**: the trigger needs a real name — "…" is not read by NVDA
  ([RA#3967](https://github.com/adobe/react-spectrum/issues/3967)); the collapsed items must be
  reachable through the menu (add-menu link items), not removed.
- **Forced colors**: links get `LinkText`; the current item must be distinguishable without
  colour (theme: weight + `aria-current` selector). Target size: crumbs are standalone links,
  so the theme gives them 24 px min height.
- **RTL**: the trail reads right to left; chevron separators mirror (theme `[dir=rtl]`).
- **Text selection**: the current item's text must stay selectable ([RA#5549](https://github.com/adobe/react-spectrum/issues/5549),
  usePress left `user-select: none` behind) — we put no press handling on non-link crumbs.

## Bug history

All breadcrumb issues of react-spectrum (40 hits for "breadcrumbs"/"breadcrumb", 14 relevant,
all read) and kobalte (4); none exist in radix, base-ui, ark/zag, reka, bits, ariakit,
headlessui beyond feature requests (searched "breadcrumb" in each). Link-level bugs are in
[link.md](link.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#2592](https://github.com/adobe/react-spectrum/issues/2592) open | Focus lost to `<body>` when the activated crumb becomes current | Current crumb becomes disabled: `tabIndex` removed while focused | Open (PRs #2594, #2709 unmerged) | A current item without `href` keeps `tabindex="-1"`; focus never drops (scenario) |
| RA | [#5294](https://github.com/adobe/react-spectrum/issues/5294) open | Focus ring stays on a crumb after focus moved on | Same: no `blur` when focusability is removed | Open, dup of #2592 | `data-focus-visible` cleared because focus is kept/blurred normally (scenario) |
| RA | [#3998](https://github.com/adobe/react-spectrum/issues/3998) open | TalkBack swipe skips the current page item | Non-focusable `role=link` skipped (Android bug 267670776) | Workaround `tabindex=-1` | Current item is text (no `role=link`) or a link; a disabled link gets `tabindex=-1` via link-navigation (scenario) |
| RA | [#6561](https://github.com/adobe/react-spectrum/issues/6561) closed | Last item always forced current + disabled | Automatic `nextKey == null` rule | Pointed to StepList | `current` explicit, last item only by default; `aria-current` value configurable (scenario) |
| RA | [#10571](https://github.com/adobe/react-spectrum/issues/10571) closed | Every link in a Menu inside the last crumb is disabled | `LinkContext` (disabled) leaks into the menu's links | Won't fix ("last item is never a menu") | Item state is not pushed into arbitrary descendants; only the Item's own Link part reads it (scenario) |
| RA | [#10572](https://github.com/adobe/react-spectrum/issues/10572) closed | `aria-current` not accepted through `LinkContext` | Type gap | Fixed | Typed `current` input (spec) |
| RA | [#3967](https://github.com/adobe/react-spectrum/issues/3967) closed | Overflow button "…" read as nothing by NVDA | Punctuation as `aria-label` | Fixed in S2 (intl "More items") | Ellipsis label from `messages`, with the count (scenario) |
| RA | [#5664](https://github.com/adobe/react-spectrum/issues/5664) closed | `aria-current` only automatic in Breadcrumbs | — | `render` + NavLink | `aria-current` scoped to sets; Breadcrumbs sets it (spec) |
| RA | [#5549](https://github.com/adobe/react-spectrum/issues/5549) closed | Current crumb text cannot be selected | usePress `user-select: none` not restored | Fixed | No press handling on non-link current items (scenario) |
| RA | [#2958](https://github.com/adobe/react-spectrum/issues/2958) closed | Wanted focus on the current crumb after the trail updates | Folder navigation in a dialog/popover | `autoFocusCurrent` added | No auto-focus prop: the current item stays focusable (`tabindex=-1`), the app focuses it (docs) |
| RA | [#1961](https://github.com/adobe/react-spectrum/issues/1961) closed | Focus lost when crumbs in a popover replace content | Focused element unmounted | Docs-specific fix | Items keyed by collection key so a re-rendered trail keeps DOM nodes (spec) |
| RA | [#2923](https://github.com/adobe/react-spectrum/issues/2923) closed | Crash with a single item and `showRoot` | Collapse code assumed ≥ 2 items | Fixed | Collapse never applies with fewer than `itemsBefore + itemsAfter + 2` items (scenario) |
| RA | [#7790](https://github.com/adobe/react-spectrum/issues/7790) closed | Error when Breadcrumbs are rendered inside a ComboBox's ListBox | Interactive content inside a combobox popup (unsupported) | Closed: use Autocomplete | Breadcrumbs is a landmark, never content of another widget's popup; development warning when nested in a `listbox`/`menu` (design) |
| Kobalte | [#566](https://github.com/kobaltedev/kobalte/issues/566) closed | Separator children ignored | Default glyph overrode children | Fixed (#616) | Separator content is only children; no hidden default glyph (spec) |
| Kobalte | [#248](https://github.com/kobaltedev/kobalte/issues/248) closed | SSR crash from the i18n formatter | ICU formatter import in SSR | Fixed | Messages are plain strings/functions (add-a11y-foundations) |
| Radix | [#2050](https://github.com/radix-ui/primitives/issues/2050) closed | Breadcrumbs requested; arrow keys debated | — | Not planned | No arrow keys; Tab through links (decision) |
| Base UI | [#2852](https://github.com/mui/base-ui/issues/2852) open | Breadcrumb requested | — | Maintainers: `nav > ol > li > a` | The structure is the component; behaviour is current/collapse/separators |

## Known pitfalls

- Separators as list items (count inflated) or as text read aloud.
- Current item that loses focusability while focused (focus to `<body>`), or that AT cannot
  reach (TalkBack).
- Automatic "last item is current" without an escape hatch.
- Collapsing that hides a single item behind a menu (a menu for one link is worse than the
  link), or crashes on short trails.
- Width-based collapsing needs a hidden measuring copy of every item (S2): duplicate links in
  the DOM, a ResizeObserver, font loading — and the visible set changes while the user tabs.

## Testing notes

- Stateless: no machine, no `testMachine`; driver tests plus axe per story.
- Contract: locate by `navigation` role + name; queries `items()` (visible crumb names in
  order), `current()` (name and `aria-current` value of the current element), `collapsedCount()`,
  `href(name)`; actions `follow(name)` (delegates to the Link part), `openCollapsed()` and
  `followCollapsed(name)` (through `getMenu` on the ellipsis trigger).
- Invariants: separators are `aria-hidden` and not list items; exactly one element with
  `aria-current` (unless the consumer opted out); the list's item count equals the visible
  crumbs + the ellipsis.

## Decisions

- **Parts**: `Root` (`<nav>`), `List` (`<ol>`), `Item` (`<li>`), `Link` (built with
  `linkProps`), `Separator` (`<span aria-hidden>` inside an Item), `Ellipsis` (`<li>` that hosts
  the consumer's Menu; render state gives the collapsed items and the trigger label). Items
  are add-collections static item parts (key, `textValue`, `href`), so collapsing can list the
  hidden ones.
- **Machine**: none. Which items are collapsed and which is current is derived in connect
  from the collection and props.
- **Current**: `Item current` (boolean). If no item sets it, the last item is current unless
  it sets `current={false}`. `currentValue` on Root (`"page"` default, `"location"`,
  `"true"`). The current Item's Link gets `aria-current`; without `href` it renders `<span>`
  with `aria-current` and `tabindex="-1"` (no `role="link"`, no press handling); with `href`
  it stays a link (APG).
- **Collapse**: `maxItems` (none by default), `itemsBeforeCollapse` (1), `itemsAfterCollapse`
  (1); collapse only when at least two items would be hidden. Hidden Items stay mounted with
  `hidden` (keys and DOM nodes stable). Width-based automatic collapse: Non-goal.
- **Non-link items**: an Item may contain any control (a Menu trigger); its render state
  exposes `{ current, currentValue }` so the control can carry `aria-current` (Reado recipe).
- **`data-*`**: Root `data-collapsed`; Item `data-current`, `data-disabled`, `data-collapsed`;
  Link: link-navigation's attributes with scope `breadcrumbs`; Ellipsis `data-count`.
- **Messages**: `label` ("Breadcrumbs"), `showCollapsed(count)` ("Show 3 more breadcrumbs").
- **Deliberately different**: `<nav>` + `<ol>` both (RA labels the list only); explicit
  current with a last-item default and opt-out (RA forces it, Kobalte requires it); the
  current item never loses focus or AT reachability; count-based collapse into the
  consumer's Menu instead of a measuring copy.

## Open questions

- Width-based collapsing (S2) as a later additive option (`collapse="auto"`), reusing a
  shared overflow-measuring module if Toolbar or Tabs overflow ever needs one.
- Should the theme draw separators with CSS (`li + li::before`) by default, so consumers
  without a Separator part still get an unread glyph?
